'use client';

/**
 * Peças de composição dos painéis — ADR-004.
 *
 * O que estava errado antes não era o tom, era o acabamento: as telas iam direto do
 * título para a tabela, sem hierarquia, sem entrada, sem respiro. Estas peças são a
 * gramática que as duas refs-base compartilham — trilha, título grande com contexto,
 * linha de indicadores, filtro em pílula, barra de progresso.
 *
 * A cor da escala de triagem não entra aqui. Navegação e superfície usam o verde
 * institucional e os neutros; sage, âmbar e terracota continuam significando uma
 * coisa só.
 */

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { juntar } from './primitivos';

/* ==========================================================================
   Trilha e cabeçalho
   ========================================================================== */

export interface PassoDaTrilha {
  readonly rotulo: string;
  readonly href?: string;
}

/** Breadcrumb. Diz onde a pessoa está sem obrigá-la a deduzir pelo menu. */
export function Trilha({ passos }: { passos: readonly PassoDaTrilha[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-texto-fraco)]">
        {passos.map((passo, indice) => {
          const ultimo = indice === passos.length - 1;
          return (
            <li key={passo.rotulo} className="flex items-center gap-1.5">
              {passo.href && !ultimo ? (
                <Link
                  href={passo.href}
                  className="transition-colors hover:text-[var(--color-texto)]"
                >
                  {passo.rotulo}
                </Link>
              ) : (
                <span
                  className={ultimo ? 'font-medium text-[var(--color-texto)]' : undefined}
                  aria-current={ultimo ? 'page' : undefined}
                >
                  {passo.rotulo}
                </span>
              )}
              {!ultimo && <span aria-hidden>›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * A entrada da tela.
 *
 * Título grande, e abaixo dele uma linha explicando o que aquela tela mostra. As duas
 * refs fazem isso e o motivo é prático: quem abre um painel clínico pela primeira vez
 * não deveria precisar inferir o recorte dos dados a partir dos nomes das colunas.
 */
export function CabecalhoDePainel({
  trilha,
  titulo,
  descricao,
  acao,
}: {
  trilha?: readonly PassoDaTrilha[];
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {trilha && <Trilha passos={trilha} />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="titulo text-[2.125rem] leading-[1.05] text-[var(--color-texto)]">
            {titulo}
          </h1>
          {descricao && (
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-texto-suave)]">
              {descricao}
            </p>
          )}
        </div>
        {acao && <div className="flex shrink-0 items-center gap-2">{acao}</div>}
      </div>
    </header>
  );
}

/* ==========================================================================
   Indicadores
   ========================================================================== */

/**
 * A grade de indicadores — malha contínua de filete, não cartões soltos.
 *
 * Os números dividem uma moldura só e são separados por 1px, do jeito da ref. A
 * diferença com a versão anterior (cartões com `gap-3`, borda e sombra cada um) não é
 * decorativa: cartão isolado é lido como objeto independente, e estes números são
 * faces do MESMO recorte de dados. Malha diz isso sem legenda.
 *
 * A técnica: cada célula desenha borda direita e inferior, e a grade sobe 1px para
 * fora do contêiner (`-mb-px -mr-px`), que corta as bordas da última coluna e da
 * última linha. Funciona com qualquer quantidade de células, inclusive linha
 * incompleta — que é o caso da metade das telas aqui.
 */
export function LinhaDeIndicadores({
  children,
  colunas = 'painel',
}: {
  children: ReactNode;
  /**
   * `painel` — 2 no estreito, 4 no largo. É o recorte das telas de equipe.
   * `tres` — 3 em qualquer largura, para o app do paciente: são poucos números e
   * eles precisam caber lado a lado num celular, sem virar uma coluna comprida que
   * empurra o check-in para fora da tela.
   */
  colunas?: 'painel' | 'tres';
}) {
  return (
    <div
      className={juntar(
        'overflow-hidden rounded-[var(--radius-amplo)] border border-[var(--color-borda)]',
        'bg-[var(--color-superficie-alta)] shadow-[var(--sombra-cartao)]',
        /* A margem é do recorte do painel, onde as telas empilham blocos sem
           contêiner com `gap`. O app do paciente usa coluna com `gap`, e margem
           aqui somaria com ela. */
        colunas === 'painel' && 'mb-6',
      )}
    >
      <div
        className={juntar(
          '-mr-px -mb-px grid',
          colunas === 'tres' ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Um número dentro da malha.
 *
 * `tom` existe para os indicadores da escala de triagem — e só para eles. Um cartão
 * de contagem qualquer usa o tom neutro; pintar de âmbar um número que não é
 * classificação clínica é exatamente o que o ADR-004 proíbe.
 *
 * `apoio` virou a linha de rodapé do número, no lugar da ref para o "vs last week".
 * Sem seta e sem cor: na ref, verde para cima e vermelho para baixo dizem "melhorou"
 * e "piorou". Aqui verde e vermelho já significam classificação de risco de paciente,
 * e um segundo significado para a mesma cor na mesma tela é o tipo de ambiguidade que
 * este produto não pode ter.
 */
export function CartaoDeIndicador({
  rotulo,
  valor,
  apoio,
  tom = 'neutro',
  selecionado = false,
  aoClicar,
}: {
  rotulo: string;
  valor: number | string;
  apoio?: string;
  tom?: 'neutro' | 'verde' | 'amarelo' | 'vermelho' | 'silencio';
  selecionado?: boolean;
  aoClicar?(): void;
}) {
  const corDoValor = {
    neutro: 'text-[var(--color-texto)]',
    verde: 'text-[var(--color-risco-verde)]',
    amarelo: 'text-[var(--color-risco-amarelo)]',
    vermelho: 'text-[var(--color-risco-vermelho)]',
    silencio: 'text-[var(--color-risco-silencio)]',
  }[tom];

  const conteudo = (
    <>
      <span className="text-sm font-medium text-[var(--color-texto-suave)]">{rotulo}</span>
      <span
        className={juntar(
          'mt-3 block text-[2.25rem] font-semibold leading-none tracking-[-0.02em] tabular-nums',
          corDoValor,
        )}
      >
        {valor}
      </span>
      <span className="mt-3 block text-xs text-[var(--color-texto-fraco)]">
        {apoio ?? ' '}
      </span>
    </>
  );

  const estilo = juntar(
    'flex flex-col border-r border-b border-[var(--color-borda)] px-5 py-5 text-left',
    'transition-colors duration-150',
    selecionado ? 'bg-[var(--color-superficie-baixa)]' : 'bg-[var(--color-superficie-alta)]',
    aoClicar && !selecionado && 'hover:bg-[var(--color-superficie-baixa)]',
  );

  if (!aoClicar) return <div className={estilo}>{conteudo}</div>;

  return (
    <button type="button" aria-pressed={selecionado} onClick={aoClicar} className={estilo}>
      {conteudo}
    </button>
  );
}

/* ==========================================================================
   Bloco de conteúdo
   ========================================================================== */

/**
 * O contêiner padrão de qualquer lista, tabela ou gráfico.
 *
 * Título e descrição ficam dentro do bloco, no topo, separados do conteúdo por uma
 * linha — é o padrão dos cartões de gráfico do Airtable, e resolve o problema de
 * tabela solta na página sem dizer o que é.
 */
export function Bloco({
  titulo,
  selo,
  descricao,
  acao,
  children,
  semPadding = false,
}: {
  titulo?: string;
  /** Pastilha ao lado do título, como o "66.9%" da ref. Opcional de propósito. */
  selo?: ReactNode;
  descricao?: string;
  acao?: ReactNode;
  children: ReactNode;
  semPadding?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-amplo)] border border-[var(--color-borda)] bg-[var(--color-superficie-alta)] shadow-[var(--sombra-cartao)]">
      {(titulo || acao) && (
        <header
          className={juntar(
            'flex flex-wrap items-start justify-between gap-3 px-5 pt-5',
            /* Filete separando cabeçalho e corpo só quando o corpo vai de borda a
               borda — tabela e lista precisam do corte; bloco com respiro interno não,
               e é assim que a ref monta o cartão do gráfico. */
            semPadding ? 'border-b border-[var(--color-borda)] pb-4' : 'pb-4',
          )}
        >
          <div>
            {/* Sem `.titulo` no `h2`: a Bricolage fica só no `h1`. Em 17px, e repetida
                em cinco blocos na mesma tela, a idiossincrasia dela vira ruído — e o
                título de bloco compete com o `h1` em vez de se subordinar a ele. O peso
                da sans já dá a hierarquia que este nível precisa. */}
            <div className="flex flex-wrap items-center gap-2">
              {titulo && (
                <h2 className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-[var(--color-texto)]">
                  {titulo}
                </h2>
              )}
              {selo}
            </div>
            {descricao && (
              <p className="mt-1 text-sm text-[var(--color-texto-suave)]">{descricao}</p>
            )}
          </div>
          {acao && <div className="flex shrink-0 items-center gap-2">{acao}</div>}
        </header>
      )}
      <div className={semPadding ? undefined : 'px-5 pb-5'}>{children}</div>
    </section>
  );
}

/** Pastilha de destaque ao lado de um título. Neutra: cor aqui não classifica nada. */
export function SeloDeBloco({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pilula)] bg-[var(--color-superficie-baixa)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--color-texto-suave)]">
      {children}
    </span>
  );
}

export function GradeDeBlocos({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{children}</div>;
}

/* ==========================================================================
   Gráfico de volume — paleta de dados (ADR-005)
   ========================================================================== */

/** As seis séries da paleta não-clínica, na ordem de uso. */
export const CORES_DE_DADO = [
  'var(--color-dado-1)',
  'var(--color-dado-2)',
  'var(--color-dado-3)',
  'var(--color-dado-4)',
  'var(--color-dado-5)',
  'var(--color-dado-neutro)',
] as const;

export interface ColunaDeVolume {
  readonly rotulo: string;
  /** Uma parcela por série, na ordem de `series`. */
  readonly partes: readonly number[];
}

/**
 * Barras empilhadas, em SVG puro.
 *
 * Sem biblioteca de gráfico: são retângulos com altura proporcional, e `recharts`
 * custaria mais em bytes do que todo o design system deste projeto. Quando existir
 * eixo com escala, tooltip ancorado e zoom, aí a dependência se paga — e aí vira ADR.
 *
 * A cor sai de `CORES_DE_DADO` por índice. Nenhuma série aceita cor arbitrária, e isso
 * é a trava: quem quiser pintar uma barra de vermelho precisa alterar este arquivo, e
 * nesse momento vai ler o porquê de não poder.
 *
 * Acessibilidade: a leitura do gráfico nunca depende da cor. Cada coluna tem `title`
 * com os números por extenso, e a legenda repete rótulo e valor em texto.
 */
export function BarrasDeVolume({
  colunas,
  series,
  titulo,
}: {
  colunas: readonly ColunaDeVolume[];
  /** Nome de cada série, na mesma ordem das parcelas. */
  series: readonly string[];
  titulo: string;
}) {
  const totalPorColuna = colunas.map((coluna) =>
    coluna.partes.reduce((soma, parte) => soma + parte, 0),
  );
  const maximo = Math.max(...totalPorColuna, 1);

  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="sr-only">{titulo}</figcaption>

      {/* A área de plotagem precisa de altura RESOLVIDA, não automática: barra com
          `height` em porcentagem mede contra o pai, e pai de altura automática resolve
          para zero — foi assim que a primeira versão desenhou a legenda certa e nenhuma
          barra. Daí a coluna ter altura fixa, a área ser `flex-1` dentro dela e a barra
          ser absoluta ancorada na base. */}
      <div className="flex h-44 gap-1.5" role="img" aria-label={titulo}>
        {colunas.map((coluna, indiceDaColuna) => {
          const total = totalPorColuna[indiceDaColuna] ?? 0;
          return (
            <div
              key={coluna.rotulo}
              className="flex min-w-0 flex-1 flex-col"
              title={`${coluna.rotulo}: ${total}`}
            >
              <div className="relative flex-1">
                {/* Teto de largura: com poucas colunas a barra esticava até virar
                    faixa chapada, que não se lê como gráfico. */}
                <div
                  className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[5rem] flex-col-reverse overflow-hidden rounded-[0.3125rem] bg-[var(--color-superficie-baixa)]"
                  style={{ height: `${Math.max((total / maximo) * 100, total > 0 ? 3 : 0)}%` }}
                >
                  {coluna.partes.map((parte, indiceDaSerie) =>
                    parte === 0 ? null : (
                      <span
                        key={series[indiceDaSerie] ?? indiceDaSerie}
                        style={{
                          height: `${(parte / Math.max(total, 1)) * 100}%`,
                          backgroundColor:
                            CORES_DE_DADO[indiceDaSerie % CORES_DE_DADO.length],
                        }}
                      />
                    ),
                  )}
                </div>
              </div>
              <span className="w-full truncate pt-2 text-center font-mono text-[0.625rem] text-[var(--color-texto-fraco)]">
                {coluna.rotulo}
              </span>
            </div>
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((serie, indice) => {
          const total = colunas.reduce((soma, coluna) => soma + (coluna.partes[indice] ?? 0), 0);
          if (total === 0) return null;
          return (
            <li
              key={serie}
              className="flex items-center gap-1.5 text-xs text-[var(--color-texto-suave)]"
            >
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: CORES_DE_DADO[indice % CORES_DE_DADO.length] }}
              />
              {serie}
              <span className="font-mono tabular-nums text-[var(--color-texto-fraco)]">
                {total}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

/* ==========================================================================
   Filtro em pílula
   ========================================================================== */

export function FiltroEmPilula({
  rotulo,
  valor,
  ativo = false,
  aoClicar,
}: {
  rotulo: string;
  valor?: string;
  ativo?: boolean;
  aoClicar(): void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={juntar(
        'inline-flex items-center gap-2 rounded-[var(--radius-pilula)] border px-3.5 py-1.5 text-sm',
        'transition-colors duration-150',
        ativo
          ? 'border-[var(--color-superficie-invertida)] bg-[var(--color-superficie-invertida)] text-[var(--color-texto-invertido)]'
          : 'border-[var(--color-borda-forte)] bg-[var(--color-superficie-alta)] text-[var(--color-texto-suave)] hover:bg-[var(--color-superficie-baixa)] hover:text-[var(--color-texto)]',
      )}
    >
      {rotulo}
      {valor && <span className="font-mono text-xs tabular-nums opacity-70">{valor}</span>}
    </button>
  );
}

/* ==========================================================================
   Progresso
   ========================================================================== */

/**
 * Barra de proporção — o padrão de "gasto sobre orçado" do Quicken.
 *
 * Aqui serve para dia do ciclo e para adesão ao check-in. Sempre acompanhada do
 * número: barra sozinha comunica ordem de grandeza, não valor, e valor clínico
 * precisa ser lido, não estimado.
 */
export function BarraDeProgresso({
  atual,
  total,
  rotulo,
  descricao,
}: {
  atual: number;
  total: number;
  rotulo?: string;
  descricao?: string;
}) {
  const proporcao = total > 0 ? Math.min(Math.max(atual / total, 0), 1) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      {(rotulo || descricao) && (
        <div className="flex items-baseline justify-between gap-3 text-sm">
          {rotulo && <span className="text-[var(--color-texto-suave)]">{rotulo}</span>}
          {descricao && (
            <span className="font-mono text-xs tabular-nums text-[var(--color-texto-fraco)]">
              {descricao}
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={atual}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={rotulo ?? 'Progresso'}
        className="h-2 w-full overflow-hidden rounded-[var(--radius-pilula)] bg-[var(--color-superficie-baixa)]"
      >
        <div
          className="h-full rounded-[var(--radius-pilula)] bg-[var(--color-sage)] transition-[width] duration-300 ease-[var(--ease-saida)]"
          style={{ width: `${proporcao * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ==========================================================================
   Barra lateral
   ========================================================================== */

export interface SecaoDeNavegacao {
  readonly titulo?: string;
  readonly itens: readonly {
    readonly href: string;
    readonly rotulo: string;
    /** Glifo do conjunto abaixo. Ícone é âncora de memória, não enfeite. */
    readonly icone?: keyof typeof ICONES;
  }[];
}

/**
 * Ícones traçados à mão, em SVG inline.
 *
 * Sem biblioteca de ícones: são oito glifos, e uma dependência inteira para isso
 * custaria mais em bytes do que o sistema todo economiza. Traço de 1.5, cantos
 * arredondados, todos no mesmo grid de 20 — é o que faz um conjunto parecer
 * desenhado junto em vez de colhido de lugares diferentes.
 */
const ICONES = {
  pacientes: 'M3 17.5c0-2.5 2.7-4 6-4s6 1.5 6 4M9 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  contato: 'M4 5.5h11a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H8l-3.5 2.5V7A1.5 1.5 0 0 1 4 5.5Z',
  conta: 'M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3.5 17c0-2.8 2.9-4.5 6.5-4.5s6.5 1.7 6.5 4.5',
  algoritmo: 'M3.5 6h13M3.5 10h13M3.5 14h13M7 3.5v13M13 3.5v13',
  orientacao: 'M5 3.5h10v13l-5-3-5 3v-13ZM8 8h4',
  protocolo: 'M6 3.5h8a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1ZM8 7h4M8 10h4M8 13h2',
  medicamento: 'M7.5 4.5h5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1ZM10 7.5v5M7.5 10h5',
  cadastro: 'M4 16v-1.5c0-1.7 1.8-3 4-3s4 1.3 4 3V16M8 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM14.5 8v4M12.5 10h4',
  auditoria: 'M4 4.5h12v11H4v-11ZM7 8h6M7 11h6M7 14h3',
  /* Glifo do botão que recolhe a barra — o mesmo retângulo dividido da ref. */
  barra: 'M3.5 4.5h13a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1ZM7.5 4.5v11',
  /* Os quatro abaixo são do app do paciente. Mesmo grid de 20 e mesmo traço de 1.5:
     um conjunto desenhado junto, e não glifos colhidos de lugares diferentes. */
  hoje: 'M10 3.5v1.5M10 15v1.5M3.5 10H5M15 10h1.5M5.4 5.4l1 1M13.6 13.6l1 1M14.6 5.4l-1 1M6.4 13.6l-1 1M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  historico: 'M10 16.5a6.5 6.5 0 1 0-6.5-6.5M10 6.5V10l2.5 1.5M3.5 10 5.5 8M3.5 10 1.5 8',
  agenda: 'M4.5 5h11a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM3.5 8.5h13M7 3.5v3M13 3.5v3',
  aviso: 'M10 3.5a4.5 4.5 0 0 1 4.5 4.5v3l1.5 2h-12l1.5-2V8A4.5 4.5 0 0 1 10 3.5ZM8.5 15.5a1.5 1.5 0 0 0 3 0',
} as const;

export type NomeDeIcone = keyof typeof ICONES;

export function Icone({ nome }: { nome: NomeDeIcone }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-[18px] w-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICONES[nome]} />
    </svg>
  );
}

/**
 * Um item da navegação está ativo quando é a raiz exata da área ou prefixo do caminho.
 *
 * Sem a distinção, `/painel` ficaria aceso em toda tela do painel. Exportado porque a
 * barra do topo tira daqui o título e o ícone da tela — o mesmo item, um lugar só.
 */
function itemAtivo(secoes: readonly SecaoDeNavegacao[], caminho: string) {
  for (const secao of secoes) {
    for (const item of secao.itens) {
      const ativo =
        item.href.split('/').length <= 2
          ? caminho === item.href
          : caminho.startsWith(item.href);
      if (ativo) return item;
    }
  }
  return null;
}

export function BarraLateral({
  produto,
  contexto,
  secoes,
  caminhoAtual,
  destaque,
  rodape,
  className,
}: {
  produto: string;
  contexto: string;
  secoes: readonly SecaoDeNavegacao[];
  caminhoAtual: string;
  /** Bloco de aviso acima do rodapé — o lugar do "CHANGELOG" na ref. */
  destaque?: ReactNode;
  rodape?: ReactNode;
  /** Só para esconder a lateral onde ela não cabe. Ver `barraInferior` no shell. */
  className?: string;
}) {
  return (
    <aside
      className={juntar(
        'h-dvh w-[16rem] shrink-0 flex-col border-r border-[var(--color-borda)] bg-[var(--color-nav-fundo)]',
        className ?? 'flex',
      )}
    >
      <div className="flex items-center gap-2.5 px-4 py-[0.9375rem]">
        {/* A marca em quadrado: âncora visual fixa, do jeito que Vercel e Mixpanel
            ancoram o topo da barra. */}
        <span className="flex h-7 w-7 items-center justify-center rounded-[0.5rem] bg-[var(--color-azul-profundo)] font-mono text-xs font-semibold text-[var(--color-lime)]">
          A
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-[var(--color-texto)]">
            {produto}
          </p>
          <p className="truncate text-xs leading-tight text-[var(--color-texto-fraco)]">
            {contexto}
          </p>
        </div>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 pt-3">
        {secoes.map((secao, indice) => (
          <div key={secao.titulo ?? indice} className="mb-6">
            {secao.titulo && (
              /* Rótulo de seção em caixa normal, como na ref. Versalete com
                 espacejamento largo competia com os próprios itens da lista. */
              <p className="mb-1.5 px-3 text-sm font-medium text-[var(--color-texto-fraco)]">
                {secao.titulo}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {secao.itens.map((item) => {
                const ativo = itemAtivo(secoes, caminhoAtual)?.href === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={ativo ? 'page' : undefined}
                      className={juntar(
                        'flex items-center gap-3 rounded-[0.625rem] px-3 py-2 text-[0.9375rem]',
                        'transition-colors duration-150',
                        /* Estado ativo como bloco preenchido, e não como cartão branco
                           com sombra: a barra agora é a mesma superfície do conteúdo, e
                           branco sobre branco não marcava nada. O preenchimento é tinta
                           a 6% — presente sem virar o objeto mais escuro da tela, que
                           num painel clínico precisa ser o paciente em risco. */
                        ativo
                          ? 'bg-[var(--color-nav-ativo)] font-medium text-[var(--color-texto)]'
                          : 'text-[var(--color-texto-suave)] hover:bg-[var(--color-nav-hover)] hover:text-[var(--color-texto)]',
                      )}
                    >
                      {item.icone && <Icone nome={item.icone} />}
                      <span className="truncate">{item.rotulo}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {destaque && (
        <div className="border-t border-[var(--color-borda)] px-4 py-4">{destaque}</div>
      )}

      {rodape && (
        <div className="border-t border-[var(--color-borda)] px-4 py-3">{rodape}</div>
      )}

      <p className="px-4 pb-3 text-xs text-[var(--color-texto-fraco)]">
        © {new Date().getFullYear()} AUREA
      </p>
    </aside>
  );
}

/* ==========================================================================
   Barra do topo e shell
   ========================================================================== */

/**
 * Barra do topo.
 *
 * Título e ícone saem do item de navegação ativo — não há prop de título, e isso é
 * intencional: título digitado à mão em cada tela é a coisa que sai do lugar quando
 * alguém renomeia um item do menu e esquece do resto.
 *
 * À direita entram só ações que existem de verdade. A ref tem avião de papel e sino;
 * aqui, botão que não leva a lugar nenhum num painel clínico é pior que ausência de
 * botão — quem está de plantão clica, espera e perde tempo.
 */
export function BarraDoTopo({
  secoes,
  caminhoAtual,
  aoAlternarBarra,
  barraVisivel,
  acoes,
  ocultarAlternador,
}: {
  secoes: readonly SecaoDeNavegacao[];
  caminhoAtual: string;
  aoAlternarBarra(): void;
  barraVisivel: boolean;
  acoes?: ReactNode;
  /** Some onde a lateral já está escondida: recolher o que não aparece confunde. */
  ocultarAlternador?: boolean;
}) {
  const atual = itemAtivo(secoes, caminhoAtual);

  /* Sem `sticky`: quem rola é a área de conteúdo, não a página. A barra é irmã dela na
     coluna flex e já fica parada por construção — `sticky` aqui seria decoração que
     não faz nada, do tipo que confunde quem vier depois. */
  return (
    <header className="z-10 flex h-[3.75rem] shrink-0 items-center gap-4 border-b border-[var(--color-borda)] bg-[var(--color-superficie-alta)] px-4">
      <button
        type="button"
        onClick={aoAlternarBarra}
        aria-pressed={barraVisivel}
        aria-label={barraVisivel ? 'Recolher a navegação' : 'Mostrar a navegação'}
        className={juntar(
          'h-9 w-9 items-center justify-center rounded-[0.625rem] text-[var(--color-texto-suave)] transition-colors hover:bg-[var(--color-nav-hover)] hover:text-[var(--color-texto)]',
          ocultarAlternador ? 'hidden lg:flex' : 'flex',
        )}
      >
        <Icone nome="barra" />
      </button>

      {atual && (
        <div className="flex min-w-0 items-center gap-2.5 text-[var(--color-texto)]">
          {atual.icone && <Icone nome={atual.icone} />}
          <span className="truncate text-[0.9375rem] font-medium">{atual.rotulo}</span>
        </div>
      )}

      {acoes && <div className="ml-auto flex items-center gap-2">{acoes}</div>}
    </header>
  );
}

/**
 * Botão redondo de ação da barra do topo — o formato dos três da ref.
 * Sempre com `titulo`, porque ícone sozinho não diz o que faz.
 */
export function AcaoDoTopo({
  titulo,
  href,
  icone,
  aoClicar,
}: {
  titulo: string;
  href?: string;
  icone: keyof typeof ICONES;
  aoClicar?(): void;
}) {
  const estilo =
    'flex h-9 w-9 items-center justify-center rounded-[0.625rem] border border-[var(--color-borda)] bg-[var(--color-superficie-alta)] text-[var(--color-texto-suave)] transition-colors hover:bg-[var(--color-superficie-baixa)] hover:text-[var(--color-texto)]';

  if (href) {
    return (
      <Link href={href} title={titulo} aria-label={titulo} className={estilo}>
        <Icone nome={icone} />
      </Link>
    );
  }

  return (
    <button type="button" title={titulo} aria-label={titulo} onClick={aoClicar} className={estilo}>
      <Icone nome={icone} />
    </button>
  );
}

/**
 * O shell inteiro: barra lateral, barra do topo e área de conteúdo.
 *
 * Existe porque os dois layouts — plantão e administração — montavam a mesma estrutura
 * lado a lado, e toda mudança de forma precisava ser feita duas vezes. Agora muda aqui.
 * A barra lateral rola sozinha e o conteúdo também; só o topo fica fixo.
 */
export function ShellDePainel({
  produto,
  contexto,
  secoes,
  caminhoAtual,
  destaque,
  rodape,
  acoes,
  barraInferior,
  larguraDoConteudo = 'ampla',
  children,
}: {
  produto: string;
  contexto: string;
  secoes: readonly SecaoDeNavegacao[];
  caminhoAtual: string;
  destaque?: ReactNode;
  rodape?: ReactNode;
  acoes?: ReactNode;
  /**
   * Navegação alternativa para telas estreitas — na prática, a barra de polegar do
   * app do paciente.
   *
   * Quando vem preenchida, a lateral some abaixo de `lg` e esta barra aparece no
   * lugar. Quando não vem, nada muda: os painéis da equipe e da administração
   * continuam com a lateral em qualquer largura, que é o comportamento que eles já
   * tinham. A escolha de amarrar as duas coisas na MESMA prop é deliberada — quem
   * esconder a lateral no celular é obrigado, pelo tipo, a dizer o que entra no
   * lugar dela. Não existe estado "sem navegação nenhuma".
   */
  barraInferior?: ReactNode;
  /**
   * `ampla` (80rem) para tabela de plantão; `leitura` (56rem) para texto corrido.
   * O app do paciente é texto: 80rem faz a linha passar de 120 caracteres, e aí
   * o olho perde a volta da linha.
   */
  larguraDoConteudo?: 'ampla' | 'leitura';
  children: ReactNode;
}) {
  const [barraVisivel, setBarraVisivel] = useState(true);

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--color-superficie)]">
      {barraVisivel && (
        <BarraLateral
          produto={produto}
          contexto={contexto}
          secoes={secoes}
          caminhoAtual={caminhoAtual}
          destaque={destaque}
          rodape={rodape}
          className={barraInferior ? 'hidden lg:flex' : undefined}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <BarraDoTopo
          secoes={secoes}
          caminhoAtual={caminhoAtual}
          barraVisivel={barraVisivel}
          aoAlternarBarra={() => setBarraVisivel((visivel) => !visivel)}
          acoes={acoes}
          ocultarAlternador={Boolean(barraInferior)}
        />
        <main
          className={juntar(
            'min-w-0 flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-7',
            Boolean(barraInferior) && 'pb-28 lg:pb-7',
          )}
        >
          <div
            className={juntar(
              'mx-auto',
              larguraDoConteudo === 'leitura' ? 'max-w-[56rem]' : 'max-w-[80rem]',
            )}
          >
            {children}
          </div>
        </main>
        {barraInferior ? <div className="lg:hidden">{barraInferior}</div> : null}
      </div>
    </div>
  );
}
