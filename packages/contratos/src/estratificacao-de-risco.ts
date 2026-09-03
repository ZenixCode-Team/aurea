/**
 * Blocos 2 e 8 dos prints — estratificação de risco do paciente.
 *
 * ## ⚠️ RASCUNHO NÃO VALIDADO CLINICAMENTE
 *
 * Os pesos abaixo NÃO vieram de literatura, de protocolo do serviço nem de orientador.
 * Vieram das quatro categorias que os prints listam (clínico, tratamento, social,
 * assistencial) e de uma distribuição plausível dentro dos cortes que os prints já
 * fixam: baixa 0-3, média 4-7, alta 8 ou mais. São valores DE DEMONSTRAÇÃO, e a tela
 * é obrigada a dizer isso enquanto `VERSAO_DOS_PESOS` continuar marcada como rascunho.
 *
 * A mesma regra que vale para o conjunto de limiares da triagem vale aqui: número que
 * classifica pessoa precisa de alguém que assine. Até lá isto orienta a ordem de
 * trabalho e não substitui julgamento clínico.
 *
 * ## Por que a pontuação é explicável, item por item
 *
 * O motor devolve os FATORES, não só o total. Um número de 0 a 15 sem decomposição é
 * a definição de caixa-preta, e o mesmo argumento que obriga a mostrar a regra que
 * classificou o sintoma obriga a mostrar o que compôs o risco. Quem discorda de um
 * fator precisa conseguir apontar qual.
 *
 * ## Ausência não pontua
 *
 * ECOG não avaliado vale zero, não vale 4. Contexto social não perguntado vale zero,
 * não conta como "sem rede de apoio". Sem isso, todo paciente recém-cadastrado nasceria
 * em risco alto por não ter cadastro — que é o inverso do que a estratificação serve.
 */

export const VERSAO_DOS_PESOS = 'rascunho-0';

/** Enquanto for rascunho, a tela mostra o selo de não validado. */
export const PESOS_VALIDADOS_CLINICAMENTE = false;

export type ECOG = 'ZERO' | 'UM' | 'DOIS' | 'TRES' | 'QUATRO' | 'NAO_AVALIADO';

export type NivelDeRisco = 'BAIXO' | 'MEDIO' | 'ALTO';

/** Os cortes dos prints: 0-3 baixa, 4-7 média, 8+ alta. */
export const CORTE_DE_RISCO_MEDIO = 4;
export const CORTE_DE_RISCO_ALTO = 8;

export type CategoriaDeFator = 'clinico' | 'tratamento' | 'social' | 'assistencial';

export interface FatorDeRisco {
  readonly categoria: CategoriaDeFator;
  readonly descricao: string;
  readonly pontos: number;
}

export interface DadosDaEstratificacao {
  // --- Clínico
  readonly ecog?: ECOG | null;
  readonly dataNascimento?: string | null;
  readonly quantidadeDeComorbidades?: number;
  readonly internadoAte?: string | null;
  /** Quantas classificações vermelhas o paciente teve nos últimos 90 dias. */
  readonly toxicidadesGravesRecentes?: number;

  // --- Tratamento
  readonly protocolo?: {
    readonly imunoterapia?: boolean;
    readonly altoRiscoDeNeutropenia?: boolean;
    readonly bombaInfusora?: boolean;
    readonly tratamentoOral?: boolean;
  } | null;
  /** Primeira aplicação: sem histórico de tolerância, tudo é desconhecido. */
  readonly primeiraAplicacao?: boolean;

  // --- Social
  readonly moraSozinho?: boolean;
  readonly dificuldadeDeTransporte?: boolean;
  readonly temCuidador?: boolean;
  /** Nulo quer dizer que ninguém perguntou. Os três acima só pontuam se isto existir. */
  readonly contextoSocialAvaliadoEm?: string | null;

  // --- Assistencial
  readonly faltasRecentes?: number;
  /** Fração de check-ins respondidos nos últimos 30 dias, de 0 a 1. */
  readonly adesao?: number | null;
  readonly contatosRecentes?: number;
}

