import { describe, expect, it } from 'vitest';
import type { ConjuntoDeLimiares, RegraDeLimiar } from '@aurea/contratos';
import { classificar, conferirIntegridadeDoConjunto, type RespostaCrua } from './motor.js';

/**
 * Os números daqui são inventados para o teste e não valem clinicamente.
 * O que está sob teste é o motor, não o corte: se o corte de febre mudar de 38,0 para
 * 37,8, estes testes continuam passando com o valor novo, porque o corte é dado.
 */

function regra(parcial: Partial<RegraDeLimiar> & Pick<RegraDeLimiar, 'id' | 'sintoma' | 'campo'>): RegraDeLimiar {
  return {
    ordem: 1,
    operador: 'E_VERDADEIRO',
    classificacao: 'AMARELO',
    justificativa: 'regra de teste',
    ...parcial,
  } as RegraDeLimiar;
}

function conjunto(regras: RegraDeLimiar[], politica?: Partial<ConjuntoDeLimiares['politica']>): ConjuntoDeLimiares {
  return {
    id: 'conjunto-de-teste',
    versao: 'teste-1',
    descricao: 'conjunto sintético de teste',
    origem: 'teste automatizado',
    validadoClinicamente: false,
    politica: {
      combinacao: 'PIOR_ISOLADO',
      efeitoDoAntitermico: 'IGNORAR',
      tratamentoDeAbandono: 'NAO_CLASSIFICAR',
      ...politica,
    },
    regras,
  };
}

const contextoPadrao = { diaDoCiclo: 5, protocoloId: 'protocolo-a', sessaoAbandonada: false };

const cortesDeFebre = [
  regra({
    id: 'febre-amarelo',
    sintoma: 'FEBRE',
    campo: 'temperaturaMaxima',
    operador: 'ENTRE',
    valor: 37.8,
    valorSecundario: 38.4,
    classificacao: 'AMARELO',
    justificativa: 'febre baixa',
  }),
  regra({
    id: 'febre-vermelho',
    sintoma: 'FEBRE',
    campo: 'temperaturaMaxima',
    operador: 'MAIOR_OU_IGUAL',
    valor: 38.5,
    classificacao: 'VERMELHO',
    justificativa: 'febre alta em quimioterapia',
  }),
];

