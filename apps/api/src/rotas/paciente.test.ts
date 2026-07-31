import { beforeAll, describe, expect, it } from 'vitest';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { hash } from 'bcryptjs';
import { prisma } from '../prisma.js';
import { ErroDaApi } from '../erros.js';
import { autenticacao } from '../autenticacao/plugin.js';
import { abrirSessao } from '../autenticacao/sessao.js';
import { calcularDiaDoCiclo } from '../tempo.js';
import { rotasDoPaciente } from './paciente.js';
import { rotasDeAtendimento } from './atendimento.js';

/**
 * Prova das rotas do paciente contra MySQL de verdade.
 *
 * Precisa de banco, então NÃO roda por padrão: `pnpm -r test` na máquina de quem estiver
 * mexendo em outra coisa não pode escrever linha no banco dele. Para rodar:
 *
 *   DATABASE_URL="mysql://root@localhost:3306/aurea_prumo" PROVA_DE_BANCO=1 \
 *     pnpm --filter @aurea/api test
 *
 * Os dados são próprios e identificados por `PROVA_035`; cada execução limpa os da
 * execução anterior, então o banco não acumula. Nada aqui toca o que o seed criou.
 *
 * O servidor é montado aqui em vez de importado de `src/servidor.ts` porque as rotas
 * ainda não estão registradas lá — o registro é do MAESTRO. O tratador de erro é o mesmo
 * de `servidor.ts`, senão o teste não veria os status que o cliente vê.
 */

const COM_BANCO = process.env.PROVA_DE_BANCO === '1';

const MARCA = 'PROVA_035';
const CPF_DE_A = '90000000001';
const CPF_DE_B = '90000000002';
const EMAIL_DA_ENFERMEIRA = 'prova035-enfermagem@aurea.local';
const EMAIL_DE_QUEM_NAO_ATENDE = 'prova035-admin@aurea.local';

interface Contexto {
  app: FastifyInstance;
  tokenDeA: string;
  tokenDeB: string;
  tokenDaEnfermeira: string;
  tokenDeQuemNaoAtende: string;
  pacienteA: string;
  pacienteB: string;
  profissionalDaEnfermeira: string;
  usuarioDeA: string;
  sessaoDeTriagemDeA: string;
  cicloDeA: Date;
  verbetePublicado: string;
  verbeteNaoPublicado: string;
}

const contexto = {} as Contexto;

async function montarAppDaProva(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(autenticacao);

  app.setErrorHandler((erro: FastifyError, _requisicao, resposta) => {
    if (erro instanceof ErroDaApi) {
      return resposta.status(erro.status).send({ erro: erro.message, detalhes: erro.detalhes });
    }
    const status = erro.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return resposta.status(status).send({ erro: erro.message });
    }
    return resposta.status(500).send({ erro: 'Erro interno.' });
  });

  await app.register(rotasDoPaciente);
  await app.register(rotasDeAtendimento);

  await app.ready();
  return app;
}

async function limparProvaAnterior() {
  const nossosUsuarios = [
    { cpf: { in: [CPF_DE_A, CPF_DE_B] } },
    { email: { in: [EMAIL_DA_ENFERMEIRA, EMAIL_DE_QUEM_NAO_ATENDE] } },
  ];

  // `logs_de_acesso` não cai por cascata — é tabela só de escrita, e a chave estrangeira
  // é restritiva de propósito. Sai antes dos usuários.
  await prisma.logDeAcesso.deleteMany({
    where: {
      OR: [{ usuario: { OR: nossosUsuarios } }, { paciente: { nome: { startsWith: MARCA } } }],
    },
  });

  await prisma.usuario.deleteMany({ where: { OR: nossosUsuarios } });
  await prisma.verbeteDaBiblioteca.deleteMany({ where: { titulo: { startsWith: MARCA } } });
}

