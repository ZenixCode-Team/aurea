import { ambiente } from './ambiente.js';

/**
 * Toda conta de data do AUREA passa por aqui. Não existe segunda convenção.
 *
 * O motivo é clínico, não estético. Antes deste módulo o código era incoerente
 * consigo mesmo: `calcularDiaDoCiclo` operava em UTC e o painel operava na hora
 * local do processo. Na máquina do desenvolvedor (UTC−3) as duas coincidiam e
 * todo teste passava. Num container em UTC, um check-in feito às 21h30 em
 * Sergipe cai no dia seguinte — o dia do ciclo sai com um dia a mais, e como
 * regra com janela de ciclo é DESCARTADA quando o dia fica fora da janela
 * (`motor.ts`), um corte de risco deixa de disparar sem erro e sem log.
 *
 * O fuso é o do serviço de saúde, não o do servidor nem o do navegador. Quem
 * define o dia do ciclo é a data da sessão de quimioterapia como o serviço a
 * registrou; um paciente viajando não muda o próprio ciclo.
 */

const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;

/**
 * Partes de data no fuso configurado.
 * `Intl` é a única forma de fazer isso sem biblioteca e sem tabela de fuso própria.
 */
function partesNoFuso(momento: Date): { ano: number; mes: number; dia: number } {
  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: ambiente.FUSO_HORARIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const partes = formatador.formatToParts(momento);
  const buscar = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)?.value);

  return { ano: buscar('year'), mes: buscar('month'), dia: buscar('day') };
}

/**
 * O dia civil de um instante, no fuso do serviço, como número comparável.
 * Ex.: 2026-07-30 → 20260730. Serve para comparar "é o mesmo dia?" sem
 * arrastar hora junto.
 */
export function diaCivil(momento: Date): number {
  const { ano, mes, dia } = partesNoFuso(momento);
  return ano * 10000 + mes * 100 + dia;
}

/**
 * Deslocamento do fuso, em milissegundos, no instante dado.
 *
 * Positivo a leste de Greenwich, negativo a oeste — America/Sao_Paulo devolve
 * −3h. Precisa do instante porque fuso com horário de verão muda de
 * deslocamento no meio do ano; o Brasil não usa desde 2019, mas o código não
 * deve assumir que continuará assim.
 */
function deslocamentoEmMs(momento: Date): number {
  const formatador = new Intl.DateTimeFormat('en-CA', {
    timeZone: ambiente.FUSO_HORARIO,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const partes = formatador.formatToParts(momento);
  const buscar = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)?.value);

  const comoSeFosseUtc = Date.UTC(
    buscar('year'),
    buscar('month') - 1,
    buscar('day'),
    buscar('hour'),
    buscar('minute'),
    buscar('second'),
  );

  // Zera os milissegundos dos dois lados: o formatador não os devolve.
  return comoSeFosseUtc - Math.floor(momento.getTime() / 1000) * 1000;
}

/** Meia-noite do dia civil de `momento`, no fuso do serviço, como instante real. */
export function inicioDoDia(momento: Date = new Date()): Date {
  const { ano, mes, dia } = partesNoFuso(momento);
  const meiaNoiteIngenua = Date.UTC(ano, mes - 1, dia, 0, 0, 0);

  // Primeira aproximação com o deslocamento do instante de referência, depois
  // uma correção com o deslocamento da própria meia-noite. As duas passadas
  // resolvem o caso em que a virada de horário de verão acontece no meio do dia.
  const primeira = new Date(meiaNoiteIngenua - deslocamentoEmMs(momento));
  return new Date(meiaNoiteIngenua - deslocamentoEmMs(primeira));
}

/**
 * Quantos dias civis separam dois instantes, no fuso do serviço.
 * Conta dias de calendário, não períodos de 24 horas: de 23h de segunda para
 * 1h de terça é 1 dia, e é assim que a enfermagem lê.
 */
export function diasDeDiferenca(de: Date, ate: Date): number {
  const inicioDe = inicioDoDia(de).getTime();
  const inicioAte = inicioDoDia(ate).getTime();
  return Math.round((inicioAte - inicioDe) / UM_DIA_EM_MS);
}

/**
 * Dia civil de uma coluna `@db.Date` — data de calendário, não instante.
 *
 * O Prisma devolve `DATE` como meia-noite UTC: `2026-07-27` chega como
 * `2026-07-27T00:00:00.000Z`. Esse instante, lido em America/Sao_Paulo, é 26/07
 * às 21h — o dia ANTERIOR. Ler coluna de data com `diaCivil` tira um dia.
 *
 * A distinção entre "instante" e "data civil" é a raiz de toda essa família de
 * defeitos, e ela não é acadêmica: `sessaoRealizadaEm` não é um momento no tempo,
 * é o dia em que a sessão aconteceu. Não tem hora, não tem fuso, e converter
 * fuso sobre ela é a operação errada por definição.
 */
export function diaCivilDeColunaDeData(coluna: Date): number {
  return (
    coluna.getUTCFullYear() * 10000 + (coluna.getUTCMonth() + 1) * 100 + coluna.getUTCDate()
  );
}

/**
 * Dia do ciclo: quantos dias de calendário desde a sessão de quimioterapia.
 * O dia da sessão é o dia 0.
 *
 * Os dois argumentos são de naturezas diferentes e por isso são lidos de formas
 * diferentes: `sessaoRealizadaEm` vem de coluna `@db.Date` e é data civil, lida em
 * UTC; `momento` é instante e é lido no fuso do serviço. Tratar os dois igual foi
 * um defeito real — o dia do ciclo saía sempre um a mais, e regra com janela
 * `[0,3]` parava de valer no dia 3 de verdade, sem erro e sem log.
 *
 * Calculado sempre, nunca guardado em coluna. Quando entra numa classificação,
 * fica congelado dentro da explicação daquela classificação.
 */
export function calcularDiaDoCiclo(sessaoRealizadaEm: Date, momento: Date): number {
  const base = Date.UTC(
    sessaoRealizadaEm.getUTCFullYear(),
    sessaoRealizadaEm.getUTCMonth(),
    sessaoRealizadaEm.getUTCDate(),
  );

  const hoje = partesNoFuso(momento);
  const atual = Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia);

  return Math.round((atual - base) / UM_DIA_EM_MS);
}

/** Verdadeiro se os dois instantes caem no mesmo dia civil do fuso do serviço. */
export function mesmoDia(a: Date, b: Date): boolean {
  return diaCivil(a) === diaCivil(b);
}
