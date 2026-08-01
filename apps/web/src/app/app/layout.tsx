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
import { AcaoDoTopo, Icone, type NomeDeIcone } from '@/componentes/sistema/painel';
import { juntar } from '@/componentes/sistema/primitivos';
import { useSessao } from '@/sistema/sessao';

const DESTINOS = [
  { href: '/app', rotulo: 'Hoje', icone: 'hoje' },
  { href: '/app/historico', rotulo: 'Histórico', icone: 'historico' },
  { href: '/app/agenda', rotulo: 'Agenda', icone: 'agenda' },
  { href: '/app/biblioteca', rotulo: 'Biblioteca', icone: 'orientacao' },
  { href: '/app/conta', rotulo: 'Conta', icone: 'conta' },
] as const satisfies readonly { href: string; rotulo: string; icone: NomeDeIcone }[];

export default function LayoutDoPaciente({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const { usuario, sair } = useSessao();
  const router = useRouter();

  return (
    <Guarda perfil="PACIENTE">
      <div className="flex min-h-dvh flex-col bg-[var(--color-superficie)]">
        {/* Mesma barra do topo dos painéis: 3.75rem, branca, filete embaixo, ação em
            botão redondo à direita. O que muda é o conteúdo, e a diferença é o produto
            inteiro — no painel o topo diz em que TELA a pessoa está, porque quem está
            de plantão troca de tela dezenas de vezes por turno; aqui diz QUEM a pessoa
            é, porque ela abre o app uma vez por dia e a tela em que está já é dita pela
            barra de baixo. Duplicar o título aqui seria ruído em 390px. */}
        <header className="flex h-[3.75rem] shrink-0 items-center border-b border-[var(--color-borda)] bg-[var(--color-superficie-alta)] px-5">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.5rem] bg-[var(--color-verde-profundo)] font-mono text-xs font-semibold text-[var(--color-lime)]">
                A
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-[var(--color-texto)]">
                  {usuario?.nome ?? 'AUREA'}
                </p>
                <p className="truncate text-xs leading-tight text-[var(--color-texto-fraco)]">
                  Acompanhamento diário
                </p>
              </div>
            </div>
            <AcaoDoTopo titulo="Avisos" href="/app/notificacoes" icone="aviso" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 pb-28">{children}</main>

        {/* A barra de baixo é o equivalente da lateral dos painéis, virada para o
            polegar. Ganhou os ícones do mesmo conjunto e o mesmo estado ativo em bloco
            preenchido — antes era um tracinho de 2px acima do rótulo, que num celular
            de 390px praticamente não se enxerga. */}
        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 border-t border-[var(--color-borda)] bg-[var(--color-superficie-alta)] pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="mx-auto flex max-w-2xl px-2 py-2">
            {DESTINOS.map(({ href, rotulo, icone }) => {
              const ativo = href === '/app' ? caminho === href : caminho.startsWith(href);
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    aria-current={ativo ? 'page' : undefined}
                    className={juntar(
                      'flex flex-col items-center gap-1 rounded-[0.625rem] py-2 text-xs',
                      'transition-colors duration-150',
                      ativo
                        ? 'bg-[var(--color-nav-ativo)] font-medium text-[var(--color-texto)]'
                        : 'text-[var(--color-texto-fraco)]',
                    )}
                  >
                    <Icone nome={icone} />
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
