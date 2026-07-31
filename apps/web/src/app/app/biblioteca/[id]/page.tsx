'use client';

/**
 * P7 — Verbete. Texto legível: largura contida, corpo maior, entrelinha generosa —
 * é para ler devagar, possivelmente com o corpo cansado.
 */

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { Aviso, Carregando, EstadoVazio, Rotulo } from '@/componentes/sistema/primitivos';
import { buscarVerbete, ErroDaFonte } from '@/sistema/fonte';
import { formatarData, ROTULO_DA_CATEGORIA } from '@/sistema/formato';
import type { Verbete } from '@/sistema/tipos';

type EstadoDaPagina =
  | { fase: 'carregando' }
  | { fase: 'nao-encontrado' }
  | { fase: 'erro' }
  | { fase: 'pronto'; verbete: Verbete };

export default function PaginaDoVerbete({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [estado, setEstado] = useState<EstadoDaPagina>({ fase: 'carregando' });

  useEffect(() => {
    let cancelado = false;
    buscarVerbete(id)
      .then((verbete) => {
        if (!cancelado) setEstado({ fase: 'pronto', verbete });
      })
      .catch((erro: unknown) => {
        if (cancelado) return;
        if (erro instanceof ErroDaFonte && erro.causa === 'NAO_ENCONTRADO') {
          setEstado({ fase: 'nao-encontrado' });
        } else {
          setEstado({ fase: 'erro' });
        }
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  if (estado.fase === 'carregando') {
    return <Carregando linhas={5} />;
  }

  if (estado.fase === 'nao-encontrado') {
    return (
      <EstadoVazio
        titulo="Este texto não foi encontrado"
        descricao="Ele pode ter sido movido ou não existe mais."
        acao={
          <Link
            href="/app/biblioteca"
            className="text-sm text-[var(--color-texto)] underline underline-offset-4"
          >
            Voltar para a biblioteca
          </Link>
        }
      />
    );
  }

  if (estado.fase === 'erro') {
    return (
      <Aviso tom="grave" titulo="Algo não carregou">
        Não foi possível abrir este texto agora. Tente novamente em instantes.
      </Aviso>
    );
  }

  const { verbete } = estado;

  return (
    <article className="mx-auto flex w-full max-w-[38rem] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Rotulo>{ROTULO_DA_CATEGORIA[verbete.categoria] ?? verbete.categoria}</Rotulo>
        <h1 className="text-2xl font-medium tracking-tight text-[var(--color-texto)]">
          {verbete.titulo}
        </h1>
        <p className="text-xs text-[var(--color-texto-fraco)]">
          Atualizado em {formatarData(verbete.atualizadoEm)}
        </p>
      </div>

      <div className="flex flex-col gap-4 text-[1.0625rem] leading-[1.85] text-[var(--color-texto)]">
        {verbete.conteudo.split('\n\n').map((paragrafo, indice) => (
          <p key={indice}>{paragrafo}</p>
        ))}
      </div>

      <Link
        href="/app/biblioteca"
        className="text-sm text-[var(--color-texto-suave)] underline underline-offset-4 hover:text-[var(--color-texto)]"
      >
        Voltar para a biblioteca
      </Link>
    </article>
  );
}
