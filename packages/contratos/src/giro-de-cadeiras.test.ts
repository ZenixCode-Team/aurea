import { describe, expect, it } from 'vitest';
import {
  MINUTOS_DE_VIRADA,
  calcularGiroDeCadeiras,
  calcularOcupacao,
  encontrarJanelasLivres,
  type CadeiraDisponivel,
  type SessaoNaCadeira,
} from './giro-de-cadeiras.js';

const AGORA = new Date('2026-09-03T13:00:00.000Z');

function cadeira(numero: number, ativa = true): CadeiraDisponivel {
  return { id: `c-${numero}`, numero, ativa };
}

function sessao(parcial: Partial<SessaoNaCadeira> & { id: string }): SessaoNaCadeira {
  return {
    paciente: 'Fulano (fictício)',
    cadeiraId: 'c-1',
    protocolo: 'FOLFOX',
    estado: 'EM_INFUSAO',
    previsaoDeInicio: '2026-09-03T11:00:00.000Z',
    previsaoDeFim: '2026-09-03T14:00:00.000Z',
    ...parcial,
  };
}

describe('calcularOcupacao', () => {
  /* O ponto do módulo inteiro: a infusão é só uma parte. */
  it('soma tudo que prende a cadeira, não só a infusão', () => {
    const ocupacao = calcularOcupacao({
      tempoDePreparoEmMinutos: 20,
      tempoDePreMedicacaoEmMinutos: 30,
      tempoDeInfusaoEmMinutos: 120,
      tempoDeObservacaoEmMinutos: 30,
    });

    expect(ocupacao.infusao).toBe(120);
    expect(ocupacao.total).toBe(20 + 30 + 120 + 30 + MINUTOS_DE_VIRADA);
    expect(ocupacao.total).toBeGreaterThan(ocupacao.infusao);
  });

  it('acrescenta margem por complexidade sem mexer no tempo de infusão', () => {
    const tempos = {
      tempoDePreparoEmMinutos: 20,
      tempoDePreMedicacaoEmMinutos: 0,
      tempoDeInfusaoEmMinutos: 120,
      tempoDeObservacaoEmMinutos: 30,
    };

    const baixo = calcularOcupacao(tempos, 'BAIXO');
    const alto = calcularOcupacao(tempos, 'ALTO');

    /* O gotejamento é do medicamento e não muda com o paciente. */
    expect(alto.infusao).toBe(baixo.infusao);
    expect(alto.preparo).toBeGreaterThan(baixo.preparo);
    expect(alto.observacao).toBeGreaterThan(baixo.observacao);
    expect(alto.total).toBeGreaterThan(baixo.total);
  });

  it('inclui a virada, que o agendamento convencional ignora', () => {
    const ocupacao = calcularOcupacao({
      tempoDePreparoEmMinutos: 0,
      tempoDePreMedicacaoEmMinutos: 0,
      tempoDeInfusaoEmMinutos: 60,
      tempoDeObservacaoEmMinutos: 0,
    });

    expect(ocupacao.total).toBe(60 + MINUTOS_DE_VIRADA);
  });
});

