import type { Sintoma } from './sintomas.js';

/** As três cores da tela 6. A ordem do array é a ordem de gravidade — o motor depende disso. */
export const CLASSIFICACOES = ['VERDE', 'AMARELO', 'VERMELHO'] as const;

export type Classificacao = (typeof CLASSIFICACOES)[number];

export function gravidadeDe(classificacao: Classificacao): number {
  return CLASSIFICACOES.indexOf(classificacao);
}

export function piorEntre(a: Classificacao, b: Classificacao): Classificacao {
  return gravidadeDe(a) >= gravidadeDe(b) ? a : b;
}

export const OPERADORES = [
  'MAIOR_OU_IGUAL',
  'MAIOR_QUE',
  'MENOR_OU_IGUAL',
  'MENOR_QUE',
  'IGUAL',
  'ENTRE',
  'E_VERDADEIRO',
  'E_FALSO',
  'ESTA_EM',
] as const;

export type Operador = (typeof OPERADORES)[number];

/**
 * Uma regra de corte. É dado do banco, nunca código — ADR-001, regra 1.
 *
 * O motor não sabe o que é febre. Ele sabe comparar o valor gravado no campo
 * `temperaturaMaxima` do sintoma `FEBRE` contra um número que veio da tabela.
 * É isso que permite o orientador mudar o corte sem tocar em uma linha de programa.
 */
export interface RegraDeLimiar {
  readonly id: string;
  /** Ordem de avaliação. Só afeta a leitura da explicação — o resultado é o pior de todas. */
  readonly ordem: number;
  readonly sintoma: Sintoma;
  /** Chave do campo em `ARVORE_DE_TRIAGEM`. Regra apontando para campo inexistente é erro de cadastro. */
  readonly campo: string;
  readonly operador: Operador;
  readonly valor?: number | null;
  /** Segundo operando de ENTRE. */
  readonly valorSecundario?: number | null;
  /** Operando de ESTA_EM e de IGUAL sobre campo de opção. */
  readonly valoresDeTexto?: readonly string[];
  readonly classificacao: Classificacao;
  /** Por que este corte existe. Vai para a explicação e para a defesa. */
  readonly justificativa: string;
  /**
   * Janela do ciclo em que a regra vale. Ausente = vale sempre.
   * É o campo que responde ao item 3 das decisões em aberto: o mesmo sintoma no dia 3
   * e no dia 10 depois da sessão não tem o mesmo peso, e `dia do ciclo` já existe no modelo.
   */
  readonly diaDoCicloMinimo?: number | null;
  readonly diaDoCicloMaximo?: number | null;
  /** Protocolo ao qual a regra se restringe. Ausente = vale para todos (item 4 das decisões em aberto). */
  readonly protocoloId?: string | null;
}

/** Como somar sintomas — item 2 das decisões em aberto. */
export const POLITICAS_DE_COMBINACAO = ['PIOR_ISOLADO', 'DOIS_AMARELOS_VIRAM_VERMELHO'] as const;

export type PoliticaDeCombinacao = (typeof POLITICAS_DE_COMBINACAO)[number];

/** O que o antitérmico altera — item 5 das decisões em aberto. */
export const EFEITOS_DO_ANTITERMICO = ['IGNORAR', 'ELEVAR_UM_NIVEL'] as const;

export type EfeitoDoAntitermico = (typeof EFEITOS_DO_ANTITERMICO)[number];

/** O que fazer com questionário abandonado no meio — item 6 das decisões em aberto. */
export const TRATAMENTOS_DE_ABANDONO = ['NAO_CLASSIFICAR', 'PIOR_DOS_RESPONDIDOS'] as const;

export type TratamentoDeAbandono = (typeof TRATAMENTOS_DE_ABANDONO)[number];

export interface PoliticaDeClassificacao {
  readonly combinacao: PoliticaDeCombinacao;
  readonly efeitoDoAntitermico: EfeitoDoAntitermico;
  readonly tratamentoDeAbandono: TratamentoDeAbandono;
}

/**
 * Um conjunto de limiares é uma versão inteira do algoritmo, congelada.
 *
 * Classificação feita em março precisa continuar explicável depois que a regra mudar
 * em maio — por isso toda classificação guarda qual conjunto a produziu, e conjunto
 * publicado nunca é editado: publica-se outro.
 */
export interface ConjuntoDeLimiares {
  readonly id: string;
  readonly versao: string;
  readonly descricao: string;
  /** De onde vieram os números. "CTCAE v5.0", "protocolo do serviço", "provisório". */
  readonly origem: string;
  /**
   * Falso enquanto ninguém com responsabilidade clínica assinou estes cortes.
   * Conjunto não validado classifica — senão não haveria demo — mas o resultado
   * carrega a marca, e a interface é obrigada a mostrar.
   */
  readonly validadoClinicamente: boolean;
  readonly politica: PoliticaDeClassificacao;
  readonly regras: readonly RegraDeLimiar[];
}

/** Uma regra que disparou, com o valor que a fez disparar. É a explicação do resultado. */
export interface RegraDisparada {
  readonly regraId: string;
  readonly sintoma: Sintoma;
  readonly campo: string;
  readonly valorObservado: number | string | boolean | null;
  readonly classificacao: Classificacao;
  readonly justificativa: string;
}

export interface ClassificacaoPorSintoma {
  readonly sintoma: Sintoma;
  readonly classificacao: Classificacao;
  readonly regrasDisparadas: readonly RegraDisparada[];
}

export interface AjusteDaPolitica {
  readonly politica: string;
  readonly de: Classificacao;
  readonly para: Classificacao;
  readonly motivo: string;
}

/**
 * O resultado completo de uma classificação.
 *
 * `explicacao` não é log: é o dado que permite reconstruir, meses depois, por que
 * aquele dia foi amarelo. Vai gravado junto da classificação no banco.
 */
export interface ResultadoDaClassificacao {
  readonly situacao: 'CLASSIFICADA';
  readonly resultado: Classificacao;
  readonly conjuntoDeLimiaresId: string;
  readonly versaoDoConjunto: string;
  readonly validadoClinicamente: boolean;
  readonly explicacao: {
    readonly porSintoma: readonly ClassificacaoPorSintoma[];
    readonly ajustesDaPolitica: readonly AjusteDaPolitica[];
    readonly sintomasNaoRespondidos: readonly Sintoma[];
    readonly diaDoCiclo: number | null;
    readonly protocoloId: string | null;
  };
}

/**
 * Questionário abandonado no meio pode não render classificação nenhuma — é o que a
 * política `NAO_CLASSIFICAR` decide, e é o item 6 das decisões em aberto.
 *
 * "Sem classificação" é um estado próprio, não é verde. Devolver verde para quem parou
 * de responder no meio é exatamente o erro que o vault chama de "silêncio não é verde":
 * as duas causas mais prováveis do abandono são opostas — a pessoa está bem e se distraiu,
 * ou está mal demais para continuar.
 */
export interface NaoClassificada {
  readonly situacao: 'NAO_CLASSIFICADA';
  readonly motivo: string;
  readonly conjuntoDeLimiaresId: string;
  readonly versaoDoConjunto: string;
  readonly sintomasRespondidos: readonly Sintoma[];
}

export type SaidaDaClassificacao = ResultadoDaClassificacao | NaoClassificada;
