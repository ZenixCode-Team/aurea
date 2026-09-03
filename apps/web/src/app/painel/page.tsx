'use client';

/**
 * E1 — Pacientes do dia.
 *
 * A primeira tela que o plantão vê, refeita sobre o padrão lista-e-detalhe do
 * Adaline e do OpenAI Platform: a lista ocupa a esquerda e o paciente selecionado
 * abre à direita, sem trocar de tela.
 *
 * A versão anterior errava por excesso de vazio — cinco cartões grandes e uma
 * tabela solta num mar de bege. Densidade aqui não é aperto: é não obrigar quem
 * está de plantão a navegar para descobrir o que já poderia estar à vista.
 *
 * A cor da escala continua exclusiva da classificação. Tudo o mais é neutro.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { GradienteAnimado } from '@/components/gradiente-animado';
import {
  Aviso,
  Carregando,
  EstadoVazio,
  LinkComoBotao,
  SeloDeRisco,
  juntar,
} from '@/componentes/sistema/primitivos';
import { ErroDaFonte, buscarPacientesDoDia } from '@/sistema/fonte';
import { ROTULO_DA_SITUACAO } from '@/sistema/formato';
import {
  ROTULO_DA_FAIXA,
  ROTULO_DO_NIVEL,
  ROTULO_DO_NIVEL_DE_RISCO,
  faixaDeSilencioDe,
  nivelDePrioridade,
  resumirSilencio,
  type NivelDePrioridade,
} from '@aurea/contratos';
import type {
  CartaoDoPainel,
  PacientesDoDia,
  ResultadoDaEstratificacao,
  SituacaoNoPainel,
} from '@/sistema/tipos';

const NIVEIS: readonly NivelDePrioridade[] = ['ALTA', 'INTERMEDIARIA', 'BAIXA'];

/**
 * Cor do grupo de prioridade.
 *
 * Reusa os tokens da escala, e isso é legítimo aqui e só aqui: o agrupamento É a
 * gravidade clínica, não decoração. A lei inviolável 1 proíbe a cor sem significado,
 * não a cor no lugar onde ela significa exatamente o que diz.
 */
const COR_DO_NIVEL: Record<NivelDePrioridade, string> = {
  ALTA: 'var(--color-risco-vermelho)',
  INTERMEDIARIA: 'var(--color-risco-amarelo)',
  BAIXA: 'var(--color-risco-verde)',
};

/**
 * O nível do cartão, com queda para cálculo local.
 *
 * A API manda pronto. O espelho sintético não manda, e recalcular no cliente é o que
 * mantém a tela honesta nos dois modos em vez de mostrar tudo como baixa prioridade
 * durante uma demonstração.
 */
function nivelDoCartao(cartao: CartaoDoPainel): NivelDePrioridade {
  if (cartao.nivelDePrioridade) return cartao.nivelDePrioridade;
  return nivelDePrioridade(
    cartao.situacao === 'NAO_CLASSIFICADA' ? 'SEM_CLASSIFICACAO' : cartao.situacao,
    cartao.faixaDeSilencio ??
      faixaDeSilencioDe(cartao.diasSemResponder, cartao.nuncaRespondeu),
  );
}

/** Ordem e cor de cada faixa da escala. Único lugar da tela onde a cor significa algo. */
const FAIXAS = [
  { situacao: 'VERMELHO', cor: 'var(--color-risco-vermelho)' },
  { situacao: 'AMARELO', cor: 'var(--color-risco-amarelo)' },
  { situacao: 'NAO_CLASSIFICADA', cor: 'var(--color-risco-silencio)' },
  { situacao: 'SEM_RESPOSTA_HOJE', cor: 'var(--color-risco-silencio)' },
  { situacao: 'VERDE', cor: 'var(--color-risco-verde)' },
] as const satisfies readonly { situacao: SituacaoNoPainel; cor: string }[];

function textoDoEstado(cartao: CartaoDoPainel): string {
  if (cartao.situacao === 'NAO_CLASSIFICADA') return 'Questionário incompleto';
  if (cartao.nuncaRespondeu) return 'Nunca respondeu';
  if (cartao.diasSemResponder != null && cartao.diasSemResponder > 0) {
    return cartao.diasSemResponder === 1
      ? '1 dia sem responder'
      : `${cartao.diasSemResponder} dias sem responder`;
  }
  if (cartao.respondeuHoje) return 'Respondeu hoje';
  return 'sem registro';
}

