import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CategoriaDaBiblioteca, TipoDeEvento, type Prisma } from '@prisma/client';
import { SINTOMAS, CLASSIFICACOES } from '@aurea/contratos';
import { prisma } from '../prisma.js';
import { ErroDaApi, conflito, naoEncontrado, requisicaoInvalida } from '../erros.js';
import { exigirPermissao, registrarAcesso, usuarioDa } from '../autenticacao/plugin.js';
import { diaCivil, diaCivilDeColunaDeData } from '../tempo.js';
import {
  fatiaDoCursor,
  lerPaginacao,
  montarPagina,
  type ChaveDeOrdenacao,
} from '../servicos/paginacao.js';

/**
 * Rotas administrativas de conteúdo (agenda, biblioteca, orientações) e a exportação do
 * conjunto de pesquisa.
 *
 * Segue o estilo de `rotas/admin.ts`: schemas Zod no topo, permissão explícita por grupo
 * de rota via `exigirPermissao`, e `registrarAcesso` em toda escrita — regra 5 do ADR-001.
 */

const idNaUrlSchema = z.object({ id: z.string().uuid() });

/**
 * Prisma devolve `Decimal` para campo numérico, que não é `number` e não converte com
 * `Number()` sozinho. Mesma necessidade e mesma solução de `paraNumero` em
 * `servicos/conjunto-de-limiares.ts` — duplicada aqui porque aquela função não é exportada
 * e o escopo desta entrega é um arquivo só.
 */
function paraNumeroOuNulo(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'object' && 'toNumber' in valor) {
    return (valor as { toNumber: () => number }).toNumber();
  }
  return Number(valor);
}

/**
 * Idade em anos completos, calculada por data civil — nunca por subtração de `Date` em
 * milissegundos, que erra perto do aniversário quando os dois instantes têm hora
 * diferente. Usa os utilitários de `tempo.ts`: `diaCivilDeColunaDeData` lê a coluna
 * `@db.Date` de nascimento como o dia que ela representa (não como instante UTC), e
 * `diaCivil` lê "hoje" no fuso do serviço. É a mesma disciplina que rege `diaDoCiclo`.
 */
