import {
  buscarCampo,
  buscarRamo,
  camposDoRamo,
  gravidadeDe,
  piorEntre,
  CLASSIFICACOES,
  type AjusteDaPolitica,
  type Classificacao,
  type ClassificacaoPorSintoma,
  type ConjuntoDeLimiares,
  type RegraDeLimiar,
  type RegraDisparada,
  type SaidaDaClassificacao,
  type Sintoma,
} from '@aurea/contratos';

/** Uma resposta crua já lida do banco, pronta para o motor. */
export interface RespostaCrua {
  readonly sintoma: Sintoma;
  readonly campo: string;
  readonly valorNumerico?: number | null;
  readonly valorBooleano?: boolean | null;
  readonly valorTexto?: string | null;
}

export interface ContextoDaClassificacao {
  /**
   * Quantos dias desde a sessão de quimioterapia. Derivado da data de início do ciclo,
   * nunca gravado — dia do ciclo guardado em coluna nasce desatualizado no dia seguinte.
   * `null` quando o paciente não tem ciclo aberto.
   */
  readonly diaDoCiclo: number | null;
  readonly protocoloId: string | null;
  /** Verdadeiro quando o paciente parou no meio do questionário. */
  readonly sessaoAbandonada: boolean;
}

type ValorObservado = number | string | boolean | null;

/**
 * Classifica uma sessão de triagem.
 *
 * Função pura: mesmas respostas e mesmo conjunto de limiares produzem sempre o mesmo
 * resultado, sem banco, sem relógio, sem rede. É o que torna possível reprocessar o
 * histórico inteiro sob um conjunto novo e comparar — que é o experimento da dissertação,
 * não um detalhe de implementação.
 *
 * O motor não conhece febre, diarreia nem neutropenia. Ele compara valores contra cortes
 * que vieram da tabela. Todo o conhecimento clínico está no conjunto de limiares.
 */
export function classificar(
  respostas: readonly RespostaCrua[],
  conjunto: ConjuntoDeLimiares,
  contexto: ContextoDaClassificacao,
): SaidaDaClassificacao {
  const sintomasRespondidos = [...new Set(respostas.map((resposta) => resposta.sintoma))];

  if (contexto.sessaoAbandonada && conjunto.politica.tratamentoDeAbandono === 'NAO_CLASSIFICAR') {
    return {
      situacao: 'NAO_CLASSIFICADA',
      motivo: 'Questionário não foi concluído e a política do conjunto é não classificar parcial.',
      conjuntoDeLimiaresId: conjunto.id,
      versaoDoConjunto: conjunto.versao,
      sintomasRespondidos,
    };
  }

  const indice = indexar(respostas);
  const porSintoma: ClassificacaoPorSintoma[] = [];

  const incompletos: Sintoma[] = [];

  for (const sintoma of sintomasRespondidos) {
    const disparadas: RegraDisparada[] = [];

    for (const regra of conjunto.regras) {
      if (regra.sintoma !== sintoma) continue;
      if (!regraSeAplica(regra, contexto)) continue;

      const valor = indice.get(chave(regra.sintoma, regra.campo));
      if (valor === undefined) continue;

      if (avaliar(regra, valor)) {
        disparadas.push({
          regraId: regra.id,
          sintoma: regra.sintoma,
          campo: regra.campo,
          valorObservado: valor,
          classificacao: regra.classificacao,
          justificativa: regra.justificativa,
        });
      }
    }

    disparadas.sort((a, b) => gravidadeDe(b.classificacao) - gravidadeDe(a.classificacao));

    /**
     * Quando NENHUMA regra dispara, "verde" é uma conclusão, não um valor de partida —
     * e só é honesta se o ramo foi respondido inteiro.
     *
     * Quem respondeu "tive febre" e parou antes de informar a temperatura não é verde:
     * é desconhecido. Sob a política `PIOR_DOS_RESPONDIDOS`, esse caso era gravado como
     * VERDE, que é exatamente a leitura de "silêncio é verde" que este sistema existe
     * para não fazer.
     *
     * Já quem informou 39 °C e não disse se tomou antitérmico TEM regra disparada. Aí
     * há evidência positiva de risco, e faltar um campo de detalhe não torna o quadro
     * mais seguro — recusar a classificação nesse caso silenciaria um vermelho real.
     * Por isso a conferência de completude só vale quando nada disparou.
     */
    if (disparadas.length === 0 && !ramoCompleto(sintoma, indice)) {
      incompletos.push(sintoma);
      continue;
    }

    porSintoma.push({
      sintoma,
      classificacao: disparadas.reduce<Classificacao>(
        (pior, disparada) => piorEntre(pior, disparada.classificacao),
        'VERDE',
      ),
      regrasDisparadas: disparadas,
    });
  }

  if (porSintoma.length === 0) {
    return {
      situacao: 'NAO_CLASSIFICADA',
      motivo: 'Nenhum sintoma foi respondido por completo; não há o que avaliar.',
      conjuntoDeLimiaresId: conjunto.id,
      versaoDoConjunto: conjunto.versao,
      sintomasRespondidos,
    };
  }

  const { resultado, ajustes } = aplicarPolitica(porSintoma, indice, conjunto);

  return {
    situacao: 'CLASSIFICADA',
    resultado,
    conjuntoDeLimiaresId: conjunto.id,
    versaoDoConjunto: conjunto.versao,
    validadoClinicamente: conjunto.validadoClinicamente,
    explicacao: {
      porSintoma,
      ajustesDaPolitica: ajustes,
      sintomasNaoRespondidos: [
        ...naoRespondidos(sintomasRespondidos, conjunto),
        // Tocado e não terminado conta como não respondido para quem lê a explicação:
        // a enfermagem precisa saber que a classificação foi feita sem aquele dado.
        ...incompletos,
      ],
      diaDoCiclo: contexto.diaDoCiclo,
      protocoloId: contexto.protocoloId,
    },
  };
}

