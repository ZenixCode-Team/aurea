'use client';

/**
 * 403 humano — a pessoa entrou, só não é o perfil dono desta tela.
 *
 * ADR-004: centrada, mas com a marca no topo — o mesmo vocabulário visual das
 * telas de entrada, em vez de uma página órfã sem identidade.
 *
 * Sem código de erro cru: cada perfil tem seu espaço (paciente, painel,
 * administração) e quem cai aqui só precisa saber que está no lugar errado
 * e como voltar para o que é dela.
 */

import { EstadoVazio, LinkComoBotao } from '@/componentes/sistema/primitivos';
import { DESTINO_POR_PERFIL, useSessao } from '@/sistema/sessao';

export default function NaoAutorizadoPage() {
  const { usuario } = useSessao();
  const destino = usuario ? DESTINO_POR_PERFIL[usuario.perfil] : '/entrar';

  return (
    <main className="flex min-h-dvh flex-col bg-[var(--color-superficie)] px-6 py-8 sm:px-12">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-[0.5rem] bg-[var(--color-azul-profundo)] font-mono text-sm font-semibold text-[var(--color-lime)]">
          A
        </span>
        <span className="text-sm font-semibold tracking-tight text-[var(--color-texto)]">
          AUREA
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-[26rem]">
          <EstadoVazio
            titulo="Esta parte do sistema é de outra equipe."
            descricao="Sua entrada não dá acesso a esta tela. Se acha que deveria ter acesso, fale com quem administra o sistema no seu serviço."
            acao={<LinkComoBotao href={destino}>Voltar para o meu espaço</LinkComoBotao>}
          />
        </div>
      </div>
    </main>
  );
}