export default function PaginaDePacientesDoDia() {
  const [dados, setDados] = useState<PacientesDoDia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<SituacaoNoPainel | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    buscarPacientesDoDia()
      .then((resultado) => {
        if (!cancelado) setDados(resultado);
      })
      .catch((motivo: unknown) => {
        if (cancelado) return;
        setErro(
          motivo instanceof ErroDaFonte
            ? motivo.message
            : 'Não foi possível carregar os pacientes do dia.',
        );
      });
    return () => {
      cancelado = true;
    };
  }, []);

  /* A ordem vem pronta da API, de `ordenarFilaDePrioridades`. Reordenar aqui seria um
     segundo critério competindo com o primeiro — foi assim que a tarefa 072 produziu
     prontuário divergindo da lista. */
  const lista = useMemo(() => {
    if (!dados) return [];
    return filtro ? dados.cards.filter((c) => c.situacao === filtro) : dados.cards;
  }, [dados, filtro]);

  /** A fila dos prints: três grupos, cada um mantendo a ordem que a API definiu. */
  const grupos = useMemo(
    () =>
      NIVEIS.map((nivel) => ({
        nivel,
        cartoes: lista.filter((cartao) => nivelDoCartao(cartao) === nivel),
      })).filter((grupo) => grupo.cartoes.length > 0),
    [lista],
  );

  const emFoco = useMemo(
    () => lista.find((c) => c.pacienteId === selecionado) ?? lista[0] ?? null,
    [lista, selecionado],
  );

  const contagem = (situacao: SituacaoNoPainel) =>
    dados?.cards.filter((c) => c.situacao === situacao).length ?? 0;

  return (
    <>
      {/*
        A entrada do plantão como bloco de marca, e não como título preto sobre bege.

        O verde é o campo institucional — o mesmo da hero e da porta de entrada. Não é a
        escala: a escala vive em `--color-risco-*`, que são outros três tons e só
        aparecem coladas a uma classificação. Trazer o campo para cá fecha o percurso
        landing → entrar → plantão com a mesma matéria visual, em vez de o sistema
        parecer outro produto depois do login.

        A contagem que importa vem por extenso e grande: quem abre esta tela quer saber,
        antes de qualquer coisa, se tem alguém precisando dela agora.
      */}
      <header className="relative mb-5 overflow-hidden rounded-[var(--radius-amplo)] bg-[var(--color-azul-profundo)] shadow-[var(--sombra-elevada)]">
        <GradienteAnimado config={{ preset: 'Aurea', speed: 5 }} />
        <div className="grain absolute inset-0" />
        {/* Véu fixo: o campo deriva, e texto creme precisa de contraste garantido em
            qualquer quadro — não no quadro em que alguém tirou o print. */}
        <div className="absolute inset-0 bg-gradient-to-r from-[rgba(20,32,26,0.78)] via-[rgba(20,32,26,0.42)] to-[rgba(20,32,26,0.14)]" />

        <div className="relative flex flex-wrap items-end justify-between gap-6 px-7 py-7">
          <div className="max-w-2xl">
            <p className="rotulo text-[var(--color-lime)]">{'// plantão'}</p>
            <h1
              className="titulo mt-3 text-[clamp(2.25rem,3.4vw,3.25rem)] leading-[0.98] text-[var(--color-creme)]"
              style={{ fontVariationSettings: '"wdth" 88' }}
            >
              Pacientes do dia
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-creme)]/75">
              Ordenados por gravidade. Silêncio vem antes do verde: quem não respondeu é
              pendência, não resultado tranquilo.
            </p>
          </div>

          {dados && (
            <div className="flex items-end gap-8">
              <div>
                <p className="rotulo text-[var(--color-creme)]/55">Em acompanhamento</p>
                <p className="mt-1 font-mono text-[2.5rem] font-medium leading-none tabular-nums text-[var(--color-creme)]">
                  {dados.resumo.total}
                </p>
              </div>
              {/* Creme, e não lime, mesmo sendo o número mais importante da tela. Lime é
                  acento de marca e não pertence à escala — mas é um verde-amarelo, e num
                  painel clínico vizinhança de matiz com âmbar e verde já é ambiguidade
                  suficiente. A hierarquia deste número vem da posição e da faixa colorida
                  logo abaixo, que é onde a cor tem permissão para significar. */}
              <div>
                <p className="rotulo text-[var(--color-creme)]/55">Precisam de você</p>
                <p className="mt-1 font-mono text-[2.5rem] font-medium leading-none tabular-nums text-[var(--color-creme)]">
                  {dados.resumo.vermelhos + dados.resumo.amarelos}
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

      {erro && (
        <Aviso tom="grave" titulo="Não foi possível carregar">
          {erro}
        </Aviso>
      )}

      {!erro && !dados && <Carregando linhas={8} />}

      {!erro && dados && (
        <>
          {/*
            A escala do dia, agora com peso.

            Antes era um fio de 2px acima de cinco pílulas de contagem — e quando o dia
            inteiro caía numa faixa só (que é o dia comum), a peça virava uma linha de uma
            cor só, sem informação. Agora cada faixa é uma célula da malha: número grande
            na cor da própria faixa, rótulo, e a barra de proporção embaixo com altura
            suficiente para ser lida de longe.

            Este é o ÚNICO lugar da tela onde a cor tem permissão para significar, e por
            isso é aqui que ela aparece cheia. Célula vazia fica em neutro: zero pintado
            de vermelho é ruído, não sinal.
          */}
          <div className="mb-5 overflow-hidden rounded-[var(--radius-amplo)] border border-[var(--color-borda)] bg-[var(--color-superficie-alta)] shadow-[var(--sombra-cartao)]">
            {/* O fio da proporção vem ANTES da malha, colado na borda superior. Como
                rodapé ele lia como sombra quebrada do cartão; no topo, lê como o que é:
                a régua que resume o que os seis números detalham. */}
            <div className="flex h-1.5 w-full bg-[var(--color-superficie-baixa)]">
              {FAIXAS.map((faixa) => {
                const quantos = contagem(faixa.situacao);
                if (quantos === 0) return null;
                return (
                  <span
                    key={faixa.situacao}
                    title={`${ROTULO_DA_SITUACAO[faixa.situacao]}: ${quantos}`}
                    className="h-full transition-[width] duration-500 ease-[var(--ease-saida)]"
                    style={{
                      width: `${(quantos / Math.max(dados.resumo.total, 1)) * 100}%`,
                      backgroundColor: faixa.cor,
                    }}
                  />
                );
              })}
            </div>

            <div className="-mr-px grid grid-cols-2 border-t border-[var(--color-borda)] lg:grid-cols-6">
              <BotaoDaFaixa
                rotulo="Todos"
                quantidade={dados.resumo.total}
                ativo={filtro === null}
                aoClicar={() => setFiltro(null)}
              />
              {FAIXAS.map((faixa) => {
                const quantos = contagem(faixa.situacao);
                return (
                  <BotaoDaFaixa
                    key={faixa.situacao}
                    rotulo={ROTULO_DA_SITUACAO[faixa.situacao]}
                    quantidade={quantos}
                    cor={quantos > 0 ? faixa.cor : undefined}
                    ativo={filtro === faixa.situacao}
                    aoClicar={() =>
                      setFiltro((atual) => (atual === faixa.situacao ? null : faixa.situacao))
                    }
                  />
                );
              })}
            </div>

          </div>

          <AlertaDeSilencio dados={dados} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            {/* Lista densa */}
            <div className="overflow-hidden rounded-[var(--radius-amplo)] border border-[var(--color-borda)] bg-[var(--color-superficie-alta)] shadow-[var(--sombra-cartao)]">
              {lista.length === 0 ? (
                <div className="p-6">
                  <EstadoVazio
                    titulo="Ninguém nesta situação"
                    descricao="Escolha outro filtro ou volte para a lista completa."
                  />
                </div>
              ) : (
                <ul>
                  {grupos.flatMap((grupo) => [
                    /* Cabeçalho do grupo. Fica no fluxo da mesma lista, e não em três
                       listas separadas: a enfermagem varre a coluna de cima a baixo
                       uma vez só, e três caixas fariam ela varrer três vezes. */
                    <li
                      key={`cabecalho-${grupo.nivel}`}
                      className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--color-borda)] bg-[var(--color-superficie-baixa)] px-4 py-1.5"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: COR_DO_NIVEL[grupo.nivel] }}
                      />
                      <span className="rotulo text-[var(--color-texto-suave)]">
                        {ROTULO_DO_NIVEL[grupo.nivel]}
                      </span>
                      <span className="ml-auto font-mono text-xs tabular-nums text-[var(--color-texto-fraco)]">
                        {grupo.cartoes.length}
                      </span>
                    </li>,
                    ...grupo.cartoes.map((cartao) => {
                    const ativo = emFoco?.pacienteId === cartao.pacienteId;
                    return (
                      <li key={cartao.pacienteId}>
                        <button
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => setSelecionado(cartao.pacienteId)}
                          className={juntar(
                            'flex w-full items-center gap-3 border-b border-[var(--color-borda)] px-4 py-2.5 text-left',
                            'transition-colors duration-100 last:border-b-0',
                            ativo
                              ? 'bg-[var(--color-superficie-baixa)]'
                              : 'hover:bg-[var(--color-superficie-baixa)]',
                          )}
                        >
                          {/* Marca de gravidade na borda: dá para varrer a coluna
                              inteira sem ler nenhum texto. */}
                          <span
                            aria-hidden
                            className="h-8 w-[3px] shrink-0 rounded-[var(--radius-pilula)]"
                            style={{
                              backgroundColor:
                                FAIXAS.find((f) => f.situacao === cartao.situacao)?.cor ??
                                'var(--color-borda-forte)',
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[var(--color-texto)]">
                              {cartao.nome}
                            </span>
                            <span className="block truncate text-xs text-[var(--color-texto-fraco)]">
                              {/* O primeiro motivo no lugar do estado genérico: entre
                                  "Respondeu hoje" e "Febre de 38,9 graus", quem está de
                                  plantão precisa do segundo. O estado continua legível
                                  no selo à direita. */}
                              {cartao.motivos?.[0]?.texto ?? textoDoEstado(cartao)}
                            </span>
                          </span>
                          {/* Marcador de estratificação (bloco 2). Ponto, não pílula:
                              a pílula à direita é da classificação clínica, e dois
                              selos do mesmo peso na mesma linha fariam a equipe
                              confundir risco de contexto com risco de sintoma. */}
                          {cartao.risco && (
                            <span
                              className="shrink-0"
                              title={`${ROTULO_DO_NIVEL_DE_RISCO[cartao.risco.nivel]} · ${cartao.risco.pontuacao} pontos · critério em rascunho`}
                            >
                              <span
                                aria-hidden
                                className="block h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    cartao.risco.nivel === 'ALTO'
                                      ? 'var(--color-dado-5)'
                                      : cartao.risco.nivel === 'MEDIO'
                                        ? 'var(--color-dado-4)'
                                        : 'var(--color-dado-neutro)',
                                }}
                              />
                              <span className="sr-only">
                                {ROTULO_DO_NIVEL_DE_RISCO[cartao.risco.nivel]}
                              </span>
                            </span>
                          )}
                          <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--color-texto-fraco)]">
                            {cartao.diaDoCiclo != null ? `D${cartao.diaDoCiclo}` : 'sem dia'}
                          </span>
                          <SeloDeRisco situacao={cartao.situacao} className="shrink-0" />
                        </button>
                      </li>
                    );
                    }),
                  ])}
                </ul>
              )}
            </div>

            {/* Detalhe do selecionado */}
            {emFoco && <PainelDeDetalhe cartao={emFoco} />}
          </div>
        </>
      )}
    </>
  );
}

