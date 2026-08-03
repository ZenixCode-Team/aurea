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
import { PESO_DA_SITUACAO, ROTULO_DA_SITUACAO } from '@/sistema/formato';
import type { CartaoDoPainel, PacientesDoDia, SituacaoNoPainel } from '@/sistema/tipos';

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

  const lista = useMemo(() => {
    if (!dados) return [];
    const filtrados = filtro ? dados.cards.filter((c) => c.situacao === filtro) : dados.cards;
    return [...filtrados].sort(
      (a, b) => PESO_DA_SITUACAO[a.situacao] - PESO_DA_SITUACAO[b.situacao],
    );
  }, [dados, filtro]);

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
      <header className="relative mb-5 overflow-hidden rounded-[var(--radius-amplo)] bg-[var(--color-verde-profundo)] shadow-[var(--sombra-elevada)]">
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
                  {lista.map((cartao) => {
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
                              {textoDoEstado(cartao)}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--color-texto-fraco)]">
                            {cartao.diaDoCiclo != null ? `D${cartao.diaDoCiclo}` : 'sem dia'}
                          </span>
                          <SeloDeRisco situacao={cartao.situacao} className="shrink-0" />
                        </button>
                      </li>
                    );
                  })}
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
