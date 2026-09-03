/**
 * Giro de cadeiras — capacidade assistencial real.
 *
 * O agendamento convencional enxerga horário livre. Este módulo enxerga CAPACIDADE:
 * quanto tempo cada paciente ocupa a poltrona e quando ela estará efetivamente
 * disponível para o próximo.
 *
 * A diferença não é sutil. Uma agenda que diz
 *
 *     Paciente A: 08h → 10h
 *     Paciente B: 10h → 12h
 *
 * está errada em toda linha, porque a infusão é só uma parte da ocupação. Antes dela
 * vem o preparo e a instalação do acesso; às vezes vem a pré-medicação; depois dela
 * vem a observação, que prende a cadeira sem aparecer em agenda nenhuma. E nada disso
 * começa enquanto a farmácia não liberar a medicação.
 *
 * A mesma agenda, lida por ocupação real:
 *
 *     08:00 ━━━ Paciente A ━━━ 10:20
 *     10:20 ━━━ Paciente B ━━━ 12:50
 *
 * ## O que este módulo NÃO faz
 *
 * Não decide quem senta onde. Alocação envolve preferência de paciente, escala de
 * enfermagem e negociação humana; o que está aqui é o cálculo que informa a decisão,
 * não a decisão. E não inventa tempo: protocolo sem tempo cadastrado usa o padrão do
 * banco e a tela diz que o número é estimado.
 *
 * ## Atraso é medido, não estimado
 *
 * O atraso operacional sai da diferença entre o início previsto e o início REAL das
 * sessões que já começaram. Não é projeção: é o que já aconteceu hoje, e por isso só
 * conta sessão que tem as duas datas.
 */

/** Os estados que uma poltrona pode estar, na ordem em que acontecem. */
export type EstadoDaCadeira =
  | 'DISPONIVEL'
  | 'AGUARDANDO_MEDICACAO'
  | 'EM_PREPARO'
  | 'OCUPADA'
  | 'EM_OBSERVACAO';

export type EstadoDaSessao =
  | 'AGENDADA'
  | 'AGUARDANDO_MEDICACAO'
  | 'EM_PREPARO'
  | 'EM_INFUSAO'
  | 'EM_OBSERVACAO'
  | 'CONCLUIDA'
  | 'CANCELADA';

export const ROTULO_DO_ESTADO_DA_CADEIRA: Record<EstadoDaCadeira, string> = {
  DISPONIVEL: 'Disponível',
  AGUARDANDO_MEDICACAO: 'Aguardando medicação',
  EM_PREPARO: 'Em preparação',
  OCUPADA: 'Ocupada',
  EM_OBSERVACAO: 'Em observação',
};

/**
 * Tempo de virada entre um paciente e o próximo.
 *
 * Limpeza da poltrona, descarte e conferência. Não é folga: é trabalho que acontece
 * com a cadeira ocupada e que o agendamento convencional simplesmente ignora, o que
 * faz toda agenda montada por ele atrasar um pouco mais a cada paciente.
 */
export const MINUTOS_DE_VIRADA = 15;

export interface TemposDoProtocolo {
  readonly tempoDePreparoEmMinutos: number;
  readonly tempoDePreMedicacaoEmMinutos: number;
  readonly tempoDeInfusaoEmMinutos: number;
  readonly tempoDeObservacaoEmMinutos: number;
  readonly bombaInfusora?: boolean;
}

export interface ComposicaoDaOcupacao {
  readonly preparo: number;
  readonly preMedicacao: number;
  readonly infusao: number;
  readonly observacao: number;
  readonly virada: number;
  /** A soma. É este número que o agendamento convencional não enxerga. */
  readonly total: number;
}

/**
 * Quanto tempo a cadeira fica indisponível por causa deste paciente.
 *
 * `complexidade` vem da estratificação de risco e acrescenta uma margem: paciente de
 * alto risco precisa de mais acompanhamento de enfermagem durante a infusão, e fingir
 * que não precisa é o que produz agenda que não fecha. A margem é percentual e
 * declarada, não escondida dentro do tempo de infusão.
 */
export function calcularOcupacao(
  tempos: TemposDoProtocolo,
  complexidade: 'BAIXO' | 'MEDIO' | 'ALTO' = 'BAIXO',
): ComposicaoDaOcupacao {
  const margem = complexidade === 'ALTO' ? 1.2 : complexidade === 'MEDIO' ? 1.1 : 1;

  /* A margem incide sobre preparo e observação, não sobre a infusão: o tempo de
     gotejamento é do medicamento e não muda com o paciente. O que muda é quanto
     tempo a enfermagem gasta antes e depois. */
  const preparo = Math.round(tempos.tempoDePreparoEmMinutos * margem);
  const preMedicacao = tempos.tempoDePreMedicacaoEmMinutos;
  const infusao = tempos.tempoDeInfusaoEmMinutos;
  const observacao = Math.round(tempos.tempoDeObservacaoEmMinutos * margem);

  return {
    preparo,
    preMedicacao,
    infusao,
    observacao,
    virada: MINUTOS_DE_VIRADA,
    total: preparo + preMedicacao + infusao + observacao + MINUTOS_DE_VIRADA,
  };
}

