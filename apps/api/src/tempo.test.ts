import { describe, expect, it } from 'vitest';
import {
  calcularDiaDoCiclo,
  colunaDeDataDoDiaCivil,
  diaCivil,
  diaCivilDeColunaDeData,
  diasDeDiferenca,
  inicioDoDia,
  mesmoDia,
} from './tempo.js';

/**
 * Este arquivo existe por causa de um defeito real, e o teste mais importante é
 * o último: ele só reprova se alguém voltar a contar dia em UTC.
 *
 * Rode com `TZ=UTC pnpm --filter @aurea/api test` para reproduzir o ambiente da
 * Coolify. Se estes testes só passam com o relógio do Mac em UTC−3, a proteção
 * não existe.
 */

/** 30/07/2026 às 21h30 em Sergipe = 31/07/2026 às 00h30 em UTC. */
const NOITE_EM_SERGIPE = new Date('2026-07-31T00:30:00Z');
/** 30/07/2026 às 10h00 em Sergipe. */
const MANHA_EM_SERGIPE = new Date('2026-07-30T13:00:00Z');

describe('diaCivil', () => {
  it('usa o fuso do serviço, não o do processo', () => {
    expect(diaCivil(NOITE_EM_SERGIPE)).toBe(20260730);
    expect(diaCivil(MANHA_EM_SERGIPE)).toBe(20260730);
  });

  it('vira o dia à meia-noite local, não à meia-noite UTC', () => {
    const antes = new Date('2026-07-31T02:59:00Z'); // 23h59 do dia 30 em Sergipe
    const depois = new Date('2026-07-31T03:01:00Z'); // 00h01 do dia 31 em Sergipe

    expect(diaCivil(antes)).toBe(20260730);
    expect(diaCivil(depois)).toBe(20260731);
  });
});

describe('mesmoDia', () => {
  it('trata check-in noturno e manhã seguinte como dias diferentes', () => {
    expect(mesmoDia(NOITE_EM_SERGIPE, MANHA_EM_SERGIPE)).toBe(true);
    expect(mesmoDia(NOITE_EM_SERGIPE, new Date('2026-07-31T13:00:00Z'))).toBe(false);
  });
});

describe('inicioDoDia', () => {
  it('devolve a meia-noite local como instante real', () => {
    // Meia-noite de 30/07 em Sergipe = 03h00 UTC do mesmo dia.
    expect(inicioDoDia(NOITE_EM_SERGIPE).toISOString()).toBe('2026-07-30T03:00:00.000Z');
  });
});

describe('diasDeDiferenca', () => {
  it('conta dias de calendário, não períodos de 24 horas', () => {
    const segundaTardeDaNoite = new Date('2026-07-28T02:00:00Z'); // 23h de segunda em Sergipe
    const tercaDeMadrugada = new Date('2026-07-28T04:00:00Z'); // 1h de terça em Sergipe

    // Duas horas de distância, mas um dia de calendário — é assim que a
    // enfermagem lê "faz um dia que não responde".
    expect(diasDeDiferenca(segundaTardeDaNoite, tercaDeMadrugada)).toBe(1);
  });

  it('devolve zero no mesmo dia', () => {
    expect(diasDeDiferenca(MANHA_EM_SERGIPE, NOITE_EM_SERGIPE)).toBe(0);
  });
});

