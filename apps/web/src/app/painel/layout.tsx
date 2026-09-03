'use client';

/**
 * Shell do painel da equipe — ADR-004.
 *
 * Barra lateral persistente, no lugar do menu horizontal fino que havia antes. Quem
 * está de plantão alterna entre a lista do dia, um paciente e a fila de contatos
 * dezenas de vezes por turno: a navegação precisa estar sempre no mesmo lugar, com o
 * destino atual marcado, e não competindo por espaço com o título da tela.
 *
 * A identidade de quem está logado fica no rodapé da barra, não no topo — o topo é
 * do conteúdo. É o padrão das duas refs-base.
 */

import { usePathname, useRouter } from 'next/navigation';
import { Guarda } from '@/componentes/sistema/guarda';
import Link from 'next/link';
import {
  AcaoDoTopo,
  Icone,
  ShellDePainel,
  type SecaoDeNavegacao,
} from '@/componentes/sistema/painel';
import { Botao, juntar } from '@/componentes/sistema/primitivos';
import { useSessao } from '@/sistema/sessao';

const SECOES: readonly SecaoDeNavegacao[] = [
  {
    titulo: 'Plantão',
    itens: [
      { href: '/painel', rotulo: 'Pacientes do dia', icone: 'pacientes' as const },
      { href: '/painel/pacientes', rotulo: 'Todos os pacientes', icone: 'cadastro' as const },
      { href: '/painel/intervencoes', rotulo: 'Intervenções', icone: 'contato' as const },
      { href: '/painel/contatos', rotulo: 'Solicitações de contato', icone: 'contato' as const },
      { href: '/painel/cadeiras', rotulo: 'Giro de cadeiras', icone: 'pacientes' as const },
      { href: '/painel/toxicidade', rotulo: 'Toxicidade', icone: 'cadastro' as const },
      { href: '/painel/navegacao', rotulo: 'Navegação', icone: 'cadastro' as const },
    ],
  },
  {
    titulo: 'Você',
    itens: [{ href: '/painel/conta', rotulo: 'Conta', icone: 'conta' as const }],
  },
];

/**
 * Os cinco destinos que cabem no polegar.
 *
 * A lateral tem oito itens; a barra do celular tem cinco, porque seis alvos numa
 * largura de 390px produzem toque de 60px e erro de dedo. Os que ficaram de fora
 * (todos os pacientes, solicitações, conta) continuam alcançáveis pela lateral, que
 * reaparece a partir de `lg`.
 *
 * `rotuloCurto` existe porque "Solicitações de contato" não cabe embaixo de um ícone
 * de 24px. O rótulo inteiro continua no `aria-label`: quem usa leitor de tela ouve o
 * nome completo, não a abreviação que existe só por causa de pixel.
 */
const DESTINOS_NO_POLEGAR = [
  { href: '/painel', rotulo: 'Pacientes do dia', rotuloCurto: 'Plantão', icone: 'pacientes' as const },
  { href: '/painel/cadeiras', rotulo: 'Giro de cadeiras', rotuloCurto: 'Cadeiras', icone: 'pacientes' as const },
  { href: '/painel/intervencoes', rotulo: 'Intervenções', rotuloCurto: 'Condutas', icone: 'contato' as const },
  { href: '/painel/toxicidade', rotulo: 'Toxicidade', rotuloCurto: 'Sintomas', icone: 'cadastro' as const },
  { href: '/painel/navegacao', rotulo: 'Navegação', rotuloCurto: 'Operação', icone: 'cadastro' as const },
] as const;

export default function LayoutDoPainel({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const { usuario, sair } = useSessao();
  const router = useRouter();

  async function encerrar() {
    await sair();
    router.replace('/entrar');
  }

  return (
    <Guarda perfil="PROFISSIONAL">
      <ShellDePainel
        produto="AUREA"
        contexto="Plantão"
        secoes={SECOES}
        caminhoAtual={caminho}
        barraInferior={
          <nav
            aria-label="Navegação do plantão"
            className="border-t border-[var(--color-borda)] bg-[var(--color-superficie-alta)] pb-[env(safe-area-inset-bottom)]"
          >
            <ul className="grid grid-cols-5">
              {DESTINOS_NO_POLEGAR.map((destino) => {
                /* `/painel` casaria com tudo se comparado por prefixo. */
                const ativo =
                  destino.href === '/painel'
                    ? caminho === '/painel'
                    : caminho.startsWith(destino.href);

                return (
                  <li key={destino.href}>
                    <Link
                      href={destino.href}
                      aria-label={destino.rotulo}
                      aria-current={ativo ? 'page' : undefined}
                      className={juntar(
                        'flex flex-col items-center gap-1 rounded-[0.625rem] px-0.5 py-2 text-[0.6875rem]',
                        'transition-colors duration-150',
                        ativo
                          ? 'bg-[var(--color-nav-ativo)] font-medium text-[var(--color-texto)]'
                          : 'text-[var(--color-texto-fraco)]',
                      )}
                    >
                      <Icone nome={destino.icone} />
                      <span className="max-w-full truncate">{destino.rotuloCurto}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        }
        /* A única ação do topo é um atalho para a fila de contatos. A ref tem três
           botões redondos; dois deles aqui não teriam destino. */
        acoes={
          <AcaoDoTopo
            titulo="Solicitações de contato"
            href="/painel/contatos"
            icone="contato"
          />
        }
        rodape={
          <div className="flex flex-col gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-texto)]">
                {usuario?.nome}
              </p>
              <p className="text-xs text-[var(--color-texto-fraco)]">Enfermagem</p>
            </div>
            <Botao variante="secundario" tamanho="compacto" onClick={encerrar}>
              Sair
            </Botao>
          </div>
        }
      >
        {children}
      </ShellDePainel>
    </Guarda>
  );
}
