import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ARVORE_DE_TRIAGEM,
  enviarTriagemSchema,
  iniciarTriagemSchema,
  validarContraArvore,
  type Classificacao,
  type Sintoma,
} from '@aurea/contratos';
import { prisma } from '../prisma.js';
import { conflito, naoEncontrado, requisicaoInvalida, semPermissao } from '../erros.js';
import { exigirPaciente } from '../autenticacao/plugin.js';
import { classificarSessao, cicloAtualDoPaciente } from '../servicos/triagem.js';
import { avisarEnfermagem, entregarOrientacoes } from '../servicos/orientacao.js';

export async function rotasDeTriagem(app: FastifyInstance) {
  const autenticado = { preHandler: (requisicao: Parameters<typeof app.autenticar>[0]) => app.autenticar(requisicao) };

  /**
   * A árvore vem do servidor para que o aplicativo não tenha uma cópia própria das
   * perguntas. Duas listas de perguntas divergem sozinhas, e divergir aqui significa
   * gravar resposta em campo que o motor não lê.
   */
  app.get('/triagem/arvore', async () => ({ sintomas: ARVORE_DE_TRIAGEM }));

  app.post('/triagem/sessoes', autenticado, async (requisicao, resposta) => {
    const pacienteId = exigirPaciente(requisicao);

    const analise = iniciarTriagemSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Dados inválidos.', analise.error.issues);
    }

    const { chaveDeIdempotencia } = analise.data;

    // Reenvio por rede instável devolve a mesma sessão em vez de criar um segundo
    // check-in do mesmo dia — dois check-ins do mesmo dia estragam a série histórica.
    const existente = await prisma.sessaoDeTriagem.findUnique({
      where: { chaveDeIdempotencia },
    });

    if (existente) {
      if (existente.pacienteId !== pacienteId) {
        throw conflito('Chave de idempotência já usada por outra pessoa.');
      }
      return resposta.send({ sessaoId: existente.id, estado: existente.estado, reaproveitada: true });
    }

    const ciclo = await cicloAtualDoPaciente(pacienteId);

    const sessao = await prisma.sessaoDeTriagem.create({
      data: { pacienteId, cicloId: ciclo?.id ?? null, chaveDeIdempotencia },
    });

    return resposta.status(201).send({ sessaoId: sessao.id, estado: sessao.estado, reaproveitada: false });
  });

  app.post('/triagem/sessoes/:id/respostas', autenticado, async (requisicao, resposta) => {
    const pacienteId = exigirPaciente(requisicao);
    const { id } = z.object({ id: z.string().uuid() }).parse(requisicao.params);

    const analise = enviarTriagemSchema.safeParse({ ...(requisicao.body as object), sessaoId: id });
    if (!analise.success) {
      throw requisicaoInvalida('Respostas inválidas.', analise.error.issues);
    }

    const problemas = validarContraArvore(analise.data);
    if (problemas.length > 0) {
      throw requisicaoInvalida('Respostas incoerentes com o questionário.', problemas);
    }

    const sessao = await prisma.sessaoDeTriagem.findUnique({
      where: { id },
      include: { paciente: { select: { nome: true } } },
    });

    if (!sessao) throw naoEncontrado('Sessão de triagem não encontrada.');
    if (sessao.pacienteId !== pacienteId) throw semPermissao('Esta sessão é de outra pessoa.');

    const agora = new Date();

    /**
     * Gravar a resposta crua, fechar a sessão e classificar acontecem numa transação
     * só, com trava na linha da sessão (`FOR UPDATE`).
     *
     * Antes eram três passos soltos, e a conferência de estado era uma leitura sem
     * trava. Dois envios simultâneos na mesma sessão produziam isto, em 7 de 20
     * tentativas: o primeiro gravava 36,2 °C e criava a classificação VERDE; o segundo
     * apagava a resposta do primeiro, gravava 41 °C, calculava VERMELHO, encontrava a
     * classificação ORIGINAL já existente e — corretamente — não a sobrescrevia.
     * Resultado no banco: 41 °C carimbado como VERDE, com `regrasDisparadas: []`. O
     * aplicativo mostrava VERMELHO e o painel da enfermagem, VERDE. E como a
     * classificação ORIGINAL é imutável e não existe rota de reprocessamento, o dado
     * nascia errado e ficava errado.
     *
     * A trava também fecha o segundo defeito, este determinístico: a conferência antiga
     * só barrava `CONCLUIDA`, então uma sessão já fechada como `ABANDONADA` pela
     * varredura aceitava resposta horas depois. O paciente via VERMELHO, a enfermagem
     * era avisada, e no histórico ficava uma sessão sem cor nenhuma com 41 °C ao lado.
     */
    const classificacao = await prisma.$transaction(async (tx) => {
      const travadas = await tx.$queryRaw<Array<{ estado: string }>>`
        SELECT estado FROM sessoes_de_triagem WHERE id = ${id} FOR UPDATE
      `;

      const travada = travadas[0];
      if (!travada) throw naoEncontrado('Sessão de triagem não encontrada.');

      // Qualquer estado que não seja "em andamento" recusa. Sessão concluída não recebe
      // resposta nova, e sessão abandonada precisa de check-in novo — retomar uma
      // sessão que o sistema já deu como encerrada faz três fontes contarem histórias
      // diferentes sobre o mesmo dia.
      if (travada.estado === 'CONCLUIDA') {
        throw conflito('Este check-in já foi concluído.');
      }
      if (travada.estado !== 'EM_ANDAMENTO') {
        throw conflito(
          'Este check-in foi encerrado porque ficou muito tempo parado. Comece um novo.',
        );
      }

      // Regra 2 — a resposta crua é persistida sempre, antes de qualquer classificação.
      await tx.respostaDeSintoma.deleteMany({ where: { sessaoId: id } });
      await tx.respostaDeSintoma.createMany({
        data: analise.data.sintomas.flatMap((sintoma) =>
          sintoma.respostas.map((r) => ({
            sessaoId: id,
            sintoma: sintoma.sintoma,
            campo: r.campo,
            valorNumerico: r.valorNumerico ?? null,
            valorBooleano: r.valorBooleano ?? null,
            valorTexto: r.valorTexto ?? null,
            respondidaEm: agora,
          })),
        ),
      });

      await tx.sessaoDeTriagem.update({
        where: { id },
        data: { estado: 'CONCLUIDA', concluidaEm: agora },
      });

      return classificarSessao(id, { cliente: tx });
    });

    const porSintoma =
      classificacao.situacao === 'CLASSIFICADA'
        ? ((classificacao.explicacao as { porSintoma: Array<{ sintoma: Sintoma; classificacao: Classificacao }> })
            .porSintoma ?? [])
        : [];

    const orientacoes = await entregarOrientacoes(id, pacienteId, porSintoma);

    const avisados =
      classificacao.resultado && classificacao.resultado !== 'VERDE'
        ? await avisarEnfermagem(sessao.paciente.nome, id, classificacao.resultado)
        : 0;

    return resposta.send({
      sessaoId: id,
      situacao: classificacao.situacao,
      resultado: classificacao.resultado,
      /**
       * O cliente é obrigado a mostrar esta marca quando for falsa. Enquanto o conjunto
       * de limiares não for assinado por alguém com responsabilidade clínica, apresentar
       * a cor como se fosse conduta validada é o pior erro possível deste produto.
       */
      validadoClinicamente: classificacao.validadoClinicamente,
      versaoDoConjunto: classificacao.versaoDoConjunto,
      explicacao: classificacao.explicacao,
      orientacoes,
      enfermagemAvisada: avisados > 0,
    });
  });

  app.get('/triagem/sessoes/:id', autenticado, async (requisicao) => {
    const pacienteId = exigirPaciente(requisicao);
    const { id } = z.object({ id: z.string().uuid() }).parse(requisicao.params);

    const sessao = await prisma.sessaoDeTriagem.findUnique({
      where: { id },
      include: {
        respostas: true,
        classificacoes: {
          orderBy: { calculadaEm: 'desc' },
          include: { conjunto: { select: { versao: true, validadoClinicamente: true } } },
        },
        orientacoesEntregues: { include: { orientacao: true } },
      },
    });

    if (!sessao) throw naoEncontrado('Sessão de triagem não encontrada.');
    if (sessao.pacienteId !== pacienteId) throw semPermissao('Esta sessão é de outra pessoa.');

    return sessao;
  });

  /** Últimos check-ins do próprio paciente. */
  app.get('/triagem/historico', autenticado, async (requisicao) => {
    const pacienteId = exigirPaciente(requisicao);

    return prisma.sessaoDeTriagem.findMany({
      where: { pacienteId },
      orderBy: { iniciadaEm: 'desc' },
      take: 30,
      include: {
        classificacoes: {
          where: { origem: 'ORIGINAL' },
          select: { resultado: true, situacao: true, calculadaEm: true },
        },
      },
    });
  });
}
