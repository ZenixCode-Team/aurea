import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { naoEncontrado, requisicaoInvalida, semPermissao } from '../erros.js';
import { exigirPermissao, registrarAcesso, usuarioDa } from '../autenticacao/plugin.js';

import { calcularDiaDoCiclo, diasDeDiferenca, mesmoDia } from '../tempo.js';

export type SituacaoNoPainel = 'VERMELHO' | 'AMARELO' | 'VERDE' | 'SEM_RESPOSTA_HOJE';

const PESO_DA_SITUACAO: Record<SituacaoNoPainel, number> = {
  VERMELHO: 0,
  AMARELO: 1,
  SEM_RESPOSTA_HOJE: 2,
  VERDE: 3,
};

export async function rotasDoPainel(app: FastifyInstance) {
  const comAcesso = {
    preHandler: [
      (requisicao: Parameters<typeof app.autenticar>[0]) => app.autenticar(requisicao),
      exigirPermissao('ATENDER_PLANTAO', 'VER_HISTORICO_DE_PACIENTE'),
    ],
  };

  /**
   * Todos os pacientes acompanhados — o prontuário de bolso da enfermagem.
   *
   * Nasceu ao lado de `pacientes-do-dia` e resolve a pergunta oposta. Aquela responde
   * "quem precisa de mim AGORA" e por isso só traz quem tem ciclo em andamento. Esta
   * responde "quem são as pessoas sob nossos cuidados", inclusive quem terminou o
   * tratamento e quem ainda não começou — que somem inteiramente da outra tela.
   *
   * Traz o suficiente para decidir sem abrir o detalhe: diagnóstico, quem cuida em
   * casa, telefone, última passagem pelo serviço. O detalhe continua sendo uma
   * navegação, não um pré-requisito.
   *
   * `registrarAcesso` é obrigatório aqui como em toda leitura de prontuário — LGPD,
   * e a lista inteira é leitura de dado de saúde de várias pessoas de uma vez.
   */
  app.get('/painel/pacientes', comAcesso, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const agora = new Date();

    const pacientes = await prisma.paciente.findMany({
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        dataNascimento: true,
        sexo: true,
        diagnostico: true,
        convenio: true,
        medicoAssistente: { select: { nome: true, funcao: true } },
        contatos: {
          select: { tipo: true, nome: true, telefone: true, relacao: true },
          orderBy: { criadoEm: 'asc' },
        },
        tratamentos: {
          where: { encerradoEm: null },
          orderBy: { iniciadoEm: 'desc' },
          take: 1,
          select: {
            protocolo: { select: { nome: true } },
            ciclos: {
              orderBy: { sessaoRealizadaEm: 'desc' },
              take: 1,
              select: { numero: true, sessaoRealizadaEm: true },
            },
          },
        },
        /* Última passagem pelo serviço: o evento de agenda mais recente que já
           aconteceu. Não é a sessão de quimio do ciclo — consulta médica, nutrição e
           psicologia também são visita, e a enfermagem precisa saber quando a pessoa
           esteve aqui por qualquer motivo. */
        eventosDeAgenda: {
          where: { aconteceEm: { lte: agora } },
          orderBy: { aconteceEm: 'desc' },
          take: 1,
          select: { tipo: true, aconteceEm: true, local: true },
        },
        sessoesDeTriagem: {
          orderBy: { iniciadaEm: 'desc' },
          take: 1,
          select: { iniciadaEm: true, estado: true },
        },
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'LEITURA_DE_PACIENTE',
      usuarioId: usuario.id,
    });

    return {
      itens: pacientes.map((paciente) => {
        const tratamento = paciente.tratamentos[0] ?? null;
        const ciclo = tratamento?.ciclos[0] ?? null;
        const ultimaVisita = paciente.eventosDeAgenda[0] ?? null;
        const ultimoCheckin = paciente.sessoesDeTriagem[0] ?? null;

        /* Quem cuida em casa é o contato de emergência quando existe; senão, o
           primeiro contato cadastrado. Devolver os dois seria empurrar a decisão
           para a tela, e a tela não tem contexto clínico para escolher. */
        const responsavel =
          paciente.contatos.find((contato) => contato.tipo === 'CONTATO_DE_EMERGENCIA') ??
          paciente.contatos[0] ??
          null;

        return {
          id: paciente.id,
          nome: paciente.nome,
          dataNascimento: paciente.dataNascimento,
          sexo: paciente.sexo,
          diagnostico: paciente.diagnostico,
          convenio: paciente.convenio,
          protocolo: tratamento?.protocolo.nome ?? null,
          emTratamento: tratamento !== null,
          diaDoCiclo: ciclo ? calcularDiaDoCiclo(ciclo.sessaoRealizadaEm, agora) : null,
          numeroDoCiclo: ciclo?.numero ?? null,
          medicoAssistente: paciente.medicoAssistente?.nome ?? null,
          responsavel: responsavel
            ? {
                nome: responsavel.nome,
                telefone: responsavel.telefone,
                relacao: responsavel.relacao,
                deEmergencia: responsavel.tipo === 'CONTATO_DE_EMERGENCIA',
              }
            : null,
          ultimaVisita: ultimaVisita
            ? { tipo: ultimaVisita.tipo, aconteceEm: ultimaVisita.aconteceEm, local: ultimaVisita.local }
            : null,
          ultimoCheckinEm: ultimoCheckin?.iniciadaEm ?? null,
          respondeuHoje: ultimoCheckin ? mesmoDia(ultimoCheckin.iniciadaEm, agora) : false,
        };
      }),
      proximoCursor: null,
    };
  });

  /**
   * Pacientes do dia.
   *
   * A lista é construída a partir de quem DEVERIA ter respondido hoje, não de quem
   * respondeu. A diferença é a razão de ser da tela: se a lista nascesse das respostas
   * recebidas, o paciente que não conseguiu responder simplesmente desapareceria — e ele
   * é justamente o caso de maior risco.
   *
   * A ordem também não é decisão de layout. Ordem alfabética esconde o vermelho no meio
   * da lista; ordenar por gravidade e depois por tempo de silêncio faz a tela responder,
   * ao abrir, à única pergunta que importa: quem precisa de mim agora.
   *
   * PENDÊNCIA CLÍNICA — quantos dias sem resposta disparam ligação ativa não está
   * definido em lugar nenhum. Enquanto não estiver, a API devolve `diasSemResponder`
   * sem cravar limite: informar o número é honesto, inventar o corte não seria.
   */
  app.get('/painel/pacientes-do-dia', comAcesso, async (requisicao) => {
    const usuario = usuarioDa(requisicao);

    const pacientes = await prisma.paciente.findMany({
      where: { tratamentos: { some: { encerradoEm: null } } },
      select: {
        id: true,
        nome: true,
        tratamentos: {
          where: { encerradoEm: null },
          take: 1,
          select: {
            protocolo: { select: { nome: true } },
            ciclos: { orderBy: { sessaoRealizadaEm: 'desc' }, take: 1 },
          },
        },
        // Uma consulta só, com os relacionamentos embutidos: buscar a última sessão de
        // cada paciente em laço seria uma consulta por paciente aberta na tela.
        sessoesDeTriagem: {
          where: { estado: 'CONCLUIDA' },
          orderBy: { concluidaEm: 'desc' },
          take: 1,
          select: {
            id: true,
            concluidaEm: true,
            classificacoes: {
              where: { origem: 'ORIGINAL' },
              select: { resultado: true, situacao: true },
              take: 1,
            },
          },
        },
      },
    });

    const agora = new Date();

    const cards = pacientes.map((paciente) => {
      const ultima = paciente.sessoesDeTriagem[0];
      // Dia civil no fuso do serviço, não comparação de instante: um check-in às
      // 22h precisa contar como hoje para quem está de plantão em Sergipe, e não
      // como amanhã porque o container roda em UTC.
      const respondeuHoje = Boolean(ultima?.concluidaEm && mesmoDia(ultima.concluidaEm, agora));
      const resultado = ultima?.classificacoes[0]?.resultado ?? null;

      const situacao: SituacaoNoPainel = respondeuHoje && resultado ? resultado : 'SEM_RESPOSTA_HOJE';

      const diasSemResponder = ultima?.concluidaEm
        ? diasDeDiferenca(ultima.concluidaEm, agora)
        : null;

      const ciclo = paciente.tratamentos[0]?.ciclos[0];

      return {
        pacienteId: paciente.id,
        nome: paciente.nome,
        protocolo: paciente.tratamentos[0]?.protocolo.nome ?? null,
        situacao,
        respondeuHoje,
        diasSemResponder,
        /** `null` quando nunca respondeu — que é diferente de "faz zero dias". */
        nuncaRespondeu: ultima === undefined,
        ultimaSessaoId: ultima?.id ?? null,
        // `sessaoRealizadaEm` é coluna de data, não instante — precisa de
        // `calcularDiaDoCiclo`, não de `diasDeDiferenca`. Ver src/tempo.ts.
        diaDoCiclo: ciclo ? calcularDiaDoCiclo(ciclo.sessaoRealizadaEm, agora) : null,
      };
    });

    cards.sort((a, b) => {
      const porGravidade = PESO_DA_SITUACAO[a.situacao] - PESO_DA_SITUACAO[b.situacao];
      if (porGravidade !== 0) return porGravidade;
      return (b.diasSemResponder ?? Number.MAX_SAFE_INTEGER) - (a.diasSemResponder ?? Number.MAX_SAFE_INTEGER);
    });

    await registrarAcesso(requisicao, { acao: 'LEITURA_DE_PACIENTE', usuarioId: usuario.id });

    return {
      cards,
      resumo: {
        total: cards.length,
        vermelhos: cards.filter((c) => c.situacao === 'VERMELHO').length,
        amarelos: cards.filter((c) => c.situacao === 'AMARELO').length,
        verdes: cards.filter((c) => c.situacao === 'VERDE').length,
        semResposta: cards.filter((c) => c.situacao === 'SEM_RESPOSTA_HOJE').length,
      },
    };
  });

  /** Histórico do paciente. Cada abertura fica registrada — regra 5 do ADR-001. */
  app.get('/painel/pacientes/:id/historico', comAcesso, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = z.object({ id: z.string().uuid() }).parse(requisicao.params);

    const paciente = await prisma.paciente.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        dataNascimento: true,
        sexo: true,
        convenio: true,
        diagnostico: true,
        habitoIntestinalBasal: true,
        medicoAssistente: { select: { nome: true, funcao: true } },
        alergias: { select: { descricao: true, origem: true, confirmadaEm: true } },
        contatos: { select: { tipo: true, nome: true, telefone: true, relacao: true } },
        /* Receitas em vigor primeiro, encerradas depois — a enfermagem que liga para o
           paciente precisa saber o que ele TOMA, e o que ele tomava é contexto. Quem
           prescreveu vem junto porque a dúvida seguinte é sempre "com quem eu falo". */
        prescricoes: {
          orderBy: [{ encerradaEm: 'asc' }, { iniciadaEm: 'desc' }],
          select: {
            id: true,
            posologia: true,
            iniciadaEm: true,
            encerradaEm: true,
            medicamento: { select: { nome: true, principioAtivo: true } },
            prescritaPor: { select: { nome: true, funcao: true } },
          },
        },
        eventosDeAgenda: {
          orderBy: { aconteceEm: 'desc' },
          take: 8,
          select: { id: true, tipo: true, aconteceEm: true, local: true },
        },
        /* O tratamento em curso. Faltava aqui, e a consequência era o prontuário
           mostrar "Protocolo: não informado" e "Dia do ciclo: —" para um paciente que
           a lista ao lado exibia como "ciclo 3 · dia 5". Dois caminhos para o mesmo
           dado, um deles cego — o tipo de divergência que faz a equipe deixar de
           confiar na tela. */
        tratamentos: {
          where: { encerradoEm: null },
          orderBy: { iniciadoEm: 'desc' },
          take: 1,
          select: {
            protocolo: { select: { nome: true } },
            ciclos: {
              orderBy: { sessaoRealizadaEm: 'desc' },
              take: 1,
              select: { numero: true, sessaoRealizadaEm: true },
            },
          },
        },
        sessoesDeTriagem: {
          orderBy: { iniciadaEm: 'desc' },
          take: 60,
          include: {
            respostas: { select: { sintoma: true, campo: true, valorNumerico: true, valorBooleano: true, valorTexto: true } },
            classificacoes: {
              orderBy: { calculadaEm: 'desc' },
              include: { conjunto: { select: { versao: true, validadoClinicamente: true } } },
            },
            intervencoes: {
              include: { profissional: { select: { nome: true, funcao: true } } },
            },
          },
        },
      },
    });

    if (!paciente) throw naoEncontrado('Paciente não encontrado.');

    await registrarAcesso(requisicao, {
      acao: 'LEITURA_DE_HISTORICO',
      usuarioId: usuario.id,
      pacienteId: paciente.id,
    });

    const tratamento = paciente.tratamentos[0] ?? null;
    const ciclo = tratamento?.ciclos[0] ?? null;

    /* `diaDoCiclo` do paciente é HOJE, calculado com `calcularDiaDoCiclo` — o mesmo
       número que a lista mostra. Não confundir com o `diaDoCiclo` de cada sessão, que
       é o dia em que AQUELE check-in aconteceu e continua vindo por sessão. */
    return {
      ...paciente,
      protocolo: tratamento?.protocolo.nome ?? null,
      numeroDoCiclo: ciclo?.numero ?? null,
      diaDoCiclo: ciclo ? calcularDiaDoCiclo(ciclo.sessaoRealizadaEm, new Date()) : null,
    };
  });

  const intervencaoSchema = z.object({
    conduta: z.string().min(3).max(4000),
    situacao: z.enum(['RESOLVIDO', 'EM_ACOMPANHAMENTO']),
    contatoRealizadoEm: z.coerce.date(),
  });

  /**
   * Registro de intervenção — regra 4 do ADR-001.
   *
   * A intervenção referencia a sessão de triagem que gerou o alerta, e não o paciente
   * solto. É essa amarração que permite responder depois "quanto tempo levou do alerta
   * ao contato", que é a métrica de qualidade do serviço e um dos indicadores de
   * desfecho que faltavam ao dashboard.
   */
  app.post(
    '/painel/sessoes/:id/intervencoes',
    {
      preHandler: [
        (requisicao: Parameters<typeof app.autenticar>[0]) => app.autenticar(requisicao),
        exigirPermissao('REGISTRAR_INTERVENCAO'),
      ],
    },
    async (requisicao, resposta) => {
      const usuario = usuarioDa(requisicao);
      const { id } = z.object({ id: z.string().uuid() }).parse(requisicao.params);

      if (!usuario.profissionalId) {
        throw semPermissao('Só profissional registra intervenção.');
      }

      const analise = intervencaoSchema.safeParse(requisicao.body);
      if (!analise.success) {
        throw requisicaoInvalida('Dados da intervenção inválidos.', analise.error.issues);
      }

      const sessao = await prisma.sessaoDeTriagem.findUnique({
        where: { id },
        select: { id: true, pacienteId: true },
      });

      if (!sessao) throw naoEncontrado('Sessão de triagem não encontrada.');

      const intervencao = await prisma.intervencao.create({
        data: {
          sessaoDeTriagemId: sessao.id,
          profissionalId: usuario.profissionalId,
          conduta: analise.data.conduta,
          situacao: analise.data.situacao,
          contatoRealizadoEm: analise.data.contatoRealizadoEm,
        },
      });

      await registrarAcesso(requisicao, {
        acao: 'REGISTRO_DE_INTERVENCAO',
        usuarioId: usuario.id,
        pacienteId: sessao.pacienteId,
      });

      return resposta.status(201).send(intervencao);
    },
  );
}
