'use client';

/**
 * 404 humano — a página não existe, mudou de lugar ou o link estava errado.
 *
 * ADR-004: centrada, mas com a marca no topo — o mesmo vocabulário visual das
 * telas de entrada, em vez de uma página órfã sem identidade.
 *
 * Sem código de erro cru. Quem chegou aqui só quer um caminho de volta —
 * de preferência para o espaço que já é dela.
 */

import { EstadoVazio, LinkComoBotao } from '@/componentes/sistema/primitivos';
import { DESTINO_POR_PERFIL, useSessao } from '@/sistema/sessao';

export default function NotFound() {
  const { usuario } = useSessao();
  const destino = usuario ? DESTINO_POR_PERFIL[usuario.perfil] : '/entrar';

  return (
    <main className="flex min-h-dvh flex-col bg-[var(--color-superficie)] px-6 py-8 sm:px-12">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-[0.5rem] bg-[var(--color-verde-profundo)] font-mono text-sm font-semibold text-[var(--color-lime)]">
          A
        </span>
        <span className="text-sm font-semibold tracking-tight text-[var(--color-texto)]">
          AUREA
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-[26rem]">
          <EstadoVazio
            titulo="Esta página não existe (ou mudou de lugar)."
            descricao="Confira o endereço ou volte para um lugar conhecido."
            acao={<LinkComoBotao href={destino}>Voltar</LinkComoBotao>}
          />
        </div>
      </div>
    </main>
  );
}
