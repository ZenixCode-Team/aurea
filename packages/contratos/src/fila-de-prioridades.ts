/**
 * A fila de prioridades do plantão, e o alerta de silêncio.
 *
 * O painel hoje ordena por gravidade da classificação e desempata por dias sem
 * responder. Isso resolve o caso fácil e falha no difícil: entre dois vermelhos, qual
 * a enfermagem atende primeiro? Entre um vermelho de ontem e um silêncio de sete dias,
 * quem vem antes? A resposta estava na cabeça de quem está de plantão, e cabeça de
 * plantão às 3 da manhã não é lugar de guardar critério clínico.
 *
 * ## Por que o silêncio pesa
 *
 * A lei do produto diz que ausência de resposta não é ausência de necessidade. Um
 * paciente calado há 72 horas pode estar internado, sem bateria, ou piorando sozinho.
 * As três explicações são incompatíveis, e nenhuma delas é "está tudo bem". Por isso
 * o silêncio longo entra na MESMA fila do sintoma grave, e não numa lista separada
 * que alguém olha se sobrar tempo.
 *
 * ## O que esta fila NÃO faz
 *
 * Não inventa gravidade. A prioridade sai da classificação que o motor já produziu,
 * do tempo de silêncio e de sinalizadores de contexto que estão cadastrados. Não há
 * escore clínico novo aqui: isso é a Onda D do briefing 119, depende de ECOG e de
 * atributos de protocolo que o banco ainda não guarda, e precisa de assinatura do
 * orientador antes de valer.
 *
 * ## Limite conhecido, e é do questionário
 *
 * Os prints pedem sangramento, sintomas neurológicos, mucosite e constipação na faixa
 * de prioridade. O motor NÃO os detecta: `enum Sintoma` tem cinco valores e a árvore
 * de triagem não faz essas perguntas. Acrescentar o valor ao enum sem a pergunta
 * correspondente produziria um sintoma que nunca dispara, o que é pior do que a
 * ausência: a equipe leria a fila como se eles estivessem cobertos. Expandir a árvore
 * é decisão clínica, não de implementação.
 */

import type { Classificacao, RegraDisparada } from './classificacao.js';
import type { Sintoma } from './sintomas.js';

/** A mesma situação que o painel já usa, incluindo o silêncio. */
export type SituacaoNoPainel =
  | 'VERMELHO'
  | 'AMARELO'
  | 'VERDE'
  | 'SEM_CLASSIFICACAO'
  | 'SEM_RESPOSTA_HOJE';

/**
 * Faixas de silêncio dos prints. `HOJE` existe para não precisar de nulo em quem
 * respondeu: a faixa é sempre um valor, e "respondeu hoje" é uma delas.
 */
export type FaixaDeSilencio =
  | 'HOJE'
  | 'UM_DIA'
  | 'DOIS_DIAS'
  | 'TRES_DIAS'
  | 'UMA_SEMANA'
  | 'NUNCA_RESPONDEU';

export const ROTULO_DA_FAIXA: Record<FaixaDeSilencio, string> = {
  HOJE: 'respondeu hoje',
  UM_DIA: '24 horas sem responder',
  DOIS_DIAS: '48 horas sem responder',
  TRES_DIAS: '72 horas sem responder',
  UMA_SEMANA: '7 dias ou mais sem responder',
  NUNCA_RESPONDEU: 'nunca respondeu',
};

/**
 * Peso do silêncio na fila.
 *
 * Uma semana calado pesa mais que 24 horas, e "nunca respondeu" pesa mais que tudo:
 * é a única faixa em que ninguém nunca teve contato com a pessoa pelo sistema.
 */
const PESO_DA_FAIXA: Record<FaixaDeSilencio, number> = {
  HOJE: 0,
  UM_DIA: 1,
  DOIS_DIAS: 3,
  TRES_DIAS: 5,
  UMA_SEMANA: 8,
  NUNCA_RESPONDEU: 9,
};

const PESO_DA_SITUACAO: Record<SituacaoNoPainel, number> = {
  VERMELHO: 100,
  AMARELO: 50,
  SEM_CLASSIFICACAO: 30,
  SEM_RESPOSTA_HOJE: 20,
  VERDE: 0,
};

/**
 * Sintomas que sobem o paciente na fila dentro da mesma classificação.
 *
 * Os quatro que estão aqui são os que o questionário coleta HOJE e que os prints
 * colocam na prioridade alta. Falta de ar vem antes de febre porque dispneia em
 * repouso não espera a próxima ligação.
 */
const PESO_DO_SINTOMA: Record<Sintoma, number> = {
  FALTA_DE_AR: 4,
  FEBRE: 3,
  DOR: 2,
  DIARREIA: 2,
  NAUSEA_VOMITO: 1,
};

export interface SinalizadoresDoPaciente {
  /** Data em que a internação terminou. Recém-saído entra na prioridade alta. */
  readonly internadoAte?: string | null;
  /** Dia do ciclo de hoje. Primeiros dias após a sessão concentram toxicidade. */
  readonly diaDoCiclo?: number | null;
}