/**
 * Um ramo está completo quando a porta foi respondida e, se ela abriu, todos os
 * detalhes que ela liberou também têm resposta. Ramo com a porta em "não" está
 * completo com uma resposta só — é o que torna o check-in diário viável.
 */
function ramoCompleto(sintoma: Sintoma, indice: Map<string, ValorObservado>): boolean {
  const ramo = buscarRamo(sintoma);
  const porta = indice.get(chave(sintoma, ramo.porta.campo));

  if (porta === undefined) return false;
  if (porta !== true) return true;

  for (const definicao of camposDoRamo(ramo)) {
    if (definicao.campo === ramo.porta.campo) continue;

    if (definicao.dependeDe) {
      const dependencia = indice.get(chave(sintoma, definicao.dependeDe.campo));
      if (dependencia !== definicao.dependeDe.valor) continue;
    }

    if (indice.get(chave(sintoma, definicao.campo)) === undefined) return false;
  }

  return true;
}

function chave(sintoma: Sintoma, campo: string): string {
  return `${sintoma}.${campo}`;
}

function indexar(respostas: readonly RespostaCrua[]): Map<string, ValorObservado> {
  const indice = new Map<string, ValorObservado>();

  for (const resposta of respostas) {
    const valor =
      resposta.valorNumerico ?? resposta.valorBooleano ?? resposta.valorTexto ?? null;
    indice.set(chave(resposta.sintoma, resposta.campo), valor);
  }

  return indice;
}

function regraSeAplica(regra: RegraDeLimiar, contexto: ContextoDaClassificacao): boolean {
  if (regra.protocoloId && regra.protocoloId !== contexto.protocoloId) return false;

  const temJanela = regra.diaDoCicloMinimo != null || regra.diaDoCicloMaximo != null;
  if (!temJanela) return true;

  // Regra com janela de ciclo não se aplica a quem não tem ciclo aberto: sem o dia,
  // não há como afirmar que a pessoa está dentro da janela de maior vulnerabilidade.
  if (contexto.diaDoCiclo == null) return false;
  if (regra.diaDoCicloMinimo != null && contexto.diaDoCiclo < regra.diaDoCicloMinimo) return false;
  if (regra.diaDoCicloMaximo != null && contexto.diaDoCiclo > regra.diaDoCicloMaximo) return false;

  return true;
}

function avaliar(regra: RegraDeLimiar, valor: ValorObservado): boolean {
  switch (regra.operador) {
    case 'E_VERDADEIRO':
      return valor === true;
    case 'E_FALSO':
      return valor === false;
    case 'ESTA_EM':
      return typeof valor === 'string' && (regra.valoresDeTexto?.includes(valor) ?? false);
    case 'IGUAL':
      if (typeof valor === 'string') return regra.valoresDeTexto?.includes(valor) ?? false;
      return typeof valor === 'number' && regra.valor != null && valor === regra.valor;
    case 'MAIOR_OU_IGUAL':
      return typeof valor === 'number' && regra.valor != null && valor >= regra.valor;
    case 'MAIOR_QUE':
      return typeof valor === 'number' && regra.valor != null && valor > regra.valor;
    case 'MENOR_OU_IGUAL':
      return typeof valor === 'number' && regra.valor != null && valor <= regra.valor;
    case 'MENOR_QUE':
      return typeof valor === 'number' && regra.valor != null && valor < regra.valor;
    case 'ENTRE':
      return (
        typeof valor === 'number' &&
        regra.valor != null &&
        regra.valorSecundario != null &&
        valor >= regra.valor &&
        valor <= regra.valorSecundario
      );
  }
}

function elevarUmNivel(classificacao: Classificacao): Classificacao {
  const proxima = CLASSIFICACOES[gravidadeDe(classificacao) + 1];
  return proxima ?? classificacao;
}

