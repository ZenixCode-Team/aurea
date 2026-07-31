import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import type { AcaoDeAcesso, Permissao, PerfilDeUsuario } from '@prisma/client';
import { prisma } from '../prisma.js';
import { naoAutenticado, semPermissao } from '../erros.js';
import { hashDoToken } from './sessao.js';

export interface UsuarioAutenticado {
  readonly id: string;
  readonly perfil: PerfilDeUsuario;
  readonly permissoes: readonly Permissao[];
  readonly pacienteId: string | null;
  readonly profissionalId: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: UsuarioAutenticado;
    tokenDaSessao?: string;
  }
}

async function carregarUsuarioDoToken(token: string): Promise<UsuarioAutenticado | null> {
  const sessao = await prisma.sessaoDeAcesso.findUnique({
    where: { tokenHash: hashDoToken(token) },
    include: {
      usuario: {
        include: {
          permissoes: { where: { revogadaEm: null } },
          paciente: { select: { id: true } },
          profissional: { select: { id: true } },
        },
      },
    },
  });

  if (!sessao) return null;
  if (sessao.revogadaEm) return null;
  if (sessao.expiraEm.getTime() <= Date.now()) return null;
  if (!sessao.usuario.ativo) return null;

  return {
    id: sessao.usuario.id,
    perfil: sessao.usuario.perfil,
    permissoes: sessao.usuario.permissoes.map((concessao) => concessao.permissao),
    pacienteId: sessao.usuario.paciente?.id ?? null,
    profissionalId: sessao.usuario.profissional?.id ?? null,
  };
}

export const autenticacao = fastifyPlugin(async (app: FastifyInstance) => {
  app.decorateRequest('usuario', undefined);
  app.decorateRequest('tokenDaSessao', undefined);

  app.decorate('autenticar', async (requisicao: FastifyRequest) => {
    const cabecalho = requisicao.headers.authorization;

    if (!cabecalho?.startsWith('Bearer ')) {
      throw naoAutenticado();
    }

    const token = cabecalho.slice('Bearer '.length).trim();
    const usuario = await carregarUsuarioDoToken(token);

    if (!usuario) throw naoAutenticado();

    requisicao.usuario = usuario;
    requisicao.tokenDaSessao = token;
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    autenticar: (requisicao: FastifyRequest) => Promise<void>;
  }
}

export function usuarioDa(requisicao: FastifyRequest): UsuarioAutenticado {
  if (!requisicao.usuario) throw naoAutenticado();
  return requisicao.usuario;
}

/**
 * Regra 6 do ADR-001 em código: a checagem é sobre a permissão nominal, nunca sobre o
 * perfil. `perfil === 'PROFISSIONAL'` não diz se a pessoa está de plantão nem se pode
 * editar o algoritmo — e tratar os dois como a mesma coisa é exatamente o erro que a
 * regra existe para impedir.
 */
export function exigirPermissao(...permissoesAceitas: Permissao[]) {
  return async (requisicao: FastifyRequest, _resposta: FastifyReply) => {
    const usuario = usuarioDa(requisicao);
    const temAlguma = permissoesAceitas.some((permissao) => usuario.permissoes.includes(permissao));

    if (!temAlguma) {
      throw semPermissao(
        `Esta operação exige uma destas permissões: ${permissoesAceitas.join(', ')}.`,
      );
    }
  };
}

/** Só o próprio paciente. Profissional usa as rotas do painel, que registram acesso. */
export function exigirPaciente(requisicao: FastifyRequest): string {
  const usuario = usuarioDa(requisicao);
  if (usuario.perfil !== 'PACIENTE' || !usuario.pacienteId) {
    throw semPermissao('Esta rota é do aplicativo do paciente.');
  }
  return usuario.pacienteId;
}

/**
 * Regra 5 — quem abriu o histórico de quem, desde o dia 1.
 *
 * Escreve fora da transação da requisição de propósito: falha ao registrar acesso não
 * pode derrubar o atendimento. O que ela não pode é passar silenciosa, então vai para o
 * log do servidor.
 */
export async function registrarAcesso(
  requisicao: FastifyRequest,
  dados: { acao: AcaoDeAcesso; usuarioId: string; pacienteId?: string | null },
): Promise<void> {
  try {
    await prisma.logDeAcesso.create({
      data: {
        usuarioId: dados.usuarioId,
        pacienteId: dados.pacienteId ?? null,
        acao: dados.acao,
        rota: requisicao.url.slice(0, 180),
        metodo: requisicao.method,
        ip: requisicao.ip?.slice(0, 45) ?? null,
        userAgent: requisicao.headers['user-agent']?.slice(0, 255) ?? null,
      },
    });
  } catch (erro) {
    requisicao.log.error({ erro }, 'Falha ao registrar acesso — investigar, é requisito de LGPD.');
  }
}
