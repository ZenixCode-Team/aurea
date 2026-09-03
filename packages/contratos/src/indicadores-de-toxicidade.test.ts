import { describe, expect, it } from 'vitest';
import {
  MINIMO_PARA_PERCENTUAL_CONFIAVEL,
  montarIndicadoresDeToxicidade,
  type OcorrenciaDeSintoma,
} from './indicadores-de-toxicidade.js';

const HOJE = new Date('2026-09-03T12:00:00.000Z');

function ocorrencia(
  parcial: Partial<OcorrenciaDeSintoma> & { sintoma: OcorrenciaDeSintoma['sintoma'] },
): OcorrenciaDeSintoma {
  return {
    classificacao: 'AMARELO',
    protocolo: 'FOLFOX',
    sessaoId: parcial.quando ?? 's-1',
    quando: '2026-09-01T10:00:00.000Z',
    ...parcial,
  };
}

describe('montarIndicadoresDeToxicidade', () => {
  it('calcula a taxa sobre o total de sessões, não sobre as ocorrências', () => {
    const indicadores = montarIndicadoresDeToxicidade(
      [
        ocorrencia({ sintoma: 'NAUSEA_VOMITO' }),
        ocorrencia({ sintoma: 'NAUSEA_VOMITO', quando: '2026-09-02T10:00:00.000Z' }),
        ocorrencia({ sintoma: 'DOR' }),
      ],
      10,
      HOJE,
    );

    const nausea = indicadores.taxas.find((t) => t.sintoma === 'NAUSEA_VOMITO');
    /* 2 de 10 sessões = 20%. Se o denominador fossem as 3 ocorrências, daria 66%. */
    expect(nausea?.percentual).toBe(20);
    expect(nausea?.totalDeSessoes).toBe(10);
  });

  /* A regra que impede todo protocolo de aparecer com 100% de tudo. */
  it('não conta sintoma classificado como verde', () => {
    const indicadores = montarIndicadoresDeToxicidade(
      [
        ocorrencia({ sintoma: 'DOR', classificacao: 'VERDE' }),
        ocorrencia({ sintoma: 'FEBRE', classificacao: 'VERMELHO' }),
      ],
      10,
      HOJE,
    );

    expect(indicadores.taxas.map((t) => t.sintoma)).toEqual(['FEBRE']);
  });

  it('ignora ocorrência fora da janela de 30 dias', () => {
    const indicadores = montarIndicadoresDeToxicidade(
      [
        ocorrencia({ sintoma: 'FEBRE', quando: '2026-06-01T10:00:00.000Z' }),
        ocorrencia({ sintoma: 'DOR' }),
      ],
      10,
      HOJE,
    );

    expect(indicadores.taxas.map((t) => t.sintoma)).toEqual(['DOR']);
  });

  it('ordena os sintomas do mais frequente para o menos', () => {
    const indicadores = montarIndicadoresDeToxicidade(
      [
        ocorrencia({ sintoma: 'DOR' }),
        ocorrencia({ sintoma: 'NAUSEA_VOMITO', quando: '2026-08-29T10:00:00.000Z' }),
        ocorrencia({ sintoma: 'NAUSEA_VOMITO', quando: '2026-08-30T10:00:00.000Z' }),
        ocorrencia({ sintoma: 'NAUSEA_VOMITO', quando: '2026-08-31T10:00:00.000Z' }),
      ],
      10,
      HOJE,
    );

    expect(indicadores.taxas[0]?.sintoma).toBe('NAUSEA_VOMITO');
  });

  it('aponta o sintoma mais frequente de cada protocolo', () => {
    const indicadores = montarIndicadoresDeToxicidade(
      [
        ocorrencia({ sintoma: 'DIARREIA', protocolo: 'FOLFOX', quando: '2026-09-01T08:00:00.000Z' }),
        ocorrencia({ sintoma: 'DIARREIA', protocolo: 'FOLFOX', quando: '2026-09-02T08:00:00.000Z' }),
        ocorrencia({ sintoma: 'DOR', protocolo: 'FOLFOX', quando: '2026-09-01T09:00:00.000Z' }),
        ocorrencia({ sintoma: 'NAUSEA_VOMITO', protocolo: 'AC-T', quando: '2026-09-01T08:00:00.000Z' }),
      ],
      20,
      HOJE,
    );

    const folfox = indicadores.porProtocolo.find((p) => p.protocolo === 'FOLFOX');
    const act = indicadores.porProtocolo.find((p) => p.protocolo === 'AC-T');

    expect(folfox?.sintomaMaisFrequente).toBe('DIARREIA');
    expect(act?.sintomaMaisFrequente).toBe('NAUSEA_VOMITO');
  });

  /* Uma sessão com três sintomas é UMA sessão. Contá-la três vezes inflaria o
     denominador de quem tem paciente mais sintomático. */
  it('conta sessão uma vez só, mesmo com vários sintomas', () => {
    const indicadores = montarIndicadoresDeToxicidade(
      [
        ocorrencia({ sintoma: 'DOR', sessaoId: 's-9' }),
        ocorrencia({ sintoma: 'FEBRE', sessaoId: 's-9' }),
        ocorrencia({ sintoma: 'DIARREIA', sessaoId: 's-9' }),
      ],
      10,
      HOJE,
    );

    expect(indicadores.porProtocolo[0]?.totalDeSessoes).toBe(1);
  });

  /* O outro lado da mesma moeda: duas sessões diferentes no mesmo instante continuam
     sendo duas. É o caso que quebrava quando id e data eram o mesmo campo. */
  it('conta duas sessões distintas mesmo com a mesma data', () => {
    const indicadores = montarIndicadoresDeToxicidade(
      [
        ocorrencia({ sintoma: 'DOR', sessaoId: 's-1' }),
        ocorrencia({ sintoma: 'DOR', sessaoId: 's-2' }),
      ],
      10,
      HOJE,
    );

    expect(indicadores.porProtocolo[0]?.totalDeSessoes).toBe(2);
  });

  it('marca amostra insuficiente em vez de fingir precisão', () => {
    const poucas = montarIndicadoresDeToxicidade(
      [ocorrencia({ sintoma: 'DOR' })],
      3,
      HOJE,
    );
    const bastante = montarIndicadoresDeToxicidade(
      [ocorrencia({ sintoma: 'DOR' })],
      MINIMO_PARA_PERCENTUAL_CONFIAVEL,
      HOJE,
    );

    expect(poucas.amostraSuficiente).toBe(false);
    expect(bastante.amostraSuficiente).toBe(true);
  });

  it('não divide por zero quando não houve sessão', () => {
    const indicadores = montarIndicadoresDeToxicidade(
      [ocorrencia({ sintoma: 'DOR' })],
      0,
      HOJE,
    );

    expect(indicadores.taxas[0]?.percentual).toBe(0);
    expect(Number.isNaN(indicadores.taxas[0]?.percentual)).toBe(false);
  });

  it('ignora ocorrência sem protocolo na tabela por protocolo', () => {
    const indicadores = montarIndicadoresDeToxicidade(
      [ocorrencia({ sintoma: 'DOR', protocolo: null })],
      10,
      HOJE,
    );

    expect(indicadores.porProtocolo).toHaveLength(0);
    /* Mas continua contando na taxa geral: o sintoma aconteceu. */
    expect(indicadores.taxas).toHaveLength(1);
  });

  it('não quebra com data inválida', () => {
    const indicadores = montarIndicadoresDeToxicidade(
      [ocorrencia({ sintoma: 'DOR', quando: 'não é data' })],
      10,
      HOJE,
    );

    expect(indicadores.taxas).toHaveLength(0);
  });
});