function aplicarPolitica(
  porSintoma: ClassificacaoPorSintoma[],
  indice: Map<string, ValorObservado>,
  conjunto: ConjuntoDeLimiares,
): { resultado: Classificacao; ajustes: AjusteDaPolitica[] } {
  const ajustes: AjusteDaPolitica[] = [];

  // Antitérmico mascara a febre: a temperatura medida depois do remédio é menor do que
  // a que o corpo produziria sozinho. Elevar um nível é uma das leituras possíveis, e
  // qual delas vale é escolha do conjunto de limiares, não do programa.
  if (conjunto.politica.efeitoDoAntitermico === 'ELEVAR_UM_NIVEL') {
    const usouAntitermico = indice.get(chave('FEBRE', 'usouAntitermico')) === true;
    const febre = porSintoma.find((item) => item.sintoma === 'FEBRE');

    if (usouAntitermico && febre) {
      const elevada = elevarUmNivel(febre.classificacao);
      if (elevada !== febre.classificacao) {
        ajustes.push({
          politica: 'efeitoDoAntitermico=ELEVAR_UM_NIVEL',
          de: febre.classificacao,
          para: elevada,
          motivo: 'Antitérmico usado; a temperatura medida subestima a febre real.',
        });
        porSintoma[porSintoma.indexOf(febre)] = { ...febre, classificacao: elevada };
      }
    }
  }

  let resultado = porSintoma.reduce<Classificacao>(
    (pior, item) => piorEntre(pior, item.classificacao),
    'VERDE',
  );

  if (conjunto.politica.combinacao === 'DOIS_AMARELOS_VIRAM_VERMELHO') {
    const amarelos = porSintoma.filter((item) => item.classificacao === 'AMARELO').length;

    if (amarelos >= 2 && resultado !== 'VERMELHO') {
      ajustes.push({
        politica: 'combinacao=DOIS_AMARELOS_VIRAM_VERMELHO',
        de: resultado,
        para: 'VERMELHO',
        motivo: `${amarelos} sintomas em atenção ao mesmo tempo.`,
      });
      resultado = 'VERMELHO';
    }
  }

  return { resultado, ajustes };
}

/**
 * Sintomas para os quais o conjunto tem regra e a sessão não trouxe resposta nenhuma.
 * Não altera o resultado — entra na explicação, para que a enfermagem saiba que a
 * classificação foi feita sem aquele dado.
 */
function naoRespondidos(
  respondidos: readonly Sintoma[],
  conjunto: ConjuntoDeLimiares,
): readonly Sintoma[] {
  const comRegra = new Set(conjunto.regras.map((regra) => regra.sintoma));
  return [...comRegra].filter((sintoma) => !respondidos.includes(sintoma));
}

/**
 * Confere se todas as regras do conjunto apontam para campos que existem na árvore.
 * Roda antes de publicar um conjunto: regra apontando para campo inexistente nunca
 * dispara, e o efeito é um corte que a equipe acha que está valendo e não está.
 */
export function conferirIntegridadeDoConjunto(conjunto: ConjuntoDeLimiares): string[] {
  const problemas: string[] = [];

  for (const regra of conjunto.regras) {
    const definicao = buscarCampo(regra.sintoma, regra.campo);

    if (!definicao) {
      problemas.push(`Regra ${regra.id}: campo "${regra.campo}" não existe em ${regra.sintoma}.`);
      continue;
    }

    const operadorNumerico = [
      'MAIOR_OU_IGUAL',
      'MAIOR_QUE',
      'MENOR_OU_IGUAL',
      'MENOR_QUE',
      'ENTRE',
    ].includes(regra.operador);

    if (operadorNumerico && definicao.tipo !== 'NUMERICO' && definicao.tipo !== 'INTEIRO') {
      problemas.push(
        `Regra ${regra.id}: operador ${regra.operador} exige campo numérico, e "${regra.campo}" é ${definicao.tipo}.`,
      );
    }

    if (operadorNumerico && regra.valor == null) {
      problemas.push(`Regra ${regra.id}: operador ${regra.operador} exige um valor de corte.`);
    }

    if (regra.operador === 'ENTRE' && regra.valorSecundario == null) {
      problemas.push(`Regra ${regra.id}: ENTRE exige valor secundário.`);
    }

    if (regra.operador === 'ESTA_EM') {
      if (definicao.tipo !== 'OPCAO') {
        problemas.push(`Regra ${regra.id}: ESTA_EM exige campo de opção.`);
      }
      const desconhecidas = (regra.valoresDeTexto ?? []).filter(
        (valor) => !(definicao.opcoes ?? []).includes(valor),
      );
      if (desconhecidas.length > 0) {
        problemas.push(
          `Regra ${regra.id}: opções fora da lista de "${regra.campo}": ${desconhecidas.join(', ')}.`,
        );
      }
    }
  }

  return problemas;
}
