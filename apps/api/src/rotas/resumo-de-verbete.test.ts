import { describe, expect, it } from 'vitest';
import { resumirVerbete } from './paciente.js';

/**
 * O resumo aparece no cartão da biblioteca antes de qualquer toque. Errar aqui não
 * derruba nada — produz cartão que termina no meio de uma palavra, que é o tipo de
 * defeito que passa por revisão humana e fica.
 */
describe('resumirVerbete', () => {
  it('devolve o parágrafo inteiro quando ele já é curto', () => {
    const corpo = 'Uma frase curta.\n\nOutro parágrafo que não deve aparecer.';
    expect(resumirVerbete(corpo)).toBe('Uma frase curta.');
  });

  it('usa só o primeiro parágrafo, nunca o texto todo', () => {
    const corpo = 'Primeiro.\n\nSegundo.';
    expect(resumirVerbete(corpo)).not.toContain('Segundo');
  });

  it('corta no fim de frase, não no meio da palavra', () => {
    const primeira = 'A defesa do corpo fica mais baixa por alguns dias depois da sessão.';
    /* O parágrafo precisa passar dos 160 caracteres, senão a função devolve ele
       inteiro e o teste não exercita o corte — que é o que ele existe para provar. */
    const corpo = `${primeira} Nesse período uma infecção pequena avança mais rápido do que avançaria antes, e a febre costuma ser o primeiro aviso de que algo mudou.`;
    expect(corpo.length).toBeGreaterThan(160);

    const resumo = resumirVerbete(corpo);

    expect(resumo).toBe(primeira);
    expect(resumo.endsWith('.')).toBe(true);
  });

  it('cai para reticências quando não há ponto final utilizável', () => {
    const corpo = 'palavra '.repeat(40).trim();

    const resumo = resumirVerbete(corpo);

    expect(resumo.endsWith('…')).toBe(true);
    /* O corte tem de respeitar a fronteira de palavra: nada de "palav…". */
    expect(resumo.replace('…', '').endsWith('palavra')).toBe(true);
  });

  it('não quebra com corpo vazio', () => {
    expect(resumirVerbete('')).toBe('');
  });
});