function idadeEmAnos(dataNascimento: Date, referencia: Date): number {
  const nascimento = diaCivilDeColunaDeData(dataNascimento);
  const hoje = diaCivil(referencia);

  const anoNascimento = Math.floor(nascimento / 10000);
  const anoHoje = Math.floor(hoje / 10000);
  const diaMesNascimento = nascimento % 10000;
  const diaMesHoje = hoje % 10000;

  let idade = anoHoje - anoNascimento;
  if (diaMesHoje < diaMesNascimento) idade -= 1;
  return idade;
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

const criarEventoDeAgendaSchema = z.object({
  pacienteId: z.string().uuid(),
  tipo: z.enum(TipoDeEvento),
  aconteceEm: z.coerce.date(),
  local: z.string().trim().min(1).max(180).optional(),
  observacoes: z.string().trim().min(1).max(4000).optional(),
  profissionalId: z.string().uuid().optional(),
});

const editarEventoDeAgendaSchema = z.object({
  tipo: z.enum(TipoDeEvento).optional(),
  aconteceEm: z.coerce.date().optional(),
  local: z.string().trim().min(1).max(180).nullable().optional(),
  observacoes: z.string().trim().min(1).max(4000).nullable().optional(),
  profissionalId: z.string().uuid().nullable().optional(),
});

async function validarProfissional(profissionalId: string | null | undefined): Promise<void> {
  if (!profissionalId) return;
  const existe = await prisma.profissional.findUnique({
    where: { id: profissionalId },
    select: { id: true },
  });
  if (!existe) throw naoEncontrado('Profissional não encontrado.');
}

// ---------------------------------------------------------------------------
// Biblioteca
// ---------------------------------------------------------------------------

/**
 * GAP: a especificação pedia "titulo, resumo, conteudo/corpo, categoria". O schema
 * (`VerbeteDaBiblioteca`) não tem campo `resumo` — só `titulo`, `corpo`, `categoria`,
 * `autoria`, `fonteExterna`, `revisadoPor`, `revisadoEm`, `publicado`. Implementado com
 * os campos que existem; `resumo` não foi inventado.
 */
const criarVerbeteSchema = z.object({
  categoria: z.enum(CategoriaDaBiblioteca),
  titulo: z.string().trim().min(2).max(180),
  corpo: z.string().trim().min(1),
  autoria: z.string().trim().min(2).max(180),
  fonteExterna: z.string().trim().max(500).optional(),
  revisadoPor: z.string().trim().min(2).max(180).optional(),
  publicado: z.boolean().default(false),
});

const editarVerbeteSchema = z.object({
  categoria: z.enum(CategoriaDaBiblioteca).optional(),
  titulo: z.string().trim().min(2).max(180).optional(),
  corpo: z.string().trim().min(1).optional(),
  autoria: z.string().trim().min(2).max(180).optional(),
  fonteExterna: z.string().trim().max(500).nullable().optional(),
  revisadoPor: z.string().trim().min(2).max(180).nullable().optional(),
  publicado: z.boolean().optional(),
});

const filtroDaBibliotecaAdminSchema = z.object({
  categoria: z.enum(CategoriaDaBiblioteca).optional(),
  publicado: z.enum(['true', 'false']).optional(),
});

// ---------------------------------------------------------------------------
// Orientações — versionamento
// ---------------------------------------------------------------------------

const camposDaOrientacaoSchema = {
  sintoma: z.enum(SINTOMAS),
  classificacao: z.enum(CLASSIFICACOES),
  protocoloId: z.string().uuid().nullable().optional(),
  ordem: z.number().int().min(0).default(0),
  titulo: z.string().trim().min(2).max(180),
  corpo: z.string().trim().min(1),
  medicamentoId: z.string().uuid().nullable().optional(),
  verbeteId: z.string().uuid().nullable().optional(),
};

/**
 * `versaoDoNovoConjunto`/`descricaoDoNovoConjunto` só são usados quando a escrita cai
 * num conjunto novo — publicado sendo clonado, ou nenhum conjunto existindo ainda. Ver
 * `resolverConjuntoParaEscrita`.
 */
const criarOrientacaoSchema = z.object({
  conjuntoId: z.string().uuid().optional(),
  ...camposDaOrientacaoSchema,
  versaoDoNovoConjunto: z.string().trim().min(1).max(60).optional(),
  descricaoDoNovoConjunto: z.string().trim().min(3).optional(),
});

const editarOrientacaoSchema = z.object({
  sintoma: z.enum(SINTOMAS).optional(),
  classificacao: z.enum(CLASSIFICACOES).optional(),
  protocoloId: z.string().uuid().nullable().optional(),
  ordem: z.number().int().min(0).optional(),
  titulo: z.string().trim().min(2).max(180).optional(),
  corpo: z.string().trim().min(1).optional(),
  medicamentoId: z.string().uuid().nullable().optional(),
  verbeteId: z.string().uuid().nullable().optional(),
  versaoDoNovoConjunto: z.string().trim().min(1).max(60).optional(),
  descricaoDoNovoConjunto: z.string().trim().min(3).optional(),
});

async function validarReferenciasDaOrientacao(dados: {
  protocoloId?: string | null;
  medicamentoId?: string | null;
  verbeteId?: string | null;
}): Promise<void> {
  if (dados.protocoloId) {
    const existe = await prisma.protocolo.findUnique({
      where: { id: dados.protocoloId },
      select: { id: true },
    });
    if (!existe) throw naoEncontrado('Protocolo não encontrado.');
  }
  if (dados.medicamentoId) {
    const existe = await prisma.medicamento.findUnique({
      where: { id: dados.medicamentoId },
      select: { id: true },
    });
    if (!existe) throw naoEncontrado('Medicamento não encontrado.');
  }
  if (dados.verbeteId) {
    const existe = await prisma.verbeteDaBiblioteca.findUnique({
      where: { id: dados.verbeteId },
      select: { id: true },
    });
    if (!existe) throw naoEncontrado('Verbete da biblioteca não encontrado.');
  }
}

async function garantirVersaoLivre(versao: string): Promise<void> {
  const existente = await prisma.conjuntoDeOrientacoes.findUnique({
    where: { versao },
    select: { id: true },
  });
  if (existente) throw conflito(`Já existe um conjunto de orientações com a versão "${versao}".`);
}

/**
 * Clona um conjunto de orientações inteiro para um rascunho novo (`ativo: false`),
 * preservando todas as orientações. Existe porque conjunto publicado é imutável — a
 * mesma regra de `ConjuntoDeLimiares` (comentário no schema: "Conjunto publicado nunca é
 * editado — publica-se outro e desativa-se o anterior"; e em `rotas/admin.ts` não existe
 * NENHUM endpoint de PATCH sobre limiar publicado, só criação de conjunto novo inteiro).
 * `ConjuntoDeOrientacoes` tem a mesma forma (`ativo` + `publicadoEm`) e serve à mesma
 * regra 3 do ADR-001 ("orientação também é versionada"): editar em cima do publicado
 * apagaria, sem log, o texto exato que o paciente leu na tela 7 num dia já passado.
 *
 * Roda numa transação interativa porque o id do conjunto novo só existe depois do
 * primeiro `create` e é usado em todos os `create` de orientação seguintes.
 */
async function clonarConjuntoDeOrientacoesParaRascunho(
  conjuntoOrigemId: string,
  versao: string,
  descricao: string,
): Promise<{ conjuntoId: string; mapaDeIds: Map<string, string> }> {
  await garantirVersaoLivre(versao);

  const original = await prisma.conjuntoDeOrientacoes.findUnique({
    where: { id: conjuntoOrigemId },
    include: { orientacoes: true },
  });
  if (!original) throw naoEncontrado('Conjunto de orientações não encontrado.');

  return prisma.$transaction(async (tx) => {
    const novo = await tx.conjuntoDeOrientacoes.create({
      data: { versao, descricao, ativo: false },
    });

    const mapaDeIds = new Map<string, string>();
    for (const orientacao of original.orientacoes) {
      const clonada = await tx.orientacao.create({
        data: {
          conjuntoId: novo.id,
          sintoma: orientacao.sintoma,
          classificacao: orientacao.classificacao,
          protocoloId: orientacao.protocoloId,
          ordem: orientacao.ordem,
          titulo: orientacao.titulo,
          corpo: orientacao.corpo,
          medicamentoId: orientacao.medicamentoId,
          verbeteId: orientacao.verbeteId,
        },
      });
      mapaDeIds.set(orientacao.id, clonada.id);
    }

    return { conjuntoId: novo.id, mapaDeIds };
  });
}

/**
 * Decide em qual `ConjuntoDeOrientacoes` uma escrita nova (POST) cai, respeitando a
 * imutabilidade do publicado. Três casos:
 *
 * 1. `conjuntoId` aponta para um rascunho (`ativo: false`) — escreve nele direto.
 * 2. `conjuntoId` aponta para o publicado, ou foi omitido e existe um conjunto ativo —
 *    clona o publicado num rascunho novo (`clonarConjuntoDeOrientacoesParaRascunho`) e a
 *    escrita cai no clone.
 * 3. Não existe nenhum conjunto ainda — cria o primeiro, como rascunho.
 *
 * Casos 2 e 3 exigem `versao`/`descricao` do conjunto novo: `versao` é `@unique` no
 * schema, e só quem está cadastrando sabe como nomear a versão.
 *
 * GAP: não existe endpoint de publicação para `ConjuntoDeOrientacoes` nesta API (o
 * equivalente de `POST /admin/limiares/:id/publicar`). O rascunho criado aqui fica
 * `ativo: false` até essa rota existir — está fora do escopo desta entrega.
 */
async function resolverConjuntoParaEscrita(
  conjuntoId: string | undefined,
  versaoDoNovoConjunto: string | undefined,
  descricaoDoNovoConjunto: string | undefined,
): Promise<{ id: string; rascunhoCriado: boolean }> {
  const conjunto = conjuntoId
    ? await prisma.conjuntoDeOrientacoes.findUnique({ where: { id: conjuntoId } })
    : await prisma.conjuntoDeOrientacoes.findFirst({ where: { ativo: true } });

  if (conjuntoId && !conjunto) throw naoEncontrado('Conjunto de orientações não encontrado.');

  if (conjunto && !conjunto.ativo) {
    return { id: conjunto.id, rascunhoCriado: false };
  }

  if (!versaoDoNovoConjunto || !descricaoDoNovoConjunto) {
    throw requisicaoInvalida(
      conjunto
        ? 'O conjunto de orientações ativo está publicado e não pode ser editado. Informe versaoDoNovoConjunto e descricaoDoNovoConjunto para criar um rascunho com esta orientação.'
        : 'Não existe nenhum conjunto de orientações ainda. Informe versaoDoNovoConjunto e descricaoDoNovoConjunto para criar o primeiro.',
    );
  }

  if (conjunto) {
    const clone = await clonarConjuntoDeOrientacoesParaRascunho(
      conjunto.id,
      versaoDoNovoConjunto,
      descricaoDoNovoConjunto,
    );
    return { id: clone.conjuntoId, rascunhoCriado: true };
  }

  await garantirVersaoLivre(versaoDoNovoConjunto);
  const novo = await prisma.conjuntoDeOrientacoes.create({
    data: { versao: versaoDoNovoConjunto, descricao: descricaoDoNovoConjunto, ativo: false },
  });
  return { id: novo.id, rascunhoCriado: true };
}

// ---------------------------------------------------------------------------
// Exportação do conjunto de pesquisa
// ---------------------------------------------------------------------------

const filtroDeExportacaoSchema = z.object({
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
});

export async function rotasDeConteudoEPesquisa(app: FastifyInstance) {
  const autenticar = (requisicao: Parameters<typeof app.autenticar>[0]) =>
    app.autenticar(requisicao);

  const comCadastro = { preHandler: [autenticar, exigirPermissao('GERENCIAR_CADASTROS')] };
  const comOrientacao = { preHandler: [autenticar, exigirPermissao('EDITAR_ORIENTACAO')] };
  const comExportacao = {
    preHandler: [autenticar, exigirPermissao('EXPORTAR_CONJUNTO_DE_PESQUISA')],
  };

  // -------------------------------------------------------------------------
  // Agenda
  // -------------------------------------------------------------------------

  app.post('/admin/agenda', comCadastro, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const analise = criarEventoDeAgendaSchema.safeParse(requisicao.body);
    if (!analise.success) throw requisicaoInvalida('Evento de agenda inválido.', analise.error.issues);
    const dados = analise.data;

    const paciente = await prisma.paciente.findUnique({
      where: { id: dados.pacienteId },
      select: { id: true },
    });
    if (!paciente) throw naoEncontrado('Paciente não encontrado.');
    await validarProfissional(dados.profissionalId);

    const criado = await prisma.eventoDeAgenda.create({
      data: {
        pacienteId: dados.pacienteId,
        tipo: dados.tipo,
        aconteceEm: dados.aconteceEm,
        local: dados.local ?? null,
        observacoes: dados.observacoes ?? null,
        profissionalId: dados.profissionalId ?? null,
      },
    });

    // Não existe ação específica de agenda no enum `AcaoDeAcesso`. `CRIACAO_DE_CADASTRO`
    // é a mesma escolha que `rotas/admin.ts` usa para protocolo e medicamento.
    await registrarAcesso(requisicao, {
      acao: 'CRIACAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: dados.pacienteId,
    });

    return resposta.status(201).send(criado);
  });

  app.patch('/admin/agenda/:id', comCadastro, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);
    const analise = editarEventoDeAgendaSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Alteração de agenda inválida.', analise.error.issues);
    }
    const dados = analise.data;

    if (Object.values(dados).every((valor) => valor === undefined)) {
      throw requisicaoInvalida('Envie ao menos um campo para alterar.');
    }

    const existente = await prisma.eventoDeAgenda.findUnique({ where: { id } });
    if (!existente) throw naoEncontrado('Evento de agenda não encontrado.');
    if (dados.profissionalId) await validarProfissional(dados.profissionalId);

    const atualizado = await prisma.eventoDeAgenda.update({
      where: { id },
      data: {
        ...(dados.tipo !== undefined ? { tipo: dados.tipo } : {}),
        ...(dados.aconteceEm !== undefined ? { aconteceEm: dados.aconteceEm } : {}),
        ...(dados.local !== undefined ? { local: dados.local } : {}),
        ...(dados.observacoes !== undefined ? { observacoes: dados.observacoes } : {}),
        ...(dados.profissionalId !== undefined ? { profissionalId: dados.profissionalId } : {}),
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: existente.pacienteId,
    });

    return atualizado;
  });

  app.delete('/admin/agenda/:id', comCadastro, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);

    const existente = await prisma.eventoDeAgenda.findUnique({ where: { id } });
    if (!existente) throw naoEncontrado('Evento de agenda não encontrado.');

    await prisma.eventoDeAgenda.delete({ where: { id } });

    // Mesma lacuna do PATCH acima: sem ação de exclusão no enum, usa-se a genérica.
    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: existente.pacienteId,
    });

    return resposta.status(204).send();
  });

  // -------------------------------------------------------------------------
  // Biblioteca
  // -------------------------------------------------------------------------

  app.get('/admin/biblioteca', comOrientacao, async (requisicao) => {
    const parametros = lerPaginacao(requisicao.query);
    const analise = filtroDaBibliotecaAdminSchema.safeParse(requisicao.query ?? {});
    if (!analise.success) {
      throw requisicaoInvalida('Filtro de biblioteca inválido.', analise.error.issues);
    }

    const chave: ChaveDeOrdenacao = { campo: 'titulo', direcao: 'asc', tipo: 'texto' };
    const fatia = fatiaDoCursor<
      Prisma.VerbeteDaBibliotecaWhereInput,
      Prisma.VerbeteDaBibliotecaOrderByWithRelationInput
    >(chave, parametros);

    const linhas = await prisma.verbeteDaBiblioteca.findMany({
      where: {
        ...(analise.data.categoria ? { categoria: analise.data.categoria } : {}),
        ...(analise.data.publicado !== undefined
          ? { publicado: analise.data.publicado === 'true' }
          : {}),
        ...(fatia.filtro ? { AND: [fatia.filtro] } : {}),
      },
      orderBy: fatia.ordenacao,
      take: fatia.quantidade,
      select: {
        id: true,
        categoria: true,
        titulo: true,
        autoria: true,
        fonteExterna: true,
        revisadoPor: true,
        revisadoEm: true,
        publicado: true,
        criadoEm: true,
      },
    });

    return montarPagina(linhas, chave, parametros);
  });

  /**
   * `revisadoEm` nunca vem do corpo da requisição — é o servidor que carimba quando
   * `revisadoPor` é preenchido, do mesmo jeito que `validadoEm` em `rotas/admin.ts` e
   * `lidaEm` em `rotas/paciente.ts` nunca vêm do cliente. Data de revisão digitada por
   * quem cadastra não é revisão, é alegação.
   */
  app.post('/admin/biblioteca', comOrientacao, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const analise = criarVerbeteSchema.safeParse(requisicao.body);
    if (!analise.success) throw requisicaoInvalida('Verbete inválido.', analise.error.issues);
    const dados = analise.data;

    if (dados.publicado && !dados.revisadoPor) {
      // Espelha o comentário do schema em `VerbeteDaBiblioteca`: "publicar sem revisão
      // é o que a coluna existe para impedir."
      throw requisicaoInvalida('Verbete não pode nascer publicado sem revisadoPor preenchido.');
    }

    const criado = await prisma.verbeteDaBiblioteca.create({
      data: {
        categoria: dados.categoria,
        titulo: dados.titulo,
        corpo: dados.corpo,
        autoria: dados.autoria,
        fonteExterna: dados.fonteExterna ?? null,
        revisadoPor: dados.revisadoPor ?? null,
        revisadoEm: dados.revisadoPor ? new Date() : null,
        publicado: dados.publicado,
      },
    });

    // Verbete não é dado de paciente — não leva `pacienteId` no log, mesma lógica de
    // protocolo/medicamento em `rotas/admin.ts`.
    await registrarAcesso(requisicao, { acao: 'CRIACAO_DE_CADASTRO', usuarioId: usuario.id });

    return resposta.status(201).send(criado);
  });

  app.patch('/admin/biblioteca/:id', comOrientacao, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);
    const analise = editarVerbeteSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Alteração de verbete inválida.', analise.error.issues);
    }
    const dados = analise.data;

    if (Object.values(dados).every((valor) => valor === undefined)) {
      throw requisicaoInvalida('Envie ao menos um campo para alterar.');
    }

    const existente = await prisma.verbeteDaBiblioteca.findUnique({ where: { id } });
    if (!existente) throw naoEncontrado('Verbete não encontrado.');

    const revisadoPorEfetivo =
      dados.revisadoPor !== undefined ? dados.revisadoPor : existente.revisadoPor;
    const vaiFicarPublicado = dados.publicado ?? existente.publicado;

    if (vaiFicarPublicado && !revisadoPorEfetivo) {
      throw requisicaoInvalida('Verbete não pode ficar publicado sem revisadoPor preenchido.');
    }

    // `revisadoEm` acompanha `revisadoPor`: some quando `revisadoPor` é limpo, é
    // carimbado pelo servidor na primeira vez que `revisadoPor` é preenchido ou muda, e
    // fica como estava quando `revisadoPor` não é tocado nesta chamada.
    const revisadoEmEfetivo =
      dados.revisadoPor === undefined
        ? undefined
        : dados.revisadoPor === null
          ? null
          : existente.revisadoPor === dados.revisadoPor
            ? existente.revisadoEm
            : new Date();

    const atualizado = await prisma.verbeteDaBiblioteca.update({
      where: { id },
      data: {
        ...(dados.categoria !== undefined ? { categoria: dados.categoria } : {}),
        ...(dados.titulo !== undefined ? { titulo: dados.titulo } : {}),
        ...(dados.corpo !== undefined ? { corpo: dados.corpo } : {}),
        ...(dados.autoria !== undefined ? { autoria: dados.autoria } : {}),
        ...(dados.fonteExterna !== undefined ? { fonteExterna: dados.fonteExterna } : {}),
        ...(dados.revisadoPor !== undefined ? { revisadoPor: dados.revisadoPor } : {}),
        ...(revisadoEmEfetivo !== undefined ? { revisadoEm: revisadoEmEfetivo } : {}),
        ...(dados.publicado !== undefined ? { publicado: dados.publicado } : {}),
      },
    });

    await registrarAcesso(requisicao, { acao: 'EDICAO_DE_CADASTRO', usuarioId: usuario.id });

    return atualizado;
  });

  // -------------------------------------------------------------------------
  // Orientações
  // -------------------------------------------------------------------------

  app.post('/admin/orientacoes', comOrientacao, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const analise = criarOrientacaoSchema.safeParse(requisicao.body);
    if (!analise.success) throw requisicaoInvalida('Orientação inválida.', analise.error.issues);
    const dados = analise.data;

    await validarReferenciasDaOrientacao(dados);

    const alvo = await resolverConjuntoParaEscrita(
      dados.conjuntoId,
      dados.versaoDoNovoConjunto,
      dados.descricaoDoNovoConjunto,
    );

    const criada = await prisma.orientacao.create({
      data: {
        conjuntoId: alvo.id,
        sintoma: dados.sintoma,
        classificacao: dados.classificacao,
        protocoloId: dados.protocoloId ?? null,
        ordem: dados.ordem,
        titulo: dados.titulo,
        corpo: dados.corpo,
        medicamentoId: dados.medicamentoId ?? null,
        verbeteId: dados.verbeteId ?? null,
      },
    });

    await registrarAcesso(requisicao, { acao: 'EDICAO_DE_ORIENTACAO', usuarioId: usuario.id });

    return resposta.status(201).send({
      orientacao: criada,
      conjuntoId: alvo.id,
      rascunhoCriado: alvo.rascunhoCriado,
      aviso: alvo.rascunhoCriado
        ? 'Um conjunto de orientações rascunho foi criado (ou clonado do publicado) para receber esta orientação. Esta API ainda não tem endpoint de publicação para ele — pendência declarada no código.'
        : null,
    });
  });

  app.patch('/admin/orientacoes/:id', comOrientacao, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);
    const analise = editarOrientacaoSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Alteração de orientação inválida.', analise.error.issues);
    }
    const dados = analise.data;

    const alteracoes = {
      sintoma: dados.sintoma,
      classificacao: dados.classificacao,
      protocoloId: dados.protocoloId,
      ordem: dados.ordem,
      titulo: dados.titulo,
      corpo: dados.corpo,
      medicamentoId: dados.medicamentoId,
      verbeteId: dados.verbeteId,
    };
    if (Object.values(alteracoes).every((valor) => valor === undefined)) {
      throw requisicaoInvalida('Envie ao menos um campo para alterar.');
    }

    await validarReferenciasDaOrientacao(alteracoes);

    const original = await prisma.orientacao.findUnique({
      where: { id },
      include: { conjunto: true },
    });
    if (!original) throw naoEncontrado('Orientação não encontrada.');

    let idParaAtualizar = original.id;
    let rascunhoCriado = false;

    // Regra de versionamento (mesma de `resolverConjuntoParaEscrita`): conjunto
    // publicado é imutável. Editar uma orientação dele clona o conjunto inteiro para um
    // rascunho e aplica a mudança só no clone — o publicado, e o que qualquer paciente
    // já leu dele, fica intocado.
    if (original.conjunto.ativo) {
      if (!dados.versaoDoNovoConjunto || !dados.descricaoDoNovoConjunto) {
        throw requisicaoInvalida(
          'Esta orientação pertence a um conjunto publicado e não pode ser editada. Informe versaoDoNovoConjunto e descricaoDoNovoConjunto para editar numa cópia rascunho.',
        );
      }

      const clone = await clonarConjuntoDeOrientacoesParaRascunho(
        original.conjunto.id,
        dados.versaoDoNovoConjunto,
        dados.descricaoDoNovoConjunto,
      );
      const idClonado = clone.mapaDeIds.get(original.id);
      if (!idClonado) {
        throw new ErroDaApi(500, 'Falha ao localizar a orientação clonada no rascunho novo.');
      }
      idParaAtualizar = idClonado;
      rascunhoCriado = true;
    }

    const atualizada = await prisma.orientacao.update({
      where: { id: idParaAtualizar },
      data: {
        ...(alteracoes.sintoma !== undefined ? { sintoma: alteracoes.sintoma } : {}),
        ...(alteracoes.classificacao !== undefined
          ? { classificacao: alteracoes.classificacao }
          : {}),
        ...(alteracoes.protocoloId !== undefined ? { protocoloId: alteracoes.protocoloId } : {}),
        ...(alteracoes.ordem !== undefined ? { ordem: alteracoes.ordem } : {}),
        ...(alteracoes.titulo !== undefined ? { titulo: alteracoes.titulo } : {}),
        ...(alteracoes.corpo !== undefined ? { corpo: alteracoes.corpo } : {}),
        ...(alteracoes.medicamentoId !== undefined
          ? { medicamentoId: alteracoes.medicamentoId }
          : {}),
        ...(alteracoes.verbeteId !== undefined ? { verbeteId: alteracoes.verbeteId } : {}),
      },
    });

    await registrarAcesso(requisicao, { acao: 'EDICAO_DE_ORIENTACAO', usuarioId: usuario.id });

    return {
      orientacao: atualizada,
      rascunhoCriado,
      aviso: rascunhoCriado
        ? 'A orientação original pertencia a um conjunto publicado. A edição foi aplicada numa cópia rascunho; o publicado não foi tocado. Esta API ainda não tem endpoint de publicação para o rascunho — pendência declarada no código.'
        : null,
    };
  });

  // -------------------------------------------------------------------------
  // Exportação do conjunto de pesquisa
  // -------------------------------------------------------------------------

  /**
   * Exporta sessões de triagem, respostas e classificações de pacientes com
   * `ParticipanteDePesquisa` registrado — regra 7 do ADR-001. Pseudonimizado por
   * desenho: o que sai é o `codigo` do participante, nunca o `pacienteId` do prontuário.
   *
   * EXCLUÍDO deste JSON, e por quê:
   * - nome, cpf, e-mail, telefone: identificam a pessoa diretamente; a pesquisa não
   *   precisa de identidade, precisa de sintoma e classificação.
   * - endereço: o schema do AUREA não tem este campo em `Paciente` — não há o que
   *   excluir aqui além de nunca inventar a coluna.
   * - data de nascimento completa: substituída por `idadeEmAnos` (função `idadeEmAnos`
   *   acima), que dá o dado clinicamente útil (idade) sem o identificador (data exata,
   *   que cruzada com outros registros públicos costuma reidentificar sozinha).
   * - `pacienteId` do prontuário, `ContatoDoPaciente`, `convenio`, `tipoSanguineo`,
   *   `urlDaFoto`, `habitoIntestinalBasal`, `medicoAssistente`: nenhum é sessão,
   *   resposta ou classificação — fora do que este endpoint promete exportar, e cada um
   *   é outro fio de reidentificação sem servir à pergunta de pesquisa.
   * - `chaveDeIdempotencia` da sessão: identificador técnico gerado pelo cliente do
   *   paciente, sem valor de pesquisa e sem necessidade de sair do serviço.
   * - `Intervencao` (conduta da enfermagem, nome do profissional): não é sessão,
   *   resposta nem classificação — e citaria profissional e narrativa clínica que a
   *   pergunta de pesquisa não pede.
   *
   * Participante com `excluidoEm` preenchido (saiu do estudo) nunca entra na
   * exportação — consentimento retirado se aplica daqui em diante.
   */
  app.get('/admin/exportacao/pesquisa', comExportacao, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const analise = filtroDeExportacaoSchema.safeParse(requisicao.query ?? {});
    if (!analise.success) {
      throw requisicaoInvalida('Período de exportação inválido.', analise.error.issues);
    }
    const { de, ate } = analise.data;

    if (de && ate && ate.getTime() < de.getTime()) {
      throw requisicaoInvalida('A data final do período vem antes da inicial.');
    }

    const participantes = await prisma.participanteDePesquisa.findMany({
      where: { excluidoEm: null },
      select: {
        codigo: true,
        paciente: {
          select: {
            id: true,
            dataNascimento: true,
            sexo: true,
            diagnostico: true,
            sessoesDeTriagem: {
              where: {
                ...(de || ate
                  ? { iniciadaEm: { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) } }
                  : {}),
              },
              select: {
                id: true,
                estado: true,
                iniciadaEm: true,
                concluidaEm: true,
                respostas: {
                  select: {
                    sintoma: true,
                    campo: true,
                    valorNumerico: true,
                    valorBooleano: true,
                    valorTexto: true,
                    respondidaEm: true,
                  },
                },
                classificacoes: {
                  select: {
                    situacao: true,
                    resultado: true,
                    motivoDeNaoClassificar: true,
                    explicacao: true,
                    origem: true,
                    calculadaEm: true,
                    conjunto: { select: { versao: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const agora = new Date();

    const conjuntoDePesquisa = participantes.map((participante) => ({
      participanteId: participante.codigo,
      idadeEmAnos: idadeEmAnos(participante.paciente.dataNascimento, agora),
      sexo: participante.paciente.sexo,
      diagnostico: participante.paciente.diagnostico,
      sessoes: participante.paciente.sessoesDeTriagem.map((sessao) => ({
        sessaoId: sessao.id,
        estado: sessao.estado,
        iniciadaEm: sessao.iniciadaEm,
        concluidaEm: sessao.concluidaEm,
        respostas: sessao.respostas.map((resposta) => ({
          sintoma: resposta.sintoma,
          campo: resposta.campo,
          valorNumerico: paraNumeroOuNulo(resposta.valorNumerico),
          valorBooleano: resposta.valorBooleano,
          valorTexto: resposta.valorTexto,
          respondidaEm: resposta.respondidaEm,
        })),
        classificacoes: sessao.classificacoes.map((classificacao) => ({
          versaoDoConjuntoDeLimiares: classificacao.conjunto.versao,
          situacao: classificacao.situacao,
          resultado: classificacao.resultado,
          motivoDeNaoClassificar: classificacao.motivoDeNaoClassificar,
          explicacao: classificacao.explicacao,
          origem: classificacao.origem,
          calculadaEm: classificacao.calculadaEm,
        })),
      })),
    }));

    // Regra 5 do ADR-001 aplicada ao pior caso: a exportação lê o histórico de todos os
    // participantes de uma vez, e cada paciente lido precisa aparecer na trilha como se
    // tivesse sido lido individualmente. O `pacienteId` real do prontuário vai só para
    // `LogDeAcesso` — trilha operacional interna, nunca para o JSON exportado.
    await Promise.all(
      participantes.map((participante) =>
        registrarAcesso(requisicao, {
          acao: 'EXPORTACAO_DE_PESQUISA',
          usuarioId: usuario.id,
          pacienteId: participante.paciente.id,
        }),
      ),
    );

    return {
      geradoEm: agora,
      periodo: { de: de ?? null, ate: ate ?? null },
      participantes: conjuntoDePesquisa,
    };
  });
}
