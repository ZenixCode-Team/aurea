import { describe, expect, it } from 'vitest';
import {
  faixaDeSilencioDe,
  nivelDePrioridade,
  ordenarFilaDePrioridades,
  pontuarEntrada,
  resumirSilencio,
  type EntradaDaFila,
  type RegraDisparada,
} from './fila-de-prioridades.js';

const HOJE = new Date('2026-09-03T12:00:00.000Z');

function entrada(parcial: Partial<EntradaDaFila> & { nome: string }): EntradaDaFila {
  return {
    pacienteId: parcial.nome.toLowerCase(),
    situacao: 'VERDE',
    diasSemResponder: 0,
    nuncaRespondeu: false,
    ...parcial,
  };
}

function regra(
  sintoma: RegraDisparada['sintoma'],
  classificacao: RegraDisparada['classificacao'],
  justificativa = 'motivo',
): RegraDisparada {
  return {
    regraId: `${sintoma}-${classificacao}`,
    sintoma,
    campo: 'campo',
    valorObservado: true,
    classificacao,
    justificativa,
  };
}

describe('faixaDeSilencioDe', () => {
  it('classifica pelas faixas dos prints', () => {
    expect(faixaDeSilencioDe(0, false)).toBe('HOJE');
    expect(faixaDeSilencioDe(1, false)).toBe('UM_DIA');
    expect(faixaDeSilencioDe(2, false)).toBe('DOIS_DIAS');
    expect(faixaDeSilencioDe(3, false)).toBe('TRES_DIAS');
    expect(faixaDeSilencioDe(6, false)).toBe('TRES_DIAS');
    expect(faixaDeSilencioDe(7, false)).toBe('UMA_SEMANA');
    expect(faixaDeSilencioDe(30, false)).toBe('UMA_SEMANA');
  });

  /* Nunca respondeu não é "faz muitos dias": ninguém nunca teve contato. */
  it('separa nunca respondeu de silêncio longo', () => {
    expect(faixaDeSilencioDe(null, true)).toBe('NUNCA_RESPONDEU');
  });

  /* O defeito que só apareceu na tela: o espelho manda `diasSemResponder: null` com
     `nuncaRespondeu: false` para quem respondeu hoje. Lido como silêncio máximo, isso
     jogava a lista inteira na prioridade alta. */
  it('não inventa silêncio quando a contagem de dias não vem', () => {
    expect(faixaDeSilencioDe(null, false)).toBe('HOJE');
  });

  it('não põe na prioridade alta quem respondeu sem contagem de dias', () => {
    const fila = ordenarFilaDePrioridades(
      [
        entrada({ nome: 'Verde sem contagem', situacao: 'VERDE', diasSemResponder: null }),
        entrada({ nome: 'Grave', situacao: 'VERMELHO', diasSemResponder: null }),
      ],
      HOJE,
    );

    const verde = fila.find((i) => i.entrada.nome === 'Verde sem contagem');
    expect(verde?.faixaDeSilencio).toBe('HOJE');
    expect(
      nivelDePrioridade(verde!.entrada.situacao, verde!.faixaDeSilencio),
    ).toBe('BAIXA');
    expect(verde?.motivos).toHaveLength(0);
  });
});

describe('ordenarFilaDePrioridades', () => {
  it('põe vermelho antes de amarelo antes de verde', () => {
    const fila = ordenarFilaDePrioridades(
      [
        entrada({ nome: 'Verde', situacao: 'VERDE' }),
        entrada({ nome: 'Vermelho', situacao: 'VERMELHO' }),
        entrada({ nome: 'Amarelo', situacao: 'AMARELO' }),
      ],
      HOJE,
    );

    expect(fila.map((i) => i.entrada.nome)).toEqual(['Vermelho', 'Amarelo', 'Verde']);
  });

  it('desempata dois vermelhos pelo tempo de silêncio', () => {
    const fila = ordenarFilaDePrioridades(
      [
        entrada({ nome: 'Respondeu hoje', situacao: 'VERMELHO', diasSemResponder: 0 }),
        entrada({ nome: 'Calado', situacao: 'VERMELHO', diasSemResponder: 7 }),
      ],
      HOJE,
    );

    expect(fila[0]?.entrada.nome).toBe('Calado');
  });

  /* A garantia que dá sentido aos patamares distantes: nenhum acúmulo de desempate
     faz um amarelo passar na frente de um vermelho. */
  it('nunca deixa amarelo ultrapassar vermelho por acúmulo de desempate', () => {
    const amareloPior = entrada({
      nome: 'Amarelo extremo',
      situacao: 'AMARELO',
      diasSemResponder: null,
      nuncaRespondeu: true,
      regrasDisparadas: [regra('FALTA_DE_AR', 'AMARELO'), regra('FEBRE', 'AMARELO')],
      sinalizadores: { internadoAte: '2026-09-02' },
    });
    const vermelhoBrando = entrada({
      nome: 'Vermelho brando',
      situacao: 'VERMELHO',
      diasSemResponder: 0,
    });

    expect(pontuarEntrada(vermelhoBrando, HOJE)).toBeGreaterThan(
      pontuarEntrada(amareloPior, HOJE),
    );
  });

  it('desempata pelo nome para a lista não trocar de ordem sozinha', () => {
    const primeira = ordenarFilaDePrioridades(
      [entrada({ nome: 'Zulmira' }), entrada({ nome: 'Ana' })],
      HOJE,
    );
    const segunda = ordenarFilaDePrioridades(
      [entrada({ nome: 'Ana' }), entrada({ nome: 'Zulmira' })],
      HOJE,
    );

    expect(primeira.map((i) => i.entrada.nome)).toEqual(['Ana', 'Zulmira']);
    expect(segunda.map((i) => i.entrada.nome)).toEqual(['Ana', 'Zulmira']);
  });

  it('sobe quem saiu de internação há pouco', () => {
    const comAlta = entrada({
      nome: 'Com alta',
      situacao: 'VERDE',
      sinalizadores: { internadoAte: '2026-09-01' },
    });
    const semAlta = entrada({ nome: 'Sem alta', situacao: 'VERDE' });

    expect(pontuarEntrada(comAlta, HOJE)).toBeGreaterThan(pontuarEntrada(semAlta, HOJE));
  });

  it('ignora internação antiga', () => {
    const antiga = entrada({
      nome: 'Antiga',
      situacao: 'VERDE',
      sinalizadores: { internadoAte: '2026-01-01' },
    });

    expect(pontuarEntrada(antiga, HOJE)).toBe(pontuarEntrada(entrada({ nome: 'Antiga' }), HOJE));
  });

  it('não quebra com data de internação inválida', () => {
    const ruim = entrada({
      nome: 'Ruim',
      situacao: 'VERDE',
      sinalizadores: { internadoAte: 'não é data' },
    });

    expect(Number.isNaN(pontuarEntrada(ruim, HOJE))).toBe(false);
  });
});

