import { describe, expect, it } from 'vitest';
import {
  LIMITE_MAXIMO,
  LIMITE_PADRAO,
  fatiaDoCursor,
  lerPaginacao,
  montarPagina,
  type ChaveDeOrdenacao,
} from './paginacao.js';
import { ErroDaApi } from '../erros.js';

/**
 * O utilitário é pura montagem de consulta, então dá para provar sem banco.
 *
 * O teste que justifica o arquivo é o último: ele reprova se alguém trocar o keyset por
 * offset, ou tirar o id do desempate — que é o defeito que faz uma linha sumir da lista
 * quando chega registro novo no meio da navegação, sem erro nenhum.
 */

const PORDATA: ChaveDeOrdenacao = { campo: 'aconteceEm', direcao: 'asc', tipo: 'data' };
const PORDATA_DESC: ChaveDeOrdenacao = { campo: 'criadaEm', direcao: 'desc', tipo: 'data' };
const PORTITULO: ChaveDeOrdenacao = { campo: 'titulo', direcao: 'asc', tipo: 'texto' };

type Filtro = { OR: Array<Record<string, unknown>> };
type Ordem = Record<string, 'asc' | 'desc'>;

describe('lerPaginacao', () => {
  it('usa 20 como limite padrão e nenhum cursor', () => {
    expect(lerPaginacao({})).toEqual({ cursor: null, limite: LIMITE_PADRAO });
    expect(lerPaginacao(undefined)).toEqual({ cursor: null, limite: LIMITE_PADRAO });
  });

  it('aceita limite dentro da faixa, como número ou texto da query', () => {
    expect(lerPaginacao({ limite: '5' }).limite).toBe(5);
    expect(lerPaginacao({ limite: LIMITE_MAXIMO }).limite).toBe(LIMITE_MAXIMO);
  });

  it('recusa limite acima do máximo em vez de silenciosamente cortar', () => {
    // Cortar em silêncio faria o cliente pedir 500 e receber 100 achando que acabou.
    expect(() => lerPaginacao({ limite: 101 })).toThrow(ErroDaApi);
    expect(() => lerPaginacao({ limite: 0 })).toThrow(ErroDaApi);
  });

  it('ignora os outros parâmetros da rota', () => {
    expect(lerPaginacao({ categoria: 'VACINAS', de: '2026-07-01' })).toEqual({
      cursor: null,
      limite: LIMITE_PADRAO,
    });
  });

  it('recusa cursor corrompido com mensagem de paciente', () => {
    const parametros = lerPaginacao({ cursor: 'isto-nao-e-um-cursor' });

    try {
      fatiaDoCursor<Filtro, Ordem>(PORDATA, parametros);
      throw new Error('deveria ter recusado');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDaApi);
      expect((erro as ErroDaApi).status).toBe(400);
      expect((erro as ErroDaApi).message).not.toMatch(/inválid|erro ao processar|indisponível/i);
    }
  });
});

