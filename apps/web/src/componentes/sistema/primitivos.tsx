/**
 * Primitivos do sistema — do /entrar pra dentro.
 *
 * Não confundir com `componentes/primitivos.tsx`, que é da landing. São dois
 * vocabulários visuais de propósito: a landing vende, o sistema é usado todo dia
 * por alguém em tratamento e por alguém de plantão.
 *
 * LEI INVIOLÁVEL — `SeloDeRisco` e os tokens `--color-risco-*` só existem no
 * painel da equipe. Se aparecerem em qualquer tela sob `/app`, é bug clínico:
 * o paciente não vê cor de risco, nome de regra nem nome de campo.
 */

import Link from 'next/link';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from 'react';
import { ROTULO_DA_SITUACAO } from '@/sistema/formato';
import type { Classificacao, SituacaoNoPainel } from '@/sistema/tipos';

export function juntar(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/* ==========================================================================
   Botão
   ========================================================================== */

type VarianteDeBotao = 'principal' | 'secundario' | 'discreto' | 'perigo';
type TamanhoDeBotao = 'padrao' | 'amplo' | 'compacto';

const ESTILO_DO_BOTAO: Record<VarianteDeBotao, string> = {
  principal:
    'bg-[var(--color-superficie-invertida)] text-[var(--color-texto-invertido)] hover:bg-[#16221a]',
  secundario:
    'bg-transparent text-[var(--color-texto)] border border-[var(--color-borda-forte)] hover:bg-[var(--color-superficie-baixa)]',
  discreto:
    'bg-transparent text-[var(--color-texto-suave)] hover:text-[var(--color-texto)] hover:bg-[var(--color-superficie-baixa)]',
  perigo:
    'bg-[var(--color-risco-vermelho)] text-white hover:brightness-110',
};

const TAMANHO_DO_BOTAO: Record<TamanhoDeBotao, string> = {
  padrao: 'px-4 py-2.5 text-sm',
  /* Alvo de toque grande: o paciente pode estar com tremor ou fraqueza. */
  amplo: 'w-full px-5 py-4 text-base',
  compacto: 'px-2.5 py-1.5 text-xs',
};

interface PropsDoBotao extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteDeBotao;
  tamanho?: TamanhoDeBotao;
}

export function Botao({
  variante = 'principal',
  tamanho = 'padrao',
  className,
  ...resto
}: PropsDoBotao) {
  return (
    <button
      {...resto}
      className={juntar(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-sistema)] font-medium',
        'transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45',
        ESTILO_DO_BOTAO[variante],
        TAMANHO_DO_BOTAO[tamanho],
        className,
      )}
    />
  );
}

/**
 * Um link com aparência de botão.
 *
 * Existe para evitar `<Link><Botao/></Link>`, que produz `<a><button>` — aninhamento
 * interativo inválido. Leitor de tela anuncia dois controles onde há um, e o teclado
 * para duas vezes no mesmo destino. Quem navega, navega; quem age, age.
 */
export function LinkComoBotao({
  href,
  children,
  variante = 'principal',
  tamanho = 'padrao',
  className,
}: {
  href: string;
  children: ReactNode;
  variante?: VarianteDeBotao;
  tamanho?: TamanhoDeBotao;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={juntar(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-sistema)] font-medium',
        'transition-colors duration-150',
        ESTILO_DO_BOTAO[variante],
        TAMANHO_DO_BOTAO[tamanho],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ==========================================================================
   Campos
   ========================================================================== */

interface PropsDoCampo extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string;
  ajuda?: string;
  erro?: string;
  /** Números clínicos vão em mono: valor que se lê errado tem consequência. */
  mono?: boolean;
}

export function Campo({ rotulo, ajuda, erro, mono, className, id, ...resto }: PropsDoCampo) {
  const identificador = id ?? `campo-${rotulo.toLowerCase().replace(/\s+/g, '-')}`;
  const idDaAjuda = ajuda ? `${identificador}-ajuda` : undefined;
  const idDoErro = erro ? `${identificador}-erro` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={identificador} className="text-sm font-medium text-[var(--color-texto)]">
        {rotulo}
      </label>
      {ajuda && (
        <p id={idDaAjuda} className="text-xs text-[var(--color-texto-fraco)]">
          {ajuda}
        </p>
      )}
      <input
        {...resto}
        id={identificador}
        aria-describedby={juntar(idDaAjuda, idDoErro) || undefined}
        aria-invalid={erro ? true : undefined}
        className={juntar(
          'rounded-[var(--radius-sistema)] border bg-[var(--color-superficie-alta)] px-3 py-2.5 text-base',
          'text-[var(--color-texto)] placeholder:text-[var(--color-texto-fraco)]',
          'transition-colors duration-150',
          mono && 'font-mono tabular-nums',
          erro
            ? 'border-[var(--color-risco-vermelho)]'
            : 'border-[var(--color-borda-forte)] focus:border-[var(--color-texto-suave)]',
          className,
        )}
      />
      {erro && (
        <p id={idDoErro} role="alert" className="text-xs text-[var(--color-risco-vermelho)]">
          {erro}
        </p>
      )}
    </div>
  );
}

