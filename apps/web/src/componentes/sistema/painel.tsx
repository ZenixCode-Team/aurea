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
import type { ReactNode } from 'react';
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
          <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--color-texto)]">
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

export function LinhaDeIndicadores({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">{children}</div>
  );
}

/**
 * Um número que merece um cartão só para ele.
 *
 * `tom` existe para os indicadores da escala de triagem — e só para eles. Um cartão
 * de contagem qualquer usa o tom neutro; pintar de âmbar um número que não é
 * classificação clínica é exatamente o que o ADR-004 proíbe.
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
      <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-[var(--color-texto-fraco)]">
        {rotulo}
      </span>
      <span
        className={juntar(
          'mt-2 block font-mono text-[2.5rem] font-medium leading-none tabular-nums',
          corDoValor,
        )}
      >
        {valor}
      </span>
      {apoio && (
        <span className="mt-1.5 block text-xs text-[var(--color-texto-fraco)]">{apoio}</span>
      )}
    </>
  );

  const estilo = juntar(
    'flex flex-col rounded-[var(--radius-amplo)] border px-5 py-4 text-left',
    'transition-all duration-150',
    selecionado
      ? 'border-[var(--color-superficie-invertida)] bg-[var(--color-superficie-alta)] shadow-[var(--sombra-elevada)]'
      : 'border-[var(--color-borda)] bg-[var(--color-superficie-alta)] shadow-[var(--sombra-cartao)]',
    aoClicar && 'hover:-translate-y-px hover:shadow-[var(--sombra-elevada)]',
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
  descricao,
  acao,
  children,
  semPadding = false,
}: {
  titulo?: string;
  descricao?: string;
  acao?: ReactNode;
  children: ReactNode;
  semPadding?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-amplo)] border border-[var(--color-borda)] bg-[var(--color-superficie-alta)] shadow-[var(--sombra-cartao)]">
      {(titulo || acao) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-borda)] px-5 py-4">
          <div>
            {titulo && (
              <h2 className="text-base font-semibold text-[var(--color-texto)]">{titulo}</h2>
            )}
            {descricao && (
              <p className="mt-1 text-sm text-[var(--color-texto-suave)]">{descricao}</p>
            )}
          </div>
          {acao && <div className="flex shrink-0 items-center gap-2">{acao}</div>}
        </header>
      )}
      <div className={semPadding ? undefined : 'p-5'}>{children}</div>
    </section>
  );
}

export function GradeDeBlocos({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{children}</div>;
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
} as const;

function Icone({ nome }: { nome: keyof typeof ICONES }) {
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

export function BarraLateral({
  produto,
  contexto,
  secoes,
  caminhoAtual,
  rodape,
}: {
  produto: string;
  contexto: string;
  secoes: readonly SecaoDeNavegacao[];
  caminhoAtual: string;
  rodape?: ReactNode;
}) {
  return (
    <aside className="flex w-[15rem] shrink-0 flex-col border-r border-[var(--color-borda)] bg-[var(--color-nav-fundo)]">
      <div className="flex items-center gap-2.5 px-4 py-4">
        {/* A marca em quadrado: âncora visual fixa, do jeito que Vercel e Mixpanel
            ancoram o topo da barra. */}
        <span className="flex h-7 w-7 items-center justify-center rounded-[0.5rem] bg-[var(--color-verde-profundo)] font-mono text-xs font-semibold text-[var(--color-lime)]">
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

      <nav aria-label="Navegação principal" className="flex-1 px-2.5">
        {secoes.map((secao, indice) => (
          <div key={secao.titulo ?? indice} className="mb-5">
            {secao.titulo && (
              <p className="mb-1 px-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-[var(--color-texto-fraco)]">
                {secao.titulo}
              </p>
            )}
            <ul className="flex flex-col gap-px">
              {secao.itens.map((item) => {
                /* Comparação exata na raiz da área e por prefixo nas demais: sem
                   isso, `/painel` ficaria aceso em toda tela do painel. */
                const ativo =
                  item.href.split('/').length <= 2
                    ? caminhoAtual === item.href
                    : caminhoAtual.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={ativo ? 'page' : undefined}
                      className={juntar(
                        'flex items-center gap-2.5 rounded-[0.5rem] px-2.5 py-[0.4375rem] text-sm',
                        'transition-colors duration-150',
                        /* Estado ativo por contraste sutil, não por bloco sólido: um
                           retângulo escuro no meio da barra puxa mais atenção que o
                           conteúdo da tela, e aqui o conteúdo é um paciente em risco. */
                        ativo
                          ? 'bg-[var(--color-superficie-alta)] font-medium text-[var(--color-texto)] shadow-[var(--sombra-cartao)]'
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

      {rodape && (
        <div className="border-t border-[var(--color-borda)] px-3 py-3">{rodape}</div>
      )}
    </aside>
  );
}
