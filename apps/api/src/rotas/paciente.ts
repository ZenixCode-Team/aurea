import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { CategoriaDaBiblioteca, type Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { ambiente } from '../ambiente.js';
import { naoEncontrado, requisicaoInvalida, semPermissao } from '../erros.js';
import { exigirPaciente, usuarioDa } from '../autenticacao/plugin.js';
import { calcularDiaDoCiclo, inicioDoDia } from '../tempo.js';
import {
  fatiaDoCursor,
  lerPaginacao,
  montarPagina,
  type ChaveDeOrdenacao,
} from '../servicos/paginacao.js';

/**
 * Rotas do aplicativo do paciente: perfil, alergia sugerida, agenda, biblioteca,
 * pedido de contato com a enfermagem e notificações.
 *
 * Duas regras valem em TODAS elas:
 *
 * - O paciente é o de `exigirPaciente()`, que vem da sessão. Nenhuma rota aceita id de
 *   paciente pela URL: id na URL é o caminho conhecido para um paciente ler o prontuário
 *   de outro trocando um número.
 * - A mensagem de erro é escrita para quem vai lê-la. Quem usa isto é paciente oncológico,
 *   frequentemente idoso, respondendo no pior dia do ciclo — "requisição inválida" não diz
 *   nada a ele.
 */

/**
 * Janela em que dois toques no botão "falar com a enfermagem" contam como um pedido só.
 *
 * Deduplicar por "existe pedido em aberto" seria pior do que não deduplicar: o pedido de
 * nove dias atrás que ninguém fechou no sistema engoliria o pedido de hoje, em silêncio,
 * e o paciente leria "pedido enviado". A janela curta cobre o problema real — o clique
 * repetido de quem está ansioso — e nada além disso. Fora dela, é pedido novo e a
 * enfermagem é avisada de novo, sempre.
 */
const JANELA_DE_DEDUPLICACAO_EM_MS = ambiente.MINUTOS_DE_JANELA_DE_CONTATO * 60 * 1000;

/**
 * Avisa quem está de plantão que um paciente pediu contato.
 *
 * Segue o padrão de `avisarEnfermagem` em `src/servicos/orientacao.ts`, inclusive nas
 * limitações: o alerta continua sem dono e sem prazo — não existe regra de escala — então
 * vai para todo mundo com `ATENDER_PLANTAO`, no canal NO_APP. É cópia do padrão porque
 * `orientacao.ts` não é editável nesta entrega; juntar os dois num serviço de notificação
 * está pedido no relatório.
 */
async function avisarPlantaoSobreSolicitacao(
  nomeDoPaciente: string,
  solicitacaoId: string,
): Promise<number> {
  const dePlantao = await prisma.concessaoDePermissao.findMany({
    where: { permissao: 'ATENDER_PLANTAO', revogadaEm: null },
    select: { usuarioId: true },
  });

  if (dePlantao.length === 0) return 0;

  await prisma.notificacao.createMany({
    data: dePlantao.map((concessao) => ({
      destinatarioId: concessao.usuarioId,
      canal: 'NO_APP' as const,
      assunto: `Pedido de contato: ${nomeDoPaciente}`,
      corpo: 'O paciente pediu para falar com a enfermagem. Abra a fila de pedidos.',
      referenciaTipo: 'SolicitacaoDeContato',
      referenciaId: solicitacaoId,
      enviadaEm: new Date(),
    })),
  });

  return dePlantao.length;
}

const alergiaSugeridaSchema = z.object({
  descricao: z.string().trim().min(2).max(255),
});

const filtroDaAgendaSchema = z.object({
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
});

const filtroDaBibliotecaSchema = z.object({
  categoria: z.enum(CategoriaDaBiblioteca).optional(),
});

const filtroDeNotificacoesSchema = z.object({
  apenasNaoLidas: z.enum(['true', 'false']).optional(),
});

const solicitacaoDeContatoSchema = z.object({
  /** A sessão de check-in que motivou o pedido, quando o botão vem da tela 7. */
  sessaoId: z.string().uuid().optional(),
});

const idNaUrlSchema = z.object({ id: z.string().uuid() });

/**
 * Corpo vazio vale como `{}` neste plugin.
 *
 * "Falar com a enfermagem" e "marcar aviso como lido" são botões sem campo nenhum, e um
 * cliente que mande `POST` com `content-type: application/json` e corpo vazio esbarra no
 * analisador padrão do Fastify, que recusa com "Body cannot be empty when content-type is
 * set to 'application/json'". Como o tratador de erro repassa mensagem de 4xx tal e qual,
 * essa frase — em inglês, falando de content-type — chegaria à tela de um paciente
 * oncológico no pior dia do ciclo, no exato momento em que ele pediu socorro.
 *
 * O analisador é local: registrado dentro do plugin, não vale para as outras rotas.
 */
function aceitarCorpoVazio(app: FastifyInstance) {
  app.removeContentTypeParser('application/json');

  app.addContentTypeParser<string>(
    'application/json',
    { parseAs: 'string' },
    (_requisicao, corpo, feito) => {
      if (corpo.trim() === '') {
        feito(null, {});
        return;
      }

      try {
        feito(null, JSON.parse(corpo));
      } catch {
        feito(
          requisicaoInvalida('Não conseguimos ler os dados enviados. Tente de novo pelo aplicativo.'),
          undefined,
        );
      }
    },
  );
}

export async function rotasDoPaciente(app: FastifyInstance) {
  aceitarCorpoVazio(app);

  const autenticado = {
    preHandler: (requisicao: FastifyRequest) => app.autenticar(requisicao),
  };

  // -------------------------------------------------------------------------
  // Perfil
  // -------------------------------------------------------------------------

  /**
   * O próprio perfil.
   *
   * `diaDoCiclo` é derivado com `calcularDiaDoCiclo` de `src/tempo.ts` e nunca lido de
   * coluna: dia do ciclo guardado nasce desatualizado no dia seguinte, e contado fora do
   * fuso do serviço sai um dia adiantado num check-in noturno.
   *
   * Os contatos saem separados por tipo, e não numa lista só. `CONTATO_DO_PACIENTE` é como
   * falar com ele; `CONTATO_DE_EMERGENCIA` é quem chamar quando ele não responde. Misturar
   * os dois apaga a diferença justamente no caso em que ela importa.
   */
  app.get('/paciente/perfil', autenticado, async (requisicao) => {
    const pacienteId = exigirPaciente(requisicao);

    const paciente = await prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: {
        id: true,
        nome: true,
        dataNascimento: true,
        sexo: true,
        diagnostico: true,
        convenio: true,
        tipoSanguineo: true,
        urlDaFoto: true,
        habitoIntestinalBasal: true,
        medicoAssistente: { select: { nome: true, funcao: true, registroDoConselho: true } },
        contatos: {
          select: { id: true, tipo: true, nome: true, telefone: true, relacao: true },
          orderBy: { criadoEm: 'asc' },
        },
        alergias: {
          select: { id: true, descricao: true, origem: true, confirmadaEm: true, criadaEm: true },
          orderBy: { criadaEm: 'desc' },
        },
        tratamentos: {
          where: { encerradoEm: null },
          orderBy: { iniciadoEm: 'desc' },
          take: 1,
          select: {
            iniciadoEm: true,
            protocolo: { select: { id: true, nome: true } },
            ciclos: {
              orderBy: { sessaoRealizadaEm: 'desc' },
              take: 1,
              select: { numero: true, sessaoRealizadaEm: true, previsaoDaProximaSessao: true },
            },
          },
        },
      },
    });

    if (!paciente) throw naoEncontrado('Não encontramos o seu cadastro. Fale com a equipe.');

    const tratamento = paciente.tratamentos[0] ?? null;
    const ciclo = tratamento?.ciclos[0] ?? null;
    const agora = new Date();

    const semTipo = (contato: (typeof paciente.contatos)[number]) => ({
      id: contato.id,
      nome: contato.nome,
      telefone: contato.telefone,
      relacao: contato.relacao,
    });

    return {
      paciente: {
        id: paciente.id,
        nome: paciente.nome,
        dataNascimento: paciente.dataNascimento,
        sexo: paciente.sexo,
        diagnostico: paciente.diagnostico,
        convenio: paciente.convenio,
        tipoSanguineo: paciente.tipoSanguineo,
        urlDaFoto: paciente.urlDaFoto,
        habitoIntestinalBasal: paciente.habitoIntestinalBasal,
      },
      medicoAssistente: paciente.medicoAssistente,
      tratamento: tratamento
        ? { protocolo: tratamento.protocolo, iniciadoEm: tratamento.iniciadoEm }
        : null,
      ciclo: ciclo
        ? {
            numero: ciclo.numero,
            sessaoRealizadaEm: ciclo.sessaoRealizadaEm,
            previsaoDaProximaSessao: ciclo.previsaoDaProximaSessao,
            diaDoCiclo: calcularDiaDoCiclo(ciclo.sessaoRealizadaEm, agora),
          }
        : null,
      contatos: {
        doPaciente: paciente.contatos
          .filter((contato) => contato.tipo === 'CONTATO_DO_PACIENTE')
          .map(semTipo),
        deEmergencia: paciente.contatos
          .filter((contato) => contato.tipo === 'CONTATO_DE_EMERGENCIA')
          .map(semTipo),
      },
      alergias: paciente.alergias.map((alergia) => ({
        id: alergia.id,
        descricao: alergia.descricao,
        origem: alergia.origem,
        /** Alergia sugerida pelo paciente vale como pendência, nunca como dado do prontuário. */
        confirmada: alergia.confirmadaEm !== null,
        confirmadaEm: alergia.confirmadaEm,
        criadaEm: alergia.criadaEm,
      })),
    };
  });

  // -------------------------------------------------------------------------
  // Alergia sugerida
  // -------------------------------------------------------------------------

  /**
   * O paciente SUGERE uma alergia. Ele não escreve no prontuário.
   *
   * Nasce com `origem = PACIENTE` e `confirmadaEm = null`: fica na fila de pendência até
   * alguém da equipe confirmar. A rota de confirmação é do painel e não vive aqui — se o
   * paciente pudesse confirmar a própria alergia, "informado pelo paciente" e "verificado
   * pela equipe" viravam a mesma coisa no prontuário.
   */
  app.post('/paciente/alergias', autenticado, async (requisicao, resposta) => {
    const pacienteId = exigirPaciente(requisicao);

    const analise = alergiaSugeridaSchema.safeParse(requisicao.body ?? {});
    if (!analise.success) {
      throw requisicaoInvalida('Escreva a alergia com pelo menos duas letras.');
    }

    const { descricao } = analise.data;

    // Toque repetido não empilha a mesma pendência na fila da equipe. A comparação é
    // insensível a maiúsculas porque a coleção padrão do MySQL já é assim.
    const pendenteIgual = await prisma.alergiaDoPaciente.findFirst({
      where: { pacienteId, descricao, confirmadaEm: null },
      select: { id: true, descricao: true, origem: true, confirmadaEm: true, criadaEm: true },
    });

    if (pendenteIgual) {
      return resposta.send({
        alergia: { ...pendenteIgual, confirmada: false },
        jaRegistrada: true,
        mensagem: 'Você já tinha registrado esta alergia. A equipe vai conferir.',
      });
    }

    const alergia = await prisma.alergiaDoPaciente.create({
      data: { pacienteId, descricao, origem: 'PACIENTE' },
      select: { id: true, descricao: true, origem: true, confirmadaEm: true, criadaEm: true },
    });

    return resposta.status(201).send({
      alergia: { ...alergia, confirmada: false },
      jaRegistrada: false,
      mensagem: 'Anotamos. A equipe vai conferir esta informação com você.',
    });
  });

  // -------------------------------------------------------------------------
  // Agenda
  // -------------------------------------------------------------------------

  /**
   * Agenda do próprio paciente, do compromisso mais próximo para o mais distante.
   *
   * Sem `de`, a lista começa na meia-noite de hoje no fuso do serviço (`inicioDoDia` de
   * `src/tempo.ts`) — o que o paciente quer ver ao abrir a tela é o que ainda vai
   * acontecer, incluindo o compromisso de hoje de manhã que já passou da hora.
   */
  app.get('/paciente/agenda', autenticado, async (requisicao) => {
    const pacienteId = exigirPaciente(requisicao);
    const parametros = lerPaginacao(requisicao.query);

    const analise = filtroDaAgendaSchema.safeParse(requisicao.query ?? {});
    if (!analise.success) {
      throw requisicaoInvalida('Não entendemos as datas do período. Escolha as datas de novo.');
    }

    const de = analise.data.de ?? inicioDoDia();
    const ate = analise.data.ate ?? null;

    if (ate && ate.getTime() < de.getTime()) {
      throw requisicaoInvalida('A data final do período vem antes da inicial. Confira as datas.');
    }

    const chave: ChaveDeOrdenacao = { campo: 'aconteceEm', direcao: 'asc', tipo: 'data' };
    const fatia = fatiaDoCursor<
      Prisma.EventoDeAgendaWhereInput,
      Prisma.EventoDeAgendaOrderByWithRelationInput
    >(chave, parametros);

    const linhas = await prisma.eventoDeAgenda.findMany({
      where: {
        pacienteId,
        aconteceEm: { gte: de, ...(ate ? { lte: ate } : {}) },
        ...(fatia.filtro ? { AND: [fatia.filtro] } : {}),
      },
      orderBy: fatia.ordenacao,
      take: fatia.quantidade,
      select: {
        id: true,
        tipo: true,
        aconteceEm: true,
        local: true,
        observacoes: true,
        profissional: { select: { nome: true, funcao: true } },
      },
    });

    const pagina = montarPagina(linhas, chave, parametros);
    return { ...pagina, periodo: { de, ate } };
  });

  // -------------------------------------------------------------------------
  // Biblioteca
  // -------------------------------------------------------------------------

  /**
   * Verbetes publicados, por categoria.
   *
   * `publicado: true` está no `where` da listagem E na busca por id. Conteúdo clínico não
   * revisado chegando ao paciente é dano direto, e o rascunho aberto por link direto
   * chegaria do mesmo jeito que pela lista.
   */
  app.get('/paciente/biblioteca', autenticado, async (requisicao) => {
    exigirPaciente(requisicao);
    const parametros = lerPaginacao(requisicao.query);

    const analise = filtroDaBibliotecaSchema.safeParse(requisicao.query ?? {});
    if (!analise.success) {
      throw requisicaoInvalida('Este assunto não existe na biblioteca. Escolha outro.');
    }

    const chave: ChaveDeOrdenacao = { campo: 'titulo', direcao: 'asc', tipo: 'texto' };
    const fatia = fatiaDoCursor<
      Prisma.VerbeteDaBibliotecaWhereInput,
      Prisma.VerbeteDaBibliotecaOrderByWithRelationInput
    >(chave, parametros);

    const linhas = await prisma.verbeteDaBiblioteca.findMany({
      where: {
        publicado: true,
        ...(analise.data.categoria ? { categoria: analise.data.categoria } : {}),
        ...(fatia.filtro ? { AND: [fatia.filtro] } : {}),
      },
      orderBy: fatia.ordenacao,
      take: fatia.quantidade,
      select: { id: true, categoria: true, titulo: true, autoria: true, revisadoEm: true },
    });

    return montarPagina(linhas, chave, parametros);
  });

  /** Um verbete. Não publicado responde 404 — não confirma nem que o rascunho existe. */
  app.get('/paciente/biblioteca/:id', autenticado, async (requisicao) => {
    exigirPaciente(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);

    const verbete = await prisma.verbeteDaBiblioteca.findFirst({
      where: { id, publicado: true },
      select: {
        id: true,
        categoria: true,
        titulo: true,
        corpo: true,
        autoria: true,
        fonteExterna: true,
        revisadoPor: true,
        revisadoEm: true,
      },
    });

    if (!verbete) throw naoEncontrado('Este conteúdo não está disponível.');

    return verbete;
  });

  // -------------------------------------------------------------------------
  // Falar com a enfermagem
  // -------------------------------------------------------------------------

  /**
   * O botão da tela 7.
   *
   * Deduplica só dentro da janela curta (`SOLICITACAO_JANELA_EM_MINUTOS`, padrão 30 min) e
   * só sobre pedido ainda não atendido. Passada a janela, o pedido é novo e a enfermagem é
   * avisada de novo — um pedido antigo esquecido na fila nunca cala o pedido de hoje.
   *
   * A resposta não promete prazo nem retorno: não existe regra de escala definida, e
   * inventar "a equipe retorna em X" seria prometer o que o serviço não combinou.
   */
  app.post('/paciente/solicitacoes-de-contato', autenticado, async (requisicao, resposta) => {
    const pacienteId = exigirPaciente(requisicao);

    const analise = solicitacaoDeContatoSchema.safeParse(requisicao.body ?? {});
    if (!analise.success) {
      throw requisicaoInvalida('Não conseguimos enviar seu pedido. Tente pelo botão da tela inicial.');
    }

    const { sessaoId } = analise.data;

    if (sessaoId) {
      const sessao = await prisma.sessaoDeTriagem.findUnique({
        where: { id: sessaoId },
        select: { pacienteId: true },
      });

      if (!sessao) throw naoEncontrado('Não encontramos este check-in.');
      if (sessao.pacienteId !== pacienteId) throw semPermissao('Este check-in é de outra pessoa.');
    }

    const agora = new Date();
    // Subtração de duração, não conta de calendário: nenhum fuso participa de "30 minutos
    // atrás". O que é conta de calendário no AUREA (dia do ciclo, mesmo dia, início do dia)
    // continua saindo inteiro de `src/tempo.ts`.
    const inicioDaJanela = new Date(agora.getTime() - JANELA_DE_DEDUPLICACAO_EM_MS);

    const recente = await prisma.solicitacaoDeContato.findFirst({
      where: { pacienteId, atendidaEm: null, solicitadaEm: { gte: inicioDaJanela } },
      orderBy: { solicitadaEm: 'desc' },
      select: { id: true, solicitadaEm: true, sessaoId: true },
    });

    if (recente) {
      return resposta.send({
        solicitacaoId: recente.id,
        solicitadaEm: recente.solicitadaEm,
        sessaoId: recente.sessaoId,
        reaproveitada: true,
        avisosEnviados: 0,
        mensagem: 'Seu pedido já está com a equipe de enfermagem.',
      });
    }

    const paciente = await prisma.paciente.findUniqueOrThrow({
      where: { id: pacienteId },
      select: { nome: true },
    });

    const solicitacao = await prisma.solicitacaoDeContato.create({
      data: { pacienteId, sessaoId: sessaoId ?? null },
      select: { id: true, solicitadaEm: true, sessaoId: true },
    });

    const avisados = await avisarPlantaoSobreSolicitacao(paciente.nome, solicitacao.id);

    if (avisados === 0) {
      // Pedido gravado e ninguém para receber. O paciente não pode ser informado disso —
      // não é problema dele — mas passar em silêncio seria o mesmo furo de antes.
      requisicao.log.error(
        { solicitacaoId: solicitacao.id },
        'Pedido de contato registrado sem ninguém com ATENDER_PLANTAO para avisar.',
      );
    }

    return resposta.status(201).send({
      solicitacaoId: solicitacao.id,
      solicitadaEm: solicitacao.solicitadaEm,
      sessaoId: solicitacao.sessaoId,
      reaproveitada: false,
      avisosEnviados: avisados,
      mensagem: 'Seu pedido foi enviado para a equipe de enfermagem.',
    });
  });

  /** Os próprios pedidos, do mais recente para o mais antigo. */
  app.get('/paciente/solicitacoes-de-contato', autenticado, async (requisicao) => {
    const pacienteId = exigirPaciente(requisicao);
    const parametros = lerPaginacao(requisicao.query);

    const chave: ChaveDeOrdenacao = { campo: 'solicitadaEm', direcao: 'desc', tipo: 'data' };
    const fatia = fatiaDoCursor<
      Prisma.SolicitacaoDeContatoWhereInput,
      Prisma.SolicitacaoDeContatoOrderByWithRelationInput
    >(chave, parametros);

    const linhas = await prisma.solicitacaoDeContato.findMany({
      where: { pacienteId, ...(fatia.filtro ? { AND: [fatia.filtro] } : {}) },
      orderBy: fatia.ordenacao,
      take: fatia.quantidade,
      select: { id: true, solicitadaEm: true, atendidaEm: true, sessaoId: true },
    });

    const pagina = montarPagina(linhas, chave, parametros);

    return {
      ...pagina,
      itens: pagina.itens.map((solicitacao) => ({
        ...solicitacao,
        atendida: solicitacao.atendidaEm !== null,
      })),
    };
  });

  // -------------------------------------------------------------------------
  // Notificações
  // -------------------------------------------------------------------------

  /**
   * As próprias notificações.
   *
   * O destinatário é o USUÁRIO da sessão, não o paciente: `Notificacao.destinatarioId`
   * aponta para `usuarios`, e é a mesma tabela que recebe os avisos da enfermagem.
   */
  app.get('/paciente/notificacoes', autenticado, async (requisicao) => {
    exigirPaciente(requisicao);
    const usuario = usuarioDa(requisicao);
    const parametros = lerPaginacao(requisicao.query);

    const analise = filtroDeNotificacoesSchema.safeParse(requisicao.query ?? {});
    if (!analise.success) {
      throw requisicaoInvalida('Não conseguimos carregar seus avisos. Feche e abra a tela de novo.');
    }

    const apenasNaoLidas = analise.data.apenasNaoLidas === 'true';

    const chave: ChaveDeOrdenacao = { campo: 'criadaEm', direcao: 'desc', tipo: 'data' };
    const fatia = fatiaDoCursor<
      Prisma.NotificacaoWhereInput,
      Prisma.NotificacaoOrderByWithRelationInput
    >(chave, parametros);

    const [linhas, naoLidas] = await Promise.all([
      prisma.notificacao.findMany({
        where: {
          destinatarioId: usuario.id,
          ...(apenasNaoLidas ? { lidaEm: null } : {}),
          ...(fatia.filtro ? { AND: [fatia.filtro] } : {}),
        },
        orderBy: fatia.ordenacao,
        take: fatia.quantidade,
        select: {
          id: true,
          canal: true,
          assunto: true,
          corpo: true,
          referenciaTipo: true,
          referenciaId: true,
          criadaEm: true,
          lidaEm: true,
        },
      }),
      prisma.notificacao.count({ where: { destinatarioId: usuario.id, lidaEm: null } }),
    ]);

    return { ...montarPagina(linhas, chave, parametros), naoLidas };
  });

  /**
   * Marca uma notificação como lida.
   *
   * Marcar de novo não reescreve `lidaEm`: a primeira leitura é a que responde "quando ele
   * viu isto", e sobrescrever apagaria justamente o dado que importa.
   */
  app.post('/paciente/notificacoes/:id/leitura', autenticado, async (requisicao) => {
    exigirPaciente(requisicao);
    const usuario = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);

    const notificacao = await prisma.notificacao.findUnique({
      where: { id },
      select: { id: true, destinatarioId: true, lidaEm: true },
    });

    if (!notificacao) throw naoEncontrado('Não encontramos este aviso.');
    if (notificacao.destinatarioId !== usuario.id) {
      throw semPermissao('Este aviso é de outra pessoa.');
    }

    if (notificacao.lidaEm) {
      return { id: notificacao.id, lidaEm: notificacao.lidaEm, jaEstavaLida: true };
    }

    const atualizada = await prisma.notificacao.update({
      where: { id },
      data: { lidaEm: new Date() },
      select: { id: true, lidaEm: true },
    });

    return { ...atualizada, jaEstavaLida: false };
  });
}
