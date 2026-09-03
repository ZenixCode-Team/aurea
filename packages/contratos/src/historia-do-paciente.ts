/**
 * A breve história do paciente, montada a partir do que está cadastrado.
 *
 * Existe porque a enfermagem abre o prontuário com o telefone na mão e precisa saber
 * QUEM é a pessoa antes de ler o que ela respondeu ontem. Hoje esse retrato está
 * espalhado por quatro blocos da tela, e montar a frase mentalmente é trabalho que a
 * pessoa de plantão faz toda vez, para todo paciente.
 *
 * Três regras governam este arquivo, e as três existem por segurança clínica:
 *
 * 1. **Nada é inventado.** Cada frase sai de um campo cadastrado. Não há inferência,
 *    não há "provavelmente", não há texto de modelo de linguagem. Se o dado não está
 *    lá, a frase não existe — e é por isso que a função devolve uma LISTA de trechos,
 *    não um parágrafo com buracos.
 * 2. **Ausência não vira negativa.** "Não perguntei se fuma" e "a pessoa não fuma" são
 *    coisas diferentes. Por isso `NAO_INFORMADO` produz silêncio, nunca "não fuma".
 *    Colapsar as duas faria a equipe ler lacuna de cadastro como resposta clínica.
 * 3. **Nenhuma classificação de risco entra aqui.** Isto é retrato de quem a pessoa é,
 *    não leitura do estado dela hoje. A escala vive nos indicadores da mesma tela, com
 *    a cor que só ela pode usar (lei inviolável 1).
 *
 * Mora em `contratos` e não no front porque a API também precisa desta leitura para o
 * dia em que houver exportação de prontuário — e duas implementações da mesma frase
 * divergem na primeira mudança de regra.
 */

export type Tabagismo =
  | 'NUNCA_FUMOU'
  | 'EX_FUMANTE'
  | 'FUMANTE_ATUAL'
  | 'NAO_INFORMADO';

export type AtividadeFisica =
  | 'SEDENTARIO'
  | 'LEVE'
  | 'MODERADA'
  | 'INTENSA'
  | 'NAO_INFORMADO';

export type ConsumoDeAlcool =
  | 'NAO_BEBE'
  | 'SOCIAL'
  | 'FREQUENTE'
  | 'NAO_INFORMADO';

export type SexoDoPaciente = 'FEMININO' | 'MASCULINO' | 'OUTRO' | 'NAO_INFORMADO';

export interface CondicaoRelatada {
  readonly descricao: string;
  /** Confirmada pela equipe ou apenas relatada. A distinção muda o peso da leitura. */
  readonly confirmada: boolean;
}

export interface MedicamentoEmUso {
  readonly nome: string;
  readonly posologia: string;
}

export interface DadosDaHistoria {
  readonly nome: string;
  readonly sexo?: SexoDoPaciente | null;
  readonly dataNascimento?: string | null;
  readonly diagnostico: string;
  readonly protocolo?: string | null;
  readonly numeroDoCiclo?: number | null;
  readonly diaDoCiclo?: number | null;
  readonly medicamentosEmUso?: readonly MedicamentoEmUso[];
  readonly alergias?: readonly CondicaoRelatada[];
  readonly comorbidades?: readonly CondicaoRelatada[];
  readonly tabagismo?: Tabagismo | null;
  readonly parouDeFumarEm?: string | null;
  readonly atividadeFisica?: AtividadeFisica | null;
  readonly descricaoDaAtividade?: string | null;
  readonly consumoDeAlcool?: ConsumoDeAlcool | null;
  readonly habitoIntestinalBasal?: number | null;
}

/**
 * Um trecho da história. `assunto` existe para a tela poder marcar visualmente o que
 * é alerta (alergia) sem que este arquivo saiba nada sobre cor ou layout.
 */
export interface TrechoDaHistoria {
  readonly assunto:
    | 'quem'
    | 'tratamento'
    | 'medicamentos'
    | 'alergias'
    | 'comorbidades'
    | 'habitos'
    | 'referencia';
  readonly texto: string;
  /** Alergia confirmada é a única coisa aqui que a equipe precisa ver antes do resto. */
  readonly destacar?: boolean;
}

const ROTULO_DA_ATIVIDADE: Record<Exclude<AtividadeFisica, 'NAO_INFORMADO'>, string> = {
  SEDENTARIO: 'sedentária',
  LEVE: 'atividade física leve',
  MODERADA: 'atividade física moderada',
  INTENSA: 'atividade física intensa',
};