/**
 * Escolha de sim ou não em alvo grande.
 *
 * É o campo mais usado do check-in — toda porta de sintoma é uma destas. Botão
 * pequeno aqui custa uma resposta errada por dia em quem está com tremor.
 */
export function EscolhaSimNao({
  pergunta,
  ajuda,
  valor,
  aoEscolher,
}: {
  pergunta: string;
  ajuda?: string;
  valor: boolean | null;
  aoEscolher(valor: boolean): void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-lg leading-snug text-[var(--color-texto)]">{pergunta}</legend>
      {ajuda && <p className="text-sm text-[var(--color-texto-suave)]">{ajuda}</p>}
      <div className="flex gap-3">
        {[
          { texto: 'Sim', escolha: true },
          { texto: 'Não', escolha: false },
        ].map(({ texto, escolha }) => (
          <button
            key={texto}
            type="button"
            aria-pressed={valor === escolha}
            onClick={() => aoEscolher(escolha)}
            className={juntar(
              'flex-1 rounded-[var(--radius-sistema)] border px-5 py-4 text-base font-medium',
              'transition-colors duration-150',
              valor === escolha
                ? 'border-[var(--color-superficie-invertida)] bg-[var(--color-superficie-invertida)] text-[var(--color-texto-invertido)]'
                : 'border-[var(--color-borda-forte)] bg-[var(--color-superficie-alta)] text-[var(--color-texto)] hover:bg-[var(--color-superficie-baixa)]',
            )}
          >
            {texto}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/* ==========================================================================
   Superfícies
   ========================================================================== */

export function Cartao({
  children,
  className,
  comoArtigo = false,
}: {
  children: ReactNode;
  className?: string;
  comoArtigo?: boolean;
}) {
  const Elemento = comoArtigo ? 'article' : 'div';
  return (
    <Elemento
      className={juntar(
        'rounded-[var(--radius-amplo)] border border-[var(--color-borda)]',
        'bg-[var(--color-superficie-alta)] shadow-[var(--sombra-cartao)]',
        className,
      )}
    >
      {children}
    </Elemento>
  );
}

export function TituloDePagina({
  titulo,
  apoio,
  acao,
}: {
  titulo: string;
  apoio?: string;
  acao?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight text-[var(--color-texto)]">
          {titulo}
        </h1>
        {apoio && <p className="mt-1 text-sm text-[var(--color-texto-suave)]">{apoio}</p>}
      </div>
      {acao}
    </header>
  );
}

export function Rotulo({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-[var(--color-texto-fraco)]">
      {children}
    </span>
  );
}

/** Número clínico. Sempre mono, sempre tabular — coluna de valores tem que alinhar. */
export function Medida({ children }: { children: ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>;
}

/* ==========================================================================
   Estados — vazio, carregando, erro
   ========================================================================== */

export function EstadoVazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-sistema)] border border-dashed border-[var(--color-borda-forte)] px-6 py-12 text-center">
      <p className="text-base font-medium text-[var(--color-texto)]">{titulo}</p>
      {descricao && (
        <p className="max-w-md text-sm text-[var(--color-texto-suave)]">{descricao}</p>
      )}
      {acao}
    </div>
  );
}

export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <span className="sr-only">Carregando</span>
      {Array.from({ length: linhas }, (_, indice) => (
        <div
          key={indice}
          className="h-10 animate-pulse rounded-[var(--radius-sistema)] bg-[var(--color-superficie-baixa)]"
          style={{ animationDelay: `${indice * 90}ms` }}
        />
      ))}
    </div>
  );
}