async function criarFixtures() {
  const senhaHash = await hash('prova-035-sem-uso', 10);

  const [usuarioA, usuarioB] = await Promise.all([
    prisma.usuario.create({ data: { cpf: CPF_DE_A, senhaHash, perfil: 'PACIENTE' } }),
    prisma.usuario.create({ data: { cpf: CPF_DE_B, senhaHash, perfil: 'PACIENTE' } }),
  ]);

  const usuarioEnfermeira = await prisma.usuario.create({
    data: {
      email: EMAIL_DA_ENFERMEIRA,
      senhaHash,
      perfil: 'PROFISSIONAL',
      permissoes: { create: [{ permissao: 'ATENDER_PLANTAO' }] },
    },
  });

  const usuarioSemPlantao = await prisma.usuario.create({
    data: {
      email: EMAIL_DE_QUEM_NAO_ATENDE,
      senhaHash,
      perfil: 'ADMINISTRADOR',
      permissoes: { create: [{ permissao: 'EDITAR_ALGORITMO' }] },
    },
  });

  const enfermeira = await prisma.profissional.create({
    data: {
      usuarioId: usuarioEnfermeira.id,
      nome: `${MARCA} Enfermeira`,
      funcao: 'ENFERMEIRO',
    },
  });

  const medico = await prisma.profissional.create({
    data: { usuarioId: usuarioSemPlantao.id, nome: `${MARCA} Médico`, funcao: 'MEDICO' },
  });

  const pacienteA = await prisma.paciente.create({
    data: {
      usuarioId: usuarioA.id,
      nome: `${MARCA} Paciente A`,
      dataNascimento: new Date('1958-03-11T12:00:00Z'),
      diagnostico: 'Diagnóstico sintético A',
      tipoSanguineo: 'O+',
      medicoAssistenteId: medico.id,
      contatos: {
        create: [
          { tipo: 'CONTATO_DO_PACIENTE', nome: 'Telefone de A', telefone: '79900000001' },
          {
            tipo: 'CONTATO_DE_EMERGENCIA',
            nome: 'Filha de A',
            telefone: '79911111111',
            relacao: 'filha',
          },
        ],
      },
    },
  });

  const pacienteB = await prisma.paciente.create({
    data: {
      usuarioId: usuarioB.id,
      nome: `${MARCA} Paciente B`,
      dataNascimento: new Date('1971-09-02T12:00:00Z'),
      diagnostico: 'Diagnóstico sintético B',
    },
  });

  const protocolo = await prisma.protocolo.upsert({
    where: { nome: `${MARCA} Protocolo` },
    update: {},
    create: { nome: `${MARCA} Protocolo` },
  });

  const tratamento = await prisma.tratamento.create({
    data: {
      pacienteId: pacienteA.id,
      protocoloId: protocolo.id,
      iniciadoEm: new Date('2026-06-01T12:00:00Z'),
    },
  });

  const sessaoDeQuimio = new Date('2026-07-21T15:00:00Z');
  await prisma.ciclo.create({
    data: { tratamentoId: tratamento.id, numero: 3, sessaoRealizadaEm: sessaoDeQuimio },
  });

  const sessaoDeTriagem = await prisma.sessaoDeTriagem.create({
    data: {
      pacienteId: pacienteA.id,
      chaveDeIdempotencia: `${MARCA}-${Date.now()}`,
      estado: 'CONCLUIDA',
      concluidaEm: new Date(),
    },
  });

  const [verbetePublicado, verbeteNaoPublicado] = await Promise.all([
    prisma.verbeteDaBiblioteca.create({
      data: {
        categoria: 'ALIMENTACAO',
        titulo: `${MARCA} Verbete publicado`,
        corpo: 'Conteúdo revisado.',
        autoria: 'Equipe fictícia',
        publicado: true,
      },
    }),
    prisma.verbeteDaBiblioteca.create({
      data: {
        categoria: 'ALIMENTACAO',
        titulo: `${MARCA} Verbete em rascunho`,
        corpo: 'Conteúdo clínico ainda NÃO revisado.',
        autoria: 'Rascunho',
        publicado: false,
      },
    }),
  ]);

  const [sessaoA, sessaoB, sessaoEnfermeira, sessaoSemPlantao] = await Promise.all([
    abrirSessao(usuarioA.id),
    abrirSessao(usuarioB.id),
    abrirSessao(usuarioEnfermeira.id),
    abrirSessao(usuarioSemPlantao.id),
  ]);

  Object.assign(contexto, {
    tokenDeA: sessaoA.token,
    tokenDeB: sessaoB.token,
    tokenDaEnfermeira: sessaoEnfermeira.token,
    tokenDeQuemNaoAtende: sessaoSemPlantao.token,
    pacienteA: pacienteA.id,
    pacienteB: pacienteB.id,
    profissionalDaEnfermeira: enfermeira.id,
    usuarioDeA: usuarioA.id,
    sessaoDeTriagemDeA: sessaoDeTriagem.id,
    cicloDeA: sessaoDeQuimio,
    verbetePublicado: verbetePublicado.id,
    verbeteNaoPublicado: verbeteNaoPublicado.id,
  } satisfies Omit<Contexto, 'app'>);
}