const ROTULO_DO_ALCOOL: Record<Exclude<ConsumoDeAlcool, 'NAO_BEBE' | 'NAO_INFORMADO'>, string> = {
  SOCIAL: 'bebe socialmente',
  FREQUENTE: 'consumo frequente de álcool',
};

/**
 * Idade em anos completos.
 *
 * Recebe `hoje` em vez de chamar `new Date()` porque função que lê o relógio não é
 * testável: o mesmo teste passaria hoje e falharia no aniversário da pessoa.
 */
export function calcularIdade(dataNascimento: string, hoje: Date): number | null {
  const nascimento = new Date(dataNascimento);
  if (Number.isNaN(nascimento.getTime())) return null;

  let idade = hoje.getUTCFullYear() - nascimento.getUTCFullYear();
  const mes = hoje.getUTCMonth() - nascimento.getUTCMonth();
  if (mes < 0 || (mes === 0 && hoje.getUTCDate() < nascimento.getUTCDate())) {
    idade -= 1;
  }

  return idade >= 0 && idade < 130 ? idade : null;
}

function descreverPessoa(dados: DadosDaHistoria, hoje: Date): string | null {
  const partes: string[] = [];

  if (dados.sexo === 'FEMININO') partes.push('Mulher');
  else if (dados.sexo === 'MASCULINO') partes.push('Homem');

  const idade =
    dados.dataNascimento != null ? calcularIdade(dados.dataNascimento, hoje) : null;
  if (idade != null) partes.push(`${idade} anos`);

  return partes.length > 0 ? partes.join(', ') : null;
}

function descreverTratamento(dados: DadosDaHistoria): string {
  let texto = `em tratamento de ${dados.diagnostico}`;
  if (dados.protocolo) texto += `, protocolo ${dados.protocolo}`;

  if (dados.diaDoCiclo != null) {
    texto +=
      dados.numeroDoCiclo != null
        ? `, hoje no dia ${dados.diaDoCiclo} do ciclo ${dados.numeroDoCiclo}`
        : `, hoje no dia ${dados.diaDoCiclo} do ciclo`;
  }

  return texto;
}

/**
 * Primeira letra em maiúscula.
 *
 * Precisa existir porque os trechos são montados de fragmentos em minúscula
 * ("ex-fumante", "não bebe") que em outro contexto entram no meio de uma frase. Sem
 * isto, a linha de hábitos sai como "ex-fumante, parou há 7 anos." — que é o tipo de
 * erro que só aparece na tela, nunca no teste que compara o conteúdo.
 */
