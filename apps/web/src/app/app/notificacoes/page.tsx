'use client';

/**
 * P9 — Notificações. Não lidas primeiro; a diferença entre lida e não lida é peso
 * de fonte, nunca cor.
 */

import { useEffect, useState } from 'react';
import { CabecalhoDePainel } from '@/componentes/sistema/painel';
import {
  Aviso,
  Cartao,
  Carregando,
  EstadoVazio,
  Rotulo,
  juntar,
} from '@/componentes/sistema/primitivos';
import { buscarNotificacoes } from '@/sistema/fonte';
import { formatarDiaRelativo, formatarHora } from '@/sistema/formato';
import type { Notificacao } from '@/sistema/tipos';

type Fase = 'carregando' | 'erro' | 'pronto';

export default function PaginaDeNotificacoes() {
  const [fase, setFase] = useState<Fase>('carregando');
  const [notificacoes, setNotificacoes] = useState<readonly Notificacao[]>([]);

  useEffect(() => {
    let cancelado = false;
    buscarNotificacoes()
      .then((dados) => {
        if (cancelado) return;
        setNotificacoes(dados);
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
    return <Carregando linhas={4} />;
  }

  if (fase === 'erro') {
    return (
      <Aviso tom="grave" titulo="Algo não carregou">
        Não foi possível carregar seus avisos agora. Tente novamente em instantes.
      </Aviso>
    );
  }

  if (notificacoes.length === 0) {
    return (
      <div className="max-w-[44rem]">
        <CabecalhoDePainel titulo="Avisos" />
        <EstadoVazio
          titulo="Nenhum aviso por enquanto"
          descricao="Quando a equipe enviar algo, aparece aqui."
        />
      </div>
    );
  }

  const naoLidas = notificacoes.filter((notificacao) => notificacao.lidaEm === null);
  const lidas = notificacoes.filter((notificacao) => notificacao.lidaEm !== null);

  return (
    <div className="flex flex-col gap-8">
      <CabecalhoDePainel titulo="Avisos" descricao="Mensagens enviadas pela equipe do seu tratamento." />

      {naoLidas.length > 0 && (
        <section className="flex flex-col gap-3">
          <Rotulo>Não lidas</Rotulo>
          <ul className="flex flex-col gap-3">
            {naoLidas.map((notificacao) => (
              <CartaoDeNotificacao key={notificacao.id} notificacao={notificacao} naoLida />
            ))}
          </ul>
        </section>
      )}

      {lidas.length > 0 && (
        <section className="flex flex-col gap-3">
          <Rotulo>Lidas</Rotulo>
          <ul className="flex flex-col gap-3">
            {lidas.map((notificacao) => (
              <CartaoDeNotificacao key={notificacao.id} notificacao={notificacao} naoLida={false} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CartaoDeNotificacao({
  notificacao,
  naoLida,
}: {
  notificacao: Notificacao;
  naoLida: boolean;
}) {
  return (
    <li>
      <Cartao className="flex flex-col gap-1.5 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p
            className={juntar(
              'text-base text-[var(--color-texto)]',
              naoLida ? 'font-semibold' : 'font-normal',
            )}
          >
            {notificacao.titulo}
          </p>
          <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--color-texto-fraco)]">
            {formatarDiaRelativo(notificacao.criadaEm)}, {formatarHora(notificacao.criadaEm)}
          </span>
        </div>
        <p
          className={juntar(
            'text-sm',
            naoLida ? 'text-[var(--color-texto)]' : 'text-[var(--color-texto-suave)]',
          )}
        >
          {notificacao.corpo}
        </p>
      </Cartao>
    </li>
  );
}
