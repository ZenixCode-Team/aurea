import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '../prisma.js';

/**
 * A sessão é um token opaco guardado como hash, não um JWT.
 *
 * JWT não é revogável antes de expirar sem uma lista de bloqueio — que é, no fim, a
 * mesma consulta ao banco que o token opaco já faz, só que com mais peças. Num sistema
 * que carrega diagnóstico oncológico, "derrubar esta sessão agora" precisa funcionar no
 * mesmo instante: aparelho perdido, desligamento de profissional, suspeita de acesso
 * indevido. A API já fala com o banco em toda requisição autenticada de qualquer forma.
 *
 * O banco guarda o hash. Vazamento da tabela de sessões não entrega sessão utilizável.
 */

const DURACAO_PADRAO_EM_DIAS = 7;
/** "Manter conectado" — o ADR-001 aceitou sessão longa como mitigação de não haver biometria na web. */
const DURACAO_ESTENDIDA_EM_DIAS = 30;

export function gerarToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SessaoCriada {
  readonly token: string;
  readonly expiraEm: Date;
}

export async function abrirSessao(
  usuarioId: string,
  opcoes: { manterConectado?: boolean; ip?: string; userAgent?: string } = {},
): Promise<SessaoCriada> {
  const token = gerarToken();
  const dias = opcoes.manterConectado ? DURACAO_ESTENDIDA_EM_DIAS : DURACAO_PADRAO_EM_DIAS;
  const expiraEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

  await prisma.sessaoDeAcesso.create({
    data: {
      usuarioId,
      tokenHash: hashDoToken(token),
      expiraEm,
      ip: opcoes.ip?.slice(0, 45) ?? null,
      userAgent: opcoes.userAgent?.slice(0, 255) ?? null,
    },
  });

  return { token, expiraEm };
}

export async function encerrarSessao(token: string): Promise<void> {
  await prisma.sessaoDeAcesso.updateMany({
    where: { tokenHash: hashDoToken(token), revogadaEm: null },
    data: { revogadaEm: new Date() },
  });
}

/** Comparação em tempo constante, para não vazar informação pelo tempo de resposta. */
export function comparaEmTempoConstante(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