export interface EntradaDaFila {
  readonly pacienteId: string;
  readonly nome: string;
  readonly situacao: SituacaoNoPainel;
  /** Nulo quando nunca respondeu — diferente de zero dias. */
  readonly diasSemResponder: number | null;
  readonly nuncaRespondeu: boolean;
  readonly regrasDisparadas?: readonly RegraDisparada[];
  readonly sinalizadores?: SinalizadoresDoPaciente;
}

export interface MotivoDaPrioridade {
  readonly texto: string;
  /** De onde veio o motivo, para a tela decidir o que mostrar primeiro. */
  readonly tipo: 'sintoma' | 'silencio' | 'contexto';
}

export interface ItemPriorizado<T extends EntradaDaFila> {
  readonly entrada: T;
  readonly faixaDeSilencio: FaixaDeSilencio;
  readonly pontuacao: number;
  /** Por que este paciente está nesta posição. A fila não pode ser caixa-preta. */
  readonly motivos: readonly MotivoDaPrioridade[];
}

/**
 * Em qual faixa de silêncio o paciente está.
 *
 * Os limites são os dos prints (24h, 48h, 72h, 7 dias) lidos como DIAS COMPLETOS sem
 * responder, que é como a equipe conta: "não responde desde terça".
 *
 * **Quem manda é `nuncaRespondeu`, não o nulo.** `diasSemResponder` nulo é ambíguo:
 * pode ser "nunca houve resposta" ou "respondeu e a origem não conta os dias" — o
 * espelho sintético manda exatamente isso, com `nuncaRespondeu: false`. Tratar o nulo
 * como silêncio máximo jogava a lista inteira na prioridade alta, e painel em que
 * todo mundo é urgente é painel em que ninguém é. Sem evidência de silêncio, a
 * resposta é HOJE: alarme inventado custa mais caro que alarme ausente numa tela cujo
 * trabalho é dizer quem atender primeiro.
 */
export function faixaDeSilencioDe(
  diasSemResponder: number | null,
  nuncaRespondeu: boolean,
): FaixaDeSilencio {
  if (nuncaRespondeu) return 'NUNCA_RESPONDEU';
  if (diasSemResponder == null) return 'HOJE';
  if (diasSemResponder >= 7) return 'UMA_SEMANA';
  if (diasSemResponder >= 3) return 'TRES_DIAS';
  if (diasSemResponder >= 2) return 'DOIS_DIAS';
  if (diasSemResponder >= 1) return 'UM_DIA';
  return 'HOJE';
}

/** Dias completos entre duas datas, ignorando hora. */
function diasEntre(inicio: Date, fim: Date): number {
  const umDia = 24 * 60 * 60 * 1000;
  const a = Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
  const b = Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), fim.getUTCDate());
  return Math.floor((b - a) / umDia);
}

/** Recém-saído de internação: até 7 dias após a alta, pelos prints. */
const DIAS_DE_ALTA_RECENTE = 7;

function motivosDe(
  entrada: EntradaDaFila,
  faixa: FaixaDeSilencio,
  hoje: Date,
): readonly MotivoDaPrioridade[] {
  const motivos: MotivoDaPrioridade[] = [];

  /* Sintoma primeiro: é o que a enfermagem precisa ler antes de decidir se liga
     agora ou daqui a pouco. Só as regras que classificaram como vermelho ou amarelo
     viram motivo; regra verde disparada não é razão para subir na fila. */
  const graves = (entrada.regrasDisparadas ?? []).filter(
    (regra) => regra.classificacao === 'VERMELHO' || regra.classificacao === 'AMARELO',
  );

  for (const regra of ordenarPorGravidade(graves)) {
    motivos.push({ tipo: 'sintoma', texto: regra.justificativa });
  }

  if (faixa !== 'HOJE') {
    motivos.push({ tipo: 'silencio', texto: ROTULO_DA_FAIXA[faixa] });
  }

  const alta = entrada.sinalizadores?.internadoAte;
  if (alta) {
    const data = new Date(alta);
    if (!Number.isNaN(data.getTime())) {
      const dias = diasEntre(data, hoje);
      if (dias >= 0 && dias <= DIAS_DE_ALTA_RECENTE) {
        motivos.push({
          tipo: 'contexto',
          texto:
            dias === 0
              ? 'saiu de internação hoje'
              : `saiu de internação há ${dias} ${dias === 1 ? 'dia' : 'dias'}`,
        });
      }
    }
  }

  return motivos;
}

function ordenarPorGravidade(
  regras: readonly RegraDisparada[],
): readonly RegraDisparada[] {
  const peso = (r: RegraDisparada) =>
    (r.classificacao === 'VERMELHO' ? 100 : 50) + (PESO_DO_SINTOMA[r.sintoma] ?? 0);
  return [...regras].sort((a, b) => peso(b) - peso(a));
}

/**
 * Pontuação da fila. Número maior atende primeiro.
 *
 * Não é escore clínico e não pretende ser: é ordenação de trabalho. A classificação
 * domina (100 / 50 / 30 / 20 / 0), o silêncio e o sintoma desempatam. Um vermelho
 * calado há uma semana passa de um vermelho que respondeu hoje, e nenhum amarelo
 * ultrapassa um vermelho por acúmulo de desempate — é por isso que os patamares da
 * situação são tão distantes entre si.
 */