function chamar(rota: string, token: string, opcoes: { metodo?: 'GET' | 'POST'; corpo?: unknown } = {}) {
  return contexto.app.inject({
    method: opcoes.metodo ?? 'GET',
    url: rota,
    headers: { authorization: `Bearer ${token}` },
    payload: opcoes.corpo as never,
  });
}

describe.skipIf(!COM_BANCO)('rotas do paciente', () => {
  beforeAll(async () => {
    contexto.app = await montarAppDaProva();
    await limparProvaAnterior();
    await criarFixtures();
  }, 60_000);

  describe('perfil', () => {
    it('devolve o próprio perfil com dia do ciclo derivado de tempo.ts', async () => {
      const resposta = await chamar('/paciente/perfil', contexto.tokenDeA);
      expect(resposta.statusCode).toBe(200);

      const corpo = resposta.json();
      expect(corpo.paciente.id).toBe(contexto.pacienteA);
      expect(corpo.paciente.tipoSanguineo).toBe('O+');
      expect(corpo.medicoAssistente.nome).toBe(`${MARCA} Médico`);

      // O oráculo é o valor COMO O BANCO DEVOLVE, não como foi gravado: `sessaoRealizadaEm`
      // é `@db.Date`, e o Prisma devolve a coluna como meia-noite UTC. Se a rota fizesse a
      // própria conta em UTC em vez de usar `tempo.ts`, este número divergiria — foi esse
      // defeito que desligou um corte de risco em silêncio.
      //
      // ATENÇÃO: meia-noite UTC cai no dia ANTERIOR no fuso do serviço, e por isso o dia do
      // ciclo sai um dia adiantado em todo o sistema (aqui, no painel e na classificação).
      // O defeito é anterior a esta entrega e está relatado — a correção mora em `tempo.ts`.
      const cicloNoBanco = await prisma.ciclo.findFirstOrThrow({
        where: { tratamento: { pacienteId: contexto.pacienteA } },
      });

      console.log(
        'ciclo — gravado:',
        contexto.cicloDeA.toISOString(),
        '| lido do banco:',
        cicloNoBanco.sessaoRealizadaEm.toISOString(),
        '| diaDoCiclo da rota:',
        corpo.ciclo.diaDoCiclo,
      );

      // `calcularDiaDoCiclo`, não `diasDeDiferenca`: `sessaoRealizadaEm` é coluna
      // `@db.Date`, que o Prisma entrega como meia-noite UTC. Lida como instante em
      // fuso negativo, ela recua um dia. Aferir contra `diasDeDiferenca` era medir o
      // valor certo com a régua torta — o teste ficava verde sobre o número errado.
      expect(corpo.ciclo.diaDoCiclo).toBe(
        calcularDiaDoCiclo(cicloNoBanco.sessaoRealizadaEm, new Date()),
      );
    });

    it('separa contato do paciente de contato de emergência', async () => {
      const corpo = (await chamar('/paciente/perfil', contexto.tokenDeA)).json();

      expect(corpo.contatos.doPaciente).toHaveLength(1);
      expect(corpo.contatos.deEmergencia).toHaveLength(1);
      expect(corpo.contatos.doPaciente[0].nome).toBe('Telefone de A');
      expect(corpo.contatos.deEmergencia[0].relacao).toBe('filha');
    });

    it('o perfil que B recebe é o de B, nunca o de A', async () => {
      const corpo = (await chamar('/paciente/perfil', contexto.tokenDeB)).json();

      expect(corpo.paciente.id).toBe(contexto.pacienteB);
      expect(corpo.paciente.id).not.toBe(contexto.pacienteA);
    });

    it('profissional não entra pela porta do aplicativo do paciente', async () => {
      const resposta = await chamar('/paciente/perfil', contexto.tokenDaEnfermeira);
      expect(resposta.statusCode).toBe(403);
    });
  });

  describe('alergia sugerida', () => {
    it('nasce com origem PACIENTE e sem confirmação', async () => {
      const resposta = await chamar('/paciente/alergias', contexto.tokenDeA, {
        metodo: 'POST',
        corpo: { descricao: 'Dipirona' },
      });

      expect(resposta.statusCode).toBe(201);

      const linha = await prisma.alergiaDoPaciente.findFirstOrThrow({
        where: { pacienteId: contexto.pacienteA, descricao: 'Dipirona' },
      });

      expect(linha.origem).toBe('PACIENTE');
      expect(linha.confirmadaEm).toBeNull();
      expect(linha.confirmadaPorId).toBeNull();
      console.log('alergia sugerida:', JSON.stringify(linha));
    });

    it('toque repetido não empilha a mesma pendência', async () => {
      const repetida = await chamar('/paciente/alergias', contexto.tokenDeA, {
        metodo: 'POST',
        corpo: { descricao: 'Dipirona' },
      });

      expect(repetida.json().jaRegistrada).toBe(true);
      expect(
        await prisma.alergiaDoPaciente.count({
          where: { pacienteId: contexto.pacienteA, descricao: 'Dipirona' },
        }),
      ).toBe(1);
    });
  });

  describe('biblioteca', () => {
    it('lista só o que está publicado', async () => {
      const corpo = (await chamar('/paciente/biblioteca?categoria=ALIMENTACAO', contexto.tokenDeA)).json();
      const ids = corpo.itens.map((item: { id: string }) => item.id);

      expect(ids).toContain(contexto.verbetePublicado);
      expect(ids).not.toContain(contexto.verbeteNaoPublicado);
    });

    it('verbete não publicado também não abre pelo id direto', async () => {
      const resposta = await chamar(
        `/paciente/biblioteca/${contexto.verbeteNaoPublicado}`,
        contexto.tokenDeA,
      );

      expect(resposta.statusCode).toBe(404);
      expect(resposta.json().erro).toBe('Este conteúdo não está disponível.');
    });

    it('verbete publicado abre', async () => {
      const resposta = await chamar(
        `/paciente/biblioteca/${contexto.verbetePublicado}`,
        contexto.tokenDeA,
      );

      expect(resposta.statusCode).toBe(200);
      expect(resposta.json().corpo).toBe('Conteúdo revisado.');
    });
  });

  describe('agenda', () => {
    it('devolve só os eventos do próprio paciente, do mais próximo ao mais distante', async () => {
      await prisma.eventoDeAgenda.createMany({
        data: [
          { pacienteId: contexto.pacienteA, tipo: 'QUIMIOTERAPIA', aconteceEm: new Date('2026-09-04T13:00:00Z'), local: 'A4' },
          { pacienteId: contexto.pacienteA, tipo: 'CONSULTA_MEDICA', aconteceEm: new Date('2026-09-01T13:00:00Z'), local: 'A1' },
          { pacienteId: contexto.pacienteA, tipo: 'CONSULTA_NUTRICAO', aconteceEm: new Date('2026-09-02T13:00:00Z'), local: 'A2' },
          { pacienteId: contexto.pacienteA, tipo: 'CONSULTA_PSICOLOGIA', aconteceEm: new Date('2026-09-03T13:00:00Z'), local: 'A3' },
          { pacienteId: contexto.pacienteB, tipo: 'QUIMIOTERAPIA', aconteceEm: new Date('2026-09-01T13:00:00Z'), local: 'B1' },
        ],
      });

      const corpo = (await chamar('/paciente/agenda?de=2026-09-01T00:00:00Z', contexto.tokenDeA)).json();
      const locais = corpo.itens.map((item: { local: string }) => item.local);

      expect(locais).toEqual(['A1', 'A2', 'A3', 'A4']);
      expect(locais).not.toContain('B1');
    });

    it('B não enxerga evento de A', async () => {
      const corpo = (await chamar('/paciente/agenda?de=2026-09-01T00:00:00Z', contexto.tokenDeB)).json();

      expect(corpo.itens.map((item: { local: string }) => item.local)).toEqual(['B1']);
    });

    it('paginação por cursor segura a página quando chega evento novo no meio', async () => {
      const primeira = (
        await chamar('/paciente/agenda?de=2026-09-01T00:00:00Z&limite=2', contexto.tokenDeA)
      ).json();

      expect(primeira.itens.map((item: { local: string }) => item.local)).toEqual(['A1', 'A2']);
      expect(primeira.proximoCursor).toBeTypeOf('string');

      // Remarcação chegando no meio da navegação: com offset, a página 2 repetiria A2 e
      // pularia A4. Com cursor, ela continua exatamente de onde parou.
      await prisma.eventoDeAgenda.create({
        data: {
          pacienteId: contexto.pacienteA,
          tipo: 'CONSULTA_MEDICA',
          aconteceEm: new Date('2026-09-01T09:00:00Z'),
          local: 'A0-remarcado',
        },
      });

      const segunda = (
        await chamar(
          `/paciente/agenda?de=2026-09-01T00:00:00Z&limite=2&cursor=${encodeURIComponent(primeira.proximoCursor)}`,
          contexto.tokenDeA,
        )
      ).json();

      expect(segunda.itens.map((item: { local: string }) => item.local)).toEqual(['A3', 'A4']);
      expect(segunda.proximoCursor).toBeNull();
    });
  });

  describe('falar com a enfermagem', () => {
    it('dois cliques seguidos criam uma solicitação só', async () => {
      const primeiro = await chamar('/paciente/solicitacoes-de-contato', contexto.tokenDeA, {
        metodo: 'POST',
        corpo: { sessaoId: contexto.sessaoDeTriagemDeA },
      });
      const segundo = await chamar('/paciente/solicitacoes-de-contato', contexto.tokenDeA, {
        metodo: 'POST',
        corpo: { sessaoId: contexto.sessaoDeTriagemDeA },
      });

      expect(primeiro.statusCode).toBe(201);
      expect(primeiro.json().reaproveitada).toBe(false);
      expect(segundo.statusCode).toBe(200);
      expect(segundo.json().reaproveitada).toBe(true);
      expect(segundo.json().solicitacaoId).toBe(primeiro.json().solicitacaoId);

      expect(
        await prisma.solicitacaoDeContato.count({ where: { pacienteId: contexto.pacienteA } }),
      ).toBe(1);
    });

    it('não promete prazo de retorno', async () => {
      const corpo = (
        await chamar('/paciente/solicitacoes-de-contato', contexto.tokenDeA, { metodo: 'POST' })
      ).json();

      expect(corpo.mensagem).not.toMatch(/hora|minuto|prazo|retorn|logo|em breve/i);
    });

    it('não amarra o pedido à sessão de outra pessoa', async () => {
      const resposta = await chamar('/paciente/solicitacoes-de-contato', contexto.tokenDeB, {
        metodo: 'POST',
        corpo: { sessaoId: contexto.sessaoDeTriagemDeA },
      });

      expect(resposta.statusCode).toBe(403);
      expect(resposta.json().erro).toBe('Este check-in é de outra pessoa.');
    });

    it('pedido antigo em aberto NÃO cala o pedido de hoje', async () => {
      const primeiro = await chamar('/paciente/solicitacoes-de-contato', contexto.tokenDeB, {
        metodo: 'POST',
      });
      expect(primeiro.statusCode).toBe(201);
      expect(primeiro.json().avisosEnviados).toBeGreaterThan(0);

      // Envelhece o pedido em duas horas, sem atendê-lo: é exatamente o cenário do
      // telefonema que a enfermeira não registrou no sistema.
      const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await prisma.solicitacaoDeContato.update({
        where: { id: primeiro.json().solicitacaoId },
        data: { solicitadaEm: duasHorasAtras },
      });

      const segundo = await chamar('/paciente/solicitacoes-de-contato', contexto.tokenDeB, {
        metodo: 'POST',
      });

      expect(segundo.statusCode).toBe(201);
      expect(segundo.json().reaproveitada).toBe(false);
      expect(segundo.json().solicitacaoId).not.toBe(primeiro.json().solicitacaoId);

      const linhas = await prisma.solicitacaoDeContato.findMany({
        where: { pacienteId: contexto.pacienteB },
        orderBy: { solicitadaEm: 'asc' },
      });
      expect(linhas).toHaveLength(2);

      const avisos = await prisma.notificacao.findMany({
        where: {
          referenciaTipo: 'SolicitacaoDeContato',
          referenciaId: { in: linhas.map((linha) => linha.id) },
        },
      });
      // Um aviso por pedido, para CADA pessoa de plantão — o banco pode ter mais de uma.
      // O que a prova exige é que os dois pedidos tenham avisado: o segundo não passou em
      // silêncio, que era exatamente o furo.
      const dePlantao = await prisma.concessaoDePermissao.count({
        where: { permissao: 'ATENDER_PLANTAO', revogadaEm: null },
      });

      expect(new Set(avisos.map((aviso) => aviso.referenciaId)).size).toBe(2);
      expect(avisos).toHaveLength(2 * dePlantao);

      console.log('duas solicitações de B:', JSON.stringify(linhas));
      console.log(
        'duas notificações:',
        JSON.stringify(avisos.map((a) => ({ id: a.id, assunto: a.assunto, referenciaId: a.referenciaId }))),
      );
    });

    it('o paciente só enxerga os próprios pedidos', async () => {
      const deB = (await chamar('/paciente/solicitacoes-de-contato', contexto.tokenDeB)).json();
      const idsDeA = (
        await prisma.solicitacaoDeContato.findMany({ where: { pacienteId: contexto.pacienteA } })
      ).map((linha) => linha.id);

      expect(deB.itens).toHaveLength(2);
      for (const item of deB.itens as Array<{ id: string }>) {
        expect(idsDeA).not.toContain(item.id);
      }
    });
  });

  describe('fila do painel e fechamento', () => {
    it('quem não tem ATENDER_PLANTAO não vê a fila', async () => {
      expect((await chamar('/painel/solicitacoes-de-contato', contexto.tokenDeA)).statusCode).toBe(403);
      expect(
        (await chamar('/painel/solicitacoes-de-contato', contexto.tokenDeQuemNaoAtende)).statusCode,
      ).toBe(403);
    });

    it('a enfermagem vê a fila em aberto, do mais antigo para o mais novo', async () => {
      const resposta = await chamar('/painel/solicitacoes-de-contato', contexto.tokenDaEnfermeira);
      expect(resposta.statusCode).toBe(200);

      const corpo = resposta.json();
      const instantes = corpo.itens.map((item: { solicitadaEm: string }) =>
        new Date(item.solicitadaEm).getTime(),
      );
      expect([...instantes].sort((a, b) => a - b)).toEqual(instantes);
      expect(corpo.aguardando).toBeGreaterThanOrEqual(3);
    });

    it('fechar grava atendidaEm e atendidaPorId, e registra o acesso', async () => {
      const fila = (await chamar('/painel/solicitacoes-de-contato', contexto.tokenDaEnfermeira)).json();
      const alvo = fila.itens[0].id;

      const resposta = await chamar(
        `/painel/solicitacoes-de-contato/${alvo}/atendimento`,
        contexto.tokenDaEnfermeira,
        { metodo: 'POST' },
      );

      expect(resposta.statusCode).toBe(200);

      const linha = await prisma.solicitacaoDeContato.findUniqueOrThrow({ where: { id: alvo } });
      expect(linha.atendidaEm).not.toBeNull();
      expect(linha.atendidaPorId).toBe(contexto.profissionalDaEnfermeira);
      console.log('solicitação fechada:', JSON.stringify(linha));

      const acessos = await prisma.logDeAcesso.count({
        where: { pacienteId: linha.pacienteId, acao: 'REGISTRO_DE_INTERVENCAO' },
      });
      expect(acessos).toBeGreaterThan(0);
    });

    it('fechar duas vezes não sobrescreve quem atendeu', async () => {
      const fechadas = await prisma.solicitacaoDeContato.findFirstOrThrow({
        where: { atendidaEm: { not: null }, paciente: { nome: { startsWith: MARCA } } },
      });

      const resposta = await chamar(
        `/painel/solicitacoes-de-contato/${fechadas.id}/atendimento`,
        contexto.tokenDaEnfermeira,
        { metodo: 'POST' },
      );

      expect(resposta.statusCode).toBe(409);
      expect(resposta.json().erro).toBe('Este pedido já foi atendido.');
    });

    it('pedido fechado sai da fila e deixa de bloquear pedido novo', async () => {
      const fila = (await chamar('/painel/solicitacoes-de-contato', contexto.tokenDaEnfermeira)).json();
      const fechada = await prisma.solicitacaoDeContato.findFirstOrThrow({
        where: { atendidaEm: { not: null }, paciente: { nome: { startsWith: MARCA } } },
      });

      expect(fila.itens.map((item: { id: string }) => item.id)).not.toContain(fechada.id);
    });
  });

  describe('notificações', () => {
    it('o paciente lê as próprias', async () => {
      await prisma.notificacao.create({
        data: {
          destinatarioId: contexto.usuarioDeA,
          canal: 'NO_APP',
          assunto: `${MARCA} Aviso`,
          corpo: 'Sua consulta foi remarcada.',
        },
      });

      const corpo = (await chamar('/paciente/notificacoes', contexto.tokenDeA)).json();

      expect(corpo.itens).toHaveLength(1);
      expect(corpo.naoLidas).toBe(1);
      expect(corpo.itens[0].assunto).toBe(`${MARCA} Aviso`);
    });

    it('marcar como lida grava lidaEm e não reescreve na segunda vez', async () => {
      const aviso = await prisma.notificacao.findFirstOrThrow({
        where: { destinatarioId: contexto.usuarioDeA },
      });

      const primeira = await chamar(
        `/paciente/notificacoes/${aviso.id}/leitura`,
        contexto.tokenDeA,
        { metodo: 'POST' },
      );
      expect(primeira.statusCode).toBe(200);
      expect(primeira.json().lidaEm).not.toBeNull();

      const segunda = await chamar(
        `/paciente/notificacoes/${aviso.id}/leitura`,
        contexto.tokenDeA,
        { metodo: 'POST' },
      );
      expect(segunda.json().jaEstavaLida).toBe(true);
      expect(segunda.json().lidaEm).toBe(primeira.json().lidaEm);
    });

    it('B não lê nem marca aviso de A', async () => {
      const aviso = await prisma.notificacao.findFirstOrThrow({
        where: { destinatarioId: contexto.usuarioDeA },
      });

      const listaDeB = (await chamar('/paciente/notificacoes', contexto.tokenDeB)).json();
      expect(listaDeB.itens.map((item: { id: string }) => item.id)).not.toContain(aviso.id);

      const tentativa = await chamar(`/paciente/notificacoes/${aviso.id}/leitura`, contexto.tokenDeB, {
        metodo: 'POST',
      });

      expect(tentativa.statusCode).toBe(403);
      expect(tentativa.json().erro).toBe('Este aviso é de outra pessoa.');
    });
  });
});
