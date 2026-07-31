import type { Prisma } from '@prisma/client';

/**
 * ⚠️  CONJUNTO PROVISÓRIO — NENHUM NÚMERO AQUI É VALIDADO CLINICAMENTE.
 *
 * Leia antes de usar, e antes de mostrar para qualquer pessoa da área da saúde.
 *
 * Os limiares de risco do AUREA não existem: não estão na especificação original, não
 * estão no vault, e não podiam ser inventados por documentação nem por programa. Definir
 * o corte de febre e o número de episódios é decisão de protocolo institucional e de
 * literatura — a referência internacional para graduar evento adverso em oncologia é o
 * CTCAE, e ainda não está confirmado se é a base que o serviço adota.
 *
 * Este conjunto existe por um motivo só: destravar o build. A regra 1 do ADR-001 fez do
 * limiar um dado versionado justamente para que o sistema inteiro pudesse ser construído,
 * testado e demonstrado enquanto a decisão clínica não vem. Quando o orientador definir a
 * base, publica-se um conjunto novo e este é desativado — sem tocar em uma linha de código.
 *
 * De onde vem cada número:
 *
 *   FEBRE — 37,8 e 38,5 são os dois primeiros valores da lista de exemplo da própria
 *   especificação. Não são cortes propostos por ninguém: são os únicos números de
 *   temperatura que aparecem no material de origem, reaproveitados aqui como referência
 *   rastreável em vez de palpite novo.
 *
 *   TODO O RESTO — diarreia, vômito, dor e falta de ar não têm nenhum número no material
 *   de origem. Os valores abaixo foram escolhidos apenas para que o motor tenha o que
 *   comparar em demonstração. Trate-os como zero informação clínica.
 *
 * Enquanto `validadoClinicamente` for falso, toda classificação produzida por este
 * conjunto sai marcada, e a interface é obrigada a exibir a marca.
 */

export const VERSAO_DO_CONJUNTO_RASCUNHO = 'rascunho-0';

const PROVISORIO = 'VALOR DE DEMONSTRAÇÃO — aguarda definição do protocolo do serviço.';

type Regra = Omit<Prisma.RegraDeLimiarCreateManyInput, 'conjuntoId'>;