describe('classificar', () => {
  it('devolve verde quando a porta do sintoma foi respondida com não', () => {
    const respostas: RespostaCrua[] = [
      { sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: false },
    ];

    const saida = classificar(respostas, conjunto(cortesDeFebre), contextoPadrao);

    expect(saida.situacao).toBe('CLASSIFICADA');
    if (saida.situacao !== 'CLASSIFICADA') return;
    expect(saida.resultado).toBe('VERDE');
    expect(saida.explicacao.porSintoma[0]?.regrasDisparadas).toHaveLength(0);
  });

  it('aplica o corte numérico e explica qual regra disparou', () => {
    const respostas: RespostaCrua[] = [
      { sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: true },
      { sintoma: 'FEBRE', campo: 'temperaturaMaxima', valorNumerico: 38.9 },
      { sintoma: 'FEBRE', campo: 'usouAntitermico', valorBooleano: false },
    ];

    const saida = classificar(respostas, conjunto(cortesDeFebre), contextoPadrao);

    if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
    expect(saida.resultado).toBe('VERMELHO');
    expect(saida.explicacao.porSintoma[0]?.regrasDisparadas[0]).toMatchObject({
      regraId: 'febre-vermelho',
      valorObservado: 38.9,
    });
  });

  it('não dispara a regra quando o valor fica abaixo do corte', () => {
    const respostas: RespostaCrua[] = [
      { sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: true },
      { sintoma: 'FEBRE', campo: 'temperaturaMaxima', valorNumerico: 37.2 },
      { sintoma: 'FEBRE', campo: 'usouAntitermico', valorBooleano: false },
    ];

    const saida = classificar(respostas, conjunto(cortesDeFebre), contextoPadrao);

    if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
    expect(saida.resultado).toBe('VERDE');
  });

  it('eleva um nível quando houve antitérmico e a política manda elevar', () => {
    const respostas: RespostaCrua[] = [
      { sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: true },
      { sintoma: 'FEBRE', campo: 'temperaturaMaxima', valorNumerico: 38.0 },
      { sintoma: 'FEBRE', campo: 'usouAntitermico', valorBooleano: true },
    ];

    const saida = classificar(
      respostas,
      conjunto(cortesDeFebre, { efeitoDoAntitermico: 'ELEVAR_UM_NIVEL' }),
      contextoPadrao,
    );

    if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
    expect(saida.resultado).toBe('VERMELHO');
    expect(saida.explicacao.ajustesDaPolitica[0]).toMatchObject({ de: 'AMARELO', para: 'VERMELHO' });
  });

  it('não eleva além de vermelho', () => {
    const respostas: RespostaCrua[] = [
      { sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: true },
      { sintoma: 'FEBRE', campo: 'temperaturaMaxima', valorNumerico: 39.5 },
      { sintoma: 'FEBRE', campo: 'usouAntitermico', valorBooleano: true },
    ];

    const saida = classificar(
      respostas,
      conjunto(cortesDeFebre, { efeitoDoAntitermico: 'ELEVAR_UM_NIVEL' }),
      contextoPadrao,
    );

    if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
    expect(saida.resultado).toBe('VERMELHO');
    expect(saida.explicacao.ajustesDaPolitica).toHaveLength(0);
  });

  it('soma dois amarelos em vermelho quando a política manda', () => {
    const regras = [
      ...cortesDeFebre,
      regra({
        id: 'diarreia-amarelo',
        sintoma: 'DIARREIA',
        campo: 'episodiosEm24h',
        operador: 'MAIOR_OU_IGUAL',
        valor: 3,
        classificacao: 'AMARELO',
      }),
    ];

    const respostas: RespostaCrua[] = [
      { sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: true },
      { sintoma: 'FEBRE', campo: 'temperaturaMaxima', valorNumerico: 38.0 },
      { sintoma: 'FEBRE', campo: 'usouAntitermico', valorBooleano: false },
      { sintoma: 'DIARREIA', campo: 'apresentouDiarreia', valorBooleano: true },
      { sintoma: 'DIARREIA', campo: 'episodiosEm24h', valorNumerico: 4 },
      { sintoma: 'DIARREIA', campo: 'presencaDeSangue', valorBooleano: false },
    ];

    const comSoma = classificar(
      respostas,
      conjunto(regras, { combinacao: 'DOIS_AMARELOS_VIRAM_VERMELHO' }),
      contextoPadrao,
    );
    const semSoma = classificar(respostas, conjunto(regras), contextoPadrao);

    if (comSoma.situacao !== 'CLASSIFICADA' || semSoma.situacao !== 'CLASSIFICADA') {
      throw new Error('esperava classificação');
    }
    expect(comSoma.resultado).toBe('VERMELHO');
    expect(semSoma.resultado).toBe('AMARELO');
  });

  it('dá peso próprio a não conseguir beber líquidos, independente da contagem de vômitos', () => {
    const regras = [
      regra({
        id: 'sem-liquidos',
        sintoma: 'NAUSEA_VOMITO',
        campo: 'consegueBeberLiquidos',
        operador: 'E_FALSO',
        classificacao: 'VERMELHO',
        justificativa: 'quem não retém líquido desidrata',
      }),
      regra({
        id: 'vomitos',
        sintoma: 'NAUSEA_VOMITO',
        campo: 'episodiosDeVomito',
        operador: 'MAIOR_OU_IGUAL',
        valor: 6,
        classificacao: 'AMARELO',
      }),
    ];

    const respostas: RespostaCrua[] = [
      { sintoma: 'NAUSEA_VOMITO', campo: 'sentiuNausea', valorBooleano: true },
      { sintoma: 'NAUSEA_VOMITO', campo: 'vomitou', valorBooleano: true },
      { sintoma: 'NAUSEA_VOMITO', campo: 'episodiosDeVomito', valorNumerico: 1 },
      { sintoma: 'NAUSEA_VOMITO', campo: 'consegueBeberLiquidos', valorBooleano: false },
      { sintoma: 'NAUSEA_VOMITO', campo: 'consegueComer', valorBooleano: false },
    ];

    const saida = classificar(respostas, conjunto(regras), contextoPadrao);

    if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
    expect(saida.resultado).toBe('VERMELHO');
  });

  it('classifica por lista fechada de opção', () => {
    const regras = [
      regra({
        id: 'ar-em-repouso',
        sintoma: 'FALTA_DE_AR',
        campo: 'esforco',
        operador: 'ESTA_EM',
        valoresDeTexto: ['EM_REPOUSO'],
        classificacao: 'VERMELHO',
      }),
    ];

    const emRepouso: RespostaCrua[] = [
      { sintoma: 'FALTA_DE_AR', campo: 'apresentouFaltaDeAr', valorBooleano: true },
      { sintoma: 'FALTA_DE_AR', campo: 'esforco', valorTexto: 'EM_REPOUSO' },
    ];
    const aoCaminhar: RespostaCrua[] = [
      { sintoma: 'FALTA_DE_AR', campo: 'apresentouFaltaDeAr', valorBooleano: true },
      { sintoma: 'FALTA_DE_AR', campo: 'esforco', valorTexto: 'AO_CAMINHAR' },
    ];

    const grave = classificar(emRepouso, conjunto(regras), contextoPadrao);
    const leve = classificar(aoCaminhar, conjunto(regras), contextoPadrao);

    if (grave.situacao !== 'CLASSIFICADA' || leve.situacao !== 'CLASSIFICADA') {
      throw new Error('esperava classificação');
    }
    expect(grave.resultado).toBe('VERMELHO');
    expect(leve.resultado).toBe('VERDE');
  });

  describe('janela do ciclo', () => {
    const regras = [
      regra({
        id: 'febre-no-nadir',
        sintoma: 'FEBRE',
        campo: 'temperaturaMaxima',
        operador: 'MAIOR_OU_IGUAL',
        valor: 37.8,
        classificacao: 'VERMELHO',
        diaDoCicloMinimo: 7,
        diaDoCicloMaximo: 14,
        justificativa: 'janela de maior vulnerabilidade',
      }),
    ];

    const respostas: RespostaCrua[] = [
      { sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: true },
      { sintoma: 'FEBRE', campo: 'temperaturaMaxima', valorNumerico: 38.0 },
      { sintoma: 'FEBRE', campo: 'usouAntitermico', valorBooleano: false },
    ];

    it('aplica dentro da janela', () => {
      const saida = classificar(respostas, conjunto(regras), { ...contextoPadrao, diaDoCiclo: 10 });
      if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
      expect(saida.resultado).toBe('VERMELHO');
    });

    it('não aplica fora da janela', () => {
      const saida = classificar(respostas, conjunto(regras), { ...contextoPadrao, diaDoCiclo: 2 });
      if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
      expect(saida.resultado).toBe('VERDE');
    });

    it('não aplica quando o paciente não tem ciclo aberto', () => {
      const saida = classificar(respostas, conjunto(regras), { ...contextoPadrao, diaDoCiclo: null });
      if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
      expect(saida.resultado).toBe('VERDE');
    });
  });

  it('restringe a regra ao protocolo quando ela declara um', () => {
    const regras = [
      regra({
        id: 'so-protocolo-b',
        sintoma: 'DOR',
        campo: 'intensidade',
        operador: 'MAIOR_OU_IGUAL',
        valor: 7,
        classificacao: 'AMARELO',
        protocoloId: 'protocolo-b',
      }),
    ];

    const respostas: RespostaCrua[] = [
      { sintoma: 'DOR', campo: 'apresentouDor', valorBooleano: true },
      { sintoma: 'DOR', campo: 'localizacao', valorTexto: 'ABDOMINAL' },
      { sintoma: 'DOR', campo: 'intensidade', valorNumerico: 9 },
    ];

    const noProtocoloA = classificar(respostas, conjunto(regras), contextoPadrao);
    const noProtocoloB = classificar(respostas, conjunto(regras), {
      ...contextoPadrao,
      protocoloId: 'protocolo-b',
    });

    if (noProtocoloA.situacao !== 'CLASSIFICADA' || noProtocoloB.situacao !== 'CLASSIFICADA') {
      throw new Error('esperava classificação');
    }
    expect(noProtocoloA.resultado).toBe('VERDE');
    expect(noProtocoloB.resultado).toBe('AMARELO');
  });

  describe('abandono', () => {
    const respostas: RespostaCrua[] = [
      { sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: true },
      { sintoma: 'FEBRE', campo: 'temperaturaMaxima', valorNumerico: 39.0 },
    ];

    it('não classifica quando a política é NAO_CLASSIFICAR', () => {
      const saida = classificar(respostas, conjunto(cortesDeFebre), {
        ...contextoPadrao,
        sessaoAbandonada: true,
      });

      expect(saida.situacao).toBe('NAO_CLASSIFICADA');
      if (saida.situacao !== 'NAO_CLASSIFICADA') return;
      expect(saida.sintomasRespondidos).toEqual(['FEBRE']);
    });

    it('classifica pelo pior respondido quando a política manda', () => {
      const saida = classificar(
        respostas,
        conjunto(cortesDeFebre, { tratamentoDeAbandono: 'PIOR_DOS_RESPONDIDOS' }),
        { ...contextoPadrao, sessaoAbandonada: true },
      );

      if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
      expect(saida.resultado).toBe('VERMELHO');
    });
  });

  it('registra na explicação os sintomas com regra que ninguém respondeu', () => {
    const regras = [
      ...cortesDeFebre,
      regra({ id: 'dor-qualquer', sintoma: 'DOR', campo: 'intensidade', operador: 'MAIOR_OU_IGUAL', valor: 8 }),
    ];

    const respostas: RespostaCrua[] = [
      { sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: false },
    ];

    const saida = classificar(respostas, conjunto(regras), contextoPadrao);

    if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
    expect(saida.explicacao.sintomasNaoRespondidos).toEqual(['DOR']);
  });

  it('carrega a marca de conjunto não validado clinicamente', () => {
    const saida = classificar(
      [{ sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: false }],
      conjunto(cortesDeFebre),
      contextoPadrao,
    );

    if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
    expect(saida.validadoClinicamente).toBe(false);
  });
});