function comInicialMaiuscula(texto: string): string {
  return texto.length === 0 ? texto : texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "e" antes do último, vírgula no resto. Lista lida em voz alta soa assim. */
function juntarComE(itens: readonly string[]): string {
  if (itens.length === 0) return '';
  if (itens.length === 1) return itens[0] as string;
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1] as string}`;
}

function descreverHabitos(dados: DadosDaHistoria, hoje: Date): string | null {
  const partes: string[] = [];

  if (dados.tabagismo === 'FUMANTE_ATUAL') {
    partes.push('fumante');
  } else if (dados.tabagismo === 'EX_FUMANTE') {
    const anos =
      dados.parouDeFumarEm != null ? calcularIdade(dados.parouDeFumarEm, hoje) : null;
    /* "há 1 anos" é o erro clássico de plural em texto montado. */
    if (anos != null && anos >= 1) {
      partes.push(`ex-fumante, parou há ${anos} ${anos === 1 ? 'ano' : 'anos'}`);
    } else if (anos === 0) {
      partes.push('ex-fumante, parou há menos de um ano');
    } else {
      partes.push('ex-fumante');
    }
  } else if (dados.tabagismo === 'NUNCA_FUMOU') {
    partes.push('nunca fumou');
  }

  if (dados.consumoDeAlcool === 'NAO_BEBE') {
    partes.push('não bebe');
  } else if (
    dados.consumoDeAlcool === 'SOCIAL' ||
    dados.consumoDeAlcool === 'FREQUENTE'
  ) {
    partes.push(ROTULO_DO_ALCOOL[dados.consumoDeAlcool]);
  }

  if (dados.atividadeFisica != null && dados.atividadeFisica !== 'NAO_INFORMADO') {
    /* A descrição livre substitui o rótulo quando existe: "caminha 3x por semana" diz
       mais à enfermagem do que "atividade física moderada". O enum continua sendo o
       dado consultável; a frase é para leitura humana. */
    partes.push(
      dados.descricaoDaAtividade?.trim()
        ? dados.descricaoDaAtividade.trim()
        : ROTULO_DA_ATIVIDADE[dados.atividadeFisica],
    );
  }

  return partes.length > 0 ? `${comInicialMaiuscula(juntarComE(partes))}.` : null;
}

function descreverCondicoes(
  condicoes: readonly CondicaoRelatada[],
  rotuloSingular: string,
  rotuloPlural: string,
): string {
  const descritas = condicoes.map((c) =>
    c.confirmada ? c.descricao : `${c.descricao} (relatada, não confirmada)`,
  );
  const rotulo = condicoes.length === 1 ? rotuloSingular : rotuloPlural;
  return `${rotulo} ${juntarComE(descritas)}.`;
}

/**
 * Monta a história. Devolve lista de trechos — vazia quando não há nada cadastrado
 * além do obrigatório, que é o caso honesto de "esta pessoa ainda não tem retrato".
 */
export function montarHistoriaDoPaciente(
  dados: DadosDaHistoria,
  hoje: Date = new Date(),
): readonly TrechoDaHistoria[] {
  const trechos: TrechoDaHistoria[] = [];

  /* Quem é a pessoa e o que ela está tratando saem na MESMA frase: separá-las produz
     "Mulher, 54 anos." solto, que não é informação, é um fragmento. */
  const pessoa = descreverPessoa(dados, hoje);
  const tratamento = descreverTratamento(dados);
  trechos.push({
    assunto: pessoa ? 'quem' : 'tratamento',
    texto: pessoa
      ? `${pessoa}, ${tratamento}.`
      : `${comInicialMaiuscula(tratamento)}.`,
  });

  const alergias = dados.alergias ?? [];
  if (alergias.length > 0) {
    /* Alergia vem ANTES de medicamento, e destacada. É a única coisa nesta tela que,
       lida tarde demais, machuca alguém. */
    trechos.push({
      assunto: 'alergias',
      texto: descreverCondicoes(alergias, 'Alergia a', 'Alergias a'),
      destacar: true,
    });
  }

  const medicamentos = dados.medicamentosEmUso ?? [];
  if (medicamentos.length > 0) {
    trechos.push({
      assunto: 'medicamentos',
      texto: `Toma ${juntarComE(medicamentos.map((m) => m.nome))}.`,
    });
  }

  const comorbidades = dados.comorbidades ?? [];
  if (comorbidades.length > 0) {
    trechos.push({
      assunto: 'comorbidades',
      texto: descreverCondicoes(comorbidades, 'Também tem', 'Também tem'),
    });
  }

  const habitos = descreverHabitos(dados, hoje);
  if (habitos) trechos.push({ assunto: 'habitos', texto: habitos });

  if (dados.habitoIntestinalBasal != null) {
    const vezes = dados.habitoIntestinalBasal;
    trechos.push({
      assunto: 'referencia',
      texto:
        vezes === 0
          ? 'Hábito intestinal basal não estabelecido.'
          : `Hábito intestinal basal: ${vezes} ${vezes === 1 ? 'vez' : 'vezes'} ao dia.`,
    });
  }

  return trechos;
}

/**
 * Quanto do retrato está preenchido, de 0 a 1.
 *
 * Serve para a tela dizer à equipe que o cadastro está incompleto em vez de mostrar
 * duas linhas como se fossem a história inteira. Conta só o que alguém precisa
 * PERGUNTAR: diagnóstico e protocolo já vêm do tratamento.
 */
export function completudeDaHistoria(dados: DadosDaHistoria): number {
  const perguntas = [
    dados.dataNascimento != null,
    dados.sexo != null && dados.sexo !== 'NAO_INFORMADO',
    (dados.alergias ?? []).length > 0,
    dados.tabagismo != null && dados.tabagismo !== 'NAO_INFORMADO',
    dados.atividadeFisica != null && dados.atividadeFisica !== 'NAO_INFORMADO',
    dados.consumoDeAlcool != null && dados.consumoDeAlcool !== 'NAO_INFORMADO',
    dados.habitoIntestinalBasal != null,
  ];

  return perguntas.filter(Boolean).length / perguntas.length;
}
