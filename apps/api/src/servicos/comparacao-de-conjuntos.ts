import type { ConjuntoDeLimiares, RegraDeLimiar } from '@aurea/contratos';

/**
 * Diferença entre duas versões do algoritmo.
 *
 * Não é enfeite de interface: é o que responde, na defesa, "o que mudou quando o corte
 * de febre desceu de 38,5 para 38,0". Sem isso, publicar conjunto novo é um ato cego —
 * ninguém consegue dizer depois qual regra entrou, qual saiu e qual mudou de valor.
 */

export interface RegraAlterada {
  readonly sintoma: string;
  readonly campo: string;
  readonly antes: string;
  readonly depois: string;
}

export interface DiferencaDeConjuntos {
  readonly de: { readonly versao: string; readonly regras: number };
  readonly para: { readonly versao: string; readonly regras: number };
  readonly entraram: readonly string[];
  readonly sairam: readonly string[];
  readonly mudaram: readonly RegraAlterada[];
  readonly politica: readonly RegraAlterada[];
  readonly semDiferenca: boolean;
  /** Cadastro duplicado em algum dos dois lados. Não afeta o diff, mas precisa aparecer. */
  readonly regrasRepetidas: readonly string[];
}

/**
 * Identidade de uma regra para fins de comparação.
 *
 * Não usa o id: id é da linha, e a linha é nova a cada importação. O que identifica uma
 * regra entre versões é o que ela decide.
 *
 * A cor e os valores de texto entram na identidade, e isso custou um defeito para ficar
 * claro: sem eles, as duas regras de falta de ar do conjunto de demonstração — "ao
 * caminhar → amarelo" e "ao falar ou em repouso → vermelho" — colapsavam numa chave só,
 * e o diff dizia que 12 regras haviam saído quando eram 13. Um comparador que perde
 * regra em silêncio é pior que comparador nenhum, porque dá confiança falsa justamente
 * na hora de publicar corte clínico.
 *
 * O efeito colateral é deliberado: regra que muda de cor aparece como uma saindo e outra
 * entrando, não como alteração. Mudar a cor de um corte é decisão diferente de mudar o
 * valor dele, e merece leitura separada.
 */
function identidade(regra: RegraDeLimiar): string {
  const janela = `${regra.diaDoCicloMinimo ?? '*'}..${regra.diaDoCicloMaximo ?? '*'}`;
  const textos = [...(regra.valoresDeTexto ?? [])].sort().join(',') || '*';

  return [
    regra.sintoma,
    regra.campo,
    regra.operador,
    regra.classificacao,
    textos,
    regra.protocoloId ?? '*',
    janela,
  ].join('|');
}

/**
 * Duas regras com a mesma identidade dentro do mesmo conjunto são cadastro duplicado:
 * a segunda nunca acrescenta nada ao resultado e some do diff. Vale avisar em vez de
 * engolir.
 */
function identidadesRepetidas(conjunto: ConjuntoDeLimiares): string[] {
  const vistas = new Set<string>();
  const repetidas = new Set<string>();

  for (const regra of conjunto.regras) {
    const chave = identidade(regra);
    if (vistas.has(chave)) repetidas.add(descreverRegra(regra));
    vistas.add(chave);
  }

  return [...repetidas];
}

const NOME_DO_OPERADOR: Record<string, string> = {
  MAIOR_OU_IGUAL: 'a partir de',
  MAIOR_QUE: 'acima de',
  MENOR_OU_IGUAL: 'até',
  MENOR_QUE: 'abaixo de',
  IGUAL: 'igual a',
  ENTRE: 'entre',
  E_VERDADEIRO: 'quando sim',
  E_FALSO: 'quando não',
  ESTA_EM: 'quando for',
};

/**
 * A regra em português. É o que o orientador confere — ninguém revisa corte clínico
 * lendo `{operador: "ENTRE", valor: 37.8}`.
 */
export function descreverRegra(regra: RegraDeLimiar): string {
  const operador = NOME_DO_OPERADOR[regra.operador] ?? regra.operador;

  const valor =
    regra.operador === 'ENTRE'
      ? `${formatar(regra.valor)} e ${formatar(regra.valorSecundario)}`
      : regra.operador === 'ESTA_EM' || (regra.operador === 'IGUAL' && regra.valoresDeTexto)
        ? (regra.valoresDeTexto ?? []).join(' ou ')
        : formatar(regra.valor);

  const janela =
    regra.diaDoCicloMinimo != null || regra.diaDoCicloMaximo != null
      ? `, do dia ${regra.diaDoCicloMinimo ?? 0} ao ${regra.diaDoCicloMaximo ?? '∞'} do ciclo`
      : '';

  const protocolo = regra.protocoloId ? ', só neste protocolo' : '';

  return `${regra.campo} ${operador} ${valor}${janela}${protocolo} → ${regra.classificacao.toLowerCase()}`;
}

function formatar(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return String(valor).replace('.', ',');
}

export function compararConjuntos(
  de: ConjuntoDeLimiares,
  para: ConjuntoDeLimiares,
): DiferencaDeConjuntos {
  const antes = new Map(de.regras.map((regra) => [identidade(regra), regra]));
  const depois = new Map(para.regras.map((regra) => [identidade(regra), regra]));

  const entraram: string[] = [];
  const sairam: string[] = [];
  const mudaram: RegraAlterada[] = [];

  for (const [chave, regra] of depois) {
    const anterior = antes.get(chave);
    if (!anterior) {
      entraram.push(descreverRegra(regra));
      continue;
    }

    const descricaoAnterior = descreverRegra(anterior);
    const descricaoAtual = descreverRegra(regra);

    if (descricaoAnterior !== descricaoAtual) {
      mudaram.push({
        sintoma: regra.sintoma,
        campo: regra.campo,
        antes: descricaoAnterior,
        depois: descricaoAtual,
      });
    }
  }

  for (const [chave, regra] of antes) {
    if (!depois.has(chave)) sairam.push(descreverRegra(regra));
  }

  const politica: RegraAlterada[] = [];
  const chavesDePolitica = ['combinacao', 'efeitoDoAntitermico', 'tratamentoDeAbandono'] as const;

  for (const chave of chavesDePolitica) {
    if (de.politica[chave] !== para.politica[chave]) {
      politica.push({
        sintoma: '—',
        campo: chave,
        antes: de.politica[chave],
        depois: para.politica[chave],
      });
    }
  }

  return {
    de: { versao: de.versao, regras: de.regras.length },
    para: { versao: para.versao, regras: para.regras.length },
    entraram,
    sairam,
    mudaram,
    politica,
    semDiferenca:
      entraram.length === 0 && sairam.length === 0 && mudaram.length === 0 && politica.length === 0,
    regrasRepetidas: [...identidadesRepetidas(de), ...identidadesRepetidas(para)],
  };
}
