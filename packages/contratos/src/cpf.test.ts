import { describe, expect, it } from 'vitest';
import { cpfEhValido, formatarCpf, normalizarCpf } from './cpf.js';

describe('cpfEhValido', () => {
  it('aceita CPF com dígito verificador correto', () => {
    for (const cpf of ['12345678909', '11144477735', '98765432100']) {
      expect(cpfEhValido(cpf), cpf).toBe(true);
    }
  });

  it('aceita CPF formatado', () => {
    expect(cpfEhValido('123.456.789-09')).toBe(true);
  });

  it('recusa sequência de dígito repetido', () => {
    // Passam no cálculo do verificador e mesmo assim são inválidos por convenção.
    // Foi o defeito que o próprio seed deste projeto teve na primeira versão.
    for (const cpf of ['11111111111', '00000000000', '99999999999']) {
      expect(cpfEhValido(cpf), cpf).toBe(false);
    }
  });

  it('recusa dígito verificador errado', () => {
    expect(cpfEhValido('12345678900')).toBe(false);
    expect(cpfEhValido('11144477734')).toBe(false);
  });

  it('recusa tamanho errado, vazio e não numérico', () => {
    for (const entrada of ['', '123', '123456789012', 'abcdefghijk', '1234567890a']) {
      expect(cpfEhValido(entrada), JSON.stringify(entrada)).toBe(false);
    }
  });
});

describe('normalizarCpf', () => {
  it('remove pontuação', () => {
    expect(normalizarCpf('123.456.789-09')).toBe('12345678909');
  });
});

describe('formatarCpf', () => {
  it('formata para exibição', () => {
    expect(formatarCpf('12345678909')).toBe('123.456.789-09');
  });

  it('devolve a entrada quando não dá para formatar', () => {
    expect(formatarCpf('123')).toBe('123');
  });
});