describe('calcularDiaDoCiclo', () => {
  /**
   * Como o Prisma entrega uma coluna `@db.Date`: meia-noite UTC.
   * Escrever assim no teste não é detalhe — é o formato que causou o defeito.
   */
  const sessaoDeQuimio = new Date('2026-07-21T00:00:00.000Z');

  it('conta o dia da sessão como dia 0', () => {
    expect(calcularDiaDoCiclo(sessaoDeQuimio, new Date('2026-07-21T18:00:00Z'))).toBe(0);
  });

  it('conta os dias seguintes', () => {
    expect(calcularDiaDoCiclo(sessaoDeQuimio, new Date('2026-07-30T13:00:00Z'))).toBe(9);
  });

  /**
   * O defeito que este teste tranca.
   *
   * `sessaoRealizadaEm` vem de coluna DATE e chega como meia-noite UTC. Lido como
   * instante em America/Sao_Paulo, esse momento é o dia ANTERIOR às 21h — a data-base
   * recuava um dia e o dia do ciclo saía sempre +1.
   *
   * Regra com `diaDoCicloMinimo/Maximo` é descartada quando o dia fica fora da janela,
   * então uma janela [0,3] parava de valer no dia 3 de verdade: corte de risco deixando
   * de disparar, sem erro e sem log.
   */
  it('não adianta um dia ao ler coluna de data em fuso negativo', () => {
    // Cenário exato do seed: sessão em 27/07, hoje 30/07 → dia 3, nunca 4.
    const sessao = new Date('2026-07-27T00:00:00.000Z');
    const hojeDeManha = new Date('2026-07-30T13:00:00Z'); // 10h em Sergipe
    const hojeDeNoite = new Date('2026-07-31T00:30:00Z'); // 21h30 de 30/07 em Sergipe

    expect(calcularDiaDoCiclo(sessao, hojeDeManha)).toBe(3);
    expect(calcularDiaDoCiclo(sessao, hojeDeNoite)).toBe(3);
  });

  it('diaCivilDeColunaDeData lê a coluna sem converter fuso', () => {
    expect(diaCivilDeColunaDeData(new Date('2026-07-27T00:00:00.000Z'))).toBe(20260727);
  });

  /**
   * O teste que justifica o módulo inteiro.
   *
   * Com a conta antiga em UTC, um check-in às 21h30 de Sergipe caía no dia
   * seguinte e o dia do ciclo saía 10 em vez de 9. Regra de risco com janela
   * `diaDoCicloMinimo/Maximo` é DESCARTADA quando o dia fica fora da janela, então
   * um corte que deveria disparar simplesmente não dispara — sem erro e sem log.
   */
  it('não adianta o dia do ciclo em check-in feito à noite', () => {
    const noite = calcularDiaDoCiclo(sessaoDeQuimio, NOITE_EM_SERGIPE);
    const manhaDoMesmoDia = calcularDiaDoCiclo(sessaoDeQuimio, MANHA_EM_SERGIPE);

    expect(noite).toBe(9);
    expect(noite).toBe(manhaDoMesmoDia);
  });

  it('é estável ao longo do dia inteiro', () => {
    const horas = ['03:30', '09:00', '15:00', '23:00', '02:59'];
    const dias = horas.map((hora) => {
      const instante =
        hora === '02:59'
          ? new Date('2026-07-31T02:59:00Z') // ainda 30/07 em Sergipe
          : new Date(`2026-07-30T${hora}:00Z`);
      return calcularDiaDoCiclo(sessaoDeQuimio, instante);
    });

    expect(new Set(dias).size).toBe(1);
    expect(dias[0]).toBe(9);
  });
});

describe('colunaDeDataDoDiaCivil', () => {
  /* O defeito real: às 22h de 2 de setembro em São Paulo, `agora` já é dia 3 em UTC.
     Aritmética de instante perguntaria pelo dia 4, e a pendência do dia 3 sumiria da
     tela sem erro nenhum. */
  it('usa o dia civil do fuso do serviço, não o dia UTC', () => {
    const noiteEmSaoPaulo = new Date('2026-09-03T01:30:00.000Z'); // 22h30 de 02/09
    expect(colunaDeDataDoDiaCivil(noiteEmSaoPaulo, 1).toISOString()).toBe(
      '2026-09-03T00:00:00.000Z',
    );
  });

  it('devolve meia-noite UTC, que é como o Prisma grava DATE', () => {
    const meioDia = new Date('2026-09-03T15:00:00.000Z');
    const coluna = colunaDeDataDoDiaCivil(meioDia);
    expect(coluna.getUTCHours()).toBe(0);
    expect(coluna.toISOString()).toBe('2026-09-03T00:00:00.000Z');
  });

  it('atravessa a virada de mês', () => {
    const fimDoMes = new Date('2026-09-30T15:00:00.000Z');
    expect(colunaDeDataDoDiaCivil(fimDoMes, 1).toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
  });
});