/**
 * Uma faixa da escala como célula da malha: número grande, rótulo e filtro no mesmo
 * alvo de clique.
 *
 * O número herda a cor da faixa apenas quando há alguém nela. Zero em vermelho é a
 * definição de ruído: pinta de alarme uma tela onde não há alarme nenhum, e faz o olho
 * aprender a ignorar a cor — que é justamente o que não pode acontecer no dia em que
 * ela aparecer de verdade.
 */
function BotaoDaFaixa({
  rotulo,
  quantidade,
  cor,
  ativo,
  aoClicar,
}: {
  rotulo: string;
  quantidade: number;
  cor?: string;
  ativo: boolean;
  aoClicar(): void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={juntar(
        'flex flex-col items-start border-r border-b border-[var(--color-borda)] px-4 py-3.5 text-left',
        'transition-colors duration-150 lg:border-b-0',
        ativo
          ? 'bg-[var(--color-superficie-baixa)]'
          : 'bg-[var(--color-superficie-alta)] hover:bg-[var(--color-superficie-baixa)]',
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-texto-suave)]">
        {cor && (
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: cor }}
          />
        )}
        {rotulo}
      </span>
      <span
        className="mt-1.5 font-mono text-[1.75rem] font-medium leading-none tabular-nums"
        style={{ color: cor ?? 'var(--color-texto)' }}
      >
        {quantidade}
      </span>
    </button>
  );
}

