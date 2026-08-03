'use client';

/**
 * Cartão que abre no lugar.
 *
 * Título e resumo sempre à vista; o texto longo entra abaixo, na mesma tela, quando
 * a pessoa toca. Usado no mural de sintomas e na biblioteca — as duas superfícies em
 * que alguém em tratamento vem procurar leitura, não navegação.
 *
 * POR QUE ABRIR NO LUGAR, E NÃO IR PARA OUTRA PÁGINA. Quem lê isto está comparando:
 * abre febre, lê, fecha, abre enjoo. Cada leitura em página separada custa uma ida e
 * uma volta, e a volta devolve a pessoa ao topo da lista, longe de onde ela estava.
 * A página por assunto continua existindo para link direto — a enfermagem manda o
 * endereço de um sintoma —, mas ela é o caminho secundário.
 *
 * UM ABERTO POR VEZ. Cinco explicações abertas viram uma parede de texto que ninguém
 * lê, e o mural deixa de ser mural. Abrir um fecha o anterior, e isso é regra do
 * grupo (`GrupoDeCartoesExpansiveis`), não de cada cartão.
 *
 * ACESSIBILIDADE. É `<button>` de verdade, com `aria-expanded` e `aria-controls`, e o
 * conteúdo sai do DOM quando fecha — leitor de tela não anuncia texto de um cartão
 * fechado, e o Tab não entra em botão invisível. `scroll-mt` no cabeçalho existe
 * porque o cartão que abre no fim da lista precisa subir para a vista.
 */

import { useId, useState, type ReactNode } from 'react';
import { juntar } from './primitivos';

export function CartaoExpansivel({
  titulo,
  resumo,
  aberto,
  aoAlternar,
  children,
}: {
  titulo: string;
  resumo?: string;
  aberto: boolean;
  aoAlternar(): void;
  children: ReactNode;
}) {
  const idDoConteudo = useId();

  return (
    <div
      className={juntar(
        'scroll-mt-4 overflow-hidden rounded-[0.75rem] border transition-colors duration-200',
        aberto
          ? 'border-[var(--color-borda-forte)] bg-[var(--color-superficie-alta)]'
          : 'border-[var(--color-borda)] bg-[var(--color-superficie)] hover:border-[var(--color-borda-forte)]',
      )}
    >
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberto}
        aria-controls={idDoConteudo}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-base font-medium text-[var(--color-texto)]">{titulo}</span>
          {resumo && (
            <span className="text-sm leading-relaxed text-[var(--color-texto-suave)]">
              {resumo}
            </span>
          )}
        </span>
        {/* Cruz que vira traço: diz o estado atual e o que o toque vai fazer, sem
            depender de cor nem de rótulo textual que precisaria de tradução. */}
        <span
          aria-hidden="true"
          className={juntar(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm leading-none transition-transform duration-200',
            aberto
              ? 'rotate-45 border-[var(--color-borda-forte)] text-[var(--color-texto)]'
              : 'border-[var(--color-borda)] text-[var(--color-texto-fraco)]',
          )}
        >
          +
        </span>
      </button>

      {aberto && (
        <div
          id={idDoConteudo}
          className="border-t border-[var(--color-borda)] px-4 pb-5 pt-5"
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Guarda qual cartão está aberto. Um por vez, por decisão — ver o cabeçalho.
 *
 * Devolve o par (aberto, alternar) para cada chave. A chave é do chamador: no mural é
 * o sintoma, na biblioteca é o id do verbete.
 */
export function useCartaoAberto() {
  const [abertoAgora, setAbertoAgora] = useState<string | null>(null);

  return {
    estaAberto: (chave: string) => abertoAgora === chave,
    alternar: (chave: string) =>
      setAbertoAgora((atual) => (atual === chave ? null : chave)),
  };
}
