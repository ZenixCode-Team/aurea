import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { conflito, naoEncontrado, requisicaoInvalida } from '../erros.js';
import { exigirPermissao, registrarAcesso, usuarioDa } from '../autenticacao/plugin.js';
import { diaCivil } from '../tempo.js';

/**
 * Cadastro administrativo de tratamento, ciclo e prescrição.
 *
 * Tudo aqui é dado de paciente — cada rota de leitura ou escrita liga a um `pacienteId` e
 * registra `LogDeAcesso` (regra 5 do ADR-001). Nas listagens que cruzam vários pacientes de
 * uma vez (`GET /admin/tratamentos`), o log sai uma vez por chamada, sem `pacienteId`, no
 * mesmo padrão que `GET /painel` já usa em `rotas/painel.ts`.
 *
 * "Médico assistente" do briefing é `Tratamento.medicoResponsavel` — o profissional
 * responsável por ESTE tratamento, campo que já existe no schema. Não confundir com
 * `Paciente.medicoAssistente`, que é o médico padrão do paciente e é editado em outra
 * rota; os dois podem divergir (ex.: um oncologista assume um tratamento específico).
 */

const idNaUrlSchema = z.object({ id: z.string().uuid() });

/**
 * "Hoje" pronto para gravar em coluna `@db.Date`.
 *
 * `diaCivil` já lê o dia certo no fuso do serviço (`FUSO_HORARIO`), não no fuso do
 * container. Falta a volta: `@db.Date` é lido como meia-noite UTC — `diaCivilDeColunaDeData`
 * em `tempo.ts` é explícito sobre isso — então para a leitura bater com o que acabamos de
 * gravar, a escrita precisa seguir a mesma convenção. Um `new Date()` bruto gravaria o
 * instante atual; num container em UTC, encerrar um tratamento às 21h30 em Sergipe gravaria
 * o dia seguinte, e é exatamente o defeito que `tempo.ts` documenta na íntegra.
 */