describe('conferirIntegridadeDoConjunto', () => {
  it('aprova conjunto coerente com a árvore', () => {
    expect(conferirIntegridadeDoConjunto(conjunto(cortesDeFebre))).toEqual([]);
  });

  it('reprova regra que aponta para campo inexistente', () => {
    const problemas = conferirIntegridadeDoConjunto(
      conjunto([regra({ id: 'fantasma', sintoma: 'FEBRE', campo: 'temperaturaAxilar' })]),
    );

    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('não existe');
  });

  it('reprova operador numérico sobre campo booleano', () => {
    const problemas = conferirIntegridadeDoConjunto(
      conjunto([
        regra({
          id: 'tipo-errado',
          sintoma: 'FEBRE',
          campo: 'usouAntitermico',
          operador: 'MAIOR_OU_IGUAL',
          valor: 1,
        }),
      ]),
    );

    expect(problemas.some((problema) => problema.includes('exige campo numérico'))).toBe(true);
  });

  it('reprova opção fora da lista fechada', () => {
    const problemas = conferirIntegridadeDoConjunto(
      conjunto([
        regra({
          id: 'opcao-invalida',
          sintoma: 'FALTA_DE_AR',
          campo: 'esforco',
          operador: 'ESTA_EM',
          valoresDeTexto: ['DEITADO'],
        }),
      ]),
    );

    expect(problemas.some((problema) => problema.includes('fora da lista'))).toBe(true);
  });
});