describe('motivos da prioridade', () => {
  it('explica por que o paciente está na posição', () => {
    const [item] = ordenarFilaDePrioridades(
      [
        entrada({
          nome: 'Maria',
          situacao: 'VERMELHO',
          diasSemResponder: 3,
          regrasDisparadas: [regra('FEBRE', 'VERMELHO', 'Febre de 38,9 graus')],
          sinalizadores: { internadoAte: '2026-09-01' },
        }),
      ],
      HOJE,
    );

    const textos = item!.motivos.map((m) => m.texto);
    expect(textos).toContain('Febre de 38,9 graus');
    expect(textos).toContain('72 horas sem responder');
    expect(textos).toContain('saiu de internação há 2 dias');
  });

  it('não usa regra verde como motivo de prioridade', () => {
    const [item] = ordenarFilaDePrioridades(
      [
        entrada({
          nome: 'Tranquilo',
          situacao: 'VERDE',
          regrasDisparadas: [regra('DOR', 'VERDE', 'Dor leve, sem critério')],
        }),
      ],
      HOJE,
    );

    expect(item!.motivos).toHaveLength(0);
  });

  it('põe falta de ar antes de febre entre os motivos', () => {
    const [item] = ordenarFilaDePrioridades(
      [
        entrada({
          nome: 'Grave',
          situacao: 'VERMELHO',
          regrasDisparadas: [
            regra('FEBRE', 'VERMELHO', 'febre'),
            regra('FALTA_DE_AR', 'VERMELHO', 'dispneia'),
          ],
        }),
      ],
      HOJE,
    );

    expect(item!.motivos[0]?.texto).toBe('dispneia');
  });

  it('não menciona silêncio de quem respondeu hoje', () => {
    const [item] = ordenarFilaDePrioridades(
      [entrada({ nome: 'Em dia', situacao: 'AMARELO', diasSemResponder: 0 })],
      HOJE,
    );

    expect(item!.motivos.some((m) => m.tipo === 'silencio')).toBe(false);
  });
});

describe('resumirSilencio', () => {
  it('conta cada faixa e o total', () => {
    const resumo = resumirSilencio([
      entrada({ nome: 'a', diasSemResponder: 0 }),
      entrada({ nome: 'b', diasSemResponder: 1 }),
      entrada({ nome: 'c', diasSemResponder: 2 }),
      entrada({ nome: 'd', diasSemResponder: 4 }),
      entrada({ nome: 'e', diasSemResponder: 10 }),
      entrada({ nome: 'f', diasSemResponder: null, nuncaRespondeu: true }),
    ]);

    expect(resumo).toEqual({
      umDia: 1,
      doisDias: 1,
      tresDias: 1,
      umaSemana: 1,
      nuncaRespondeu: 1,
      total: 5,
    });
  });
});

describe('nivelDePrioridade', () => {
  it('vermelho é sempre prioridade alta', () => {
    expect(nivelDePrioridade('VERMELHO', 'HOJE')).toBe('ALTA');
  });

  /* A lei do produto: silêncio longo não é "está tudo bem". */
  it('72 horas de silêncio entra na alta mesmo sem classificação', () => {
    expect(nivelDePrioridade('SEM_RESPOSTA_HOJE', 'TRES_DIAS')).toBe('ALTA');
    expect(nivelDePrioridade('SEM_RESPOSTA_HOJE', 'UMA_SEMANA')).toBe('ALTA');
    expect(nivelDePrioridade('SEM_RESPOSTA_HOJE', 'NUNCA_RESPONDEU')).toBe('ALTA');
  });

  it('silêncio curto não vira prioridade alta sozinho', () => {
    expect(nivelDePrioridade('SEM_RESPOSTA_HOJE', 'UM_DIA')).toBe('INTERMEDIARIA');
  });

  it('verde que respondeu hoje é baixa prioridade', () => {
    expect(nivelDePrioridade('VERDE', 'HOJE')).toBe('BAIXA');
  });
});
