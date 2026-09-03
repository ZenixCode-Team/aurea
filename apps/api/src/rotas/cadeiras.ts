import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  calcularGiroDeCadeiras,
  calcularOcupacao,
  encontrarJanelasLivres,
  estratificarRisco,
} from '@aurea/contratos';
import { prisma } from '../prisma.js';
import { naoEncontrado, requisicaoInvalida } from '../erros.js';
import { exigirPermissao, registrarAcesso, usuarioDa } from '../autenticacao/plugin.js';
import { colunaDeDataDoDiaCivil } from '../tempo.js';

/**
 * Giro de cadeiras — capacidade assistencial real.
 *
 * O cálculo mora em `@aurea/contratos`; aqui só se busca o dado e se grava o que a
 * equipe registra. A separação importa porque a pergunta "quando esta cadeira fica
 * livre" precisa de teste, e teste de regra dentro de handler exige subir servidor.
 *
 * ## Expediente
 *
 * 7h às 19h no fuso do serviço. É constante declarada e não configuração porque
 * configuração sem tela que a edite é campo morto — quando o horário do ambulatório
 * precisar variar, isso vira cadastro de unidade, não uma variável de ambiente que
 * ninguém sabe que existe.
 */

const ABERTURA_EM_HORAS = 7;
const FECHAMENTO_EM_HORAS = 19;

function janelaDoDia(referencia: Date): { abertura: Date; fechamento: Date } {
  const diaCivil = colunaDeDataDoDiaCivil(referencia);
  /* A coluna vem em meia-noite UTC; o expediente é local. O deslocamento do fuso do
     serviço entra somando as horas sobre a meia-noite local, não sobre a UTC. */
  const meiaNoiteLocal = new Date(
    diaCivil.getTime() + new Date().getTimezoneOffset() * 60000,
  );
  return {
    abertura: new Date(meiaNoiteLocal.getTime() + ABERTURA_EM_HORAS * 3600000),
    fechamento: new Date(meiaNoiteLocal.getTime() + FECHAMENTO_EM_HORAS * 3600000),
  };
}

