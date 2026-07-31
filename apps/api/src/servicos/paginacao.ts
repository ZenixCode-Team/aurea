import { z } from 'zod';
import { requisicaoInvalida } from '../erros.js';

/**
 * Paginação por cursor — o utilitário único do AUREA. Nenhuma listagem usa offset.
 *
 * Por que não `skip`/`take`: offset numera a página pela posição, e a posição muda
 * quando chega linha nova durante a navegação. Numa fila de pedidos de contato ou num
 * histórico de check-ins, isso significa a página 2 repetir uma linha da página 1 e
 * PULAR outra — e a linha pulada some da tela sem ninguém perceber. Cursor ancora na
 * última linha lida, então inserção no meio não desloca o que já foi entregue.
 *
 * O cursor é *keyset*: carrega o valor do campo de ordenação e o id da última linha, e a
 * consulta seguinte pede "o que vem depois deste par". O id é desempate obrigatório —
 * sem ele, duas linhas com o mesmo `solicitadaEm` fazem o cursor pular ou repetir de novo.
 *
 * Contrato para reúso (é o mesmo em toda rota):
 *
 *   entrada:  ?cursor=<opaco>&limite=<1..100>     (limite padrão 20)
 *   saída:    { itens: [...], proximoCursor: string | null }
 *
 * `proximoCursor` nulo significa fim da lista. O cliente não interpreta o cursor: ele é
 * opaco de propósito, para que mudar a chave de ordenação não quebre aplicativo instalado.
 *
 * Como usar numa rota:
 *
 *   const parametros = lerPaginacao(requisicao.query);
 *   const chave: ChaveDeOrdenacao = { campo: 'aconteceEm', direcao: 'asc', tipo: 'data' };
 *   const fatia = fatiaDoCursor<Prisma.EventoDeAgendaWhereInput, Prisma.EventoDeAgendaOrderByWithRelationInput>(
 *     chave,
 *     parametros,
 *   );
 *
 *   const linhas = await prisma.eventoDeAgenda.findMany({
 *     where: { pacienteId, ...(fatia.filtro ? { AND: [fatia.filtro] } : {}) },
 *     orderBy: fatia.ordenacao,
 *     take: fatia.quantidade,
 *     select: { id: true, aconteceEm: true, ... },   // o campo da chave PRECISA vir no select
 *   });
 *
 *   return montarPagina(linhas, chave, parametros);
 *
 * Três regras de uso, todas com efeito silencioso quando violadas:
 *
 * 1. O `select` precisa trazer `id` e o campo da chave — o cursor é montado a partir deles.
 * 2. O filtro do cursor entra em `AND`, nunca espalhado no `where`. A condição de keyset é
 *    um `OR` interno; espalhar dois `OR` no mesmo objeto faz um sobrescrever o outro e a
 *    consulta devolve linha de outro paciente.
 * 3. A chave de ordenação precisa ser estável para a mesma linha. Ordenar por campo que o
 *    próprio usuário edita (um título, por exemplo) faz a linha trocar de lugar entre duas
 *    páginas; para esses casos, ordene por algo imutável.
 */

export const LIMITE_PADRAO = 20;
export const LIMITE_MAXIMO = 100;

export type DirecaoDaOrdem = 'asc' | 'desc';

/** Tipo do campo de ordenação. Decide como o valor volta do cursor. */
export type TipoDaChave = 'data' | 'texto' | 'numero';

export interface ChaveDeOrdenacao {
  /** Nome da coluna pela qual a lista é ordenada. Precisa estar no `select` da consulta. */
  readonly campo: string;
  readonly direcao: DirecaoDaOrdem;
  readonly tipo: TipoDaChave;
}

export interface ParametrosDePaginacao {
  readonly cursor: string | null;
  readonly limite: number;
}

export interface PaginaPorCursor<T> {
  readonly itens: T[];
  /** Nulo quando não há próxima página. */
  readonly proximoCursor: string | null;
}

export interface FatiaDeConsulta<Filtro, Ordem> {
  /** Condição de keyset. Vai em `AND`, nunca espalhada no `where`. */
  readonly filtro: Filtro | undefined;
  readonly ordenacao: Ordem[];
  /** Já vem com +1 linha: é assim que se sabe se existe página seguinte sem um `count`. */
  readonly quantidade: number;
}

const consultaDePaginacaoSchema = z.object({
  cursor: z.string().min(1).max(400).optional(),
  limite: z.coerce.number().int().min(1).max(LIMITE_MAXIMO).optional(),
});

const conteudoDoCursorSchema = z.object({
  v: z.union([z.string(), z.number()]),
  i: z.string().min(1).max(64),
});

/**
 * Mensagem única para cursor corrompido ou limite fora da faixa.
 *
 * Em linguagem de paciente e sem jargão: quem lê isto pode ser uma pessoa idosa no pior
 * dia do ciclo, e "parâmetro inválido" não diz a ela o que fazer.
 */
const NAO_CONSEGUIMOS_CONTINUAR =
  'Não conseguimos continuar esta lista de onde você parou. Feche e abra a tela de novo.';

