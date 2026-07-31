import type { FastifyInstance } from 'fastify';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';
import { cpfEhValido, normalizarCpf } from '@aurea/contratos';
import { prisma } from '../prisma.js';
import { requisicaoInvalida, ErroDaApi } from '../erros.js';
import { abrirSessao, encerrarSessao } from '../autenticacao/sessao.js';
import { registrarAcesso, usuarioDa } from '../autenticacao/plugin.js';
import {
  estaBloqueado,
  limparTentativas,
  registrarFalha,
  segundosAteLiberar,
} from '../autenticacao/tentativas.js';

const entrarSchema = z
  .object({
    /** Paciente entra por CPF: a enfermagem já o conhece por ele e não há dúvida de quem é quem. */
    cpf: z
      .string()
      .transform(normalizarCpf)
      .refine(cpfEhValido, 'CPF inválido.')
      .optional(),
    /** Profissional e administrador entram por e-mail. */
    email: z.string().email().optional(),
    senha: z.string().min(8).max(200),
    manterConectado: z.boolean().default(false),
  })
  .refine((dados) => Boolean(dados.cpf) !== Boolean(dados.email), {
    message: 'Informe CPF ou e-mail, nunca os dois.',
  });

/**
 * Hash descartável usado quando o usuário não existe.
 *
 * Sem ele, login com CPF inexistente responde em 2 ms e login com senha errada responde
 * em 80 ms — e a diferença deixa qualquer pessoa descobrir quais CPFs estão cadastrados
 * no sistema. Num cadastro de pacientes oncológicos, saber quem está na lista já é
 * vazamento de dado de saúde, mesmo sem abrir o prontuário.
 */
const hashDescartavel = await hash('senha-que-nao-existe', 10);

export async function rotasDeAutenticacao(app: FastifyInstance) {
  app.post(
    '/autenticacao/entrar',
    {
      /**
       * Este limite conta só por ORIGEM, e é generoso de propósito.
       *
       * Não tente pôr o identificador nesta chave: o `keyGenerator` roda no `onRequest`
       * e `requisicao.body` é `undefined` lá dentro — foi exatamente esse engano que
       * fez o limite anterior contar tudo num balde só, trancando o login da enfermagem
       * quando um paciente errava a senha no mesmo IP.
       *
       * A proteção da CONTA fica em `autenticacao/tentativas.ts`, dentro do handler,
       * onde o corpo já existe.
       */
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '5 minutes',
        },
      },
    },
    async (requisicao, resposta) => {
    const analise = entrarSchema.safeParse(requisicao.body);
    if (!analise.success) {
      throw requisicaoInvalida('Dados de entrada inválidos.', analise.error.issues);
    }

    const { cpf, email, senha, manterConectado } = analise.data;
    const alvo = cpf ?? email ?? '';

    // Proteção da conta, independente da origem. Quem troca de IP a cada tentativa
    // continua batendo no mesmo contador, porque o contador é do identificador.
    if (estaBloqueado(alvo)) {
      throw new ErroDaApi(
        429,
        `Muitas tentativas seguidas. Tente de novo em ${Math.ceil(segundosAteLiberar(alvo) / 60)} minuto(s).`,
      );
    }

    const usuario = await prisma.usuario.findFirst({
      where: cpf ? { cpf } : { email },
    });

    const senhaConfere = usuario
      ? await compare(senha, usuario.senhaHash)
      : await compare(senha, hashDescartavel);

    if (!usuario || !senhaConfere || !usuario.ativo) {
      registrarFalha(alvo);

      if (usuario) {
        await registrarAcesso(requisicao, { acao: 'LOGIN_RECUSADO', usuarioId: usuario.id });
      }
      // Mensagem única de propósito: dizer "CPF não cadastrado" entrega a lista.
      throw new ErroDaApi(401, 'CPF, e-mail ou senha incorretos.');
    }

    // Quem sabe a senha não é ameaça. Zerar aqui evita que o contador puna o paciente
    // que errou duas vezes e acertou na terceira.
    limparTentativas(alvo);

    const sessao = await abrirSessao(usuario.id, {
      manterConectado,
      ip: requisicao.ip,
      userAgent: requisicao.headers['user-agent'],
    });

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcessoEm: new Date() },
    });

    await registrarAcesso(requisicao, { acao: 'LOGIN', usuarioId: usuario.id });

    return resposta.send({
      token: sessao.token,
      expiraEm: sessao.expiraEm,
      perfil: usuario.perfil,
      precisaVerPrimeiroAcesso: usuario.primeiroAcessoEm === null,
    });
    },
  );

  app.post(
    '/autenticacao/sair',
    { preHandler: (requisicao) => app.autenticar(requisicao) },
    async (requisicao, resposta) => {
      if (requisicao.tokenDaSessao) await encerrarSessao(requisicao.tokenDaSessao);
      return resposta.status(204).send();
    },
  );

  app.get(
    '/autenticacao/eu',
    { preHandler: (requisicao) => app.autenticar(requisicao) },
    async (requisicao) => {
      const usuario = usuarioDa(requisicao);

      const perfil =
        usuario.pacienteId !== null
          ? await prisma.paciente.findUnique({
              where: { id: usuario.pacienteId },
              select: { id: true, nome: true, diagnostico: true },
            })
          : usuario.profissionalId !== null
            ? await prisma.profissional.findUnique({
                where: { id: usuario.profissionalId },
                select: { id: true, nome: true, funcao: true },
              })
            : null;

      return { ...usuario, perfilDetalhado: perfil };
    },
  );
}
