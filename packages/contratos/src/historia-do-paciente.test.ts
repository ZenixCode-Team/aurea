import { describe, expect, it } from 'vitest';
import {
  calcularIdade,
  completudeDaHistoria,
  montarHistoriaDoPaciente,
  type DadosDaHistoria,
} from './historia-do-paciente.js';

/* Data fixa em todos os testes: função que lê o relógio produz teste que quebra no
   aniversário de alguém. */
const HOJE = new Date('2026-09-03T12:00:00.000Z');

const MINIMO: DadosDaHistoria = {
  nome: 'Paciente Um',
  diagnostico: 'câncer de mama',
};

function textoDe(dados: DadosDaHistoria): string {
  return montarHistoriaDoPaciente(dados, HOJE)
    .map((t) => t.texto)
    .join(' ');
}

/* Um fragmento como "ex-fumante" aparece com inicial maiúscula quando abre a frase e
   minúscula quando vem depois de outro hábito. Asserção de CONTEÚDO não deve depender
   disso — a caixa tem teste próprio, logo abaixo. */
function textoDeIgnorandoCaixa(dados: DadosDaHistoria): string {
  return textoDe(dados).toLowerCase();
}

describe('calcularIdade', () => {
  it('conta anos completos', () => {
    expect(calcularIdade('1972-03-10', HOJE)).toBe(54);
  });

  it('não conta o ano do aniversário que ainda não chegou', () => {
    expect(calcularIdade('1972-12-25', HOJE)).toBe(53);
  });

  it('conta o ano no próprio dia do aniversário', () => {
    expect(calcularIdade('1972-09-03', HOJE)).toBe(54);
  });

  it('devolve nulo para data inválida em vez de NaN', () => {
    expect(calcularIdade('não é data', HOJE)).toBeNull();
  });
});

