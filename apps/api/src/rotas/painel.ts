import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { naoEncontrado, requisicaoInvalida, semPermissao } from '../erros.js';
import { exigirPermissao, registrarAcesso, usuarioDa } from '../autenticacao/plugin.js';

import {
  estratificarRisco,
  montarIndicadoresDeToxicidade,
  type Classificacao,
  type Sintoma,
  faixaDeSilencioDe,
  nivelDePrioridade,
  ordenarFilaDePrioridades,
  resumirSilencio,
  type RegraDisparada,
} from '@aurea/contratos';
import {
  calcularDiaDoCiclo,
  colunaDeDataDoDiaCivil,
  diasDeDiferenca,
  mesmoDia,
} from '../tempo.js';

export type SituacaoNoPainel = 'VERMELHO' | 'AMARELO' | 'VERDE' | 'SEM_RESPOSTA_HOJE';

/**
 * As regras que dispararam, extraídas da `explicacao` gravada com a classificação.
 *
 * A explicação é `Json` no banco e chega aqui sem tipo. Em vez de confiar no formato,
 * a leitura descarta silenciosamente tudo que não tiver a forma esperada: explicação
 * de uma versão antiga do motor não pode derrubar o painel inteiro do plantão.
 */
function lerRegrasDisparadas(explicacao: unknown): readonly RegraDisparada[] {
  if (typeof explicacao !== 'object' || explicacao === null) return [];
  const porSintoma = (explicacao as { porSintoma?: unknown }).porSintoma;
  if (!Array.isArray(porSintoma)) return [];

  const regras: RegraDisparada[] = [];
  for (const bloco of porSintoma) {
    if (typeof bloco !== 'object' || bloco === null) continue;
    const disparadas = (bloco as { regrasDisparadas?: unknown }).regrasDisparadas;
    if (!Array.isArray(disparadas)) continue;

    for (const regra of disparadas) {
      if (typeof regra !== 'object' || regra === null) continue;
      const r = regra as Partial<RegraDisparada>;
      if (typeof r.sintoma !== 'string' || typeof r.classificacao !== 'string') continue;
      regras.push({
        regraId: typeof r.regraId === 'string' ? r.regraId : '',
        sintoma: r.sintoma as RegraDisparada['sintoma'],
        campo: typeof r.campo === 'string' ? r.campo : '',
        valorObservado: (r.valorObservado ?? null) as RegraDisparada['valorObservado'],
        classificacao: r.classificacao as RegraDisparada['classificacao'],
        justificativa: typeof r.justificativa === 'string' ? r.justificativa : '',
      });
    }
  }
  return regras;
}

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
        /* Alta recente sobe o paciente na fila por sete dias — ver
           `fila-de-prioridades.ts`. */
        internadoAte: true,
        /* Estratificação de risco (blocos 2 e 8). Tudo no mesmo `select` de propósito:
           buscar por paciente em laço seria uma consulta por linha da tela. */
        dataNascimento: true,
        ecog: true,
        moraSozinho: true,
        dificuldadeDeTransporte: true,
        temCuidador: true,
        contextoSocialAvaliadoEm: true,
        _count: {
          select: {
            comorbidades: true,
            /* Toxicidade grave recente: classificações vermelhas nos últimos 90 dias.
               Contagem e não lista — o peso satura em 3 e a lista seria desperdício. */
            sessoesDeTriagem: {
              where: {
                estado: 'CONCLUIDA',
                classificacoes: { some: { origem: 'ORIGINAL', resultado: 'VERMELHO' } },
              },
            },
          },
        },
        tratamentos: {
          where: { encerradoEm: null },
          take: 1,
          select: {
            iniciadoEm: true,
            protocolo: {
              select: {
                nome: true,
                imunoterapia: true,
                altoRiscoDeNeutropenia: true,
                bombaInfusora: true,
                tratamentoOral: true,
              },
            },
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
              /* `explicacao` entra aqui para o cartão poder dizer POR QUE o paciente
                 está no topo. Fila que ordena sem justificar é caixa-preta, e o mesmo
                 argumento que obriga a mostrar a regra no prontuário vale aqui. */
              select: { resultado: true, situacao: true, explicacao: true },
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

      const tratamentoAtivo = paciente.tratamentos[0] ?? null;
      const ciclo = tratamentoAtivo?.ciclos[0] ?? null;

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
        regrasDisparadas: lerRegrasDisparadas(ultima?.classificacoes[0]?.explicacao),
        sinalizadores: { internadoAte: paciente.internadoAte?.toISOString() ?? null },
        /* Blocos 2 e 8 — a estratificação viaja junto com o cartão para a tela não
           precisar de uma segunda chamada por paciente. O selo de rascunho vem no
           próprio resultado, e não como convenção do front. */
        risco: estratificarRisco(
          {
            ecog: paciente.ecog,
            dataNascimento: paciente.dataNascimento?.toISOString() ?? null,
            quantidadeDeComorbidades: paciente._count.comorbidades,
            internadoAte: paciente.internadoAte?.toISOString() ?? null,
            toxicidadesGravesRecentes: paciente._count.sessoesDeTriagem,
            protocolo: tratamentoAtivo
              ? {
                  imunoterapia: tratamentoAtivo.protocolo.imunoterapia,
                  altoRiscoDeNeutropenia:
                    tratamentoAtivo.protocolo.altoRiscoDeNeutropenia,
                  bombaInfusora: tratamentoAtivo.protocolo.bombaInfusora,
                  tratamentoOral: tratamentoAtivo.protocolo.tratamentoOral,
                }
              : null,
            /* Primeira aplicação: nenhum ciclo registrado ainda no tratamento ativo. */
            primeiraAplicacao: tratamentoAtivo != null && ciclo == null,
            moraSozinho: paciente.moraSozinho,
            dificuldadeDeTransporte: paciente.dificuldadeDeTransporte,
            temCuidador: paciente.temCuidador,
            contextoSocialAvaliadoEm:
              paciente.contextoSocialAvaliadoEm?.toISOString() ?? null,
          },
          agora,
        ),
      };
    });

    /* A ordenação saiu daqui para `@aurea/contratos`. Não é preciosismo: o critério
       de quem a enfermagem atende primeiro é regra de produto, precisa de teste, e
       teste de regra que mora dentro de handler de rota exige subir servidor. */
    const priorizados = ordenarFilaDePrioridades(cards, agora);
    const silencio = resumirSilencio(cards);

    await registrarAcesso(requisicao, { acao: 'LEITURA_DE_PACIENTE', usuarioId: usuario.id });

    return {
      /* Cada cartão carrega a posição, a faixa de silêncio e os motivos. O front não
         recalcula nada: ordem e justificativa vêm prontas da mesma função testada. */
      cards: priorizados.map((item) => ({
        ...item.entrada,
        faixaDeSilencio: item.faixaDeSilencio,
        nivelDePrioridade: nivelDePrioridade(
          item.entrada.situacao,
          faixaDeSilencioDe(item.entrada.diasSemResponder, item.entrada.nuncaRespondeu),
        ),
        motivos: item.motivos,
      })),
      silencio,
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
        /* História de vida. Alimenta a breve história no topo do prontuário, montada
           por `montarHistoriaDoPaciente` em `@aurea/contratos`. */
        tabagismo: true,
        parouDeFumarEm: true,
        atividadeFisica: true,
        descricaoDaAtividade: true,
        consumoDeAlcool: true,
        medicoAssistente: { select: { nome: true, funcao: true } },
        alergias: { select: { descricao: true, origem: true, confirmadaEm: true } },
        comorbidades: { select: { descricao: true, origem: true, confirmadaEm: true } },
        /* Contexto que a tela de registro edita. Vem no mesmo prontuário para a
           edição não precisar de uma segunda chamada. */
        ecog: true,
        moraSozinho: true,
        dificuldadeDeTransporte: true,
        temCuidador: true,
        contextoSocialAvaliadoEm: true,
        barreiras: {
          where: { resolvidaEm: null },
          orderBy: { criadaEm: 'desc' },
          select: { id: true, tipo: true, descricao: true, criadaEm: true },
        },
        pendencias: {
          where: { resolvidaEm: null },
          orderBy: { referenteA: 'asc' },
          select: { id: true, tipo: true, descricao: true, referenteA: true },
        },
        internacoes: {
          orderBy: { iniciadaEm: 'desc' },
          take: 5,
          select: { id: true, motivo: true, local: true, iniciadaEm: true, altaEm: true },
        },
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

  /* ---------------------------------------------------------------------------
     Registro operacional: barreira, pendência e internação.

     Ficam AQUI e não em `cadastro-de-pacientes.ts` por uma razão de permissão, não de
     arrumação: quem descobre que o paciente não tem transporte é a enfermagem no
     telefone, e ela não tem `GERENCIAR_CADASTROS`. Exigir o perfil administrativo
     para registrar a barreira garantiria que a barreira nunca fosse registrada, e o
     mapa do bloco 10 nasceria vazio para sempre.

     Campos de identidade do paciente continuam do outro lado, com o perfil que os
     protege. A separação é por natureza do dado: observação do plantão aqui, cadastro
     lá.
     --------------------------------------------------------------------------- */

  const registroDoPlantao = {
    preHandler: [
      (requisicao: Parameters<typeof app.autenticar>[0]) => app.autenticar(requisicao),
      exigirPermissao('ATENDER_PLANTAO'),
    ],
  };

  const barreiraSchema = z.object({
    tipo: z.enum([
      'TRANSPORTE',
      'AUTORIZACAO',
      'FINANCEIRA',
      'ANSIEDADE',
      'REDE_DE_APOIO',
      'DISTANCIA',
      'TRABALHO',
      'OUTRA',
    ]),
    descricao: z.string().trim().min(1).max(255).optional(),
  });

  app.post('/painel/pacientes/:id/barreiras', registroDoPlantao, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const { id } = z.object({ id: z.string().uuid() }).parse(requisicao.params);

    const analise = barreiraSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Dados da barreira inválidos.', analise.error.issues);
    }

    const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } });
    if (!paciente) throw naoEncontrado('Paciente não encontrado.');

    const barreira = await prisma.barreiraDoPaciente.create({
      data: {
        pacienteId: id,
        tipo: analise.data.tipo,
        descricao: analise.data.descricao ?? null,
        registradaPorId: usuario.profissionalId ?? null,
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: id,
    });

    return resposta.status(201).send(barreira);
  });

  /* Resolver, não apagar: o mapa é de navegação, e apagar o histórico esconderia o
     que o serviço conseguiu destravar. */
  app.post(
    '/painel/barreiras/:barreiraId/resolucao',
    registroDoPlantao,
    async (requisicao) => {
      const usuario = usuarioDa(requisicao);
      const { barreiraId } = z
        .object({ barreiraId: z.string().uuid() })
        .parse(requisicao.params);

      const barreira = await prisma.barreiraDoPaciente.findUnique({
        where: { id: barreiraId },
        select: { id: true, pacienteId: true, resolvidaEm: true },
      });
      if (!barreira) throw naoEncontrado('Barreira não encontrada.');

      const atualizada = await prisma.barreiraDoPaciente.update({
        where: { id: barreiraId },
        /* Idempotente: resolver duas vezes não move a data da primeira. */
        data: { resolvidaEm: barreira.resolvidaEm ?? new Date() },
      });

      await registrarAcesso(requisicao, {
        acao: 'EDICAO_DE_CADASTRO',
        usuarioId: usuario.id,
        pacienteId: barreira.pacienteId,
      });

      return atualizada;
    },
  );

  const pendenciaSchema = z.object({
    tipo: z.enum([
      'EXAME',
      'AUTORIZACAO',
      'CONSULTA_MEDICA',
      'TOXICIDADE_EM_ACOMPANHAMENTO',
      'INTERNACAO_RECENTE',
      'OUTRA',
    ]),
    descricao: z.string().trim().min(1).max(255).optional(),
    referenteA: z.coerce.date(),
  });

  app.post('/painel/pacientes/:id/pendencias', registroDoPlantao, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const { id } = z.object({ id: z.string().uuid() }).parse(requisicao.params);

    const analise = pendenciaSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Dados da pendência inválidos.', analise.error.issues);
    }

    const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } });
    if (!paciente) throw naoEncontrado('Paciente não encontrado.');

    const pendencia = await prisma.pendenciaPreTratamento.create({
      data: {
        pacienteId: id,
        tipo: analise.data.tipo,
        descricao: analise.data.descricao ?? null,
        referenteA: analise.data.referenteA,
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: id,
    });

    return resposta.status(201).send(pendencia);
  });

  app.post(
    '/painel/pendencias/:pendenciaId/resolucao',
    registroDoPlantao,
    async (requisicao) => {
      const usuario = usuarioDa(requisicao);
      const { pendenciaId } = z
        .object({ pendenciaId: z.string().uuid() })
        .parse(requisicao.params);

      const pendencia = await prisma.pendenciaPreTratamento.findUnique({
        where: { id: pendenciaId },
        select: { id: true, pacienteId: true, resolvidaEm: true },
      });
      if (!pendencia) throw naoEncontrado('Pendência não encontrada.');

      const atualizada = await prisma.pendenciaPreTratamento.update({
        where: { id: pendenciaId },
        data: { resolvidaEm: pendencia.resolvidaEm ?? new Date() },
      });

      await registrarAcesso(requisicao, {
        acao: 'EDICAO_DE_CADASTRO',
        usuarioId: usuario.id,
        pacienteId: pendencia.pacienteId,
      });

      return atualizada;
    },
  );

  const internacaoSchema = z.object({
    motivo: z.string().trim().min(2).max(255),
    local: z.string().trim().min(1).max(160).optional(),
    iniciadaEm: z.coerce.date(),
    altaEm: z.coerce.date().optional(),
  });

  app.post('/painel/pacientes/:id/internacoes', registroDoPlantao, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const { id } = z.object({ id: z.string().uuid() }).parse(requisicao.params);

    const analise = internacaoSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Dados da internação inválidos.', analise.error.issues);
    }
    if (analise.data.altaEm && analise.data.altaEm < analise.data.iniciadaEm) {
      throw requisicaoInvalida('A alta não pode ser anterior à internação.');
    }

    const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } });
    if (!paciente) throw naoEncontrado('Paciente não encontrado.');

    const internacao = await prisma.internacao.create({
      data: {
        pacienteId: id,
        motivo: analise.data.motivo,
        local: analise.data.local ?? null,
        iniciadaEm: analise.data.iniciadaEm,
        altaEm: analise.data.altaEm ?? null,
      },
    });

    /* `internadoAte` no paciente é o estado ATUAL e alimenta a fila de prioridades;
       a tabela é o histórico. Escrever nos dois é o que mantém a fila correta sem
       obrigá-la a varrer internações a cada carregamento. */
    await prisma.paciente.update({
      where: { id },
      data: { internadoAte: analise.data.altaEm ?? null },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: id,
    });

    return resposta.status(201).send(internacao);
  });

  /**
   * Contexto que alimenta a estratificação, editável por quem está no plantão.
   *
   * ECOG fica de FORA de propósito: é atribuição médica, não observação de plantão, e
   * entra pelo cadastro administrativo. O que está aqui é o que a enfermagem descobre
   * conversando: se mora sozinho, se tem quem traga, se tem cuidador.
   */
  const contextoSocialSchema = z.object({
    moraSozinho: z.boolean(),
    dificuldadeDeTransporte: z.boolean(),
    temCuidador: z.boolean(),
  });

  app.patch('/painel/pacientes/:id/contexto-social', registroDoPlantao, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = z.object({ id: z.string().uuid() }).parse(requisicao.params);

    const analise = contextoSocialSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Dados do contexto social inválidos.', analise.error.issues);
    }

    const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } });
    if (!paciente) throw naoEncontrado('Paciente não encontrado.');

    /* `contextoSocialAvaliadoEm` é o que separa "respondeu que não tem cuidador" de
       "ninguém perguntou". Sem ele o motor trata os três campos como ausentes, e é
       por isso que ele é gravado aqui e não pelo cliente. */
    const atualizado = await prisma.paciente.update({
      where: { id },
      data: { ...analise.data, contextoSocialAvaliadoEm: new Date() },
      select: {
        moraSozinho: true,
        dificuldadeDeTransporte: true,
        temCuidador: true,
        contextoSocialAvaliadoEm: true,
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: id,
    });

    return atualizado;
  });

  /**
   * Blocos 6, 9, 10 e 11 — a tela de navegação.
   *
   * Quatro leituras que os prints tratam como blocos separados e que respondem à
   * mesma pergunta de gestão: onde o serviço está travando. Vêm numa rota só porque
   * a tela é uma só, e quatro chamadas para montar uma tela é latência sem ganho.
   *
   * Nenhum número aqui classifica paciente. É contagem de operação, e a tela usa a
   * paleta de dados do ADR-005.
   */
  app.get('/painel/navegacao', comAcesso, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const agora = new Date();
    const trintaDias = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

    /* Amanhã como COLUNA DE DATA, não como instante. `referenteA` é `@db.Date`, e
       montar a janela com aritmética de instante pergunta pelo dia errado sempre que
       o fuso do serviço está atrás de UTC — o dia inteiro, no Brasil. Ver o comentário
       de `colunaDeDataDoDiaCivil` em `tempo.ts`. */
    const amanha = colunaDeDataDoDiaCivil(agora, 1);
    const depoisDeAmanha = colunaDeDataDoDiaCivil(agora, 2);

    const [
      barreiras,
      pendencias,
      internacoesAbertas,
      internacoesNoMes,
      suspensos,
      intervencoesNoMes,
      encaminhados,
      pacientesAcompanhados,
      semRedeDeApoio,
      comDificuldadeDeAcesso,
    ] = await Promise.all([
      /* Só barreiras ABERTAS no mapa: o bloco 10 pergunta onde o serviço está travado
         agora, não o que já foi destravado. O histórico continua no banco. */
      prisma.barreiraDoPaciente.groupBy({
        by: ['tipo'],
        where: { resolvidaEm: null },
        _count: { _all: true },
      }),
      prisma.pendenciaPreTratamento.findMany({
        where: {
          resolvidaEm: null,
          referenteA: { gte: amanha, lt: depoisDeAmanha },
        },
        select: {
          id: true,
          tipo: true,
          descricao: true,
          referenteA: true,
          paciente: { select: { id: true, nome: true } },
        },
        orderBy: { criadaEm: 'asc' },
      }),
      prisma.internacao.count({ where: { altaEm: null } }),
      prisma.internacao.count({ where: { iniciadaEm: { gte: trintaDias } } }),
      prisma.tratamento.count({ where: { suspensoEm: { not: null }, encerradoEm: null } }),
      prisma.intervencao.findMany({
        where: { registradaEm: { gte: trintaDias } },
        select: { registradaEm: true, contatoRealizadoEm: true, situacao: true },
      }),
      prisma.intervencao.count({
        where: { registradaEm: { gte: trintaDias }, situacao: 'ENCAMINHADO_AO_PA' },
      }),
      prisma.paciente.count({ where: { tratamentos: { some: { encerradoEm: null } } } }),
      prisma.paciente.count({
        where: {
          tratamentos: { some: { encerradoEm: null } },
          contextoSocialAvaliadoEm: { not: null },
          temCuidador: false,
        },
      }),
      prisma.paciente.count({
        where: {
          tratamentos: { some: { encerradoEm: null } },
          dificuldadeDeTransporte: true,
        },
      }),
    ]);

    /* Tempo médio entre o alerta chegar e a equipe registrar o contato. Em minutos,
       e só sobre intervenções em que as duas datas existem: média que inclui zero
       por dado faltante é média que mente para baixo. */
    const duracoes = intervencoesNoMes
      .map((i) => i.contatoRealizadoEm.getTime() - i.registradaEm.getTime())
      .filter((ms) => Number.isFinite(ms));
    const tempoMedioDeRespostaEmMinutos =
      duracoes.length > 0
        ? Math.round(
            duracoes.reduce((total, ms) => total + Math.abs(ms), 0) /
              duracoes.length /
              60000,
          )
        : null;

    await registrarAcesso(requisicao, {
      acao: 'LEITURA_DE_PACIENTE',
      usuarioId: usuario.id,
    });

    return {
      indicadores: {
        pacientesAcompanhados,
        intervencoesRealizadas: intervencoesNoMes.length,
        tempoMedioDeRespostaEmMinutos,
        encaminhamentos: encaminhados,
        internacoesNotificadas: internacoesNoMes,
        tratamentosSuspensos: suspensos,
        pacientesSemRedeDeApoio: semRedeDeApoio,
        pacientesComDificuldadeDeAcesso: comDificuldadeDeAcesso,
      },
      barreiras: barreiras
        .map((b) => ({ tipo: b.tipo, quantidade: b._count._all }))
        .sort((a, b) => b.quantidade - a.quantidade),
      alertasPreTratamento: pendencias.map((p) => ({
        id: p.id,
        pacienteId: p.paciente.id,
        paciente: p.paciente.nome,
        tipo: p.tipo,
        descricao: p.descricao,
        referenteA: p.referenteA,
      })),
      mural: {
        pacientesInternados: internacoesAbertas,
        tratamentosSuspensos: suspensos,
        pendenciasParaAmanha: pendencias.length,
        barreirasAbertas: barreiras.reduce((total, b) => total + b._count._all, 0),
      },
    };
  });

  /**
   * Bloco 5 dos prints — indicadores de toxicidade.
   *
   * Leitura agregada, sem dado identificável no retorno: nenhum nome, nenhum id de
   * paciente. É por isso que o `LogDeAcesso` registrado aqui não carrega `pacienteId`
   * — não houve leitura de prontuário, houve contagem.
   */
  app.get('/painel/indicadores-de-toxicidade', comAcesso, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { dias } = z
      .object({ dias: z.coerce.number().int().min(7).max(365).default(30) })
      .parse(requisicao.query);

    const agora = new Date();
    const desde = new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000);

    const sessoes = await prisma.sessaoDeTriagem.findMany({
      where: { estado: 'CONCLUIDA', concluidaEm: { gte: desde } },
      select: {
        id: true,
        concluidaEm: true,
        paciente: {
          select: {
            tratamentos: {
              where: { encerradoEm: null },
              take: 1,
              orderBy: { iniciadoEm: 'desc' },
              select: { protocolo: { select: { nome: true } } },
            },
          },
        },
        classificacoes: {
          where: { origem: 'ORIGINAL' },
          take: 1,
          select: { explicacao: true },
        },
      },
    });

    /* Uma ocorrência por SINTOMA classificado como amarelo ou vermelho. */
    const ocorrencias = sessoes.flatMap((sessao) => {
      const protocolo = sessao.paciente.tratamentos[0]?.protocolo.nome ?? null;
      const explicacao = sessao.classificacoes[0]?.explicacao;
      if (typeof explicacao !== 'object' || explicacao === null) return [];

      const porSintoma = (explicacao as { porSintoma?: unknown }).porSintoma;
      if (!Array.isArray(porSintoma)) return [];

      return porSintoma.flatMap((bloco) => {
        if (typeof bloco !== 'object' || bloco === null) return [];
        const b = bloco as { sintoma?: unknown; classificacao?: unknown };
        if (typeof b.sintoma !== 'string' || typeof b.classificacao !== 'string') {
          return [];
        }
        return [
          {
            sintoma: b.sintoma as Sintoma,
            classificacao: b.classificacao as Classificacao,
            protocolo,
            sessaoId: sessao.id,
            quando: (sessao.concluidaEm ?? agora).toISOString(),
          },
        ];
      });
    });

    await registrarAcesso(requisicao, {
      acao: 'LEITURA_DE_PACIENTE',
      usuarioId: usuario.id,
    });

    /* A janela é aplicada duas vezes de propósito: na consulta, para não trazer o
       banco inteiro, e na função pura, que é onde a regra vive e está testada. */
    return montarIndicadoresDeToxicidade(ocorrencias, sessoes.length, agora, dias);
  });

  /**
   * Bloco 7 dos prints — acompanhamento de intervenções.
   *
   * Responde "o que aconteceu depois que a enfermagem ligou". Sem esta tela, a
   * intervenção era registrada e sumia: o follow-up vivia na memória de quem atendeu,
   * e memória não passa de plantão para plantão.
   *
   * Por padrão devolve só o que continua ABERTO, porque a pergunta do plantão é sobre
   * pendência. `incluirResolvidas=true` traz o histórico completo.
   */
  app.get('/painel/intervencoes', comAcesso, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { incluirResolvidas } = z
      .object({ incluirResolvidas: z.coerce.boolean().default(false) })
      .parse(requisicao.query);

    const intervencoes = await prisma.intervencao.findMany({
      where: incluirResolvidas ? {} : { situacao: { not: 'RESOLVIDO' } },
      orderBy: { registradaEm: 'desc' },
      take: 200,
      select: {
        id: true,
        conduta: true,
        situacao: true,
        contatoRealizadoEm: true,
        registradaEm: true,
        profissional: { select: { nome: true, funcao: true } },
        sessaoDeTriagem: {
          select: {
            id: true,
            paciente: { select: { id: true, nome: true } },
            /* O motivo da intervenção é a classificação que a gerou. Sem ela a tabela
               teria "paciente + conduta" e a coluna Motivo dos prints ficaria vazia. */
            classificacoes: {
              where: { origem: 'ORIGINAL' },
              take: 1,
              select: { resultado: true, explicacao: true },
            },
          },
        },
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'LEITURA_DE_HISTORICO',
      usuarioId: usuario.id,
    });

    return {
      itens: intervencoes.map((intervencao) => {
        const classificacao = intervencao.sessaoDeTriagem.classificacoes[0];
        const regras = lerRegrasDisparadas(classificacao?.explicacao);
        /* O motivo é o sintoma da regra mais grave, e não a conduta: a conduta é o que
           a enfermagem FEZ, e a coluna pergunta por que ela precisou fazer. */
        const maisGrave = regras.find((r) => r.classificacao === 'VERMELHO') ?? regras[0];

        return {
          id: intervencao.id,
          pacienteId: intervencao.sessaoDeTriagem.paciente.id,
          paciente: intervencao.sessaoDeTriagem.paciente.nome,
          sessaoId: intervencao.sessaoDeTriagem.id,
          motivo: maisGrave?.sintoma ?? null,
          justificativa: maisGrave?.justificativa ?? null,
          classificacao: classificacao?.resultado ?? null,
          situacao: intervencao.situacao,
          conduta: intervencao.conduta,
          profissional: intervencao.profissional.nome,
          contatoRealizadoEm: intervencao.contatoRealizadoEm,
          registradaEm: intervencao.registradaEm,
        };
      }),
      resumo: {
        abertas: intervencoes.filter((i) => i.situacao !== 'RESOLVIDO').length,
        total: intervencoes.length,
      },
    };
  });

  const intervencaoSchema = z.object({
    conduta: z.string().min(3).max(4000),
    situacao: z.enum([
      'RESOLVIDO',
      'EM_ACOMPANHAMENTO',
      'AGUARDANDO_RETORNO',
      'ENCAMINHADO_AO_PA',
      'REAVALIAR',
    ]),
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
