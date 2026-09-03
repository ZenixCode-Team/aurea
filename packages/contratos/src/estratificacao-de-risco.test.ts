import { describe, expect, it } from 'vitest';
import {
  CORTE_DE_RISCO_ALTO,
  CORTE_DE_RISCO_MEDIO,
  PESOS_VALIDADOS_CLINICAMENTE,
  estratificarRisco,
  type DadosDaEstratificacao,
} from './estratificacao-de-risco.js';

const HOJE = new Date('2026-09-03T12:00:00.000Z');

function risco(dados: DadosDaEstratificacao = {}) {
  return estratificarRisco(dados, HOJE);
}

describe('estratificarRisco', () => {
  it('paciente sem cadastro nenhum não pontua', () => {
    const resultado = risco();
    expect(resultado.pontuacao).toBe(0);
    expect(resultado.nivel).toBe('BAIXO');
    expect(resultado.fatores).toHaveLength(0);
  });

  /* A regra que impede paciente novo de nascer em risco alto por falta de cadastro. */
  it('ausência de dado não pontua', () => {
    const resultado = risco({
      ecog: 'NAO_AVALIADO',
      moraSozinho: true,
      dificuldadeDeTransporte: true,
      temCuidador: false,
      contextoSocialAvaliadoEm: null,
    });

    expect(resultado.pontuacao).toBe(0);
    expect(resultado.fatores).toHaveLength(0);
  });

  it('contexto social só pontua depois de alguém perguntar', () => {
    const semAvaliar = risco({ moraSozinho: true, temCuidador: false });
    const avaliado = risco({
      moraSozinho: true,
      temCuidador: false,
      contextoSocialAvaliadoEm: '2026-08-01T00:00:00.000Z',
    });

    expect(semAvaliar.pontuacao).toBe(0);
    expect(avaliado.pontuacao).toBeGreaterThan(0);
  });

  it('ECOG 0 e 1 não pontuam; 2, 3 e 4 pontuam em escada', () => {
    expect(risco({ ecog: 'ZERO' }).pontuacao).toBe(0);
    expect(risco({ ecog: 'UM' }).pontuacao).toBe(0);
    expect(risco({ ecog: 'DOIS' }).pontuacao).toBe(2);
    expect(risco({ ecog: 'TRES' }).pontuacao).toBe(3);
    expect(risco({ ecog: 'QUATRO' }).pontuacao).toBe(4);
  });

  it('respeita os cortes dos prints', () => {
    expect(risco({ ecog: 'TRES' }).nivel).toBe('BAIXO');
    expect(risco({ ecog: 'QUATRO' }).nivel).toBe('MEDIO');
    expect(CORTE_DE_RISCO_MEDIO).toBe(4);
    expect(CORTE_DE_RISCO_ALTO).toBe(8);
  });

  it('chega a alto risco somando categorias diferentes', () => {
    const resultado = risco({
      ecog: 'DOIS',
      primeiraAplicacao: true,
      protocolo: { altoRiscoDeNeutropenia: true },
      moraSozinho: true,
      temCuidador: false,
      contextoSocialAvaliadoEm: '2026-08-01T00:00:00.000Z',
    });

    expect(resultado.pontuacao).toBeGreaterThanOrEqual(CORTE_DE_RISCO_ALTO);
    expect(resultado.nivel).toBe('ALTO');
    /* As quatro categorias precisam aparecer separadas na explicação. */
    const categorias = new Set(resultado.fatores.map((f) => f.categoria));
    expect(categorias.has('clinico')).toBe(true);
    expect(categorias.has('tratamento')).toBe(true);
    expect(categorias.has('social')).toBe(true);
  });

  it('devolve os fatores para o número não ser caixa-preta', () => {
    const resultado = risco({ ecog: 'DOIS', primeiraAplicacao: true });
    const soma = resultado.fatores.reduce((total, f) => total + f.pontos, 0);
    expect(soma).toBe(resultado.pontuacao);
    expect(resultado.fatores.length).toBeGreaterThan(0);
  });

  it('limita o peso das comorbidades para não premiar cadastro detalhado', () => {
    expect(risco({ quantidadeDeComorbidades: 1 }).pontuacao).toBe(1);
    expect(risco({ quantidadeDeComorbidades: 2 }).pontuacao).toBe(2);
    expect(risco({ quantidadeDeComorbidades: 7 }).pontuacao).toBe(2);
  });

  it('pesa internação recente mais que internação do mês', () => {
    const semana = risco({ internadoAte: '2026-08-30' });
    const mes = risco({ internadoAte: '2026-08-10' });
    const antiga = risco({ internadoAte: '2026-01-10' });

    expect(semana.pontuacao).toBeGreaterThan(mes.pontuacao);
    expect(antiga.pontuacao).toBe(0);
  });

  it('conta idade só a partir de 75 anos', () => {
    expect(risco({ dataNascimento: '1960-01-01' }).pontuacao).toBe(0);
    expect(risco({ dataNascimento: '1945-01-01' }).pontuacao).toBe(2);
  });

  /* Tratamento oral não é mais seguro: ninguém confere adesão nem efeito em casa. */
  it('pontua tratamento oral em vez de descontar', () => {
    expect(risco({ protocolo: { tratamentoOral: true } }).pontuacao).toBeGreaterThan(0);
  });

  it('pontua adesão baixa e ignora adesão boa', () => {
    expect(risco({ adesao: 0.2 }).pontuacao).toBe(2);
    expect(risco({ adesao: 0.9 }).pontuacao).toBe(0);
    expect(risco({ adesao: null }).pontuacao).toBe(0);
  });

  it('trata contatos repetidos como sinal, não como paciente inconveniente', () => {
    expect(risco({ contatosRecentes: 2 }).pontuacao).toBe(0);
    expect(risco({ contatosRecentes: 3 }).pontuacao).toBe(1);
  });

  it('marca base insuficiente quando falta ECOG ou avaliação social', () => {
    expect(risco({ ecog: 'DOIS' }).baseSuficiente).toBe(false);
    expect(
      risco({ ecog: 'DOIS', contextoSocialAvaliadoEm: '2026-08-01T00:00:00.000Z' })
        .baseSuficiente,
    ).toBe(true);
  });

  /* A trava que impede a tela de mostrar o número sem selo de rascunho. */
  it('continua declarando que os pesos não foram validados', () => {
    expect(PESOS_VALIDADOS_CLINICAMENTE).toBe(false);
    expect(risco({ ecog: 'DOIS' }).validadoClinicamente).toBe(false);
    expect(risco({ ecog: 'DOIS' }).versaoDosPesos).toBe('rascunho-0');
  });

  it('não quebra com datas inválidas', () => {
    const resultado = risco({ dataNascimento: 'não é data', internadoAte: 'nem isto' });
    expect(Number.isNaN(resultado.pontuacao)).toBe(false);
    expect(resultado.pontuacao).toBe(0);
  });
});