/**
 * O painel da direita.
 *
 * Mostra o que já se sabe do cartão e leva ao histórico completo. Não inventa dado:
 * o que não veio de `/painel/pacientes-do-dia` não aparece aqui — quem quiser o
 * detalhe clínico abre o histórico, onde ele existe de verdade.
 */
/**
 * Bloco 3 dos prints — o alerta de silêncio.
 *
 * A frase que justifica a existência deste bloco está no próprio print: ausência de
 * resposta não é ausência de necessidade. Internação, celular sem bateria e piora
 * sozinha em casa produzem exatamente o mesmo silêncio, e nenhuma delas é boa notícia.
 *
 * NÃO usa a cor da escala. As faixas de tempo não são classificação clínica: quem está
 * calado há 72 horas não foi classificado como vermelho, foi apenas não classificado.
 * Pintar de vermelho aqui inventaria uma gravidade que ninguém mediu, e é a mesma
 * razão pela qual o motor devolve estado próprio para o silêncio em vez de verde.
 */
function AlertaDeSilencio({ dados }: { dados: PacientesDoDia }) {
  const silencio =
    dados.silencio ??
    /* Espelho sintético e API antiga não mandam o resumo. Contar aqui mantém o bloco
       verdadeiro nos dois modos. */
    resumirSilencio(
      dados.cards.map((cartao) => ({
        pacienteId: cartao.pacienteId,
        nome: cartao.nome,
        situacao:
          cartao.situacao === 'NAO_CLASSIFICADA' ? 'SEM_CLASSIFICACAO' : cartao.situacao,
        diasSemResponder: cartao.diasSemResponder,
        nuncaRespondeu: cartao.nuncaRespondeu,
      })),
    );

  if (silencio.total === 0) return null;

  const faixas = [
    { chave: 'UM_DIA' as const, quantos: silencio.umDia },
    { chave: 'DOIS_DIAS' as const, quantos: silencio.doisDias },
    { chave: 'TRES_DIAS' as const, quantos: silencio.tresDias },
    { chave: 'UMA_SEMANA' as const, quantos: silencio.umaSemana },
    { chave: 'NUNCA_RESPONDEU' as const, quantos: silencio.nuncaRespondeu },
  ].filter((faixa) => faixa.quantos > 0);

  return (
    <div className="mb-4 rounded-[var(--radius-amplo)] border border-[var(--color-borda)] bg-[var(--color-superficie-alta)] p-5 shadow-[var(--sombra-cartao)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="rotulo text-[var(--color-texto-suave)]">Alerta de silêncio</p>
          <p className="mt-1.5 text-sm text-[var(--color-texto-suave)]">
            {silencio.total === 1
              ? '1 paciente não respondeu.'
              : `${silencio.total} pacientes não responderam.`}{' '}
            Ausência de resposta não é ausência de necessidade.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {faixas.map((faixa) => (
          <div
            key={faixa.chave}
            className="rounded-[var(--radius-sistema)] bg-[var(--color-superficie-baixa)] px-3.5 py-3"
          >
            <dd className="font-mono text-2xl tabular-nums leading-none text-[var(--color-texto)]">
              {faixa.quantos}
            </dd>
            <dt className="mt-1.5 text-xs leading-snug text-[var(--color-texto-fraco)]">
              {ROTULO_DA_FAIXA[faixa.chave]}
            </dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Blocos 2 e 8 — a estratificação, decomposta.
 *
 * Mostra os FATORES e não só o total. Um número de 0 a 15 sem decomposição é
 * caixa-preta, e o mesmo argumento que obriga o prontuário a exibir a regra que
 * classificou o sintoma obriga esta tela a dizer o que compôs o risco. Quem discorda
 * precisa conseguir apontar qual linha está errada.
 *
 * O selo de rascunho não é enfeite: enquanto `validadoClinicamente` for falso, nenhum
 * profissional pode tomar esse número por critério do serviço.
 */
function BlocoDeRisco({ risco }: { risco: ResultadoDaEstratificacao }) {
  const cor =
    risco.nivel === 'ALTO'
      ? 'var(--color-dado-5)'
      : risco.nivel === 'MEDIO'
        ? 'var(--color-dado-4)'
        : 'var(--color-dado-neutro)';

  return (
    <div className="border-t border-[var(--color-borda)] px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: cor }}
          />
          <span className="text-sm font-medium text-[var(--color-texto)]">
            {ROTULO_DO_NIVEL_DE_RISCO[risco.nivel]}
          </span>
        </span>
        <span className="font-mono text-sm tabular-nums text-[var(--color-texto-suave)]">
          {risco.pontuacao} {risco.pontuacao === 1 ? 'ponto' : 'pontos'}
        </span>
      </div>

      {!risco.validadoClinicamente && (
        <p className="mt-2 rounded-[var(--radius-sistema)] bg-[var(--color-superficie-baixa)] px-3 py-2 text-xs leading-relaxed text-[var(--color-texto-suave)]">
          Critério em rascunho ({risco.versaoDosPesos}), ainda não validado
          clinicamente. Serve para ordenar trabalho e não substitui julgamento.
        </p>
      )}

      {risco.fatores.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {risco.fatores.map((fator) => (
            <li
              key={`${fator.categoria}-${fator.descricao}`}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <span className="text-[var(--color-texto-suave)]">{fator.descricao}</span>
              <span className="shrink-0 font-mono tabular-nums text-[var(--color-texto-fraco)]">
                +{fator.pontos}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-[var(--color-texto-fraco)]">
          Nenhum fator de risco registrado.
        </p>
      )}

      {!risco.baseSuficiente && (
        <p className="mt-3 text-xs leading-relaxed text-[var(--color-texto-fraco)]">
          Sem ECOG ou sem avaliação de contexto social no cadastro. O que falta não
          aparece acima porque não foi perguntado, e não porque a resposta seja
          negativa.
        </p>
      )}
    </div>
  );
}

function PainelDeDetalhe({ cartao }: { cartao: CartaoDoPainel }) {
  const router = useRouter();
  const destino = `/painel/pacientes/${cartao.pacienteId}`;

  const linhas = [
    { rotulo: 'Situação', valor: ROTULO_DA_SITUACAO[cartao.situacao] },
    { rotulo: 'Protocolo', valor: cartao.protocolo },
    {
      rotulo: 'Dia do ciclo',
      valor: cartao.diaDoCiclo != null ? String(cartao.diaDoCiclo) : 'Sem ciclo aberto',
      mono: true,
    },
    { rotulo: 'Respondeu hoje', valor: cartao.respondeuHoje ? 'Sim' : 'Não' },
    { rotulo: 'Acompanhamento', valor: textoDoEstado(cartao) },
  ];

  return (
    <aside className="h-fit overflow-hidden rounded-[var(--radius-amplo)] border border-[var(--color-borda)] bg-[var(--color-superficie-alta)] shadow-[var(--sombra-cartao)]">
      <header className="border-b border-[var(--color-borda)] px-5 py-4">
        <SeloDeRisco situacao={cartao.situacao} />
        <h2 className="mt-2.5 text-lg font-semibold leading-tight text-[var(--color-texto)]">
          {cartao.nome}
        </h2>
      </header>

      <dl className="px-5 py-1">
        {linhas.map((linha) => (
          <div
            key={linha.rotulo}
            className="flex items-baseline justify-between gap-4 border-b border-[var(--color-borda)] py-2.5 last:border-b-0"
          >
            <dt className="text-sm text-[var(--color-texto-fraco)]">{linha.rotulo}</dt>
            <dd
              className={juntar(
                'text-right text-sm text-[var(--color-texto)]',
                linha.mono && 'font-mono tabular-nums',
              )}
            >
              {linha.valor}
            </dd>
          </div>
        ))}
      </dl>

      {cartao.risco && <BlocoDeRisco risco={cartao.risco} />}

      <div className="flex flex-col gap-2 border-t border-[var(--color-borda)] px-5 py-4">
        <LinkComoBotao href={destino} tamanho="amplo">
          Abrir histórico
        </LinkComoBotao>
        {cartao.situacao === 'NAO_CLASSIFICADA' && (
          <p className="text-xs leading-relaxed text-[var(--color-texto-fraco)]">
            Questionário começado e não terminado não recebe classificação. As duas causas
            mais prováveis são opostas; trate como pendência.
          </p>
        )}
      </div>

      {/* Atalho de teclado para quem trabalha de teclado o dia inteiro. */}
      <button
        type="button"
        onClick={() => router.push(destino)}
        className="sr-only focus:not-sr-only focus:block focus:px-5 focus:py-2 focus:text-sm"
      >
        Ir para o histórico de {cartao.nome}
      </button>
    </aside>
  );
}
