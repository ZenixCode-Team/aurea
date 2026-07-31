'use client';

/**
 * P6 — Biblioteca. Lista os verbetes agrupados por categoria, cada um levando
 * ao texto completo em `/app/biblioteca/[id]`.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Aviso, Cartao, Carregando, EstadoVazio, Rotulo } from '@/componentes/sistema/primitivos';
import { buscarBiblioteca } from '@/sistema/fonte';
import { ROTULO_DA_CATEGORIA } from '@/sistema/formato';
import type { VerbeteResumido } from '@/sistema/tipos';

type Fase = 'carregando' | 'erro' | 'pronto';

export default function PaginaDeBiblioteca() {
  const [fase, setFase] = useState<Fase>('carregando');
  const [biblioteca, setBiblioteca] = useState<readonly VerbeteResumido[]>([]);

  useEffect(() => {
    let cancelado = false;
    buscarBiblioteca()
      .then((dados) => {
        if (cancelado) return;
        setBiblioteca(dados);
        setFase('pronto');
      })
      .catch(() => {
        if (!cancelado) setFase('erro');
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (fase === 'carregando') {
    return <Carregando linhas={5} />;
  }

  if (fase === 'erro') {
    return (
      <Aviso tom="grave" titulo="Algo não carregou">
        Não foi possível carregar a biblioteca agora. Tente novamente em instantes.
      </Aviso>
    );
  }

  if (biblioteca.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum texto disponível ainda"
        descricao="A equipe ainda não publicou nenhum material aqui."
      />
    );
  }

  const grupos = new Map<string, VerbeteResumido[]>();
  for (const verbete of biblioteca) {
    const lista = grupos.get(verbete.categoria) ?? [];
    lista.push(verbete);
    grupos.set(verbete.categoria, lista);
  }

  return (
    <div className="flex flex-col gap-8">
      {[...grupos.entries()].map(([categoria, itens]) => (
        <section key={categoria} className="flex flex-col gap-3">
          <Rotulo>{ROTULO_DA_CATEGORIA[categoria] ?? categoria}</Rotulo>
          <ul className="flex flex-col gap-3">
            {itens.map((verbete) => (
              <li key={verbete.id}>
                <Link href={`/app/biblioteca/${verbete.id}`}>
                  <Cartao className="flex flex-col gap-1.5 p-5 transition-colors hover:bg-[var(--color-superficie-baixa)]">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-base font-medium text-[var(--color-texto)]">
                        {verbete.titulo}
                      </p>
                      <span aria-hidden className="shrink-0 text-[var(--color-texto-fraco)]">
                        ›
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-texto-suave)]">{verbete.resumo}</p>
                  </Cartao>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