export function pontuarEntrada(entrada: EntradaDaFila, hoje: Date = new Date()): number {
  const faixa = faixaDeSilencioDe(entrada.diasSemResponder, entrada.nuncaRespondeu);

  let pontos = PESO_DA_SITUACAO[entrada.situacao] + PESO_DA_FAIXA[faixa];

  const graves = (entrada.regrasDisparadas ?? []).filter(
    (regra) => regra.classificacao === 'VERMELHO' || regra.classificacao === 'AMARELO',
  );
  for (const regra of graves) {
    pontos += PESO_DO_SINTOMA[regra.sintoma] ?? 0;
  }

  const alta = entrada.sinalizadores?.internadoAte;
  if (alta) {
    const data = new Date(alta);
    if (!Number.isNaN(data.getTime())) {
      const dias = diasEntre(data, hoje);
      if (dias >= 0 && dias <= DIAS_DE_ALTA_RECENTE) pontos += 6;
    }
  }

  return pontos;
}

/**
 * Ordena a fila do plantão.
 *
 * Empate desfeito pelo nome, e não pela ordem que o banco devolveu: lista que muda de
 * ordem sozinha entre dois carregamentos faz a equipe perder o lugar onde estava.
 */
export function ordenarFilaDePrioridades<T extends EntradaDaFila>(
  entradas: readonly T[],
  hoje: Date = new Date(),
): readonly ItemPriorizado<T>[] {
  return entradas
    .map((entrada) => {
      const faixaDeSilencio = faixaDeSilencioDe(
        entrada.diasSemResponder,
        entrada.nuncaRespondeu,
      );
      return {
        entrada,
        faixaDeSilencio,
        pontuacao: pontuarEntrada(entrada, hoje),
        motivos: motivosDe(entrada, faixaDeSilencio, hoje),
      };
    })
    .sort((a, b) => {
      if (b.pontuacao !== a.pontuacao) return b.pontuacao - a.pontuacao;
      return a.entrada.nome.localeCompare(b.entrada.nome, 'pt-BR');
    });
}

export interface ResumoDoSilencio {
  readonly umDia: number;
  readonly doisDias: number;
  readonly tresDias: number;
  readonly umaSemana: number;
  readonly nuncaRespondeu: number;
  /** Todo mundo que não respondeu hoje, em um número só. */
  readonly total: number;
}

/** O bloco 3 dos prints: quantos estão em cada faixa de silêncio. */
export function resumirSilencio(
  entradas: readonly EntradaDaFila[],
): ResumoDoSilencio {
  const contagem = { umDia: 0, doisDias: 0, tresDias: 0, umaSemana: 0, nuncaRespondeu: 0 };

  for (const entrada of entradas) {
    const faixa = faixaDeSilencioDe(entrada.diasSemResponder, entrada.nuncaRespondeu);
    if (faixa === 'UM_DIA') contagem.umDia += 1;
    else if (faixa === 'DOIS_DIAS') contagem.doisDias += 1;
    else if (faixa === 'TRES_DIAS') contagem.tresDias += 1;
    else if (faixa === 'UMA_SEMANA') contagem.umaSemana += 1;
    else if (faixa === 'NUNCA_RESPONDEU') contagem.nuncaRespondeu += 1;
  }

  return {
    ...contagem,
    total:
      contagem.umDia +
      contagem.doisDias +
      contagem.tresDias +
      contagem.umaSemana +
      contagem.nuncaRespondeu,
  };
}

/** Nível de prioridade dos prints, derivado da situação. Só para rótulo na tela. */
export type NivelDePrioridade = 'ALTA' | 'INTERMEDIARIA' | 'BAIXA';

export function nivelDePrioridade(
  situacao: SituacaoNoPainel,
  faixa: FaixaDeSilencio,
): NivelDePrioridade {
  if (situacao === 'VERMELHO') return 'ALTA';
  /* Silêncio de 72 horas ou mais entra na prioridade alta mesmo sem classificação:
     é exatamente o caso que a lei do produto manda não ler como "está tudo bem". */
  if (faixa === 'TRES_DIAS' || faixa === 'UMA_SEMANA' || faixa === 'NUNCA_RESPONDEU') {
    return 'ALTA';
  }
  if (situacao === 'AMARELO' || situacao === 'SEM_CLASSIFICACAO') return 'INTERMEDIARIA';
  /* Qualquer silêncio, mesmo de um dia, tira o paciente da baixa prioridade. Baixa
     prioridade nos prints é "orientações gerais" — quem não respondeu não está lá. */
  if (faixa !== 'HOJE') return 'INTERMEDIARIA';
  return 'BAIXA';
}

export const ROTULO_DO_NIVEL: Record<NivelDePrioridade, string> = {
  ALTA: 'Prioridade alta',
  INTERMEDIARIA: 'Prioridade intermediária',
  BAIXA: 'Baixa prioridade',
};

