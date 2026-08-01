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
import {
  AcaoDoTopo,
  ShellDePainel,
  type SecaoDeNavegacao,
} from '@/componentes/sistema/painel';
import { Botao } from '@/componentes/sistema/primitivos';
import { useSessao } from '@/sistema/sessao';

const SECOES: readonly SecaoDeNavegacao[] = [
  {
    titulo: 'Plantão',
    itens: [
      { href: '/painel', rotulo: 'Pacientes do dia', icone: 'pacientes' as const },
      { href: '/painel/pacientes', rotulo: 'Todos os pacientes', icone: 'cadastro' as const },
      { href: '/painel/contatos', rotulo: 'Solicitações de contato', icone: 'contato' as const },
    ],
  },
  {
    titulo: 'Você',
    itens: [{ href: '/painel/conta', rotulo: 'Conta', icone: 'conta' as const }],
  },
];

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