function hojeComoDataCivil(): Date {
  const codigo = diaCivil(new Date());
  const ano = Math.floor(codigo / 10000);
  const mes = Math.floor((codigo % 10000) / 100);
  const dia = codigo % 100;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const criarTratamentoSchema = z.object({
  pacienteId: z.string().uuid(),
  protocoloId: z.string().uuid(),
  medicoResponsavelId: z.string().uuid().nullable().optional(),
  iniciadoEm: z.coerce.date(),
});

const criarCicloSchema = z.object({
  numero: z.number().int().min(1),
  sessaoRealizadaEm: z.coerce.date(),
  previsaoDaProximaSessao: z.coerce.date().nullable().optional(),
});

const atualizarCicloSchema = z
  .object({
    sessaoRealizadaEm: z.coerce.date().optional(),
    previsaoDaProximaSessao: z.coerce.date().nullable().optional(),
  })
  .refine((dados) => dados.sessaoRealizadaEm !== undefined || dados.previsaoDaProximaSessao !== undefined, {
    message: 'Informe ao menos um campo para atualizar.',
  });

const criarPrescricaoSchema = z.object({
  medicamentoId: z.string().uuid(),
  posologia: z.string().trim().min(2).max(255),
  iniciadaEm: z.coerce.date(),
  prescritaPorId: z.string().uuid().nullable().optional(),
});

const SELECAO_DO_PACIENTE = { select: { id: true, nome: true } } as const;
const SELECAO_DO_PROTOCOLO = { select: { id: true, nome: true } } as const;
const SELECAO_DO_PROFISSIONAL = { select: { id: true, nome: true, funcao: true } } as const;

export async function rotasDeCadastroDeTratamentos(app: FastifyInstance) {
  const comCadastro = {
    preHandler: [
      (requisicao: Parameters<typeof app.autenticar>[0]) => app.autenticar(requisicao),
      exigirPermissao('GERENCIAR_CADASTROS'),
    ],
  };

  // ---------------------------------------------------------------------------
  // Tratamentos
  // ---------------------------------------------------------------------------

  app.get('/admin/tratamentos', comCadastro, async (requisicao) => {
    const usuario = usuarioDa(requisicao);

    const tratamentos = await prisma.tratamento.findMany({
      // Ativo (encerradoEm null) primeiro — o MySQL já ordena NULL antes do resto em ASC.
      orderBy: [{ encerradoEm: 'asc' }, { iniciadoEm: 'desc' }],
      include: {
        paciente: SELECAO_DO_PACIENTE,
        protocolo: SELECAO_DO_PROTOCOLO,
        medicoResponsavel: SELECAO_DO_PROFISSIONAL,
      },
    });

    await registrarAcesso(requisicao, { acao: 'LEITURA_DE_PACIENTE', usuarioId: usuario.id });

    return tratamentos.map((tratamento) => ({
      id: tratamento.id,
      paciente: tratamento.paciente,
      protocolo: tratamento.protocolo,
      medicoResponsavel: tratamento.medicoResponsavel,
      iniciadoEm: tratamento.iniciadoEm,
      ativo: tratamento.encerradoEm === null,
    }));
  });

  /**
   * Um paciente só pode ter um tratamento ativo por vez. Sem essa checagem, dois
   * tratamentos correndo juntos deixam o dia do ciclo e a triagem sem saber qual protocolo
   * vale para aquele check-in — `cicloAtualDoPaciente` (usado pela triagem) não teria como
   * escolher entre os dois.
   */
  app.post('/admin/tratamentos', comCadastro, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const analise = criarTratamentoSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Dados do tratamento inválidos.', analise.error.issues);
    }
    const dados = analise.data;

    const paciente = await prisma.paciente.findUnique({
      where: { id: dados.pacienteId },
      select: { id: true },
    });
    if (!paciente) throw naoEncontrado('Paciente não encontrado.');

    const protocolo = await prisma.protocolo.findUnique({
      where: { id: dados.protocoloId },
      select: { id: true, nome: true },
    });
    if (!protocolo) throw naoEncontrado('Protocolo não encontrado.');

    if (dados.medicoResponsavelId) {
      const medico = await prisma.profissional.findUnique({
        where: { id: dados.medicoResponsavelId },
        select: { id: true },
      });
      if (!medico) throw naoEncontrado('Médico responsável não encontrado.');
    }

    const tratamentoAtivo = await prisma.tratamento.findFirst({
      where: { pacienteId: dados.pacienteId, encerradoEm: null },
      select: { id: true, protocolo: SELECAO_DO_PROTOCOLO },
    });

    if (tratamentoAtivo) {
      throw conflito(
        `Este paciente já está em tratamento ativo (protocolo "${tratamentoAtivo.protocolo.nome}"). Encerre-o antes de iniciar outro.`,
      );
    }

    const criado = await prisma.tratamento.create({
      data: {
        pacienteId: dados.pacienteId,
        protocoloId: dados.protocoloId,
        medicoResponsavelId: dados.medicoResponsavelId ?? null,
        iniciadoEm: dados.iniciadoEm,
      },
      include: {
        paciente: SELECAO_DO_PACIENTE,
        protocolo: SELECAO_DO_PROTOCOLO,
        medicoResponsavel: SELECAO_DO_PROFISSIONAL,
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'CRIACAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: dados.pacienteId,
    });

    return resposta.status(201).send({
      id: criado.id,
      paciente: criado.paciente,
      protocolo: criado.protocolo,
      medicoResponsavel: criado.medicoResponsavel,
      iniciadoEm: criado.iniciadoEm,
      ativo: true,
    });
  });

  app.patch('/admin/tratamentos/:id/encerrar', comCadastro, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);

    const tratamento = await prisma.tratamento.findUnique({
      where: { id },
      select: { id: true, pacienteId: true, encerradoEm: true },
    });
    if (!tratamento) throw naoEncontrado('Tratamento não encontrado.');
    if (tratamento.encerradoEm) throw conflito('Este tratamento já está encerrado.');

    const encerrado = await prisma.tratamento.update({
      where: { id },
      data: { encerradoEm: hojeComoDataCivil() },
      select: { id: true, encerradoEm: true },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: tratamento.pacienteId,
    });

    return { id: encerrado.id, encerradoEm: encerrado.encerradoEm, ativo: false };
  });

  // ---------------------------------------------------------------------------
  // Ciclos
  // ---------------------------------------------------------------------------

  app.get('/admin/tratamentos/:id/ciclos', comCadastro, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);

    const tratamento = await prisma.tratamento.findUnique({
      where: { id },
      select: { id: true, pacienteId: true },
    });
    if (!tratamento) throw naoEncontrado('Tratamento não encontrado.');

    const ciclos = await prisma.ciclo.findMany({
      where: { tratamentoId: id },
      orderBy: [{ sessaoRealizadaEm: 'desc' }, { numero: 'desc' }],
    });

    await registrarAcesso(requisicao, {
      acao: 'LEITURA_DE_HISTORICO',
      usuarioId: usuario.id,
      pacienteId: tratamento.pacienteId,
    });

    return ciclos;
  });

  app.post('/admin/tratamentos/:id/ciclos', comCadastro, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);
    const analise = criarCicloSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Dados do ciclo inválidos.', analise.error.issues);
    }
    const dados = analise.data;

    const tratamento = await prisma.tratamento.findUnique({
      where: { id },
      select: { id: true, pacienteId: true },
    });
    if (!tratamento) throw naoEncontrado('Tratamento não encontrado.');

    // Pré-checagem sobre o índice único (tratamentoId, numero) do schema — mesmo padrão de
    // `admin.ts` para a versão do conjunto de limiares: olhar antes de gravar, para devolver
    // 409 com mensagem clara em vez de deixar a constraint do banco estourar como 500.
    const duplicado = await prisma.ciclo.findUnique({
      where: { tratamentoId_numero: { tratamentoId: id, numero: dados.numero } },
    });
    if (duplicado) {
      throw conflito(`Este tratamento já tem um ciclo número ${dados.numero}.`);
    }

    const criado = await prisma.ciclo.create({
      data: {
        tratamentoId: id,
        numero: dados.numero,
        sessaoRealizadaEm: dados.sessaoRealizadaEm,
        previsaoDaProximaSessao: dados.previsaoDaProximaSessao ?? null,
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'CRIACAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: tratamento.pacienteId,
    });

    return resposta.status(201).send(criado);
  });

  app.patch('/admin/ciclos/:id', comCadastro, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);
    const analise = atualizarCicloSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Dados do ciclo inválidos.', analise.error.issues);
    }
    const dados = analise.data;

    const ciclo = await prisma.ciclo.findUnique({
      where: { id },
      select: { id: true, tratamento: { select: { pacienteId: true } } },
    });
    if (!ciclo) throw naoEncontrado('Ciclo não encontrado.');

    const atualizado = await prisma.ciclo.update({
      where: { id },
      data: {
        ...(dados.sessaoRealizadaEm !== undefined ? { sessaoRealizadaEm: dados.sessaoRealizadaEm } : {}),
        ...(dados.previsaoDaProximaSessao !== undefined
          ? { previsaoDaProximaSessao: dados.previsaoDaProximaSessao }
          : {}),
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: ciclo.tratamento.pacienteId,
    });

    return atualizado;
  });

  // ---------------------------------------------------------------------------
  // Prescrições
  // ---------------------------------------------------------------------------

  app.get('/admin/pacientes/:id/prescricoes', comCadastro, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);

    const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } });
    if (!paciente) throw naoEncontrado('Paciente não encontrado.');

    const prescricoes = await prisma.prescricao.findMany({
      where: { pacienteId: id },
      // Ativa (encerradaEm null) primeiro — mesma leitura de NULL do MySQL usada acima.
      orderBy: [{ encerradaEm: 'asc' }, { iniciadaEm: 'desc' }],
      include: {
        medicamento: { select: { id: true, nome: true, principioAtivo: true } },
        prescritaPor: SELECAO_DO_PROFISSIONAL,
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'LEITURA_DE_HISTORICO',
      usuarioId: usuario.id,
      pacienteId: id,
    });

    return prescricoes.map((prescricao) => ({ ...prescricao, ativa: prescricao.encerradaEm === null }));
  });

  app.post('/admin/pacientes/:id/prescricoes', comCadastro, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);
    const analise = criarPrescricaoSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Dados da prescrição inválidos.', analise.error.issues);
    }
    const dados = analise.data;

    const paciente = await prisma.paciente.findUnique({ where: { id }, select: { id: true } });
    if (!paciente) throw naoEncontrado('Paciente não encontrado.');

    const medicamento = await prisma.medicamento.findUnique({
      where: { id: dados.medicamentoId },
      select: { id: true, nome: true },
    });
    if (!medicamento) throw naoEncontrado('Medicamento não encontrado.');

    if (dados.prescritaPorId) {
      const profissional = await prisma.profissional.findUnique({
        where: { id: dados.prescritaPorId },
        select: { id: true },
      });
      if (!profissional) throw naoEncontrado('Profissional prescritor não encontrado.');
    }

    const criada = await prisma.prescricao.create({
      data: {
        pacienteId: id,
        medicamentoId: dados.medicamentoId,
        posologia: dados.posologia,
        iniciadaEm: dados.iniciadaEm,
        prescritaPorId: dados.prescritaPorId ?? null,
      },
      include: {
        medicamento: { select: { id: true, nome: true, principioAtivo: true } },
        prescritaPor: SELECAO_DO_PROFISSIONAL,
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'CRIACAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: id,
    });

    return resposta.status(201).send({ ...criada, ativa: true });
  });

  app.patch('/admin/prescricoes/:id/encerrar', comCadastro, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);

    const prescricao = await prisma.prescricao.findUnique({
      where: { id },
      select: { id: true, pacienteId: true, encerradaEm: true },
    });
    if (!prescricao) throw naoEncontrado('Prescrição não encontrada.');
    if (prescricao.encerradaEm) throw conflito('Esta prescrição já está encerrada.');

    const encerrada = await prisma.prescricao.update({
      where: { id },
      data: { encerradaEm: hojeComoDataCivil() },
      select: { id: true, encerradaEm: true },
    });

    await registrarAcesso(requisicao, {
      acao: 'EDICAO_DE_CADASTRO',
      usuarioId: usuario.id,
      pacienteId: prescricao.pacienteId,
    });

    return { id: encerrada.id, encerradaEm: encerrada.encerradaEm, ativa: false };
  });
}