describe('montarHistoriaDoPaciente', () => {
  it('monta a frase de abertura com pessoa e tratamento juntos', () => {
    const texto = textoDe({
      ...MINIMO,
      sexo: 'FEMININO',
      dataNascimento: '1972-03-10',
      protocolo: 'AC-T',
      numeroDoCiclo: 2,
      diaDoCiclo: 7,
    });

    expect(texto).toBe(
      'Mulher, 54 anos, em tratamento de câncer de mama, protocolo AC-T, hoje no dia 7 do ciclo 2.',
    );
  });

  it('abre com o tratamento em maiúscula quando não há sexo nem nascimento', () => {
    expect(textoDe(MINIMO)).toBe('Em tratamento de câncer de mama.');
  });

  /* A regra 2 do arquivo, e a razão de existirem os NAO_INFORMADO. */
  it('não transforma ausência de dado em negativa', () => {
    const texto = textoDe({
      ...MINIMO,
      tabagismo: 'NAO_INFORMADO',
      consumoDeAlcool: 'NAO_INFORMADO',
      atividadeFisica: 'NAO_INFORMADO',
    });

    expect(texto).not.toContain('não fuma');
    expect(texto).not.toContain('não bebe');
    expect(texto).toBe('Em tratamento de câncer de mama.');
  });

  it('diz "não bebe" quando isso foi de fato perguntado e respondido', () => {
    expect(
      textoDeIgnorandoCaixa({ ...MINIMO, consumoDeAlcool: 'NAO_BEBE' }),
    ).toContain('não bebe');
  });

  it('põe a alergia antes do medicamento e a marca para destaque', () => {
    const trechos = montarHistoriaDoPaciente(
      {
        ...MINIMO,
        alergias: [{ descricao: 'dipirona', confirmada: true }],
        medicamentosEmUso: [{ nome: 'losartana', posologia: '50mg/dia' }],
      },
      HOJE,
    );

    const assuntos = trechos.map((t) => t.assunto);
    expect(assuntos.indexOf('alergias')).toBeLessThan(assuntos.indexOf('medicamentos'));
    expect(trechos.find((t) => t.assunto === 'alergias')?.destacar).toBe(true);
  });

  it('marca alergia não confirmada como relatada', () => {
    const texto = textoDe({
      ...MINIMO,
      alergias: [{ descricao: 'penicilina', confirmada: false }],
    });

    expect(texto).toContain('penicilina (relatada, não confirmada)');
  });

  it('junta lista com vírgula e "e" antes do último', () => {
    const texto = textoDe({
      ...MINIMO,
      medicamentosEmUso: [
        { nome: 'losartana', posologia: '50mg' },
        { nome: 'omeprazol', posologia: '20mg' },
        { nome: 'metformina', posologia: '850mg' },
      ],
    });

    expect(texto).toContain('Toma losartana, omeprazol e metformina.');
  });

  it('conta os anos desde que parou de fumar, com plural correto', () => {
    expect(
      textoDeIgnorandoCaixa({
        ...MINIMO,
        tabagismo: 'EX_FUMANTE',
        parouDeFumarEm: '2023-01-10',
      }),
    ).toContain('ex-fumante, parou há 3 anos');

    expect(
      textoDeIgnorandoCaixa({
        ...MINIMO,
        tabagismo: 'EX_FUMANTE',
        parouDeFumarEm: '2025-06-10',
      }),
    ).toContain('ex-fumante, parou há 1 ano');
  });

  it('não afirma quantos anos quando parou há menos de um', () => {
    expect(
      textoDeIgnorandoCaixa({
        ...MINIMO,
        tabagismo: 'EX_FUMANTE',
        parouDeFumarEm: '2026-05-10',
      }),
    ).toContain('parou há menos de um ano');
  });

  it('diz apenas ex-fumante quando a data de parada não foi registrada', () => {
    const texto = textoDeIgnorandoCaixa({ ...MINIMO, tabagismo: 'EX_FUMANTE' });
    expect(texto).toContain('ex-fumante');
    expect(texto).not.toContain('parou há');
  });

  it('prefere a descrição livre ao rótulo do enum', () => {
    const texto = textoDeIgnorandoCaixa({
      ...MINIMO,
      atividadeFisica: 'MODERADA',
      descricaoDaAtividade: 'caminha 3x por semana',
    });

    expect(texto).toContain('caminha 3x por semana');
    expect(texto).not.toContain('atividade física moderada');
  });

  it('cai no rótulo do enum quando a descrição é só espaço em branco', () => {
    const texto = textoDeIgnorandoCaixa({
      ...MINIMO,
      atividadeFisica: 'MODERADA',
      descricaoDaAtividade: '   ',
    });

    expect(texto).toContain('atividade física moderada');
  });

  /* O defeito que passou por 21 testes e só apareceu na tela: todo trecho é uma
     frase, e frase começa em maiúscula. */
  it('começa toda frase em maiúscula', () => {
    const trechos = montarHistoriaDoPaciente(
      {
        ...MINIMO,
        sexo: 'MASCULINO',
        dataNascimento: '1963-05-22',
        alergias: [{ descricao: 'dipirona', confirmada: true }],
        comorbidades: [{ descricao: 'hipertensão', confirmada: true }],
        medicamentosEmUso: [{ nome: 'losartana', posologia: '50mg' }],
        tabagismo: 'EX_FUMANTE',
        parouDeFumarEm: '2019-08-01',
        consumoDeAlcool: 'NAO_BEBE',
        atividadeFisica: 'LEVE',
        descricaoDaAtividade: 'caminha três vezes por semana',
        habitoIntestinalBasal: 1,
      },
      HOJE,
    );

    expect(trechos.length).toBeGreaterThan(4);
    for (const trecho of trechos) {
      const primeira = trecho.texto.charAt(0);
      expect(primeira, `trecho "${trecho.assunto}" começa em minúscula`).toBe(
        primeira.toUpperCase(),
      );
    }
  });

  it('termina toda frase com ponto', () => {
    const trechos = montarHistoriaDoPaciente(
      {
        ...MINIMO,
        tabagismo: 'FUMANTE_ATUAL',
        alergias: [{ descricao: 'dipirona', confirmada: true }],
        habitoIntestinalBasal: 2,
      },
      HOJE,
    );

    for (const trecho of trechos) {
      expect(trecho.texto.endsWith('.'), `trecho "${trecho.assunto}" sem ponto`).toBe(true);
    }
  });

  it('usa singular em uma vez ao dia', () => {
    expect(textoDe({ ...MINIMO, habitoIntestinalBasal: 1 })).toContain(
      'Hábito intestinal basal: 1 vez ao dia.',
    );
    expect(textoDe({ ...MINIMO, habitoIntestinalBasal: 3 })).toContain(
      'Hábito intestinal basal: 3 vezes ao dia.',
    );
  });

  /* Regra 3: retrato de quem a pessoa é, nunca leitura do estado clínico de hoje. */
  it('nunca menciona classificação de risco', () => {
    const texto = textoDe({
      ...MINIMO,
      sexo: 'FEMININO',
      dataNascimento: '1972-03-10',
      alergias: [{ descricao: 'dipirona', confirmada: true }],
      comorbidades: [{ descricao: 'hipertensão', confirmada: true }],
      tabagismo: 'FUMANTE_ATUAL',
    }).toLowerCase();

    for (const proibido of ['verde', 'amarelo', 'vermelho', 'risco', 'gravidade']) {
      expect(texto).not.toContain(proibido);
    }
  });
});

describe('completudeDaHistoria', () => {
  it('devolve zero quando nada além do obrigatório foi cadastrado', () => {
    expect(completudeDaHistoria(MINIMO)).toBe(0);
  });

  it('não conta NAO_INFORMADO como preenchido', () => {
    expect(
      completudeDaHistoria({ ...MINIMO, tabagismo: 'NAO_INFORMADO', sexo: 'NAO_INFORMADO' }),
    ).toBe(0);
  });

  it('devolve um quando tudo que se pergunta foi respondido', () => {
    expect(
      completudeDaHistoria({
        ...MINIMO,
        dataNascimento: '1972-03-10',
        sexo: 'FEMININO',
        alergias: [{ descricao: 'dipirona', confirmada: true }],
        tabagismo: 'EX_FUMANTE',
        atividadeFisica: 'MODERADA',
        consumoDeAlcool: 'NAO_BEBE',
        habitoIntestinalBasal: 1,
      }),
    ).toBe(1);
  });
});