describe('calcularGiroDeCadeiras', () => {
  it('conta os quatro estados separadamente', () => {
    const giro = calcularGiroDeCadeiras(
      [cadeira(1), cadeira(2), cadeira(3), cadeira(4), cadeira(5)],
      [
        sessao({ id: 's1', cadeiraId: 'c-1', estado: 'EM_INFUSAO' }),
        sessao({ id: 's2', cadeiraId: 'c-2', estado: 'EM_PREPARO' }),
        sessao({ id: 's3', cadeiraId: 'c-3', estado: 'AGUARDANDO_MEDICACAO' }),
        sessao({ id: 's4', cadeiraId: 'c-4', estado: 'EM_OBSERVACAO' }),
      ],
      AGORA,
    );

    expect(giro.total).toBe(5);
    expect(giro.ocupadas).toBe(1);
    expect(giro.emPreparo).toBe(1);
    expect(giro.aguardandoMedicacao).toBe(1);
    expect(giro.emObservacao).toBe(1);
    expect(giro.disponiveis).toBe(1);
    expect(giro.taxaDeOcupacao).toBe(80);
  });

  /* O erro que faria o painel mostrar 100% às 7h com o ambulatório vazio. */
  it('agendamento não ocupa cadeira; chegada ocupa', () => {
    const giro = calcularGiroDeCadeiras(
      [cadeira(1)],
      [sessao({ id: 's1', estado: 'AGENDADA' })],
      AGORA,
    );

    expect(giro.disponiveis).toBe(1);
    expect(giro.taxaDeOcupacao).toBe(0);
  });

  it('observação continua ocupando, mesmo sem infusão correndo', () => {
    const giro = calcularGiroDeCadeiras(
      [cadeira(1)],
      [sessao({ id: 's1', estado: 'EM_OBSERVACAO' })],
      AGORA,
    );

    expect(giro.disponiveis).toBe(0);
    expect(giro.taxaDeOcupacao).toBe(100);
  });

  it('ignora cadeira desativada no cálculo de capacidade', () => {
    const giro = calcularGiroDeCadeiras(
      [cadeira(1), cadeira(2, false)],
      [sessao({ id: 's1', cadeiraId: 'c-1' })],
      AGORA,
    );

    expect(giro.total).toBe(1);
    expect(giro.taxaDeOcupacao).toBe(100);
  });

  it('diz quando a próxima cadeira fica livre', () => {
    const giro = calcularGiroDeCadeiras(
      [cadeira(1), cadeira(2)],
      [
        sessao({
          id: 's1',
          cadeiraId: 'c-1',
          previsaoDeFim: '2026-09-03T17:35:00.000Z',
        }),
        sessao({
          id: 's2',
          cadeiraId: 'c-2',
          previsaoDeFim: '2026-09-03T15:10:00.000Z',
        }),
      ],
      AGORA,
    );

    expect(giro.proximaCadeiraLivreEm).toBe('2026-09-03T15:10:00.000Z');
  });

  it('não fala em próxima cadeira quando já existe uma livre', () => {
    const giro = calcularGiroDeCadeiras(
      [cadeira(1), cadeira(2)],
      [sessao({ id: 's1', cadeiraId: 'c-1' })],
      AGORA,
    );

    expect(giro.disponiveis).toBe(1);
    expect(giro.proximaCadeiraLivreEm).toBeNull();
  });

  /* Média que inclui sessão em curso mente para baixo. */
  it('calcula o tempo médio só com sessões terminadas', () => {
    const giro = calcularGiroDeCadeiras(
      [cadeira(1)],
      [
        sessao({
          id: 's1',
          estado: 'CONCLUIDA',
          inicioReal: '2026-09-03T08:00:00.000Z',
          fimReal: '2026-09-03T10:20:00.000Z',
        }),
        sessao({
          id: 's2',
          estado: 'CONCLUIDA',
          inicioReal: '2026-09-03T10:20:00.000Z',
          fimReal: '2026-09-03T12:40:00.000Z',
        }),
        /* Em curso, sem fimReal: não pode entrar na média. */
        sessao({ id: 's3', estado: 'EM_INFUSAO', inicioReal: '2026-09-03T12:50:00.000Z' }),
      ],
      AGORA,
    );

    expect(giro.tempoMedioDeOcupacaoEmMinutos).toBe(140);
  });

  it('devolve nulo em vez de zero quando nada terminou', () => {
    const giro = calcularGiroDeCadeiras(
      [cadeira(1)],
      [sessao({ id: 's1', estado: 'EM_INFUSAO' })],
      AGORA,
    );

    expect(giro.tempoMedioDeOcupacaoEmMinutos).toBeNull();
  });

  it('soma só o atraso que já aconteceu', () => {
    const giro = calcularGiroDeCadeiras(
      [cadeira(1), cadeira(2)],
      [
        sessao({
          id: 's1',
          previsaoDeInicio: '2026-09-03T08:00:00.000Z',
          inicioReal: '2026-09-03T08:20:00.000Z',
        }),
        sessao({
          id: 's2',
          cadeiraId: 'c-2',
          previsaoDeInicio: '2026-09-03T10:00:00.000Z',
          inicioReal: '2026-09-03T10:07:00.000Z',
        }),
        /* Ainda não começou: tem previsão, não tem atraso. */
        sessao({
          id: 's3',
          estado: 'AGENDADA',
          previsaoDeInicio: '2026-09-03T09:00:00.000Z',
        }),
      ],
      AGORA,
    );

    expect(giro.atrasoAcumuladoEmMinutos).toBe(27);
  });

  it('não conta adiantamento como atraso negativo', () => {
    const giro = calcularGiroDeCadeiras(
      [cadeira(1)],
      [
        sessao({
          id: 's1',
          previsaoDeInicio: '2026-09-03T08:00:00.000Z',
          inicioReal: '2026-09-03T07:45:00.000Z',
        }),
      ],
      AGORA,
    );

    expect(giro.atrasoAcumuladoEmMinutos).toBe(0);
  });

  it('não divide por zero sem cadeira nenhuma', () => {
    const giro = calcularGiroDeCadeiras([], [], AGORA);
    expect(giro.taxaDeOcupacao).toBe(0);
    expect(Number.isNaN(giro.taxaDeOcupacao)).toBe(false);
  });
});

