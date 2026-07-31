import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CLASSIFICACOES,
  EFEITOS_DO_ANTITERMICO,
  OPERADORES,
  POLITICAS_DE_COMBINACAO,
  SINTOMAS,
  TRATAMENTOS_DE_ABANDONO,
} from '@aurea/contratos';
import { conferirIntegridadeDoConjunto } from '@aurea/triagem';
import { prisma } from '../prisma.js';
import { ErroDaApi, conflito, naoEncontrado, requisicaoInvalida, semPermissao } from '../erros.js';
import { exigirPermissao, registrarAcesso, usuarioDa } from '../autenticacao/plugin.js';
import { ativarConjunto, carregarConjuntoPorId } from '../servicos/conjunto-de-limiares.js';
import { compararConjuntos, descreverRegra } from '../servicos/comparacao-de-conjuntos.js';

const regraSchema = z.object({
  ordem: z.number().int().min(0),
  sintoma: z.enum(SINTOMAS),
  campo: z.string().min(1).max(64),
  operador: z.enum(OPERADORES),
  valor: z.number().finite().nullable().optional(),
  valorSecundario: z.number().finite().nullable().optional(),
  valoresDeTexto: z.array(z.string().max(60)).max(20).optional(),
  classificacao: z.enum(CLASSIFICACOES),
  justificativa: z.string().min(3).max(2000),
  diaDoCicloMinimo: z.number().int().min(0).max(400).nullable().optional(),
  diaDoCicloMaximo: z.number().int().min(0).max(400).nullable().optional(),
  protocoloId: z.string().uuid().nullable().optional(),
});

const importarConjuntoSchema = z.object({
  versao: z.string().min(1).max(60),
  descricao: z.string().min(3),
  origem: z.string().min(3).max(255),
  combinacao: z.enum(POLITICAS_DE_COMBINACAO).default('PIOR_ISOLADO'),
  efeitoDoAntitermico: z.enum(EFEITOS_DO_ANTITERMICO).default('IGNORAR'),
  tratamentoDeAbandono: z.enum(TRATAMENTOS_DE_ABANDONO).default('NAO_CLASSIFICAR'),
  regras: z.array(regraSchema).min(1).max(500),
});