/** Lê `cursor` e `limite` da query string. Ignora os outros parâmetros da rota. */
export function lerPaginacao(consulta: unknown): ParametrosDePaginacao {
  const analise = consultaDePaginacaoSchema.safeParse(consulta ?? {});

  if (!analise.success) {
    throw requisicaoInvalida(NAO_CONSEGUIMOS_CONTINUAR);
  }

  return {
    cursor: analise.data.cursor ?? null,
    limite: analise.data.limite ?? LIMITE_PADRAO,
  };
}

function codificarCursor(valor: string | number, id: string): string {
  return Buffer.from(JSON.stringify({ v: valor, i: id }), 'utf8').toString('base64url');
}

function decodificarCursor(
  cursor: string,
  chave: ChaveDeOrdenacao,
): { valor: Date | string | number; id: string } {
  let bruto: unknown;

  try {
    bruto = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw requisicaoInvalida(NAO_CONSEGUIMOS_CONTINUAR);
  }

  const analise = conteudoDoCursorSchema.safeParse(bruto);
  if (!analise.success) throw requisicaoInvalida(NAO_CONSEGUIMOS_CONTINUAR);

  const { v, i } = analise.data;

  if (chave.tipo === 'data') {
    // O cursor guarda a data em ISO 8601. `new Date(string)` aqui é leitura de valor
    // que este mesmo módulo escreveu, não conta de calendário — conta de calendário do
    // AUREA mora inteira em `src/tempo.ts` e não passa por aqui.
    const data = typeof v === 'string' ? new Date(v) : new Date(NaN);
    if (Number.isNaN(data.getTime())) throw requisicaoInvalida(NAO_CONSEGUIMOS_CONTINUAR);
    return { valor: data, id: i };
  }

  if (chave.tipo === 'numero') {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw requisicaoInvalida(NAO_CONSEGUIMOS_CONTINUAR);
    }
    return { valor: v, id: i };
  }

  if (typeof v !== 'string') throw requisicaoInvalida(NAO_CONSEGUIMOS_CONTINUAR);
  return { valor: v, id: i };
}

/**
 * Monta o pedaço da consulta que depende do cursor: condição de keyset, ordenação e
 * quantidade.
 *
 * Os dois tipos genéricos são os tipos do Prisma do modelo consultado
 * (`Prisma.XWhereInput` e `Prisma.XOrderByWithRelationInput`). São informados pelo chamador
 * porque este módulo é genérico de propósito — a conversão acontece aqui, uma vez, em vez
 * de um `as` espalhado em cada rota.
 */
export function fatiaDoCursor<Filtro, Ordem>(
  chave: ChaveDeOrdenacao,
  parametros: ParametrosDePaginacao,
): FatiaDeConsulta<Filtro, Ordem> {
  const ordenacao = [
    { [chave.campo]: chave.direcao },
    { id: chave.direcao },
  ] as unknown as Ordem[];

  // Uma linha a mais do que o pedido: se ela veio, existe página seguinte. Evita um
  // `count` por página, que numa tabela que cresce custa mais do que a própria consulta.
  const quantidade = parametros.limite + 1;

  if (!parametros.cursor) {
    return { filtro: undefined, ordenacao, quantidade };
  }

  const { valor, id } = decodificarCursor(parametros.cursor, chave);
  const comparador = chave.direcao === 'asc' ? 'gt' : 'lt';

  const filtro = {
    OR: [
      { [chave.campo]: { [comparador]: valor } },
      { [chave.campo]: valor, id: { [comparador]: id } },
    ],
  } as unknown as Filtro;

  return { filtro, ordenacao, quantidade };
}

function valorDaChave(linha: Record<string, unknown>, chave: ChaveDeOrdenacao): string | number {
  const valor = linha[chave.campo];

  if (chave.tipo === 'data') {
    if (!(valor instanceof Date)) {
      throw new Error(
        `Paginação: o campo "${chave.campo}" não veio como data. Confira se ele está no select da consulta.`,
      );
    }
    return valor.toISOString();
  }

  if (chave.tipo === 'numero') {
    if (typeof valor !== 'number') {
      throw new Error(
        `Paginação: o campo "${chave.campo}" não veio como número. Confira se ele está no select da consulta.`,
      );
    }
    return valor;
  }

  if (typeof valor !== 'string') {
    throw new Error(
      `Paginação: o campo "${chave.campo}" não veio como texto. Confira se ele está no select da consulta.`,
    );
  }
  return valor;
}

/**
 * Corta a linha extra e monta o cursor da próxima página.
 *
 * Recebe as linhas como vieram do banco (`limite + 1`, na ordem da chave).
 */
export function montarPagina<T extends { id: string }>(
  linhas: readonly T[],
  chave: ChaveDeOrdenacao,
  parametros: ParametrosDePaginacao,
): PaginaPorCursor<T> {
  const temProximaPagina = linhas.length > parametros.limite;
  const itens = temProximaPagina ? linhas.slice(0, parametros.limite) : [...linhas];

  const ultimo = itens[itens.length - 1];

  return {
    itens,
    proximoCursor:
      temProximaPagina && ultimo
        ? codificarCursor(valorDaChave(ultimo as Record<string, unknown>, chave), ultimo.id)
        : null,
  };
}