/**
 * Regressões dos bloqueantes do QA 036.
 */
describe('🔴 4 do QA — ausência não pode virar verde', () => {
  const cortes = [
    regra({
      id: 'febre-vermelho',
      sintoma: 'FEBRE',
      campo: 'temperaturaMaxima',
      operador: 'MAIOR_OU_IGUAL',
      valor: 38.5,
      classificacao: 'VERMELHO',
    }),
  ];

  it('não classifica quem disse que teve febre e parou antes da temperatura', () => {
    const saida = classificar(
      [{ sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: true }],
      conjunto(cortes, { tratamentoDeAbandono: 'PIOR_DOS_RESPONDIDOS' }),
      { ...contextoPadrao, sessaoAbandonada: true },
    );

    expect(saida.situacao).toBe('NAO_CLASSIFICADA');
  });

  it('mas classifica quem informou 39 °C sem dizer se tomou antitérmico', () => {
    // Regra disparada é evidência positiva. Faltar um campo de detalhe não torna o
    // quadro mais seguro, e recusar aqui silenciaria um vermelho real.
    const saida = classificar(
      [
        { sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: true },
        { sintoma: 'FEBRE', campo: 'temperaturaMaxima', valorNumerico: 39 },
      ],
      conjunto(cortes, { tratamentoDeAbandono: 'PIOR_DOS_RESPONDIDOS' }),
      { ...contextoPadrao, sessaoAbandonada: true },
    );

    if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
    expect(saida.resultado).toBe('VERMELHO');
  });

  it('ramo com a porta em "não" continua completo com uma resposta só', () => {
    const saida = classificar(
      [{ sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: false }],
      conjunto(cortes, { tratamentoDeAbandono: 'PIOR_DOS_RESPONDIDOS' }),
      { ...contextoPadrao, sessaoAbandonada: true },
    );

    if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
    expect(saida.resultado).toBe('VERDE');
  });

  it('sintoma incompleto entra na explicação como não respondido', () => {
    const saida = classificar(
      [
        { sintoma: 'FEBRE', campo: 'apresentouFebre', valorBooleano: false },
        { sintoma: 'DIARREIA', campo: 'apresentouDiarreia', valorBooleano: true },
      ],
      conjunto(cortes, { tratamentoDeAbandono: 'PIOR_DOS_RESPONDIDOS' }),
      { ...contextoPadrao, sessaoAbandonada: true },
    );

    if (saida.situacao !== 'CLASSIFICADA') throw new Error('esperava classificação');
    expect(saida.explicacao.sintomasNaoRespondidos).toContain('DIARREIA');
  });
});
