/**
 * A árvore do questionário de triagem.
 *
 * FRONTEIRA ARQUITETURAL — leia antes de mudar qualquer coisa aqui.
 *
 * A árvore é código. Os limiares são dado versionado no banco (ADR-001, regra 1).
 *
 * São coisas diferentes e a separação é deliberada: a árvore define QUAIS perguntas
 * existem e como se encadeiam — muda raramente, e cada mudança exige tela nova,
 * campo novo no banco e revisão clínica. O limiar define A PARTIR DE QUAL VALOR a
 * resposta vira amarelo ou vermelho — muda dezenas de vezes durante a validação e
 * não pode esperar deploy.
 *
 * Transformar a árvore em dado também significaria construir um montador de
 * formulário, com campo sem tipo e validação genérica. É um segundo produto, e
 * nada na especificação pede isso.
 */

/** Os sintomas do MVP. Cada um custa uma árvore, um conjunto de limiares e um texto de orientação. */
export const SINTOMAS = [
  'FEBRE',
  'DIARREIA',
  'NAUSEA_VOMITO',
  'DOR',
  'FALTA_DE_AR',
] as const;

export type Sintoma = (typeof SINTOMAS)[number];

/** Onde dói. Lista fechada porque localização é o que vira regra — a nota 0-10 vira tendência. */
export const LOCAIS_DE_DOR = [
  'ABDOMINAL',
  'TORACICA',
  'CABECA',
  'BOCA_OU_GARGANTA',
  'OSSOS_OU_ARTICULACOES',
  'LOCAL_DO_CATETER',
  'OUTRO',
] as const;

export type LocalDeDor = (typeof LOCAIS_DE_DOR)[number];

/**
 * Graduação por esforço, do menos grave para o mais grave.
 * A ordem é a graduação: quem sente falta de ar em repouso está pior que quem
 * sente ao caminhar. A estrutura da pergunta ordena a gravidade sem pedir nota.
 */
export const ESFORCOS_COM_FALTA_DE_AR = ['AO_CAMINHAR', 'AO_FALAR', 'EM_REPOUSO'] as const;

export type EsforcoComFaltaDeAr = (typeof ESFORCOS_COM_FALTA_DE_AR)[number];

export const TIPOS_DE_CAMPO = ['BOOLEANO', 'NUMERICO', 'INTEIRO', 'OPCAO'] as const;

export type TipoDeCampo = (typeof TIPOS_DE_CAMPO)[number];

export interface DefinicaoDeCampo {
  /** Identificador estável. É a chave gravada em RespostaDeSintoma.campo — nunca renomear sem migração. */
  readonly campo: string;
  readonly pergunta: string;
  readonly tipo: TipoDeCampo;
  /** Só é perguntado se este outro campo do mesmo sintoma tiver este valor. Ausente = sempre perguntado. */
  readonly dependeDe?: { readonly campo: string; readonly valor: boolean };
  readonly minimo?: number;
  readonly maximo?: number;
  readonly casasDecimais?: number;
  readonly unidade?: string;
  readonly opcoes?: readonly string[];
  /** Texto curto exibido abaixo do campo. Linguagem de paciente, nunca termo técnico. */
  readonly ajuda?: string;
}

export interface RamoDeSintoma {
  readonly sintoma: Sintoma;
  readonly rotulo: string;
  /** A pergunta de porta. "Não" pula o ramo inteiro — é o que torna o check-in diário viável. */
  readonly porta: DefinicaoDeCampo;
  readonly detalhes: readonly DefinicaoDeCampo[];
}

/**
 * A árvore, sintoma por sintoma, como está especificada em `AUREA/Triagem de sintomas.md`.
 *
 * Três desvios deliberados da especificação original, cada um recomendado pelo próprio
 * vault na nota do sintoma. Estão marcados abaixo com DESVIO e precisam de confirmação
 * clínica antes de rodar com paciente real:
 *
 *   1. FEBRE — temperatura vira entrada numérica com uma casa decimal, no lugar da lista
 *      fixa de três valores (37,8 · 38,5 · 39,2), que não registra 38,0 nem 40,1 e esconde
 *      justamente a faixa onde a conduta muda.
 *   2. NAUSEA_VOMITO — ganha pergunta de porta ("sentiu enjoo?"). Na especificação o ramo
 *      começava em "vomitou?", e náusea sem vômito ficava de fora do sistema inteiro.
 *   3. DOR — a localização vira lista fechada. A lista de locais é provisória: não veio
 *      da especificação, foi montada aqui para que a localização possa virar regra.
 */
