import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { Prisma, Sexo, TipoDeContato } from '@prisma/client';
import { cpfEhValido, normalizarCpf } from '@aurea/contratos';
import { prisma } from '../prisma.js';
import { conflito, naoEncontrado, requisicaoInvalida } from '../erros.js';
import { exigirPermissao, registrarAcesso, usuarioDa } from '../autenticacao/plugin.js';
import {
  fatiaDoCursor,
  lerPaginacao,
  montarPagina,
  type ChaveDeOrdenacao,
} from '../servicos/paginacao.js';

/**
 * Cadastro administrativo de pacientes: criar, editar, listar e manter contatos e
 * alergias. Toda rota aqui exige `GERENCIAR_CADASTROS` e registra `LogDeAcesso` — é
 * dado de paciente, e a regra 5 do ADR-001 (quem abriu o quê, desde o dia 1) não abre
 * exceção para tela administrativa.
 *
 * O que esta rota NÃO faz: alterar CPF ou senha de paciente já cadastrado. CPF é
 * identidade de login (regra em `autenticacao.ts`) e trocar por aqui, sem o fluxo de
 * "esqueci a senha", seria uma porta de troca de identidade sem rastro equivalente.
 */

const idNaUrlSchema = z.object({ id: z.string().uuid() });

const idDoContatoNaUrlSchema = z.object({
  id: z.string().uuid(),
  contatoId: z.string().uuid(),
});

const idDaAlergiaNaUrlSchema = z.object({
  id: z.string().uuid(),
  alergiaId: z.string().uuid(),
});

const cpfSchema = z
  .string()
  .transform(normalizarCpf)
  .refine(cpfEhValido, 'CPF inválido.');

const criarPacienteSchema = z.object({
  nome: z.string().trim().min(2).max(180),
  cpf: cpfSchema,
  dataNascimento: z.coerce.date(),
  sexo: z.enum(Sexo),
  diagnostico: z.string().trim().min(2).max(255),
  convenio: z.string().trim().min(1).max(120).optional(),
  tipoSanguineo: z.string().trim().min(1).max(5).optional(),
  habitoIntestinalBasal: z.number().int().min(0).max(20).optional(),
  // Mesmo piso de `trocarSenhaSchema` em `conta.ts`: é a senha com que o paciente vai
  // entrar até trocar no primeiro acesso, e não faz sentido nascer mais fraca que a
  // política que rege toda troca posterior.
  senhaProvisoria: z
    .string()
    .min(10, 'A senha provisória precisa de pelo menos 10 caracteres.')
    .max(200),
});

const atualizarPacienteSchema = z
  .object({
    nome: z.string().trim().min(2).max(180).optional(),
    dataNascimento: z.coerce.date().optional(),
    sexo: z.enum(Sexo).optional(),
    diagnostico: z.string().trim().min(2).max(255).optional(),
    convenio: z.string().trim().min(1).max(120).nullable().optional(),
    tipoSanguineo: z.string().trim().min(1).max(5).nullable().optional(),
    habitoIntestinalBasal: z.number().int().min(0).max(20).nullable().optional(),
  })
  .refine((dados) => Object.keys(dados).length > 0, {
    message: 'Envie ao menos um campo para atualizar.',
  });

const criarContatoSchema = z.object({
  nome: z.string().trim().min(2).max(180),
  telefone: z.string().trim().min(8).max(20),
  relacao: z.string().trim().min(1).max(60).optional(),
  tipo: z.enum(TipoDeContato),
});

const criarAlergiaSchema = z.object({
  substancia: z.string().trim().min(2).max(200),
  reacao: z.string().trim().min(1).max(255).optional(),
});

