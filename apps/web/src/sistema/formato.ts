/**
 * Formatação de tudo que a pessoa lê.
 *
 * Existe em um lugar só porque data e número clínico formatados de duas maneiras
 * diferentes na mesma tela é erro de leitura esperando acontecer.
 */

import type { Classificacao, SituacaoNoPainel, TipoDeEvento } from './tipos';

const FUSO = 'America/Sao_Paulo';

/** `2026-07-30` — dia civil, sem hora. Diferente de um instante. */
const SOMENTE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function ehSomenteData(iso: string): boolean {
  return SOMENTE_DATA.test(iso);
}

/**
 * Converte a string para `Date` sem deixar o dia escorregar.
 *
 * `new Date('2026-07-30')` é meia-noite **UTC**, que em Brasília é 21h do dia 29 —
 * e a sessão de triagem passa a aparecer um dia antes do que aconteceu. Ancorando
 * o dia civil ao meio-dia local, nenhum fuso do mundo muda a data.
 */
function paraData(iso: string): Date {
  return new Date(SOMENTE_DATA.test(iso) ? `${iso}T12:00:00` : iso);
}

export function formatarData(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: FUSO,
  }).format(paraData(iso));
}

export function formatarDataPorExtenso(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: FUSO,
  }).format(paraData(iso));
}

export function formatarHora(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSO,
  }).format(new Date(iso));
}

/**
 * Data e hora — mas só a data quando não há hora para mostrar.
 *
 * Um dia civil formatado como instante produziria "às 00:00", uma hora que ninguém
 * registrou. Inventar precisão que o dado não tem é pior que omiti-la.
 */
export function formatarDataEHora(iso: string): string {
  if (SOMENTE_DATA.test(iso)) return formatarData(iso);
  return `${formatarData(iso)} às ${formatarHora(iso)}`;
}

/**
 * O número do dia, para a âncora de data das listas por mês.
 *
 * Dentro de uma seção que já se chama "Julho de 2026", repetir `29/07/2026` em cada
 * linha é ruído: o mês e o ano estão no cabeçalho, e o que distingue uma linha da
 * outra é o dia.
 */
export function formatarNumeroDoDia(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: FUSO }).format(
    paraData(iso),
  );
}

/** "qui" — o dia da semana abreviado, sem o ponto que o `Intl` acrescenta em pt-BR. */
export function formatarDiaDaSemana(iso: string): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    timeZone: FUSO,
  }).format(paraData(iso));
  return texto.replace('.', '');
}

/**
 * A distância até um compromisso, em linguagem de gente.
 *
 * "em 3 dias" responde a pergunta que a pessoa realmente faz ao abrir a agenda, e
 * que `17 de agosto` só responde depois de uma conta mental. Passado devolve `null`:
 * dizer "há 5 dias" num compromisso que já aconteceu não ajuda ninguém a se
 * organizar, e a lista já mostra que ele ficou para trás.
 */
export function formatarDistanciaEmDias(iso: string, referencia = new Date()): string | null {
  const alvo = new Date(paraData(iso));
  alvo.setHours(0, 0, 0, 0);
  const hoje = new Date(referencia);
  hoje.setHours(0, 0, 0, 0);

  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
  if (dias < 0) return null;
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `em ${dias} dias`;
}

/** "hoje", "ontem" ou a data. Usado onde a distância importa mais que o dia exato. */
export function formatarDiaRelativo(iso: string, referencia = new Date()): string {
  const dia = paraData(iso);
  const diferenca = Math.round(
    (inicioDoDia(referencia).getTime() - inicioDoDia(dia).getTime()) / 86_400_000,
  );
  if (diferenca === 0) return 'hoje';
  if (diferenca === 1) return 'ontem';
  if (diferenca === -1) return 'amanhã';
  return formatarData(iso);
}

function inicioDoDia(data: Date): Date {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

export function formatarTelefone(numero: string): string {
  const digitos = numero.replace(/\D/g, '');
  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return numero;
}

export function formatarCpf(cpf: string): string {
  const digitos = cpf.replace(/\D/g, '');
  if (digitos.length !== 11) return cpf;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

/** Número clínico. Vírgula decimal e casas fixas — 38,6 nunca vira 38.6 nem 38,60. */
export function formatarMedida(valor: number, casas = 1, unidade?: string): string {
  const texto = valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
  return unidade ? `${texto} ${unidade}` : texto;
}

export function calcularIdade(nascimentoIso: string, referencia = new Date()): number {
  const nascimento = new Date(nascimentoIso);
  let idade = referencia.getFullYear() - nascimento.getFullYear();
  const mes = referencia.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && referencia.getDate() < nascimento.getDate())) idade -= 1;
  return idade;
}

/* ==========================================================================
   Rótulos — o vocabulário do sistema em um lugar só
   ========================================================================== */

export const ROTULO_DA_CLASSIFICACAO: Record<Classificacao, string> = {
  VERDE: 'Verde',
  AMARELO: 'Amarelo',
  VERMELHO: 'Vermelho',
};

export const ROTULO_DA_SITUACAO: Record<SituacaoNoPainel, string> = {
  VERMELHO: 'Vermelho',
  AMARELO: 'Amarelo',
  VERDE: 'Verde',
  SEM_RESPOSTA_HOJE: 'Sem resposta hoje',
  NAO_CLASSIFICADA: 'Sem classificação',
};