export function Aviso({
  tom = 'informacao',
  titulo,
  children,
}: {
  tom?: 'informacao' | 'atencao' | 'grave';
  titulo?: string;
  children: ReactNode;
}) {
  const estilo = {
    informacao: 'border-[var(--color-borda-forte)] bg-[var(--color-superficie-baixa)]',
    atencao: 'border-[var(--color-risco-amarelo)] bg-[var(--color-risco-amarelo-fundo)]',
    grave: 'border-[var(--color-risco-vermelho)] bg-[var(--color-risco-vermelho-fundo)]',
  }[tom];

  return (
    <div
      role={tom === 'grave' ? 'alert' : 'status'}
      className={juntar('rounded-[var(--radius-sistema)] border px-4 py-3 text-sm', estilo)}
    >
      {titulo && <p className="mb-1 font-medium text-[var(--color-texto)]">{titulo}</p>}
      <div className="text-[var(--color-texto-suave)]">{children}</div>
    </div>
  );
}

/* ==========================================================================
   Tabela — densidade é qualidade no painel
   ========================================================================== */

export function Tabela({ children, rotulo }: { children: ReactNode; rotulo: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{rotulo}</caption>
        {children}
      </table>
    </div>
  );
}

export function CabecalhoDaTabela({ colunas }: { colunas: readonly string[] }) {
  return (
    <thead>
      <tr className="border-b border-[var(--color-borda-forte)]">
        {colunas.map((coluna) => (
          <th
            key={coluna}
            scope="col"
            className="px-3 py-2 text-left font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-[var(--color-texto-fraco)]"
          >
            {coluna}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function LinhaDaTabela({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLTableRowElement>;
}) {
  return (
    <tr
      onClick={onClick}
      className={juntar(
        'border-b border-[var(--color-borda)] last:border-0 hover:bg-[var(--color-superficie-baixa)]',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function Celula({
  children,
  mono = false,
  className,
}: {
  children: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={juntar(
        'px-3 py-2.5 align-top text-[var(--color-texto)]',
        mono && 'font-mono tabular-nums',
        className,
      )}
    >
      {children}
    </td>
  );
}

/* ==========================================================================
   Selo de risco — SOMENTE no painel da equipe
   ========================================================================== */

const ESTILO_DO_SELO: Record<SituacaoNoPainel, string> = {
  VERMELHO:
    'border-[var(--color-risco-vermelho)] bg-[var(--color-risco-vermelho-fundo)] text-[var(--color-risco-vermelho)]',
  AMARELO:
    'border-[var(--color-risco-amarelo)] bg-[var(--color-risco-amarelo-fundo)] text-[var(--color-risco-amarelo)]',
  VERDE:
    'border-[var(--color-risco-verde)] bg-[var(--color-risco-verde-fundo)] text-[var(--color-risco-verde)]',
  SEM_RESPOSTA_HOJE:
    'border-[var(--color-risco-silencio)] bg-[var(--color-risco-silencio-fundo)] text-[var(--color-risco-silencio)]',
  NAO_CLASSIFICADA:
    'border-[var(--color-risco-silencio)] bg-[var(--color-risco-silencio-fundo)] text-[var(--color-risco-silencio)]',
};

/**
 * A escala de triagem como selo.
 *
 * Traz o texto junto da cor de propósito: daltonismo é comum, plantão tem monitor
 * ruim, e classificação lida errado é dano clínico. Cor sozinha nunca é o sinal.
 */
export function SeloDeRisco({
  situacao,
  className,
}: {
  situacao: SituacaoNoPainel | Classificacao;
  className?: string;
}) {
  const chave = situacao as SituacaoNoPainel;
  return (
    <span
      className={juntar(
        'inline-flex items-center gap-1.5 rounded-[var(--radius-pilula)] border px-2.5 py-1',
        'text-xs font-medium',
        ESTILO_DO_SELO[chave],
        className,
      )}
    >
      {/* O ponto reforça a leitura de relance; o texto é que carrega o significado,
          porque daltonismo é comum e monitor de plantão é ruim. */}
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {ROTULO_DA_SITUACAO[chave]}
    </span>
  );
}

/**
 * Marca de conjunto não validado clinicamente.
 *
 * A API devolve `validadoClinicamente: false` enquanto ninguém com responsabilidade
 * clínica assinou os cortes. A interface é obrigada a mostrar — omitir seria
 * apresentar número provisório como se fosse conduta estabelecida.
 */
export function SeloDeNaoValidado() {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--color-borda-forte)] bg-[var(--color-superficie-baixa)] px-2.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[var(--color-texto-suave)]">
      Não validado clinicamente
    </span>
  );
}