describe('fatiaDoCursor', () => {
  it('pede uma linha a mais do que o limite, para saber se há próxima página', () => {
    expect(fatiaDoCursor<Filtro, Ordem>(PORDATA, { cursor: null, limite: 20 }).quantidade).toBe(21);
  });

  it('ordena pela chave e desempata pelo id na mesma direção', () => {
    expect(fatiaDoCursor<Filtro, Ordem>(PORDATA, { cursor: null, limite: 2 }).ordenacao).toEqual([
      { aconteceEm: 'asc' },
      { id: 'asc' },
    ]);

    expect(fatiaDoCursor<Filtro, Ordem>(PORDATA_DESC, { cursor: null, limite: 2 }).ordenacao).toEqual([
      { criadaEm: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('não filtra nada na primeira página', () => {
    expect(fatiaDoCursor<Filtro, Ordem>(PORDATA, { cursor: null, limite: 2 }).filtro).toBeUndefined();
  });

  it('em ordem crescente pede o que vem depois do par (valor, id)', () => {
    const primeira = montarPagina(
      [
        { id: 'a', aconteceEm: new Date('2026-08-01T12:00:00Z') },
        { id: 'b', aconteceEm: new Date('2026-08-02T12:00:00Z') },
      ],
      PORDATA,
      { cursor: null, limite: 1 },
    );

    const fatia = fatiaDoCursor<Filtro, Ordem>(PORDATA, {
      cursor: primeira.proximoCursor,
      limite: 1,
    });

    expect(fatia.filtro).toEqual({
      OR: [
        { aconteceEm: { gt: new Date('2026-08-01T12:00:00Z') } },
        { aconteceEm: new Date('2026-08-01T12:00:00Z'), id: { gt: 'a' } },
      ],
    });
  });

  it('em ordem decrescente inverte o comparador', () => {
    const primeira = montarPagina(
      [
        { id: 'a', criadaEm: new Date('2026-08-02T12:00:00Z') },
        { id: 'b', criadaEm: new Date('2026-08-01T12:00:00Z') },
      ],
      PORDATA_DESC,
      { cursor: null, limite: 1 },
    );

    const fatia = fatiaDoCursor<Filtro, Ordem>(PORDATA_DESC, {
      cursor: primeira.proximoCursor,
      limite: 1,
    });

    expect(fatia.filtro?.OR[0]).toEqual({ criadaEm: { lt: new Date('2026-08-02T12:00:00Z') } });
  });

  it('carrega chave de texto sem convertê-la em data', () => {
    const primeira = montarPagina(
      [
        { id: 'a', titulo: 'Alimentação' },
        { id: 'b', titulo: 'Vacinas' },
      ],
      PORTITULO,
      { cursor: null, limite: 1 },
    );

    const fatia = fatiaDoCursor<Filtro, Ordem>(PORTITULO, {
      cursor: primeira.proximoCursor,
      limite: 1,
    });

    expect(fatia.filtro?.OR[0]).toEqual({ titulo: { gt: 'Alimentação' } });
  });
});

describe('montarPagina', () => {
  const linhas = [
    { id: 'a', aconteceEm: new Date('2026-08-01T12:00:00Z') },
    { id: 'b', aconteceEm: new Date('2026-08-02T12:00:00Z') },
    { id: 'c', aconteceEm: new Date('2026-08-03T12:00:00Z') },
  ];

  it('descarta a linha extra e devolve cursor quando há próxima página', () => {
    const pagina = montarPagina(linhas, PORDATA, { cursor: null, limite: 2 });

    expect(pagina.itens.map((item) => item.id)).toEqual(['a', 'b']);
    expect(pagina.proximoCursor).toBeTypeOf('string');
  });

  it('devolve cursor nulo quando a lista acabou', () => {
    const pagina = montarPagina(linhas, PORDATA, { cursor: null, limite: 3 });

    expect(pagina.itens).toHaveLength(3);
    expect(pagina.proximoCursor).toBeNull();
  });

  it('devolve cursor nulo na lista vazia', () => {
    expect(montarPagina([], PORDATA, { cursor: null, limite: 20 }).proximoCursor).toBeNull();
  });

  it('reclama alto se o campo da chave não veio no select', () => {
    // Sem isto, o cursor sairia montado com `undefined` e a página seguinte viria vazia
    // ou repetida — falha silenciosa, que é a pior forma desta função quebrar.
    expect(() =>
      montarPagina([{ id: 'a' }, { id: 'b' }], PORDATA, { cursor: null, limite: 1 }),
    ).toThrow(/aconteceEm/);
  });
});

describe('estabilidade quando chega linha nova no meio da navegação', () => {
  /**
   * O teste que justifica o módulo inteiro.
   *
   * Com offset, inserir uma linha que ordena ANTES do que já foi lido empurra tudo para a
   * frente: a página 2 repete a última linha da página 1 e pula a seguinte — e a pulada
   * some da tela sem erro e sem log. Com keyset, a âncora é o par (valor, id) da última
   * linha entregue, então a inserção no meio não desloca nada.
   */
  const consultar = (
    tabela: Array<{ id: string; aconteceEm: Date }>,
    filtro: Filtro | undefined,
    quantidade: number,
  ) => {
    const ordenada = [...tabela].sort(
      (a, b) => a.aconteceEm.getTime() - b.aconteceEm.getTime() || a.id.localeCompare(b.id),
    );

    const depoisDoCursor = filtro
      ? ordenada.filter((linha) => {
          const [porValor, porDesempate] = filtro.OR as [
            { aconteceEm: { gt: Date } },
            { aconteceEm: Date; id: { gt: string } },
          ];
          return (
            linha.aconteceEm.getTime() > porValor.aconteceEm.gt.getTime() ||
            (linha.aconteceEm.getTime() === porDesempate.aconteceEm.getTime() &&
              linha.id > porDesempate.id.gt)
          );
        })
      : ordenada;

    return depoisDoCursor.slice(0, quantidade);
  };

  it('não repete nem pula linha', () => {
    const tabela = [
      { id: 'e1', aconteceEm: new Date('2026-08-01T12:00:00Z') },
      { id: 'e2', aconteceEm: new Date('2026-08-02T12:00:00Z') },
      { id: 'e3', aconteceEm: new Date('2026-08-03T12:00:00Z') },
      { id: 'e4', aconteceEm: new Date('2026-08-04T12:00:00Z') },
    ];

    const primeiraFatia = fatiaDoCursor<Filtro, Ordem>(PORDATA, { cursor: null, limite: 2 });
    const primeira = montarPagina(
      consultar(tabela, primeiraFatia.filtro, primeiraFatia.quantidade),
      PORDATA,
      { cursor: null, limite: 2 },
    );

    expect(primeira.itens.map((item) => item.id)).toEqual(['e1', 'e2']);

    // Chega um evento novo que ordena ANTES do que já foi lido — remarcação de consulta,
    // que é o caso corriqueiro nesta agenda.
    tabela.push({ id: 'e0', aconteceEm: new Date('2026-07-31T12:00:00Z') });

    const parametrosDaSegunda = { cursor: primeira.proximoCursor, limite: 2 };
    const segundaFatia = fatiaDoCursor<Filtro, Ordem>(PORDATA, parametrosDaSegunda);
    const segunda = montarPagina(
      consultar(tabela, segundaFatia.filtro, segundaFatia.quantidade),
      PORDATA,
      parametrosDaSegunda,
    );

    expect(segunda.itens.map((item) => item.id)).toEqual(['e3', 'e4']);
    expect(segunda.proximoCursor).toBeNull();

    const lidos = [...primeira.itens, ...segunda.itens].map((item) => item.id);
    expect(new Set(lidos).size).toBe(lidos.length);
  });

  it('desempata por id quando duas linhas têm o mesmo instante', () => {
    const mesmoInstante = new Date('2026-08-05T12:00:00Z');
    const tabela = [
      { id: 'a', aconteceEm: mesmoInstante },
      { id: 'b', aconteceEm: mesmoInstante },
      { id: 'c', aconteceEm: mesmoInstante },
    ];

    const primeiraFatia = fatiaDoCursor<Filtro, Ordem>(PORDATA, { cursor: null, limite: 2 });
    const primeira = montarPagina(
      consultar(tabela, primeiraFatia.filtro, primeiraFatia.quantidade),
      PORDATA,
      { cursor: null, limite: 2 },
    );

    const parametrosDaSegunda = { cursor: primeira.proximoCursor, limite: 2 };
    const segundaFatia = fatiaDoCursor<Filtro, Ordem>(PORDATA, parametrosDaSegunda);
    const segunda = montarPagina(
      consultar(tabela, segundaFatia.filtro, segundaFatia.quantidade),
      PORDATA,
      parametrosDaSegunda,
    );

    expect(primeira.itens.map((item) => item.id)).toEqual(['a', 'b']);
    expect(segunda.itens.map((item) => item.id)).toEqual(['c']);
  });
});
