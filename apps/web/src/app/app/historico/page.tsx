'use client';

/**
 * P4 — Histórico.
 *
 * Um dia sem sintoma é "Nada a relatar" — informação tão válida quanto um sintoma
 * relatado. Um dia ABANDONADA é "Check-in não terminado", em tom neutro: sem cor,
 * sem julgamento. A pessoa pode ter esquecido, estar mal ou só ter fechado o app sem
 * querer, e não é esta tela que decide qual.
 *
 * ERA UMA PILHA DE CARTÕES, VIROU LINHA DO TEMPO. Cada dia ocupava um cartão de
 * 1240×118px para carregar uma data e uma linha de texto, e cartão isolado é lido
 * como objeto independente — quando estes dias são o MESMO objeto ao longo do tempo.
 * Agora são linhas separadas por filete, com a data ancorada à esquerda, que é como
 * se lê uma sequência.
 *
 * A DATA DEIXOU DE SER `29/07/2026`. Dentro de uma seção chamada "Julho de 2026",
 * repetir mês e ano em cada linha é ruído; o que distingue uma linha da outra é o
 * dia e o dia da semana. "hoje" e "ontem" continuam por extenso, porque para os dois
 * dias mais recentes a distância importa mais que a data.
 *
 * O RESUMO NO TOPO responde o que a pessoa vem procurar aqui, que raramente é uma
 * data específica: é "como eu venho indo". Conta dias registrados e dias não
 * terminados — adesão, não classificação. Contar sintomas relatados seria justamente
 * a leitura clínica que o paciente não faz sozinho, e nenhuma cor da escala entra
 * nesta tela (lei 2).
 *
 * A TROCA DE CICLO ganha marca própria. O dia do ciclo salta de 20 para 0 quando um
 * ciclo novo começa, e sem marcador esse salto parece defeito de dado.
 */

import { useEffect, useState } from 'react';
import { CabecalhoDePainel } from '@/componentes/sistema/painel';
import { Aviso, Carregando, EstadoVazio } from '@/componentes/sistema/primitivos';
import { buscarHistoricoDoPaciente } from '@/sistema/fonte';
import {
  formatarDiaDaSemana,
  formatarDiaRelativo,
  formatarNumeroDoDia,
  ROTULO_DO_SINTOMA,
} from '@/sistema/formato';
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

/** O que aquele dia registrou, em uma frase. Sem classificação e sem cor. */
function relatoDoDia(dia: DiaDoHistorico): string {
  if (dia.estado === 'ABANDONADA') return 'Check-in não terminado.';
  if (dia.sintomasRelatados.length === 0) return 'Nada a relatar.';
  return dia.sintomasRelatados
    .map((sintoma) => ROTULO_DO_SINTOMA[sintoma] ?? sintoma)
    .join(', ');
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
      <div className="max-w-[44rem]">
        <CabecalhoDePainel titulo="Histórico" />
        <EstadoVazio
          titulo="Nenhum check-in ainda"
          descricao="Quando você responder o check-in, os dias aparecem aqui."
        />
      </div>
    );
  }

  const ordenado = [...historico].sort(
    (a, b) => new Date(b.dia).getTime() - new Date(a.dia).getTime(),
  );

  const naoTerminados = ordenado.filter((dia) => dia.estado === 'ABANDONADA').length;
  const respondidos = ordenado.length - naoTerminados;

  const grupos = new Map<string, DiaDoHistorico[]>();
  for (const dia of ordenado) {
    const chave = chaveDoMes(dia.dia);
    const lista = grupos.get(chave) ?? [];
    lista.push(dia);
    grupos.set(chave, lista);
  }

  return (
    <div className="max-w-[44rem]">
      <CabecalhoDePainel
        titulo="Histórico"
        descricao="Todos os dias em que você respondeu, do mais recente para o mais antigo."
      />

      <p className="mb-8 border-y border-[var(--color-borda)] py-4 text-sm leading-relaxed text-[var(--color-texto-suave)]">
        <span className="font-medium text-[var(--color-texto)]">
          {ordenado.length} {ordenado.length === 1 ? 'dia registrado' : 'dias registrados'}
        </span>
        {' · '}
        {respondidos} {respondidos === 1 ? 'respondido' : 'respondidos'}
        {naoTerminados > 0 &&
          ` · ${naoTerminados} não ${naoTerminados === 1 ? 'terminado' : 'terminados'}`}
      </p>

      <div className="flex flex-col gap-9">
        {[...grupos.entries()].map(([chave, dias]) => (
          <section key={chave}>
            <h2 className="mb-1 text-sm font-semibold text-[var(--color-texto)]">
              {rotuloDoMes(dias[0].dia)}
            </h2>

            <ul>
              {dias.map((dia, indice) => {
                const anterior = dias[indice - 1];
                /* A lista desce do mais recente para o mais antigo, então o começo de
                   um ciclo aparece ACIMA do fim do anterior: o dia do ciclo da linha
                   de cima é MENOR que o da linha de baixo. */
                const comecouCiclo =
                  anterior != null &&
                  anterior.diaDoCiclo !== null &&
                  dia.diaDoCiclo !== null &&
                  anterior.diaDoCiclo < dia.diaDoCiclo;

                return (
                  <li key={dia.sessaoId}>
                    {comecouCiclo && (
                      <p className="border-t border-[var(--color-borda)] pt-4 text-xs text-[var(--color-texto-fraco)]">
                        Começou um ciclo novo
                      </p>
                    )}
                    <LinhaDoDia dia={dia} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function LinhaDoDia({ dia }: { dia: DiaDoHistorico }) {
  const relativo = formatarDiaRelativo(dia.dia);
  /* `formatarDiaRelativo` devolve a data numérica para tudo que não é hoje nem
     ontem. Aqui só interessa a palavra; o número vira a âncora ao lado. */
  const ehRecente = relativo === 'hoje' || relativo === 'ontem';

  return (
    <div className="flex items-baseline gap-4 border-t border-[var(--color-borda)] py-4">
      {/* Âncora de data: largura fixa para os números empilharem alinhados coluna
          abaixo. É o que faz a lista ler como linha do tempo, e não como parágrafos
          soltos um embaixo do outro. */}
      <div className="w-14 shrink-0">
        <p className="font-mono text-lg leading-none tabular-nums text-[var(--color-texto)]">
          {formatarNumeroDoDia(dia.dia)}
        </p>
        <p className="mt-1 text-xs text-[var(--color-texto-fraco)]">
          {ehRecente ? relativo : formatarDiaDaSemana(dia.dia)}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={
            dia.estado === 'ABANDONADA'
              ? 'text-[0.9375rem] leading-relaxed text-[var(--color-texto-fraco)]'
              : 'text-[0.9375rem] leading-relaxed text-[var(--color-texto)]'
          }
        >
          {relatoDoDia(dia)}
        </p>
      </div>

      {dia.diaDoCiclo !== null && (
        <span
          title="Dia do ciclo"
          className="shrink-0 font-mono text-xs tabular-nums text-[var(--color-texto-fraco)]"
        >
          D{dia.diaDoCiclo}
        </span>
      )}
    </div>
  );
}