export interface SessaoNaCadeira {
  readonly id: string;
  readonly paciente: string;
  readonly cadeiraId: string | null;
  readonly protocolo: string | null;
  readonly estado: EstadoDaSessao;
  readonly previsaoDeInicio: string;
  readonly previsaoDeFim: string;
  readonly inicioReal?: string | null;
  readonly fimReal?: string | null;
  readonly medicacaoLiberadaEm?: string | null;
}

export interface CadeiraDisponivel {
  readonly id: string;
  readonly numero: number;
  readonly ativa: boolean;
}

export interface OcupacaoDaCadeira {
  readonly cadeira: CadeiraDisponivel;
  readonly estado: EstadoDaCadeira;
  readonly sessaoAtual: SessaoNaCadeira | null;
  /** Quando esta poltrona fica livre. Nulo quando já está. */
  readonly livreEm: string | null;
}

export interface GiroDeCadeiras {
  readonly total: number;
  readonly ocupadas: number;
  readonly emPreparo: number;
  readonly aguardandoMedicacao: number;
  readonly emObservacao: number;
  readonly disponiveis: number;
  /** 0 a 100. Conta como ocupada tudo que não está disponível. */
  readonly taxaDeOcupacao: number;
  /** Em minutos, das sessões de hoje que já terminaram. Nulo sem base. */
  readonly tempoMedioDeOcupacaoEmMinutos: number | null;
  /** Quando a primeira cadeira fica livre. Nulo se já há alguma. */
  readonly proximaCadeiraLivreEm: string | null;
  /** Soma dos atrasos de início já observados hoje, em minutos. */
  readonly atrasoAcumuladoEmMinutos: number;
  readonly porCadeira: readonly OcupacaoDaCadeira[];
}

/** O estado da CADEIRA derivado do estado da SESSÃO que a ocupa. */
function estadoDaCadeira(sessao: SessaoNaCadeira | null): EstadoDaCadeira {
  if (!sessao) return 'DISPONIVEL';
  switch (sessao.estado) {
    case 'AGUARDANDO_MEDICACAO':
      return 'AGUARDANDO_MEDICACAO';
    case 'EM_PREPARO':
      return 'EM_PREPARO';
    case 'EM_OBSERVACAO':
      return 'EM_OBSERVACAO';
    case 'EM_INFUSAO':
      return 'OCUPADA';
    default:
      /* AGENDADA não ocupa: a cadeira só fica presa quando o paciente chega. Contar
         agendamento como ocupação é o erro que faz o painel mostrar 100% às 7h da
         manhã, com o ambulatório vazio. */
      return 'DISPONIVEL';
  }
}

function minutosEntre(inicio: string, fim: string): number | null {
  const a = new Date(inicio).getTime();
  const b = new Date(fim).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 60000);
}

/**
 * O retrato do ambulatório agora.
 *
 * Recebe `agora` em vez de chamar o relógio: painel de capacidade que lê o relógio por
 * dentro não é testável, e este é o número que a coordenação usa para decidir se
 * encaixa mais um paciente.
 */