describe('encontrarJanelasLivres', () => {
  const abertura = new Date('2026-09-03T11:00:00.000Z');
  const fechamento = new Date('2026-09-03T20:00:00.000Z');

  it('acha o vão depois da última sessão', () => {
    const janelas = encontrarJanelasLivres(
      [cadeira(1)],
      [
        sessao({
          id: 's1',
          previsaoDeInicio: '2026-09-03T11:00:00.000Z',
          previsaoDeFim: '2026-09-03T18:10:00.000Z',
        }),
      ],
      abertura,
      fechamento,
    );

    expect(janelas).toHaveLength(1);
    expect(janelas[0]?.de).toBe('2026-09-03T18:10:00.000Z');
    expect(janelas[0]?.minutos).toBe(110);
  });

  it('descarta vão curto demais para caber alguém', () => {
    const janelas = encontrarJanelasLivres(
      [cadeira(1)],
      [
        sessao({
          id: 's1',
          previsaoDeInicio: '2026-09-03T11:00:00.000Z',
          previsaoDeFim: '2026-09-03T19:30:00.000Z',
        }),
      ],
      abertura,
      fechamento,
      60,
    );

    expect(janelas).toHaveLength(0);
  });

  it('acha o vão ENTRE duas sessões', () => {
    const janelas = encontrarJanelasLivres(
      [cadeira(1)],
      [
        sessao({
          id: 's1',
          previsaoDeInicio: '2026-09-03T11:00:00.000Z',
          previsaoDeFim: '2026-09-03T13:00:00.000Z',
        }),
        sessao({
          id: 's2',
          previsaoDeInicio: '2026-09-03T16:00:00.000Z',
          previsaoDeFim: '2026-09-03T20:00:00.000Z',
        }),
      ],
      abertura,
      fechamento,
    );

    expect(janelas).toHaveLength(1);
    expect(janelas[0]?.minutos).toBe(180);
  });

  /* Sessões sobrepostas por erro de cadastro não podem gerar a mesma janela duas
     vezes nem inventar capacidade que não existe. */
  it('não inventa janela com sessões sobrepostas', () => {
    const janelas = encontrarJanelasLivres(
      [cadeira(1)],
      [
        sessao({
          id: 's1',
          previsaoDeInicio: '2026-09-03T11:00:00.000Z',
          previsaoDeFim: '2026-09-03T18:00:00.000Z',
        }),
        sessao({
          id: 's2',
          previsaoDeInicio: '2026-09-03T12:00:00.000Z',
          previsaoDeFim: '2026-09-03T14:00:00.000Z',
        }),
      ],
      abertura,
      fechamento,
    );

    expect(janelas).toHaveLength(1);
    expect(janelas[0]?.de).toBe('2026-09-03T18:00:00.000Z');
  });

  it('ignora sessão cancelada, que não ocupa nada', () => {
    const janelas = encontrarJanelasLivres(
      [cadeira(1)],
      [
        sessao({
          id: 's1',
          estado: 'CANCELADA',
          previsaoDeInicio: '2026-09-03T11:00:00.000Z',
          previsaoDeFim: '2026-09-03T20:00:00.000Z',
        }),
      ],
      abertura,
      fechamento,
    );

    expect(janelas).toHaveLength(1);
    expect(janelas[0]?.minutos).toBe(540);
  });
});
