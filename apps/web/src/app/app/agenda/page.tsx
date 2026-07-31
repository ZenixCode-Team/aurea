'use client';

/**
 * P5 — Agenda. `buscarAgenda()` já devolve os itens em ordem cronológica; aqui
 * eles só são reagrupados por mês para leitura mais fácil.
 */

import { useEffect, useState } from 'react';
import { Aviso, Cartao, Carregando, EstadoVazio, Rotulo } from '@/componentes/sistema/primitivos';
import { buscarAgenda } from '@/sistema/fonte';
import { formatarDataPorExtenso, formatarHora, ROTULO_DA_FUNCAO, ROTULO_DO_EVENTO } from '@/sistema/formato';
import type { ItemDaAgenda } from '@/sistema/tipos';

type Fase = 'carregando' | 'erro' | 'pronto';

const FUSO = 'America/Sao_Paulo';

function chaveDoMes(iso: string): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    timeZone: FUSO,
  }).formatToParts(new Date(iso));
  const ano = partes.find((parte) => parte.type === 'year')?.value ?? '';
  const mes = partes.find((parte) => parte.type === 'month')?.value ?? '';
  return `${ano}-${mes}`;
}

function rotuloDoMes(iso: string): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: FUSO,
  }).format(new Date(iso));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function PaginaDeAgenda() {
  const [fase, setFase] = useState<Fase>('carregando');
  const [agenda, setAgenda] = useState<readonly ItemDaAgenda[]>([]);

  useEffect(() => {
    let cancelado = false;
    buscarAgenda()
      .then((dados) => {
        if (cancelado) return;
        setAgenda(dados);
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
        Não foi possível carregar sua agenda agora. Tente novamente em instantes.
      </Aviso>
    );
  }

  if (agenda.length === 0) {
    return (
      <EstadoVazio
        titulo="Nada marcado por enquanto"
        descricao="Quando a equipe marcar um compromisso, ele aparece aqui."
      />
    );
  }

  const grupos = new Map<string, ItemDaAgenda[]>();
  for (const item of agenda) {
    const chave = chaveDoMes(item.aconteceEm);
    const lista = grupos.get(chave) ?? [];
    lista.push(item);
    grupos.set(chave, lista);
  }

  return (
    <div className="flex flex-col gap-8">
      {[...grupos.entries()].map(([chave, itens]) => (
        <section key={chave} className="flex flex-col gap-3">
          <Rotulo>{rotuloDoMes(itens[0].aconteceEm)}</Rotulo>
          <ul className="flex flex-col gap-3">
            {itens.map((item) => (
              <li key={item.id}>
                <Cartao className="flex flex-col gap-1.5 p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-base font-medium text-[var(--color-texto)]">
                      {ROTULO_DO_EVENTO[item.tipo]}
                    </p>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--color-texto-fraco)]">
                      {formatarHora(item.aconteceEm)}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-texto-suave)]">
                    {formatarDataPorExtenso(item.aconteceEm)}
                  </p>
                  {item.local && (
                    <p className="text-sm text-[var(--color-texto-suave)]">{item.local}</p>
                  )}
                  {item.profissional && (
                    <p className="text-sm text-[var(--color-texto-suave)]">
                      {ROTULO_DA_FUNCAO[item.profissional.funcao]} {item.profissional.nome}
                    </p>
                  )}
                  {item.observacoes && (
                    <p className="text-sm text-[var(--color-texto-fraco)]">{item.observacoes}</p>
                  )}
                </Cartao>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