export const ARVORE_DE_TRIAGEM: readonly RamoDeSintoma[] = [
  {
    sintoma: 'FEBRE',
    rotulo: 'Febre',
    porta: {
      campo: 'apresentouFebre',
      pergunta: 'Você teve febre?',
      tipo: 'BOOLEANO',
    },
    detalhes: [
      {
        // DESVIO 1 — numérico no lugar da lista de três valores fixos.
        campo: 'temperaturaMaxima',
        pergunta: 'Qual foi a temperatura mais alta que você mediu?',
        tipo: 'NUMERICO',
        dependeDe: { campo: 'apresentouFebre', valor: true },
        minimo: 34,
        maximo: 43,
        casasDecimais: 1,
        unidade: '°C',
        ajuda: 'Se mediu mais de uma vez, informe a maior.',
      },
      {
        campo: 'usouAntitermico',
        pergunta: 'Você tomou algum remédio para baixar a febre?',
        tipo: 'BOOLEANO',
        dependeDe: { campo: 'apresentouFebre', valor: true },
        ajuda: 'Dipirona ou paracetamol, por exemplo.',
      },
    ],
  },
  {
    sintoma: 'DIARREIA',
    rotulo: 'Diarreia',
    porta: {
      campo: 'apresentouDiarreia',
      pergunta: 'Você teve diarreia?',
      tipo: 'BOOLEANO',
    },
    detalhes: [
      {
        campo: 'episodiosEm24h',
        pergunta: 'Quantas vezes você foi ao banheiro nas últimas 24 horas?',
        tipo: 'INTEIRO',
        dependeDe: { campo: 'apresentouDiarreia', valor: true },
        minimo: 1,
        maximo: 30,
        ajuda: 'Conte apenas as evacuações soltas ou líquidas.',
      },
      {
        campo: 'presencaDeSangue',
        pergunta: 'Você percebeu sangue?',
        tipo: 'BOOLEANO',
        dependeDe: { campo: 'apresentouDiarreia', valor: true },
      },
    ],
  },
  {
    sintoma: 'NAUSEA_VOMITO',
    rotulo: 'Enjoo e vômito',
    porta: {
      // DESVIO 2 — porta que não existia na especificação.
      campo: 'sentiuNausea',
      pergunta: 'Você sentiu enjoo?',
      tipo: 'BOOLEANO',
    },
    detalhes: [
      {
        campo: 'vomitou',
        pergunta: 'Você chegou a vomitar?',
        tipo: 'BOOLEANO',
        dependeDe: { campo: 'sentiuNausea', valor: true },
      },
      {
        campo: 'episodiosDeVomito',
        pergunta: 'Quantas vezes?',
        tipo: 'INTEIRO',
        dependeDe: { campo: 'vomitou', valor: true },
        minimo: 1,
        maximo: 30,
      },
      {
        campo: 'consegueBeberLiquidos',
        pergunta: 'Você está conseguindo beber água e outros líquidos?',
        tipo: 'BOOLEANO',
        dependeDe: { campo: 'sentiuNausea', valor: true },
        ajuda: 'Mesmo que aos poucos, em pequenos goles.',
      },
      {
        campo: 'consegueComer',
        pergunta: 'Você está conseguindo comer?',
        tipo: 'BOOLEANO',
        dependeDe: { campo: 'sentiuNausea', valor: true },
      },
    ],
  },
  {
    sintoma: 'DOR',
    rotulo: 'Dor',
    porta: {
      campo: 'apresentouDor',
      pergunta: 'Você sentiu dor?',
      tipo: 'BOOLEANO',
    },
    detalhes: [
      {
        // DESVIO 3 — lista fechada provisória.
        campo: 'localizacao',
        pergunta: 'Onde dói?',
        tipo: 'OPCAO',
        dependeDe: { campo: 'apresentouDor', valor: true },
        opcoes: LOCAIS_DE_DOR,
      },
      {
        campo: 'intensidade',
        pergunta: 'De 0 a 10, qual a força dessa dor?',
        tipo: 'INTEIRO',
        dependeDe: { campo: 'apresentouDor', valor: true },
        minimo: 0,
        maximo: 10,
        ajuda: '0 é sem dor nenhuma e 10 é a pior dor que você já sentiu.',
      },
    ],
  },
  {
    sintoma: 'FALTA_DE_AR',
    rotulo: 'Falta de ar',
    porta: {
      campo: 'apresentouFaltaDeAr',
      pergunta: 'Você sentiu falta de ar?',
      tipo: 'BOOLEANO',
    },
    detalhes: [
      {
        campo: 'esforco',
        pergunta: 'Em que momento você sente?',
        tipo: 'OPCAO',
        dependeDe: { campo: 'apresentouFaltaDeAr', valor: true },
        opcoes: ESFORCOS_COM_FALTA_DE_AR,
        ajuda: 'Escolha a situação mais leve em que você já sente falta de ar.',
      },
    ],
  },
] as const;

/** Todos os campos de um ramo, porta primeiro. */
export function camposDoRamo(ramo: RamoDeSintoma): readonly DefinicaoDeCampo[] {
  return [ramo.porta, ...ramo.detalhes];
}

export function buscarRamo(sintoma: Sintoma): RamoDeSintoma {
  const ramo = ARVORE_DE_TRIAGEM.find((candidato) => candidato.sintoma === sintoma);
  if (!ramo) {
    throw new Error(`Sintoma sem ramo na árvore de triagem: ${sintoma}`);
  }
  return ramo;
}

export function buscarCampo(sintoma: Sintoma, campo: string): DefinicaoDeCampo | undefined {
  return camposDoRamo(buscarRamo(sintoma)).find((definicao) => definicao.campo === campo);
}