export async function rotasDeCadeiras(app: FastifyInstance) {
  const comAcesso = {
    preHandler: [
      (requisicao: Parameters<typeof app.autenticar>[0]) => app.autenticar(requisicao),
      exigirPermissao('ATENDER_PLANTAO'),
    ],
  };

  /**
   * O retrato do ambulatório agora, mais as janelas em que ainda cabe alguém.
   *
   * Uma consulta para cadeiras e uma para as sessões do dia. Não há laço por cadeira:
   * doze consultas para montar um painel que a coordenação recarrega o tempo todo
   * seria o N+1 mais caro do sistema.
   */
  app.get('/painel/cadeiras', comAcesso, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const agora = new Date();
    const { abertura, fechamento } = janelaDoDia(agora);

    const [cadeiras, sessoes] = await Promise.all([
      prisma.cadeira.findMany({ orderBy: { numero: 'asc' } }),
      prisma.sessaoDeInfusao.findMany({
        where: { previsaoDeInicio: { gte: abertura, lte: fechamento } },
        orderBy: { previsaoDeInicio: 'asc' },
        select: {
          id: true,
          estado: true,
          cadeiraId: true,
          previsaoDeInicio: true,
          previsaoDeFim: true,
          inicioReal: true,
          fimReal: true,
          medicacaoLiberadaEm: true,
          paciente: { select: { id: true, nome: true } },
          tratamento: { select: { protocolo: { select: { nome: true } } } },
        },
      }),
    ]);

    const sessoesParaOMotor = sessoes.map((s) => ({
      id: s.id,
      paciente: s.paciente.nome,
      pacienteId: s.paciente.id,
      cadeiraId: s.cadeiraId,
      protocolo: s.tratamento?.protocolo.nome ?? null,
      estado: s.estado,
      previsaoDeInicio: s.previsaoDeInicio.toISOString(),
      previsaoDeFim: s.previsaoDeFim.toISOString(),
      inicioReal: s.inicioReal?.toISOString() ?? null,
      fimReal: s.fimReal?.toISOString() ?? null,
      medicacaoLiberadaEm: s.medicacaoLiberadaEm?.toISOString() ?? null,
    }));

    const giro = calcularGiroDeCadeiras(cadeiras, sessoesParaOMotor, agora);
    const janelas = encontrarJanelasLivres(
      cadeiras,
      sessoesParaOMotor,
      abertura,
      fechamento,
    );

    await registrarAcesso(requisicao, {
      acao: 'LEITURA_DE_PACIENTE',
      usuarioId: usuario.id,
    });

    return {
      giro,
      janelasLivres: janelas,
      /* A linha do tempo por cadeira. É o que desenha a barra de ocupação do dia e o
         que mostra que 08h-10h vira 08h-10h20 quando se conta o que a infusão não
         conta. */
      sessoesDoDia: sessoesParaOMotor,
      expediente: {
        abertura: abertura.toISOString(),
        fechamento: fechamento.toISOString(),
      },
    };
  });

  /**
   * A previsão de ocupação de uma prescrição, antes de agendar.
   *
   * Responde a pergunta do bloco: dado este protocolo e este paciente, quanto tempo a
   * cadeira fica presa. Não grava nada — é simulação, e é o número que a coordenação
   * usa para decidir se o encaixe cabe.
   */
  app.get('/painel/cadeiras/previsao/:pacienteId', comAcesso, async (requisicao) => {
    const { pacienteId } = z
      .object({ pacienteId: z.string().uuid() })
      .parse(requisicao.params);

    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: {
        id: true,
        nome: true,
        ecog: true,
        dataNascimento: true,
        moraSozinho: true,
        dificuldadeDeTransporte: true,
        temCuidador: true,
        contextoSocialAvaliadoEm: true,
        internadoAte: true,
        _count: { select: { comorbidades: true } },
        tratamentos: {
          where: { encerradoEm: null },
          take: 1,
          orderBy: { iniciadoEm: 'desc' },
          select: {
            protocolo: {
              select: {
                nome: true,
                bombaInfusora: true,
                imunoterapia: true,
                altoRiscoDeNeutropenia: true,
                tratamentoOral: true,
                tempoDePreparoEmMinutos: true,
                tempoDePreMedicacaoEmMinutos: true,
                tempoDeInfusaoEmMinutos: true,
                tempoDeObservacaoEmMinutos: true,
              },
            },
          },
        },
      },
    });

    if (!paciente) throw naoEncontrado('Paciente não encontrado.');

    const protocolo = paciente.tratamentos[0]?.protocolo;
    if (!protocolo) {
      throw requisicaoInvalida('Paciente sem tratamento ativo: não há o que prever.');
    }

    /* A complexidade sai da MESMA estratificação que o painel usa. Um segundo cálculo
       de complexidade só para a agenda divergiria do primeiro na primeira mudança de
       peso, e a coordenação teria dois números discordando sobre o mesmo paciente. */
    const risco = estratificarRisco(
      {
        ecog: paciente.ecog,
        dataNascimento: paciente.dataNascimento?.toISOString() ?? null,
        quantidadeDeComorbidades: paciente._count.comorbidades,
        internadoAte: paciente.internadoAte?.toISOString() ?? null,
        protocolo: {
          imunoterapia: protocolo.imunoterapia,
          altoRiscoDeNeutropenia: protocolo.altoRiscoDeNeutropenia,
          bombaInfusora: protocolo.bombaInfusora,
          tratamentoOral: protocolo.tratamentoOral,
        },
        moraSozinho: paciente.moraSozinho,
        dificuldadeDeTransporte: paciente.dificuldadeDeTransporte,
        temCuidador: paciente.temCuidador,
        contextoSocialAvaliadoEm:
          paciente.contextoSocialAvaliadoEm?.toISOString() ?? null,
      },
      new Date(),
    );

    return {
      paciente: { id: paciente.id, nome: paciente.nome },
      protocolo: protocolo.nome,
      complexidade: risco.nivel,
      ocupacao: calcularOcupacao(protocolo, risco.nivel),
    };
  });

  // ---------------------------------------------------------------------------
  // Escrita
  // ---------------------------------------------------------------------------

  app.post('/painel/cadeiras', comAcesso, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const analise = z
      .object({
        numero: z.number().int().min(1).max(999),
        observacao: z.string().trim().min(1).max(180).optional(),
      })
      .safeParse(requisicao.body);

    if (!analise.success) {
      throw requisicaoInvalida('Dados da cadeira inválidos.', analise.error.issues);
    }

    const cadeira = await prisma.cadeira.upsert({
      where: { numero: analise.data.numero },
      update: { ativa: true, observacao: analise.data.observacao ?? null },
      create: {
        numero: analise.data.numero,
        observacao: analise.data.observacao ?? null,
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuario.id,
    });

    return resposta.status(201).send(cadeira);
  });

  /**
   * Agenda a sessão, com a previsão de fim CALCULADA e não informada.
   *
   * Se o cliente pudesse mandar o fim, a agenda voltaria a ser a agenda convencional
   * com outro nome: alguém digitaria "duas horas" e a cadeira ficaria presa por três.
   * A previsão sai dos tempos do protocolo, pelo mesmo motor que a tela mostra.
   */
  app.post('/painel/cadeiras/sessoes', comAcesso, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const analise = z
      .object({
        pacienteId: z.string().uuid(),
        cadeiraId: z.string().uuid().optional(),
        previsaoDeInicio: z.coerce.date(),
        observacao: z.string().trim().min(1).max(255).optional(),
      })
      .safeParse(requisicao.body);

    if (!analise.success) {
      throw requisicaoInvalida('Dados da sessão inválidos.', analise.error.issues);
    }

    const paciente = await prisma.paciente.findUnique({
      where: { id: analise.data.pacienteId },
      select: {
        id: true,
        ecog: true,
        dataNascimento: true,
        moraSozinho: true,
        dificuldadeDeTransporte: true,
        temCuidador: true,
        contextoSocialAvaliadoEm: true,
        internadoAte: true,
        _count: { select: { comorbidades: true } },
        tratamentos: {
          where: { encerradoEm: null },
          take: 1,
          orderBy: { iniciadoEm: 'desc' },
          select: {
            id: true,
            protocolo: {
              select: {
                imunoterapia: true,
                altoRiscoDeNeutropenia: true,
                bombaInfusora: true,
                tratamentoOral: true,
                tempoDePreparoEmMinutos: true,
                tempoDePreMedicacaoEmMinutos: true,
                tempoDeInfusaoEmMinutos: true,
                tempoDeObservacaoEmMinutos: true,
              },
            },
          },
        },
      },
    });

    if (!paciente) throw naoEncontrado('Paciente não encontrado.');
    const tratamento = paciente.tratamentos[0];
    if (!tratamento) {
      throw requisicaoInvalida('Paciente sem tratamento ativo: não há o que agendar.');
    }

    const risco = estratificarRisco(
      {
        ecog: paciente.ecog,
        dataNascimento: paciente.dataNascimento?.toISOString() ?? null,
        quantidadeDeComorbidades: paciente._count.comorbidades,
        internadoAte: paciente.internadoAte?.toISOString() ?? null,
        protocolo: tratamento.protocolo,
        moraSozinho: paciente.moraSozinho,
        dificuldadeDeTransporte: paciente.dificuldadeDeTransporte,
        temCuidador: paciente.temCuidador,
        contextoSocialAvaliadoEm:
          paciente.contextoSocialAvaliadoEm?.toISOString() ?? null,
      },
      new Date(),
    );

    const ocupacao = calcularOcupacao(tratamento.protocolo, risco.nivel);
    const previsaoDeFim = new Date(
      analise.data.previsaoDeInicio.getTime() + ocupacao.total * 60000,
    );

    const sessao = await prisma.sessaoDeInfusao.create({
      data: {
        pacienteId: paciente.id,
        tratamentoId: tratamento.id,
        cadeiraId: analise.data.cadeiraId ?? null,
        previsaoDeInicio: analise.data.previsaoDeInicio,
        previsaoDeFim,
        observacao: analise.data.observacao ?? null,
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: paciente.id,
    });

    return resposta.status(201).send({ ...sessao, ocupacao });
  });

  /**
   * Muda o estado da sessão. É o que faz o painel andar em tempo real.
   *
   * `inicioReal` e `fimReal` são gravados pelo SERVIDOR no momento da transição, nunca
   * enviados pelo cliente: são eles que produzem o atraso operacional, e atraso que o
   * cliente pode escolher não é medição, é opinião.
   */
  app.patch('/painel/cadeiras/sessoes/:id', comAcesso, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = z.object({ id: z.string().uuid() }).parse(requisicao.params);

    const analise = z
      .object({
        estado: z.enum([
          'AGENDADA',
          'AGUARDANDO_MEDICACAO',
          'EM_PREPARO',
          'EM_INFUSAO',
          'EM_OBSERVACAO',
          'CONCLUIDA',
          'CANCELADA',
        ]),
        cadeiraId: z.string().uuid().nullable().optional(),
      })
      .safeParse(requisicao.body);

    if (!analise.success) {
      throw requisicaoInvalida('Estado inválido.', analise.error.issues);
    }

    const sessao = await prisma.sessaoDeInfusao.findUnique({
      where: { id },
      select: { id: true, pacienteId: true, inicioReal: true, fimReal: true },
    });
    if (!sessao) throw naoEncontrado('Sessão não encontrada.');

    const agora = new Date();
    const { estado } = analise.data;

    const atualizada = await prisma.sessaoDeInfusao.update({
      where: { id },
      data: {
        estado,
        ...(analise.data.cadeiraId !== undefined
          ? { cadeiraId: analise.data.cadeiraId }
          : {}),
        /* O relógio começa a contar quando o preparo começa, e não quando a infusão
           começa: é o preparo que prende a cadeira primeiro. */
        ...(estado === 'EM_PREPARO' && !sessao.inicioReal ? { inicioReal: agora } : {}),
        ...(estado === 'EM_INFUSAO' && !sessao.inicioReal ? { inicioReal: agora } : {}),
        ...(estado === 'AGUARDANDO_MEDICACAO' ? { medicacaoLiberadaEm: null } : {}),
        ...(estado === 'EM_INFUSAO' ? { medicacaoLiberadaEm: agora } : {}),
        ...(estado === 'CONCLUIDA' && !sessao.fimReal ? { fimReal: agora } : {}),
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: sessao.pacienteId,
    });

    return atualizada;
  });
}
