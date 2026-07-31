'use client';

/**
 * Diálogo do sistema.
 *
 * Usa `<dialog>` nativo em vez de portal com overlay próprio: foco preso, Escape e
 * leitura por leitor de tela vêm de graça e corretos. Reimplementar isso à mão é
 * a origem clássica de modal inacessível.
 */

import { useEffect, useRef } from 'react';
import { Botao, juntar } from './primitivos';

export function Modal({
  aberto,
  titulo,
  descricao,
  aoFechar,
  children,
  rodape,
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  aoFechar(): void;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  const referencia = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = referencia.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  return (
    <dialog
      ref={referencia}
      onCancel={(evento) => {
        evento.preventDefault();
        aoFechar();
      }}
      onClick={(evento) => {
        /* Clique no backdrop fecha. O alvo é o próprio <dialog> só quando o
           clique cai fora do conteúdo. */
        if (evento.target === referencia.current) aoFechar();
      }}
      className={juntar(
        'm-auto w-[min(34rem,calc(100vw-2rem))] rounded-[var(--radius-sistema)] border',
        'border-[var(--color-borda-forte)] bg-[var(--color-superficie-alta)] p-0',
        'text-[var(--color-texto)] backdrop:bg-[rgba(20,32,26,0.4)]',
      )}
    >
      <div className="border-b border-[var(--color-borda)] px-5 py-4">
        <h2 className="text-lg font-medium">{titulo}</h2>
        {descricao && (
          <p className="mt-1 text-sm text-[var(--color-texto-suave)]">{descricao}</p>
        )}
      </div>

      <div className="px-5 py-4">{children}</div>

      <div className="flex justify-end gap-2 border-t border-[var(--color-borda)] px-5 py-3">
        {rodape ?? (
          <Botao variante="secundario" onClick={aoFechar}>
            Fechar
          </Botao>
        )}
      </div>
    </dialog>
  );
}
