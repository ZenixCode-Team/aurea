'use client';

/**
 * Shell da administração — ADR-004.
 *
 * Aqui a regra 1 do ADR-001 vira interface: o algoritmo é linha de tabela, não código.
 * Quem entra é orientador ou pesquisador mudando corte clínico, e alterna entre
 * conjunto, regra e diferença dezenas de vezes na mesma sessão de trabalho — daí a
 * barra lateral com as seções sempre visíveis.
 *
 * Quem edita o algoritmo não atende plantão. São perfis separados de propósito, e a
 * API recusa a chamada cruzada com 403.
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Guarda } from '@/componentes/sistema/guarda';
import { Icone, ShellDePainel, type SecaoDeNavegacao } from '@/componentes/sistema/painel';
import { Botao, juntar } from '@/componentes/sistema/primitivos';
import { useSessao } from '@/sistema/sessao';

const SECOES: readonly SecaoDeNavegacao[] = [
  {
    titulo: 'Algoritmo',
    itens: [
      { href: '/admin/limiares', rotulo: 'Conjuntos de limiares', icone: 'algoritmo' as const },
      { href: '/admin/orientacoes', rotulo: 'Orientações', icone: 'orientacao' as const },
    ],
  },
  {
    titulo: 'Cadastros',
    itens: [
      { href: '/admin/protocolos', rotulo: 'Protocolos', icone: 'protocolo' as const },
      { href: '/admin/medicamentos', rotulo: 'Medicamentos', icone: 'medicamento' as const },
      { href: '/admin/cadastros', rotulo: 'Pacientes e equipe', icone: 'cadastro' as const },
    ],
  },
  {
    titulo: 'Auditoria',
    itens: [{ href: '/admin/acessos', rotulo: 'Registro de acessos', icone: 'auditoria' as const }],
  },
];

/**
 * Os cinco destinos que cabem no polegar.
 *
 * Mesmo limite do plantao, pelo mesmo motivo: seis alvos em 390px dao toque de 60px
 * e erro de dedo. Quem ficou de fora foi Medicamentos, que e tabela de consulta e
 * trabalho de mesa; ele continua alcancavel pela lateral, que reaparece a partir de
 * `lg`.
 *
 * `rotuloCurto` existe por causa de pixel, e so por isso. O nome inteiro continua no
 * `aria-label`: quem usa leitor de tela ouve "Conjuntos de limiares", nao "Limiares".
 */
const DESTINOS_NO_POLEGAR = [
  {
    href: '/admin/limiares',
    rotulo: 'Conjuntos de limiares',
    rotuloCurto: 'Limiares',
    icone: 'algoritmo' as const,
  },
  {
    href: '/admin/orientacoes',
    rotulo: 'Orientações',
    rotuloCurto: 'Orientações',
    icone: 'orientacao' as const,
  },
  {
    href: '/admin/protocolos',
    rotulo: 'Protocolos',
    rotuloCurto: 'Protocolos',
    icone: 'protocolo' as const,
  },
  {
    href: '/admin/cadastros',
    rotulo: 'Pacientes e equipe',
    rotuloCurto: 'Cadastros',
    icone: 'cadastro' as const,
  },
  {
    href: '/admin/acessos',
    rotulo: 'Registro de acessos',
    rotuloCurto: 'Acessos',
    icone: 'auditoria' as const,
  },
] as const;

export default function LayoutDoAdmin({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const { usuario, sair } = useSessao();
  const router = useRouter();

  async function encerrar() {
    await sair();
    router.replace('/entrar');
  }

  return (
    <Guarda perfil="ADMINISTRADOR">
      <ShellDePainel
        produto="AUREA"
        contexto="Administração"
        secoes={SECOES}
        caminhoAtual={caminho}
        /* A administracao tinha a lateral fixa em qualquer largura. Em 390px isso da
           256px de barra para 134px de conteudo: dois tercos da tela para navegar e um
           terco para trabalhar. E o mesmo defeito que o plantao ja corrigiu, e a peca
           para corrigir aqui ja existia no shell. */
        barraInferior={
          <nav
            aria-label="Navegação da administração"
            className="border-t border-[var(--color-borda)] bg-[var(--color-superficie-alta)] pb-[env(safe-area-inset-bottom)]"
          >
            <ul className="grid grid-cols-5">
              {DESTINOS_NO_POLEGAR.map((destino) => {
                const ativo = caminho.startsWith(destino.href);
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
        rodape={
          <div className="flex flex-col gap-2">
            {/* O administrador nao tem ficha de profissional, entao nao tem nome a
                mostrar. Sem nome, sobra o papel: e verdade, e cabe. */}
            <div className="min-w-0">
              {usuario?.nome && (
                <p className="truncate text-sm font-medium text-[var(--color-texto)]">
                  {usuario.nome}
                </p>
              )}
              {/* Sem nome, o papel assume o posto de identidade e ganha o corpo dele.
                  `juntar` concatena classe, nao resolve conflito do Tailwind: por isso
                  a escolha e um ternario inteiro, e nao duas classes de tamanho. */}
              <p
                className={
                  usuario?.nome
                    ? 'text-xs text-[var(--color-texto-fraco)]'
                    : 'text-sm font-medium text-[var(--color-texto)]'
                }
              >
                Orientação clínica
              </p>
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
