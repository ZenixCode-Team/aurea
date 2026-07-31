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

import { usePathname, useRouter } from 'next/navigation';
import { Guarda } from '@/componentes/sistema/guarda';
import { BarraLateral, type SecaoDeNavegacao } from '@/componentes/sistema/painel';
import { Botao } from '@/componentes/sistema/primitivos';
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
      <div className="flex min-h-dvh bg-[var(--color-superficie-baixa)]">
        <BarraLateral
          produto="AUREA"
          contexto="Administração"
          secoes={SECOES}
          caminhoAtual={caminho}
          rodape={
            <div className="flex flex-col gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--color-texto)]">
                  {usuario?.nome}
                </p>
                <p className="text-xs text-[var(--color-texto-fraco)]">Orientação clínica</p>
              </div>
              <Botao variante="secundario" tamanho="compacto" onClick={encerrar}>
                Sair
              </Botao>
            </div>
          }
        />

        <main className="min-w-0 flex-1 overflow-x-hidden px-8 py-7">
          <div className="mx-auto max-w-[80rem]">{children}</div>
        </main>
      </div>
    </Guarda>
  );
}