export function calcularGiroDeCadeiras(
  cadeiras: readonly CadeiraDisponivel[],
  sessoes: readonly SessaoNaCadeira[],
  agora: Date = new Date(),
): GiroDeCadeiras {
  const ativas = cadeiras.filter((c) => c.ativa);

  const emAndamento = sessoes.filter(
    (s) => s.estado !== 'CONCLUIDA' && s.estado !== 'CANCELADA',
  );

  const porCadeira: OcupacaoDaCadeira[] = ativas
    .map((cadeira) => {
      const sessao =
        emAndamento.find(
          (s) => s.cadeiraId === cadeira.id && estadoDaCadeira(s) !== 'DISPONIVEL',
        ) ?? null;

      return {
        cadeira,
        estado: estadoDaCadeira(sessao),
        sessaoAtual: sessao,
        livreEm: sessao ? sessao.previsaoDeFim : null,
      };
    })
    .sort((a, b) => a.cadeira.numero - b.cadeira.numero);

  const contar = (estado: EstadoDaCadeira) =>
    porCadeira.filter((o) => o.estado === estado).length;

  const disponiveis = contar('DISPONIVEL');
  const total = porCadeira.length;

  /* Tempo médio de ocupação: só sessões que começaram E terminaram. Incluir as em
     curso puxaria a média para baixo, porque uma sessão que começou há dez minutos
     entraria valendo dez minutos. */
  const duracoes = sessoes
    .filter((s) => s.inicioReal && s.fimReal)
    .map((s) => minutosEntre(s.inicioReal as string, s.fimReal as string))
    .filter((m): m is number => m != null && m > 0);

  const tempoMedioDeOcupacaoEmMinutos =
    duracoes.length > 0
      ? Math.round(duracoes.reduce((soma, m) => soma + m, 0) / duracoes.length)
      : null;

  /* Atraso acumulado: só o que JÁ aconteceu. Sessão que ainda não começou não tem
     atraso, tem previsão — e somar previsão como atraso inventaria um número que a
     coordenação usaria para tomar decisão real. */
  const atrasoAcumuladoEmMinutos = sessoes
    .filter((s) => s.inicioReal)
    .map((s) => minutosEntre(s.previsaoDeInicio, s.inicioReal as string))
    .filter((m): m is number => m != null && m > 0)
    .reduce((soma, m) => soma + m, 0);

  /* Próxima cadeira livre: a que se libera primeiro. Se já existe alguma disponível,
     não há "próxima" — a resposta é agora, e a tela diz isso de outro jeito. */
  const proximaCadeiraLivreEm =
    disponiveis > 0
      ? null
      : (porCadeira
          .map((o) => o.livreEm)
          .filter((quando): quando is string => quando != null)
          .sort()[0] ?? null);

  return {
    total,
    ocupadas: contar('OCUPADA'),
    emPreparo: contar('EM_PREPARO'),
    aguardandoMedicacao: contar('AGUARDANDO_MEDICACAO'),
    emObservacao: contar('EM_OBSERVACAO'),
    disponiveis,
    taxaDeOcupacao: total > 0 ? Math.round(((total - disponiveis) / total) * 100) : 0,
    tempoMedioDeOcupacaoEmMinutos,
    proximaCadeiraLivreEm,
    atrasoAcumuladoEmMinutos,
    porCadeira,
  };
}

export interface JanelaLivre {
  readonly cadeiraId: string;
  readonly numero: number;
  readonly de: string;
  readonly ate: string;
  readonly minutos: number;
}

/**
 * Onde ainda cabe alguém hoje.
 *
 * Percorre as sessões já marcadas de cada cadeira e devolve os vãos entre elas, dentro
 * do expediente. É a resposta a "capacidade disponível: 1 cadeira entre 15h10 e 17h",
 * que é uma pergunta que o agendamento convencional não sabe fazer porque não conhece
 * a duração real de nada.
 *
 * Janelas menores que `minimoEmMinutos` são descartadas: vão de 20 minutos entre dois
 * pacientes não é capacidade, é ilusão de capacidade.
 */
export function encontrarJanelasLivres(
  cadeiras: readonly CadeiraDisponivel[],
  sessoes: readonly SessaoNaCadeira[],
  inicioDoExpediente: Date,
  fimDoExpediente: Date,
  minimoEmMinutos = 60,
): readonly JanelaLivre[] {
  const janelas: JanelaLivre[] = [];

  for (const cadeira of cadeiras.filter((c) => c.ativa)) {
    const ocupacoes = sessoes
      .filter((s) => s.cadeiraId === cadeira.id && s.estado !== 'CANCELADA')
      .map((s) => ({
        inicio: new Date(s.previsaoDeInicio),
        fim: new Date(s.previsaoDeFim),
      }))
      .filter((o) => !Number.isNaN(o.inicio.getTime()) && !Number.isNaN(o.fim.getTime()))
      .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

    let cursor = inicioDoExpediente;

    for (const ocupacao of ocupacoes) {
      if (ocupacao.inicio > cursor) {
        const minutos = Math.round(
          (ocupacao.inicio.getTime() - cursor.getTime()) / 60000,
        );
        if (minutos >= minimoEmMinutos) {
          janelas.push({
            cadeiraId: cadeira.id,
            numero: cadeira.numero,
            de: cursor.toISOString(),
            ate: ocupacao.inicio.toISOString(),
            minutos,
          });
        }
      }
      /* Sessões podem se sobrepor por erro de cadastro. O cursor nunca anda para trás,
         senão a mesma janela sairia duas vezes. */
      if (ocupacao.fim > cursor) cursor = ocupacao.fim;
    }

    if (cursor < fimDoExpediente) {
      const minutos = Math.round(
        (fimDoExpediente.getTime() - cursor.getTime()) / 60000,
      );
      if (minutos >= minimoEmMinutos) {
        janelas.push({
          cadeiraId: cadeira.id,
          numero: cadeira.numero,
          de: cursor.toISOString(),
          ate: fimDoExpediente.toISOString(),
          minutos,
        });
      }
    }
  }

  return janelas.sort(
    (a, b) => new Date(a.de).getTime() - new Date(b.de).getTime() || a.numero - b.numero,
  );
}