export async function rotasDeCadastroDePacientes(app: FastifyInstance) {
  const autenticar = (requisicao: Parameters<typeof app.autenticar>[0]) =>
    app.autenticar(requisicao);

  const comCadastro = { preHandler: [autenticar, exigirPermissao('GERENCIAR_CADASTROS')] };

  // ---------------------------------------------------------------------------
  // Listagem e detalhe
  // ---------------------------------------------------------------------------

  /**
   * Lista paginada. Ordenada por `criadoEm`, não por `nome`: nome é campo que a própria
   * equipe edita, e ordenar por ele faria uma linha trocar de página entre duas
   * chamadas — exatamente o problema que `servicos/paginacao.ts` avisa para evitar.
   */
  app.get('/admin/pacientes', comCadastro, async (requisicao) => {
    const usuarioLogado = usuarioDa(requisicao);
    const parametros = lerPaginacao(requisicao.query);

    const chave: ChaveDeOrdenacao = { campo: 'criadoEm', direcao: 'desc', tipo: 'data' };
    const fatia = fatiaDoCursor<
      Prisma.PacienteWhereInput,
      Prisma.PacienteOrderByWithRelationInput
    >(chave, parametros);

    const linhas = await prisma.paciente.findMany({
      where: fatia.filtro ? { AND: [fatia.filtro] } : undefined,
      orderBy: fatia.ordenacao,
      take: fatia.quantidade,
      select: {
        id: true,
        nome: true,
        dataNascimento: true,
        sexo: true,
        diagnostico: true,
        criadoEm: true,
        usuario: { select: { cpf: true } },
        tratamentos: {
          where: { encerradoEm: null },
          take: 1,
          orderBy: { iniciadoEm: 'desc' },
          select: { protocolo: { select: { id: true, nome: true } } },
        },
      },
    });

    const pagina = montarPagina(linhas, chave, parametros);

    await registrarAcesso(requisicao, { acao: 'LEITURA_DE_PACIENTE', usuarioId: usuarioLogado.id });

    return {
      ...pagina,
      itens: pagina.itens.map((paciente) => ({
        id: paciente.id,
        nome: paciente.nome,
        cpf: paciente.usuario.cpf,
        dataNascimento: paciente.dataNascimento,
        sexo: paciente.sexo,
        diagnostico: paciente.diagnostico,
        protocolo: paciente.tratamentos[0]?.protocolo ?? null,
      })),
    };
  });

  /**
   * Detalhe de um paciente: dados cadastrais, contatos, alergias e o tratamento ativo.
   *
   * Não é o histórico clínico (sessões de triagem, classificações) — aquele já existe
   * em `/painel/pacientes/:id/historico`, com sua própria ação de log
   * (`LEITURA_DE_HISTORICO`). Aqui é ficha de cadastro, por isso a ação registrada é
   * `LEITURA_DE_PACIENTE`.
   */
  app.get('/admin/pacientes/:id', comCadastro, async (requisicao) => {
    const usuarioLogado = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);

    const paciente = await prisma.paciente.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        dataNascimento: true,
        sexo: true,
        diagnostico: true,
        convenio: true,
        tipoSanguineo: true,
        habitoIntestinalBasal: true,
        criadoEm: true,
        usuario: { select: { cpf: true } },
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
          take: 1,
          orderBy: { iniciadoEm: 'desc' },
          select: { iniciadoEm: true, protocolo: { select: { id: true, nome: true } } },
        },
      },
    });

    if (!paciente) throw naoEncontrado('Paciente não encontrado.');

    await registrarAcesso(requisicao, {
      acao: 'LEITURA_DE_PACIENTE',
      usuarioId: usuarioLogado.id,
      pacienteId: paciente.id,
    });

    const tratamento = paciente.tratamentos[0] ?? null;

    return {
      id: paciente.id,
      nome: paciente.nome,
      cpf: paciente.usuario.cpf,
      dataNascimento: paciente.dataNascimento,
      sexo: paciente.sexo,
      diagnostico: paciente.diagnostico,
      convenio: paciente.convenio,
      tipoSanguineo: paciente.tipoSanguineo,
      habitoIntestinalBasal: paciente.habitoIntestinalBasal,
      criadoEm: paciente.criadoEm,
      contatos: {
        doPaciente: paciente.contatos.filter((contato) => contato.tipo === 'CONTATO_DO_PACIENTE'),
        deEmergencia: paciente.contatos.filter(
          (contato) => contato.tipo === 'CONTATO_DE_EMERGENCIA',
        ),
      },
      alergias: paciente.alergias.map((alergia) => ({
        ...alergia,
        confirmada: alergia.confirmadaEm !== null,
      })),
      tratamento: tratamento
        ? { protocolo: tratamento.protocolo, iniciadoEm: tratamento.iniciadoEm }
        : null,
    };
  });

  // ---------------------------------------------------------------------------
  // Criação e edição
  // ---------------------------------------------------------------------------

  /**
   * Cria o login (`Usuario`, perfil PACIENTE) e a ficha (`Paciente`) juntos, numa
   * transação: paciente sem usuário não entra no aplicativo, e usuário PACIENTE sem
   * ficha é login fantasma. Nenhum dos dois pode sobreviver sem o outro.
   *
   * A checagem de CPF duplicado roda antes da transação para devolver 409 com mensagem
   * clara no caminho comum; a unicidade de `Usuario.cpf` no schema é quem garante a
   * regra de fato contra corrida entre duas requisições simultâneas — capturada abaixo
   * pelo código de erro do Prisma (P2002).
   */
  app.post('/admin/pacientes', comCadastro, async (requisicao, resposta) => {
    const usuarioLogado = usuarioDa(requisicao);
    const analise = criarPacienteSchema.safeParse(requisicao.body);

    if (!analise.success) {
      throw requisicaoInvalida('Dados do paciente inválidos.', analise.error.issues);
    }

    const dados = analise.data;

    const cpfEmUso = await prisma.usuario.findUnique({ where: { cpf: dados.cpf } });
    if (cpfEmUso) throw conflito('Já existe um cadastro com este CPF.');

    const senhaHash = await hash(dados.senhaProvisoria, 10);

    try {
      const pacienteCriado = await prisma.$transaction(async (tx) => {
        const novoUsuario = await tx.usuario.create({
          data: { cpf: dados.cpf, senhaHash, perfil: 'PACIENTE' },
        });

        return tx.paciente.create({
          data: {
            usuarioId: novoUsuario.id,
            nome: dados.nome,
            dataNascimento: dados.dataNascimento,
            sexo: dados.sexo,
            diagnostico: dados.diagnostico,
            convenio: dados.convenio,
            tipoSanguineo: dados.tipoSanguineo,
            habitoIntestinalBasal: dados.habitoIntestinalBasal,
          },
          select: {
            id: true,
            nome: true,
            dataNascimento: true,
            sexo: true,
            diagnostico: true,
            convenio: true,
            tipoSanguineo: true,
            habitoIntestinalBasal: true,
            criadoEm: true,
          },
        });
      });

      await registrarAcesso(requisicao, {
        acao: 'CRIACAO_DE_CADASTRO',
        usuarioId: usuarioLogado.id,
        pacienteId: pacienteCriado.id,
      });

      return resposta.status(201).send({ ...pacienteCriado, cpf: dados.cpf });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw conflito('Já existe um cadastro com este CPF.');
      }
      throw erro;
    }
  });

  /** Atualiza os campos editáveis do cadastro. CPF e senha não passam por aqui. */
  app.patch('/admin/pacientes/:id', comCadastro, async (requisicao) => {
    const usuarioLogado = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);

    const analise = atualizarPacienteSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Dados de atualização inválidos.', analise.error.issues);
    }

    const existe = await prisma.paciente.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw naoEncontrado('Paciente não encontrado.');

    const atualizado = await prisma.paciente.update({
      where: { id },
      data: analise.data,
      select: {
        id: true,
        nome: true,
        dataNascimento: true,
        sexo: true,
        diagnostico: true,
        convenio: true,
        tipoSanguineo: true,
        habitoIntestinalBasal: true,
        atualizadoEm: true,
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuarioLogado.id,
      pacienteId: id,
    });

    return atualizado;
  });

  // ---------------------------------------------------------------------------
  // Contatos
  // ---------------------------------------------------------------------------

  app.post('/admin/pacientes/:id/contatos', comCadastro, async (requisicao, resposta) => {
    const usuarioLogado = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);

    const analise = criarContatoSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Dados do contato inválidos.', analise.error.issues);
    }

    const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } });
    if (!paciente) throw naoEncontrado('Paciente não encontrado.');

    const contato = await prisma.contatoDoPaciente.create({
      data: { pacienteId: id, ...analise.data },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuarioLogado.id,
      pacienteId: id,
    });

    return resposta.status(201).send(contato);
  });

  /** Só apaga contato que pertence a este paciente — id na URL não abre atalho para outro. */
  app.delete('/admin/pacientes/:id/contatos/:contatoId', comCadastro, async (requisicao) => {
    const usuarioLogado = usuarioDa(requisicao);
    const { id, contatoId } = idDoContatoNaUrlSchema.parse(requisicao.params);

    const contato = await prisma.contatoDoPaciente.findFirst({
      where: { id: contatoId, pacienteId: id },
      select: { id: true },
    });
    if (!contato) throw naoEncontrado('Contato não encontrado.');

    await prisma.contatoDoPaciente.delete({ where: { id: contatoId } });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuarioLogado.id,
      pacienteId: id,
    });

    return { id: contatoId, removido: true };
  });

  // ---------------------------------------------------------------------------
  // Alergias
  // ---------------------------------------------------------------------------

  /**
   * `AlergiaDoPaciente` guarda uma única `descricao` de texto — não existe coluna
   * separada para substância e reação. Substância é obrigatória e vira o corpo da
   * descrição; reação, quando informada, entra anexada, para não perder a informação
   * nem inventar coluna que o schema não tem.
   *
   * Nasce com `origem: 'EQUIPE'` e sem confirmação automática: quem cadastra por aqui
   * tem `GERENCIAR_CADASTROS`, não necessariamente é profissional de saúde, e
   * `confirmadaEm`/`confirmadaPorId` é campo de responsabilidade clínica — não é este
   * endpoint que deve preenchê-lo.
   */
  app.post('/admin/pacientes/:id/alergias', comCadastro, async (requisicao, resposta) => {
    const usuarioLogado = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);

    const analise = criarAlergiaSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Dados da alergia inválidos.', analise.error.issues);
    }

    const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } });
    if (!paciente) throw naoEncontrado('Paciente não encontrado.');

    const { substancia, reacao } = analise.data;
    const descricao = reacao ? `${substancia}, reação: ${reacao}` : substancia;

    const alergia = await prisma.alergiaDoPaciente.create({
      data: { pacienteId: id, descricao, origem: 'EQUIPE' },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuarioLogado.id,
      pacienteId: id,
    });

    return resposta.status(201).send({ ...alergia, confirmada: alergia.confirmadaEm !== null });
  });

  /** Só apaga alergia que pertence a este paciente, pelo mesmo motivo do contato acima. */
  app.delete('/admin/pacientes/:id/alergias/:alergiaId', comCadastro, async (requisicao) => {
    const usuarioLogado = usuarioDa(requisicao);
    const { id, alergiaId } = idDaAlergiaNaUrlSchema.parse(requisicao.params);

    const alergia = await prisma.alergiaDoPaciente.findFirst({
      where: { id: alergiaId, pacienteId: id },
      select: { id: true },
    });
    if (!alergia) throw naoEncontrado('Alergia não encontrada.');

    await prisma.alergiaDoPaciente.delete({ where: { id: alergiaId } });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuarioLogado.id,
      pacienteId: id,
    });

    return { id: alergiaId, removido: true };
  });
}