export async function rotasDeAdmin(app: FastifyInstance) {
  const autenticar = (requisicao: Parameters<typeof app.autenticar>[0]) =>
    app.autenticar(requisicao);

  const comLeitura = { preHandler: [autenticar, exigirPermissao('EDITAR_ALGORITMO', 'PUBLICAR_ALGORITMO', 'GERENCIAR_CADASTROS')] };
  const comEdicao = { preHandler: [autenticar, exigirPermissao('EDITAR_ALGORITMO')] };
  const comPublicacao = { preHandler: [autenticar, exigirPermissao('PUBLICAR_ALGORITMO')] };
  const comCadastro = { preHandler: [autenticar, exigirPermissao('GERENCIAR_CADASTROS')] };

  // ---------------------------------------------------------------------------
  // Conjuntos de limiares — o coração do admin
  // ---------------------------------------------------------------------------

  app.get('/admin/limiares', comLeitura, async () => {
    const conjuntos = await prisma.conjuntoDeLimiares.findMany({
      orderBy: [{ ativo: 'desc' }, { criadoEm: 'desc' }],
      include: {
        _count: { select: { regras: true, classificacoes: true } },
        validadoPor: { select: { nome: true, funcao: true, registroDoConselho: true } },
      },
    });

    return conjuntos.map((conjunto) => ({
      id: conjunto.id,
      versao: conjunto.versao,
      descricao: conjunto.descricao,
      origem: conjunto.origem,
      ativo: conjunto.ativo,
      validadoClinicamente: conjunto.validadoClinicamente,
      validadoPor: conjunto.validadoPor,
      validadoEm: conjunto.validadoEm,
      publicadoEm: conjunto.publicadoEm,
      criadoEm: conjunto.criadoEm,
      regras: conjunto._count.regras,
      /** Quantas classificações já saíram deste conjunto. Conjunto com histórico
       *  não pode ser tratado como rascunho descartável. */
      classificacoesProduzidas: conjunto._count.classificacoes,
    }));
  });

  app.get('/admin/limiares/:id', comLeitura, async (requisicao) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(requisicao.params);
    const conjunto = await carregarConjuntoPorId(id);

    return {
      ...conjunto,
      // A frase em português é o que o orientador confere. Ninguém revisa corte
      // clínico lendo operador e valor soltos.
      regras: conjunto.regras.map((regra) => ({ ...regra, descricao: descreverRegra(regra) })),
      problemasDeIntegridade: conferirIntegridadeDoConjunto(conjunto),
    };
  });

  /**
   * Importa um conjunto novo. Nasce SEMPRE inativo.
   *
   * A validação de integridade roda antes de gravar: regra apontando para campo que não
   * existe na árvore nunca dispara, e o efeito é um corte que a equipe pensa que está
   * valendo e não está. Silencioso, e por isso pior que um erro.
   */
  app.post('/admin/limiares', comEdicao, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const analise = importarConjuntoSchema.safeParse(requisicao.body);

    if (!analise.success) {
      throw requisicaoInvalida('Conjunto inválido.', analise.error.issues);
    }

    const dados = analise.data;

    const jaExiste = await prisma.conjuntoDeLimiares.findUnique({
      where: { versao: dados.versao },
    });
    if (jaExiste) throw conflito(`Já existe um conjunto com a versão "${dados.versao}".`);

    const paraConferir = {
      id: 'novo',
      versao: dados.versao,
      descricao: dados.descricao,
      origem: dados.origem,
      validadoClinicamente: false,
      politica: {
        combinacao: dados.combinacao,
        efeitoDoAntitermico: dados.efeitoDoAntitermico,
        tratamentoDeAbandono: dados.tratamentoDeAbandono,
      },
      regras: dados.regras.map((regra, indice) => ({
        ...regra,
        id: `nova-${indice}`,
        valor: regra.valor ?? null,
        valorSecundario: regra.valorSecundario ?? null,
        diaDoCicloMinimo: regra.diaDoCicloMinimo ?? null,
        diaDoCicloMaximo: regra.diaDoCicloMaximo ?? null,
        protocoloId: regra.protocoloId ?? null,
      })),
    };

    const problemas = conferirIntegridadeDoConjunto(paraConferir);
    if (problemas.length > 0) {
      throw new ErroDaApi(422, 'Conjunto incoerente com a árvore de triagem.', problemas);
    }

    const criado = await prisma.conjuntoDeLimiares.create({
      data: {
        versao: dados.versao,
        descricao: dados.descricao,
        origem: dados.origem,
        combinacao: dados.combinacao,
        efeitoDoAntitermico: dados.efeitoDoAntitermico,
        tratamentoDeAbandono: dados.tratamentoDeAbandono,
        validadoClinicamente: false,
        ativo: false,
        regras: {
          create: dados.regras.map((regra) => ({
            ordem: regra.ordem,
            sintoma: regra.sintoma,
            campo: regra.campo,
            operador: regra.operador,
            valor: regra.valor ?? null,
            valorSecundario: regra.valorSecundario ?? null,
            valoresDeTexto: regra.valoresDeTexto ?? undefined,
            classificacao: regra.classificacao,
            justificativa: regra.justificativa,
            diaDoCicloMinimo: regra.diaDoCicloMinimo ?? null,
            diaDoCicloMaximo: regra.diaDoCicloMaximo ?? null,
            protocoloId: regra.protocoloId ?? null,
          })),
        },
      },
    });

    await registrarAcesso(requisicao, { acao: 'EDICAO_DE_ALGORITMO', usuarioId: usuario.id });

    return resposta.status(201).send({
      id: criado.id,
      versao: criado.versao,
      ativo: false,
      aviso:
        'Conjunto criado como rascunho. Nenhuma classificação usa estes cortes até você publicar.',
    });
  });

  app.get('/admin/limiares/:de/diferenca/:para', comLeitura, async (requisicao) => {
    const { de, para } = z
      .object({ de: z.string().uuid(), para: z.string().uuid() })
      .parse(requisicao.params);

    const [conjuntoDe, conjuntoPara] = await Promise.all([
      carregarConjuntoPorId(de),
      carregarConjuntoPorId(para),
    ]);

    return compararConjuntos(conjuntoDe, conjuntoPara);
  });

  /**
   * Publica. É a operação mais perigosa do sistema: muda o risco de todos os pacientes
   * de uma vez, e por isso exige permissão própria e deixa trilha.
   */
  app.post('/admin/limiares/:id/publicar', comPublicacao, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = z.object({ id: z.string().uuid() }).parse(requisicao.params);

    const anterior = await prisma.conjuntoDeLimiares.findFirst({
      where: { ativo: true },
      select: { id: true, versao: true },
    });

    if (anterior?.id === id) throw conflito('Este conjunto já está publicado.');

    await ativarConjunto(id);
    const publicado = await prisma.conjuntoDeLimiares.findUniqueOrThrow({ where: { id } });

    await registrarAcesso(requisicao, {
      acao: 'PUBLICACAO_DE_ALGORITMO',
      usuarioId: usuario.id,
    });

    return {
      publicado: publicado.versao,
      substituiu: anterior?.versao ?? null,
      validadoClinicamente: publicado.validadoClinicamente,
      aviso: publicado.validadoClinicamente
        ? null
        : 'Este conjunto NÃO é validado clinicamente. Toda classificação sai marcada, e a interface é obrigada a exibir a marca.',
    };
  });

  /**
   * Assinatura de responsabilidade clínica pelos cortes.
   *
   * Rota separada de propósito: validar clinicamente nunca pode ser efeito colateral de
   * publicar. São atos diferentes, de responsabilidades diferentes — publicar é operação,
   * validar é responsabilidade técnica sobre o conteúdo.
   */
  app.post('/admin/limiares/:id/validar', comPublicacao, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = z.object({ id: z.string().uuid() }).parse(requisicao.params);

    if (!usuario.profissionalId) {
      throw semPermissao(
        'Só profissional de saúde assina validação clínica — é responsabilidade técnica sobre os cortes.',
      );
    }

    const conjunto = await prisma.conjuntoDeLimiares.findUnique({ where: { id } });
    if (!conjunto) throw naoEncontrado('Conjunto não encontrado.');
    if (conjunto.validadoClinicamente) throw conflito('Este conjunto já foi validado.');

    const validado = await prisma.conjuntoDeLimiares.update({
      where: { id },
      data: {
        validadoClinicamente: true,
        validadoPorId: usuario.profissionalId,
        validadoEm: new Date(),
      },
      include: { validadoPor: { select: { nome: true, registroDoConselho: true } } },
    });

    await registrarAcesso(requisicao, {
      acao: 'VALIDACAO_CLINICA_DE_ALGORITMO',
      usuarioId: usuario.id,
    });

    return { versao: validado.versao, validadoPor: validado.validadoPor, validadoEm: validado.validadoEm };
  });

  // ---------------------------------------------------------------------------
  // Cadastro de apoio
  // ---------------------------------------------------------------------------

  app.get('/admin/protocolos', comCadastro, async () =>
    prisma.protocolo.findMany({ orderBy: { nome: 'asc' } }),
  );

  app.post('/admin/protocolos', comCadastro, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const dados = z
      .object({ nome: z.string().min(2).max(120), descricao: z.string().max(4000).optional() })
      .parse(requisicao.body);

    const criado = await prisma.protocolo.create({ data: dados });
    await registrarAcesso(requisicao, { acao: 'CRIACAO_DE_CADASTRO', usuarioId: usuario.id });
    return resposta.status(201).send(criado);
  });

  app.get('/admin/medicamentos', comCadastro, async () =>
    prisma.medicamento.findMany({ orderBy: { nome: 'asc' } }),
  );

  app.post('/admin/medicamentos', comCadastro, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const dados = z
      .object({ nome: z.string().min(2).max(160), principioAtivo: z.string().max(160).optional() })
      .parse(requisicao.body);

    const criado = await prisma.medicamento.create({ data: dados });
    await registrarAcesso(requisicao, { acao: 'CRIACAO_DE_CADASTRO', usuarioId: usuario.id });
    return resposta.status(201).send(criado);
  });

  app.get('/admin/orientacoes', comLeitura, async () => {
    const conjunto = await prisma.conjuntoDeOrientacoes.findFirst({
      where: { ativo: true },
      include: {
        orientacoes: {
          orderBy: [{ sintoma: 'asc' }, { classificacao: 'asc' }, { ordem: 'asc' }],
          include: { medicamento: { select: { nome: true } } },
        },
      },
    });

    if (!conjunto) return { conjunto: null, orientacoes: [] };

    return {
      conjunto: { id: conjunto.id, versao: conjunto.versao, publicadoEm: conjunto.publicadoEm },
      orientacoes: conjunto.orientacoes.map((orientacao) => ({
        ...orientacao,
        // Regra 8 do ADR-001 tornada visível para quem cadastra: sem este aviso, é
        // fácil escrever um texto que nomeia remédio e não entender por que metade
        // dos pacientes não o recebe.
        avisoDeMedicamento: orientacao.medicamentoId
          ? `Só chega a quem tem ${orientacao.medicamento?.nome} prescrito e ativo. Mantenha uma versão sem nomear remédio como alternativa, com ordem maior.`
          : null,
      })),
    };
  });

  app.get('/admin/registro-de-acessos', comPublicacao, async (requisicao) => {
    const { limite } = z
      .object({ limite: z.coerce.number().int().min(1).max(200).default(50) })
      .parse(requisicao.query);

    return prisma.logDeAcesso.findMany({
      orderBy: { ocorridoEm: 'desc' },
      take: limite,
      include: {
        usuario: { select: { email: true, perfil: true } },
        paciente: { select: { nome: true } },
      },
    });
  });
}