export interface ResultadoDaEstratificacao {
  readonly pontuacao: number;
  readonly nivel: NivelDeRisco;
  readonly fatores: readonly FatorDeRisco[];
  readonly versaoDosPesos: string;
  readonly validadoClinicamente: boolean;
  /** Falso quando falta cadastro demais para o número significar alguma coisa. */
  readonly baseSuficiente: boolean;
}

export const ROTULO_DO_NIVEL_DE_RISCO: Record<NivelDeRisco, string> = {
  BAIXO: 'Baixo risco',
  MEDIO: 'Médio risco',
  ALTO: 'Alto risco',
};

function idadeEm(dataNascimento: string, hoje: Date): number | null {
  const nascimento = new Date(dataNascimento);
  if (Number.isNaN(nascimento.getTime())) return null;
  let idade = hoje.getUTCFullYear() - nascimento.getUTCFullYear();
  const mes = hoje.getUTCMonth() - nascimento.getUTCMonth();
  if (mes < 0 || (mes === 0 && hoje.getUTCDate() < nascimento.getUTCDate())) idade -= 1;
  return idade >= 0 && idade < 130 ? idade : null;
}

function diasDesde(quando: string, hoje: Date): number | null {
  const data = new Date(quando);
  if (Number.isNaN(data.getTime())) return null;
  const umDia = 24 * 60 * 60 * 1000;
  const a = Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
  const b = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  return Math.floor((b - a) / umDia);
}

/** ECOG 0 e 1 não pontuam: são desempenho preservado. */
const PONTOS_DO_ECOG: Record<Exclude<ECOG, 'NAO_AVALIADO'>, number> = {
  ZERO: 0,
  UM: 0,
  DOIS: 2,
  TRES: 3,
  QUATRO: 4,
};

