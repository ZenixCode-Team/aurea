/**
 * Bloco 5 dos prints — indicadores de toxicidade.
 *
 * Responde duas perguntas de gestão que hoje ninguém consegue responder sem abrir
 * paciente por paciente: **o que mais apareceu nos últimos 30 dias**, e **qual sintoma
 * cada protocolo produz**. A segunda é a que os prints chamam de inteligência
 * assistencial, e com razão: saber que FOLFOX produz diarreia muda o que a enfermagem
 * pergunta antes mesmo de a pessoa reclamar.
 *
 * ## Três regras
 *
 * 1. **Isto NÃO é classificação de paciente.** É contagem de operação. A tela usa a
 *    paleta de dados do ADR-005 (fria, matiz entre 185° e 330°), nunca `--color-risco-*`.
 *    Barra de gráfico com cor de escala clínica seria lida como gravidade, e a regra 3
 *    do ADR-005 existe exatamente para impedir isso.
 * 2. **Percentual precisa de denominador visível.** "Náusea: 40%" sem dizer 40% de quê
 *    é número que mente por omissão. Toda taxa aqui vem acompanhada do total.
 * 3. **Amostra pequena é dita, não escondida.** Três sessões num protocolo produzem
 *    percentuais de 33% e 66% que parecem precisos e não são. O corte é declarado, não
 *    presumido.
 */

import type { Classificacao } from './classificacao.js';
import type { Sintoma } from './sintomas.js';

/** Abaixo disto o percentual é ruído, e a tela precisa dizer isso. */
export const MINIMO_PARA_PERCENTUAL_CONFIAVEL = 10;

export interface OcorrenciaDeSintoma {
  readonly sintoma: Sintoma;
  /** A classificação daquele sintoma naquela sessão. */
  readonly classificacao: Classificacao;
  readonly protocolo: string | null;
  /**
   * Identidade da sessão que produziu a ocorrência.
   *
   * Separado de `quando` porque as duas coisas respondem perguntas diferentes: a data
   * decide se a ocorrência entra na janela, o id decide se duas ocorrências vieram do
   * mesmo check-in. Juntar as duas num campo só fazia três sintomas do mesmo dia
   * contarem como três sessões — ou, quando a data era normalizada, todas as sessões
   * do mês colapsarem em uma.
   */
  readonly sessaoId: string;
  readonly quando: string;
}

export interface TaxaDeSintoma {
  readonly sintoma: Sintoma;
  /** Em quantas sessões o sintoma apareceu com classificação amarela ou vermelha. */
  readonly ocorrencias: number;
  readonly totalDeSessoes: number;
  /** 0 a 100, arredondado. */
  readonly percentual: number;
}

export interface ToxicidadePorProtocolo {
  readonly protocolo: string;
  readonly totalDeSessoes: number;
  readonly sintomaMaisFrequente: Sintoma | null;
  readonly ocorrenciasDoMaisFrequente: number;
  /** Falso quando a amostra é pequena demais para o percentual significar algo. */
  readonly amostraSuficiente: boolean;
}

export interface IndicadoresDeToxicidade {
  readonly diasConsiderados: number;
  readonly totalDeSessoes: number;
  readonly taxas: readonly TaxaDeSintoma[];
  readonly porProtocolo: readonly ToxicidadePorProtocolo[];
  readonly amostraSuficiente: boolean;
}

/**
 * Um sintoma "aconteceu" quando foi classificado como amarelo ou vermelho.
 *
 * Verde não entra na contagem, e isso é decisão de leitura, não economia: a pergunta
 * do bloco é quanta TOXICIDADE o serviço viu, e sintoma dentro do limiar não é evento
 * de toxicidade. Contá-lo faria todo protocolo aparecer com 100% de tudo.
 */
function contou(ocorrencia: OcorrenciaDeSintoma): boolean {
  return (
    ocorrencia.classificacao === 'AMARELO' || ocorrencia.classificacao === 'VERMELHO'
  );
}

function dentroDaJanela(quando: string, hoje: Date, dias: number): boolean {
  const data = new Date(quando);
  if (Number.isNaN(data.getTime())) return false;
  const limite = new Date(hoje.getTime() - dias * 24 * 60 * 60 * 1000);
  return data >= limite && data <= hoje;
}

/**
 * Monta os indicadores.
 *
 * `totalDeSessoes` é o denominador de TODAS as taxas: quantas sessões concluídas
 * houve na janela, e não quantas ocorrências. Sem isso, "40%" seria a fatia do sintoma
 * dentro das ocorrências, que é outro número e leva a outra conclusão.
 */
export function montarIndicadoresDeToxicidade(
  ocorrencias: readonly OcorrenciaDeSintoma[],
  totalDeSessoes: number,
  hoje: Date = new Date(),
  diasConsiderados = 30,
): IndicadoresDeToxicidade {
  const naJanela = ocorrencias.filter(
    (o) => contou(o) && dentroDaJanela(o.quando, hoje, diasConsiderados),
  );

  const porSintoma = new Map<Sintoma, number>();
  for (const ocorrencia of naJanela) {
    porSintoma.set(ocorrencia.sintoma, (porSintoma.get(ocorrencia.sintoma) ?? 0) + 1);
  }

  const taxas: TaxaDeSintoma[] = [...porSintoma.entries()]
    .map(([sintoma, contagem]) => ({
      sintoma,
      ocorrencias: contagem,
      totalDeSessoes,
      percentual:
        totalDeSessoes > 0 ? Math.round((contagem / totalDeSessoes) * 100) : 0,
    }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias || a.sintoma.localeCompare(b.sintoma));

  /* Sessões por protocolo, contadas pelo par sessão-protocolo e não por ocorrência:
     uma sessão com três sintomas é UMA sessão, e contá-la três vezes inflaria o
     denominador de quem tem paciente mais sintomático. */
  const sessoesPorProtocolo = new Map<string, Set<string>>();
  const contagemPorProtocolo = new Map<string, Map<Sintoma, number>>();

  for (const ocorrencia of naJanela) {
    const protocolo = ocorrencia.protocolo;
    if (!protocolo) continue;

    if (!sessoesPorProtocolo.has(protocolo)) sessoesPorProtocolo.set(protocolo, new Set());
    sessoesPorProtocolo.get(protocolo)!.add(ocorrencia.sessaoId);

    if (!contagemPorProtocolo.has(protocolo)) contagemPorProtocolo.set(protocolo, new Map());
    const mapa = contagemPorProtocolo.get(protocolo)!;
    mapa.set(ocorrencia.sintoma, (mapa.get(ocorrencia.sintoma) ?? 0) + 1);
  }

  const porProtocolo: ToxicidadePorProtocolo[] = [...contagemPorProtocolo.entries()]
    .map(([protocolo, mapa]) => {
      const ordenados = [...mapa.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      );
      const total = sessoesPorProtocolo.get(protocolo)?.size ?? 0;
      const topo = ordenados[0];

      return {
        protocolo,
        totalDeSessoes: total,
        sintomaMaisFrequente: topo?.[0] ?? null,
        ocorrenciasDoMaisFrequente: topo?.[1] ?? 0,
        amostraSuficiente: total >= MINIMO_PARA_PERCENTUAL_CONFIAVEL,
      };
    })
    .sort((a, b) => b.totalDeSessoes - a.totalDeSessoes || a.protocolo.localeCompare(b.protocolo));

  return {
    diasConsiderados,
    totalDeSessoes,
    taxas,
    porProtocolo,
    amostraSuficiente: totalDeSessoes >= MINIMO_PARA_PERCENTUAL_CONFIAVEL,
  };
}