export const ROTULO_DO_SINTOMA: Record<string, string> = {
  FEBRE: 'Febre',
  DIARREIA: 'Diarreia',
  NAUSEA_VOMITO: 'Náusea ou vômito',
  DOR: 'Dor',
  FALTA_DE_AR: 'Falta de ar',
};

export const ROTULO_DO_EVENTO: Record<TipoDeEvento, string> = {
  QUIMIOTERAPIA: 'Sessão de quimioterapia',
  CONSULTA: 'Consulta',
  EXAME: 'Exame',
  RETORNO: 'Retorno',
  OUTRO: 'Compromisso',
};

/** As dez do enum `CategoriaDaBiblioteca` no banco. Sem chave faltando, sem chave a mais. */
export const ROTULO_DA_CATEGORIA: Record<string, string> = {
  MEDICAMENTOS: 'Medicamentos',
  ALIMENTACAO: 'Alimentação',
  MUCOSITE: 'Boca e garganta',
  CATETER: 'Cateter',
  QUEDA_DE_CABELO: 'Queda de cabelo',
  DIARREIA: 'Diarreia',
  CONSTIPACAO: 'Intestino preso',
  EXERCICIOS: 'Movimento e descanso',
  VACINAS: 'Vacinas',
  DIREITOS_DO_PACIENTE: 'Seus direitos',
};

export const ROTULO_DO_OPERADOR: Record<string, string> = {
  MAIOR_OU_IGUAL: 'maior ou igual a',
  MAIOR_QUE: 'maior que',
  MENOR_OU_IGUAL: 'menor ou igual a',
  MENOR_QUE: 'menor que',
  IGUAL: 'igual a',
  ENTRE: 'entre',
  E_VERDADEIRO: 'é verdadeiro',
  E_FALSO: 'é falso',
  ESTA_EM: 'está entre os valores',
};

export const ROTULO_DA_ACAO: Record<string, string> = {
  LOGIN: 'Entrada no sistema',
  LOGIN_RECUSADO: 'Entrada recusada',
  LOGOUT: 'Saída do sistema',
  TROCA_DE_SENHA: 'Troca de senha',
  CONSENTIMENTO_REGISTRADO: 'Consentimento registrado',
  LEITURA_DE_HISTORICO: 'Leitura de histórico',
  LEITURA_DE_PACIENTE: 'Leitura de paciente',
  REGISTRO_DE_INTERVENCAO: 'Registro de intervenção',
  ATENDIMENTO_DE_SOLICITACAO: 'Atendimento de solicitação',
  CRIACAO_DE_CADASTRO: 'Criação de cadastro',
  EDICAO_DE_CADASTRO: 'Edição de cadastro',
  EDICAO_DE_ORIENTACAO: 'Edição de orientação',
  EDICAO_DE_ALGORITMO: 'Edição do algoritmo',
  PUBLICACAO_DE_ALGORITMO: 'Publicação do algoritmo',
  VALIDACAO_CLINICA_DE_ALGORITMO: 'Validação clínica do algoritmo',
  REPROCESSAMENTO_DE_HISTORICO: 'Reprocessamento de histórico',
  EXPORTACAO_DE_PESQUISA: 'Exportação de pesquisa',
};

export const ROTULO_DA_FUNCAO: Record<string, string> = {
  MEDICO: 'Médico',
  ENFERMEIRO: 'Enfermeiro',
  TECNICO_DE_ENFERMAGEM: 'Técnico de enfermagem',
  NUTRICIONISTA: 'Nutricionista',
  PSICOLOGO: 'Psicólogo',
};

/**
 * Nome de campo em linguagem de gente.
 *
 * `temperaturaMaxima` é chave de banco, não texto de tela. Em caixa alta vira
 * "TEMPERATURAMAXIMA", que ninguém lê — e quem está de plantão precisa reconhecer
 * o campo de relance, não decifrá-lo.
 */
export function nomeDoCampoLegivel(campo: string): string {
  const comEspacos = campo.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return comEspacos.charAt(0).toUpperCase() + comEspacos.slice(1);
}

/** Ordem de leitura do plantão: quem precisa de atenção primeiro. */
export const PESO_DA_SITUACAO: Record<SituacaoNoPainel, number> = {
  VERMELHO: 0,
  AMARELO: 1,
  NAO_CLASSIFICADA: 2,
  SEM_RESPOSTA_HOJE: 3,
  VERDE: 4,
};

/**
 * Desfecho da intervenção, no vocabulário do plantão.
 *
 * "Aguardando retorno" e "Reavaliar amanhã" não são estados vagos: o primeiro quer
 * dizer que a bola está com o paciente, o segundo que está com a equipe. Quem lê a
 * tabela precisa saber de quem é a próxima ação sem abrir a conduta.
 */
export const ROTULO_DO_DESFECHO: Record<string, string> = {
  RESOLVIDO: 'Resolvido',
  EM_ACOMPANHAMENTO: 'Em acompanhamento',
  AGUARDANDO_RETORNO: 'Aguardando retorno',
  ENCAMINHADO_AO_PA: 'Encaminhado ao pronto atendimento',
  REAVALIAR: 'Reavaliar',
};