export function estratificarRisco(
  dados: DadosDaEstratificacao,
  hoje: Date = new Date(),
): ResultadoDaEstratificacao {
  const fatores: FatorDeRisco[] = [];

  // ---------------------------------------------------------------- clínico
  if (dados.ecog && dados.ecog !== 'NAO_AVALIADO') {
    const pontos = PONTOS_DO_ECOG[dados.ecog];
    if (pontos > 0) {
      fatores.push({
        categoria: 'clinico',
        descricao: `ECOG ${dados.ecog === 'DOIS' ? 2 : dados.ecog === 'TRES' ? 3 : 4}`,
        pontos,
      });
    }
  }

  if (dados.dataNascimento) {
    const idade = idadeEm(dados.dataNascimento, hoje);
    /* 75 anos, e não 65: o corte mais alto é o que a literatura de oncologia
       geriátrica costuma usar para rastreio, e um corte baixo demais colocaria metade
       da coorte em risco elevado, o que não estratifica nada. */
    if (idade != null && idade >= 75) {
      fatores.push({ categoria: 'clinico', descricao: `${idade} anos`, pontos: 2 });
    }
  }

  const comorbidades = dados.quantidadeDeComorbidades ?? 0;
  if (comorbidades > 0) {
    fatores.push({
      categoria: 'clinico',
      descricao:
        comorbidades === 1 ? '1 comorbidade' : `${comorbidades} comorbidades`,
      /* Teto de 2: a terceira comorbidade não dobra o risco da segunda, e sem teto
         um paciente com cadastro detalhado pontuaria mais que um sem cadastro. */
      pontos: Math.min(comorbidades, 2),
    });
  }

  if (dados.internadoAte) {
    const dias = diasDesde(dados.internadoAte, hoje);
    if (dias != null && dias >= 0 && dias <= 30) {
      fatores.push({
        categoria: 'clinico',
        descricao: dias <= 7 ? 'internação na última semana' : 'internação no último mês',
        pontos: dias <= 7 ? 3 : 1,
      });
    }
  }

  const toxicidades = dados.toxicidadesGravesRecentes ?? 0;
  if (toxicidades > 0) {
    fatores.push({
      categoria: 'clinico',
      descricao:
        toxicidades === 1
          ? '1 toxicidade grave recente'
          : `${toxicidades} toxicidades graves recentes`,
      pontos: Math.min(toxicidades, 3),
    });
  }

  // ------------------------------------------------------------- tratamento
  const protocolo = dados.protocolo;
  if (protocolo?.altoRiscoDeNeutropenia) {
    fatores.push({
      categoria: 'tratamento',
      descricao: 'protocolo com alto risco de neutropenia',
      pontos: 2,
    });
  }
  if (protocolo?.imunoterapia) {
    fatores.push({ categoria: 'tratamento', descricao: 'imunoterapia', pontos: 1 });
  }
  if (protocolo?.bombaInfusora) {
    fatores.push({ categoria: 'tratamento', descricao: 'bomba infusora', pontos: 1 });
  }
  /* Tratamento oral NÃO é mais seguro: o paciente administra sozinho em casa, sem
     ninguém conferindo adesão nem efeito. É por isso que pontua em vez de descontar. */
  if (protocolo?.tratamentoOral) {
    fatores.push({
      categoria: 'tratamento',
      descricao: 'tratamento oral, administrado em casa',
      pontos: 1,
    });
  }
  if (dados.primeiraAplicacao) {
    fatores.push({
      categoria: 'tratamento',
      descricao: 'primeira aplicação, sem histórico de tolerância',
      pontos: 2,
    });
  }

  // ------------------------------------------------------------------ social
  /* Os três só pontuam quando alguém de fato perguntou. Ver o comentário do topo. */
  if (dados.contextoSocialAvaliadoEm) {
    if (dados.moraSozinho) {
      fatores.push({ categoria: 'social', descricao: 'mora sozinho', pontos: 2 });
    }
    if (dados.dificuldadeDeTransporte) {
      fatores.push({
        categoria: 'social',
        descricao: 'dificuldade de transporte',
        pontos: 2,
      });
    }
    if (!dados.temCuidador) {
      fatores.push({ categoria: 'social', descricao: 'sem cuidador', pontos: 2 });
    }
  }

  // ------------------------------------------------------------ assistencial
  const faltas = dados.faltasRecentes ?? 0;
  if (faltas > 0) {
    fatores.push({
      categoria: 'assistencial',
      descricao: faltas === 1 ? '1 falta recente' : `${faltas} faltas recentes`,
      pontos: Math.min(faltas, 2),
    });
  }

  if (dados.adesao != null && dados.adesao < 0.5) {
    fatores.push({
      categoria: 'assistencial',
      descricao: `respondeu ${Math.round(dados.adesao * 100)}% dos check-ins`,
      pontos: 2,
    });
  }

  const contatos = dados.contatosRecentes ?? 0;
  /* Três ou mais contatos em pouco tempo é sinal de que algo não se resolveu, e não
     de paciente "que liga muito". */
  if (contatos >= 3) {
    fatores.push({
      categoria: 'assistencial',
      descricao: `${contatos} contatos recentes`,
      pontos: 1,
    });
  }

  const pontuacao = fatores.reduce((total, fator) => total + fator.pontos, 0);

  const nivel: NivelDeRisco =
    pontuacao >= CORTE_DE_RISCO_ALTO
      ? 'ALTO'
      : pontuacao >= CORTE_DE_RISCO_MEDIO
        ? 'MEDIO'
        : 'BAIXO';

  /* Sem ECOG e sem avaliação social, o que sobra é protocolo e histórico — metade da
     conta. A tela precisa dizer isso em vez de mostrar "baixo risco" com confiança. */
  const baseSuficiente =
    (dados.ecog != null && dados.ecog !== 'NAO_AVALIADO') &&
    dados.contextoSocialAvaliadoEm != null;

  return {
    pontuacao,
    nivel,
    fatores,
    versaoDosPesos: VERSAO_DOS_PESOS,
    validadoClinicamente: PESOS_VALIDADOS_CLINICAMENTE,
    baseSuficiente,
  };
}