export const REGRAS_DO_RASCUNHO: Regra[] = [
  // ---- FEBRE ----
  {
    ordem: 1,
    sintoma: 'FEBRE',
    campo: 'temperaturaMaxima',
    operador: 'ENTRE',
    valor: 37.8,
    valorSecundario: 38.4,
    classificacao: 'AMARELO',
    justificativa:
      'Temperatura entre 37,8 °C e 38,4 °C. Os dois valores vêm da lista de exemplo da especificação original. ' +
      PROVISORIO,
  },
  {
    ordem: 2,
    sintoma: 'FEBRE',
    campo: 'temperaturaMaxima',
    operador: 'MAIOR_OU_IGUAL',
    valor: 38.5,
    classificacao: 'VERMELHO',
    justificativa:
      'Temperatura igual ou acima de 38,5 °C. Febre é o único sinal que o paciente mede em casa, e neutropenia febril ' +
      'é a urgência clássica do período pós-quimioterapia. O valor vem da lista de exemplo da especificação. ' +
      PROVISORIO,
  },

  // ---- DIARREIA ----
  {
    ordem: 10,
    sintoma: 'DIARREIA',
    campo: 'episodiosEm24h',
    operador: 'ENTRE',
    valor: 3,
    valorSecundario: 5,
    classificacao: 'AMARELO',
    justificativa:
      'De 3 a 5 evacuações soltas em 24 horas. A contagem é lida sem o hábito basal do paciente, que é cadastro e ' +
      'ainda não entra na regra. ' + PROVISORIO,
  },
  {
    ordem: 11,
    sintoma: 'DIARREIA',
    campo: 'episodiosEm24h',
    operador: 'MAIOR_OU_IGUAL',
    valor: 6,
    classificacao: 'VERMELHO',
    justificativa: 'Seis ou mais evacuações soltas em 24 horas. ' + PROVISORIO,
  },
  {
    ordem: 12,
    sintoma: 'DIARREIA',
    campo: 'presencaDeSangue',
    operador: 'E_VERDADEIRO',
    classificacao: 'VERMELHO',
    justificativa: 'Sangue nas fezes escala independente da contagem de episódios. ' + PROVISORIO,
  },

  // ---- NÁUSEA E VÔMITO ----
  {
    ordem: 20,
    sintoma: 'NAUSEA_VOMITO',
    campo: 'consegueBeberLiquidos',
    operador: 'E_FALSO',
    classificacao: 'VERMELHO',
    justificativa:
      'Não conseguir reter líquido tem peso próprio, independente da contagem de vômitos: não mede o sintoma, mede a ' +
      'consequência, e desidratação em paciente em quimioterapia escala rápido. ' + PROVISORIO,
  },
  {
    ordem: 21,
    sintoma: 'NAUSEA_VOMITO',
    campo: 'episodiosDeVomito',
    operador: 'ENTRE',
    valor: 2,
    valorSecundario: 5,
    classificacao: 'AMARELO',
    justificativa: 'De 2 a 5 episódios de vômito em 24 horas. ' + PROVISORIO,
  },
  {
    ordem: 22,
    sintoma: 'NAUSEA_VOMITO',
    campo: 'episodiosDeVomito',
    operador: 'MAIOR_OU_IGUAL',
    valor: 6,
    classificacao: 'VERMELHO',
    justificativa: 'Seis ou mais episódios de vômito em 24 horas. ' + PROVISORIO,
  },
  {
    ordem: 23,
    sintoma: 'NAUSEA_VOMITO',
    campo: 'consegueComer',
    operador: 'E_FALSO',
    classificacao: 'AMARELO',
    justificativa: 'Não conseguir se alimentar, mas ainda beber líquido. ' + PROVISORIO,
  },

  // ---- DOR ----
  {
    ordem: 30,
    sintoma: 'DOR',
    campo: 'intensidade',
    operador: 'ENTRE',
    valor: 4,
    valorSecundario: 7,
    classificacao: 'AMARELO',
    justificativa:
      'Dor de 4 a 7. A escala 0–10 serve melhor para acompanhar a variação do mesmo paciente ao longo do ciclo do que ' +
      'como gatilho absoluto — usá-la como corte é o ponto mais frágil deste conjunto. ' + PROVISORIO,
  },
  {
    ordem: 31,
    sintoma: 'DOR',
    campo: 'intensidade',
    operador: 'MAIOR_OU_IGUAL',
    valor: 8,
    classificacao: 'VERMELHO',
    justificativa: 'Dor de 8 a 10. ' + PROVISORIO,
  },
  {
    ordem: 32,
    sintoma: 'DOR',
    campo: 'localizacao',
    operador: 'ESTA_EM',
    valoresDeTexto: ['TORACICA', 'LOCAL_DO_CATETER'],
    classificacao: 'AMARELO',
    justificativa:
      'Dor torácica e dor no local do cateter escalam pela localização, não pela nota — é o uso defensável da árvore ' +
      'de dor. ' + PROVISORIO,
  },

  // ---- FALTA DE AR ----
  {
    ordem: 40,
    sintoma: 'FALTA_DE_AR',
    campo: 'esforco',
    operador: 'ESTA_EM',
    valoresDeTexto: ['AO_CAMINHAR'],
    classificacao: 'AMARELO',
    justificativa:
      'Falta de ar ao caminhar. A própria pergunta já gradua por esforço decrescente, sem precisar de número. ' +
      PROVISORIO,
  },
  {
    ordem: 41,
    sintoma: 'FALTA_DE_AR',
    campo: 'esforco',
    operador: 'ESTA_EM',
    valoresDeTexto: ['AO_FALAR', 'EM_REPOUSO'],
    classificacao: 'VERMELHO',
    justificativa: 'Falta de ar ao falar ou em repouso. ' + PROVISORIO,
  },
];
