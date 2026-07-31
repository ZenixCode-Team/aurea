'use client';

/**
 * P4 — Histórico.
 *
 * Linha do tempo por dia. Um dia sem sintoma é "Nada a relatar" — informação tão
 * válida quanto um sintoma relatado. Um dia ABANDONADA é "Check-in não terminado",
 * em tom neutro: sem cor, sem julgamento. A pessoa pode ter esquecido, estar mal
 * ou só ter fechado o app sem querer — não é esta tela que decide qual.
 */

import { useEffect, useState } from 'react';
import { Aviso, Cartao, Carregando, EstadoVazio, Rotulo } from '@/componentes/sistema/primitivos';
import { buscarHistoricoDoPaciente } from '@/sistema/fonte';
import { formatarDiaRelativo, ROTULO_DO_SINTOMA } from '@/sistema/formato';
import type { DiaDoHistorico } from '@/sistema/tipos';

type Fase = 'carregando' | 'erro' | 'pronto';

const FUSO = 'America/Sao_Paulo';

/**
 * `dia` é sempre civil (`AAAA-MM-DD`, sem hora) — a chave sai de um recorte de
 * string, não de `Date`, porque converter esse formato com `new Date()` direto
 * escorrega um dia pro fuso UTC (o mesmo bug já corrigido em `formato.ts`).
 */
function chaveDoMes(diaISO: string): string {
  return diaISO.slice(0, 7);
}

function rotuloDoMes(diaISO: string): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: FUSO,
  }).format(new Date(`${diaISO}T12:00:00`));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default function PaginaDeHistorico() {
  const [fase, setFase] = useState<Fase>('carregando');
  const [historico, setHistorico] = useState<readonly DiaDoHistorico[]>([]);

  useEffect(() => {
    let cancelado = false;
    buscarHistoricoDoPaciente()
      .then((dados) => {
        if (cancelado) return;
        setHistorico(dados);
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
        Não foi possível carregar seu histórico agora. Tente novamente em instantes.
      </Aviso>
    );
  }

  if (historico.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum check-in ainda"
        descricao="Quando você responder o check-in, os dias aparecem aqui."
      />
    );
  }

  const ordenado = [...historico].sort(
    (a, b) => new Date(b.dia).getTime() - new Date(a.dia).getTime(),
  );

  const grupos = new Map<string, DiaDoHistorico[]>();
  for (const dia of ordenado) {
    const chave = chaveDoMes(dia.dia);
    const lista = grupos.get(chave) ?? [];
    lista.push(dia);
    grupos.set(chave, lista);
  }

  return (
    <div className="flex flex-col gap-8">
      {[...grupos.entries()].map(([chave, dias]) => (
        <section key={chave} className="flex flex-col gap-3">
          <Rotulo>{rotuloDoMes(dias[0].dia)}</Rotulo>
          <ul className="flex flex-col gap-3">
            {dias.map((dia) => (
              <li key={dia.sessaoId}>
                <Cartao className="flex flex-col gap-2 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-base font-medium capitalize text-[var(--color-texto)]">
                      {formatarDiaRelativo(dia.dia)}
                    </p>
                    {dia.diaDoCiclo !== null && (
                      <span className="font-mono text-xs tabular-nums text-[var(--color-texto-fraco)]">
                        dia {dia.diaDoCiclo} do ciclo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-texto-suave)]">
                    {dia.estado === 'ABANDONADA'
                      ? 'Check-in não terminado.'
                      : dia.sintomasRelatados.length === 0
                        ? 'Nada a relatar.'
                        : dia.sintomasRelatados
                            .map((sintoma) => ROTULO_DO_SINTOMA[sintoma] ?? sintoma)
                            .join(', ')}
                  </p>
                </Cartao>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
