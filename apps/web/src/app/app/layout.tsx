'use client';

/**
 * Shell do app do paciente — mobile-first.
 *
 * Ref-base Brightharbor: tema sensível pede calor e tom de voz humano. O que a
 * pessoa vê ao abrir é o nome dela e o que falta fazer hoje, não um painel.
 *
 * Navegação embaixo, ao alcance do polegar, com cinco destinos no máximo. Nenhum
 * token de risco entra aqui — a escala de triagem vive só no painel da equipe.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Guarda } from '@/componentes/sistema/guarda';
import { juntar } from '@/componentes/sistema/primitivos';
import { useSessao } from '@/sistema/sessao';

const DESTINOS = [
  { href: '/app', rotulo: 'Hoje' },
  { href: '/app/historico', rotulo: 'Histórico' },
  { href: '/app/agenda', rotulo: 'Agenda' },
  { href: '/app/biblioteca', rotulo: 'Biblioteca' },
  { href: '/app/conta', rotulo: 'Conta' },
] as const;

export default function LayoutDoPaciente({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const { usuario, sair } = useSessao();
  const router = useRouter();

  return (
    <Guarda perfil="PACIENTE">
      <div className="flex min-h-dvh flex-col bg-[var(--color-superficie)]">
        <header className="border-b border-[var(--color-borda)] px-5 py-4">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[var(--color-texto-fraco)]">
                AUREA
              </p>
              <p className="text-sm text-[var(--color-texto-suave)]">
                {usuario?.nome ?? ''}
              </p>
            </div>
            <Link
              href="/app/notificacoes"
              className="rounded-[var(--radius-sistema)] px-3 py-2 text-sm text-[var(--color-texto-suave)] transition-colors hover:bg-[var(--color-superficie-baixa)] hover:text-[var(--color-texto)]"
            >
              Avisos
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 pb-28">{children}</main>

        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 border-t border-[var(--color-borda)] bg-[var(--color-superficie)]"
        >
          <ul className="mx-auto flex max-w-2xl">
            {DESTINOS.map(({ href, rotulo }) => {
              const ativo = href === '/app' ? caminho === href : caminho.startsWith(href);
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    aria-current={ativo ? 'page' : undefined}
                    className={juntar(
                      'flex flex-col items-center gap-1 py-3 text-xs transition-colors',
                      ativo
                        ? 'text-[var(--color-texto)] font-medium'
                        : 'text-[var(--color-texto-fraco)]',
                    )}
                  >
                    <span
                      className={juntar(
                        'h-0.5 w-6 rounded-full transition-colors',
                        ativo ? 'bg-[var(--color-superficie-invertida)]' : 'bg-transparent',
                      )}
                    />
                    {rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sair mora na Conta; este atalho existe só para o teclado não ficar sem saída. */}
        <button
          type="button"
          onClick={() => {
            sair();
            router.replace('/entrar');
          }}
          className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:rounded focus:bg-[var(--color-superficie-invertida)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--color-texto-invertido)]"
        >
          Sair
        </button>
      </div>
    </Guarda>
  );
}
