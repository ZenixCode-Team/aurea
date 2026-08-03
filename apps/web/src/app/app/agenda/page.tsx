'use client';

/**
 * P5 — Agenda.
 *
 * O QUE A PESSOA VEM SABER AQUI É "QUANDO É O PRÓXIMO". A tela anterior respondia
 * isso por último: o cartão abria com o TIPO do evento, a data vinha na terceira
 * linha e a hora ficava sozinha na borda direita, a 600px de distância da data com
 * que ela forma par. Agora o próximo compromisso tem bloco próprio no topo, com a
 * distância em dias — "em 3 dias" responde sem obrigar a uma conta mental a partir
 * de "17 de agosto".
 *
 * O QUE JÁ PASSOU NÃO SOME, mas recua: fica depois, com o texto esmaecido e o
 * cabeçalho dizendo que passou. Sumir com o passado tira da pessoa a resposta de
 * "quando foi mesmo a última consulta", que ela precisa quando a equipe pergunta.
 *
 * BUG CORRIGIDO: `{ROTULO_DA_FUNCAO[funcao]} {nome}` produzia "Médico Médico de
 * demonstração" e "Enfermeiro Enfermeira de demonstração". Concatenar cargo e nome
 * sem separador gagueja sempre que o nome já traz tratamento — e "Médico Dra. Ana"
 * é o mesmo defeito com dado real. O nome passa a vir primeiro, o cargo em seguida,
 * separado e em tom secundário.
 */

import { useEffect, useState } from 'react';
import { CabecalhoDePainel } from '@/componentes/sistema/painel';
import { Aviso, Carregando, EstadoVazio } from '@/componentes/sistema/primitivos';
import { buscarAgenda } from '@/sistema/fonte';
import {
  formatarDataPorExtenso,
  formatarDiaDaSemana,
  formatarDistanciaEmDias,
  formatarHora,
  formatarNumeroDoDia,
  ROTULO_DA_FUNCAO,
  ROTULO_DO_EVENTO,
} from '@/sistema/formato';
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

/** Já aconteceu? Compara instantes, não dias: consulta das 9h já passou às 14h. */
function jaPassou(iso: string, agora: Date): boolean {
  return new Date(iso).getTime() < agora.getTime();
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
      <div className="max-w-[44rem]">
        <CabecalhoDePainel titulo="Agenda" />
        <EstadoVazio
          titulo="Nada marcado por enquanto"
          descricao="Quando a equipe marcar um compromisso, ele aparece aqui."
        />
      </div>
    );
  }

  /* `new Date()` uma vez só: chamado dentro do map, dois itens vizinhos poderiam
     cair em lados diferentes da fronteira se o relógio virasse no meio da render. */
  const agora = new Date();
  const futuros = agenda.filter((item) => !jaPassou(item.aconteceEm, agora));
  const passados = agenda
    .filter((item) => jaPassou(item.aconteceEm, agora))
    .sort((a, b) => new Date(b.aconteceEm).getTime() - new Date(a.aconteceEm).getTime());

  const proximo = futuros[0];
  const demaisFuturos = futuros.slice(1);

  return (
    <div className="max-w-[44rem]">
      <CabecalhoDePainel
        titulo="Agenda"
        descricao="Os compromissos que a equipe marcou para você."
      />

      {proximo && <ProximoCompromisso item={proximo} />}

      {demaisFuturos.length > 0 && (
        <ListaPorMes titulo="Depois" itens={demaisFuturos} />
      )}

      {passados.length > 0 && (
        <ListaPorMes titulo="Já aconteceu" itens={passados} esmaecida />
      )}
    </div>
  );
}

/**
 * O próximo compromisso, em bloco próprio.
 *
 * Sem cor de destaque: a paleta de risco não entra no app do paciente, e verde ou
 * âmbar aqui seriam lidos como classificação. O destaque vem de posição, moldura e
 * corpo maior.
 */
function ProximoCompromisso({ item }: { item: ItemDaAgenda }) {
  const distancia = formatarDistanciaEmDias(item.aconteceEm);

  return (
    <section className="mb-9 rounded-[0.75rem] border border-[var(--color-borda-forte)] bg-[var(--color-superficie-alta)] p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-texto-fraco)]">
        Próximo
      </p>

      <h2 className="mt-2 text-xl font-semibold text-[var(--color-texto)]">
        {ROTULO_DO_EVENTO[item.tipo]}
      </h2>

      <p className="mt-1 text-base text-[var(--color-texto)]">
        {formatarDataPorExtenso(item.aconteceEm)}
        {', '}
        <span className="font-mono tabular-nums">{formatarHora(item.aconteceEm)}</span>
        {distancia && (
          <span className="text-[var(--color-texto-suave)]">{` · ${distancia}`}</span>
        )}
      </p>

      <DetalhesDoItem item={item} className="mt-3" />
    </section>
  );
}

function ListaPorMes({
  titulo,
  itens,
  esmaecida = false,
}: {
  titulo: string;
  itens: readonly ItemDaAgenda[];
  esmaecida?: boolean;
}) {
  const grupos = new Map<string, ItemDaAgenda[]>();
  for (const item of itens) {
    const chave = chaveDoMes(item.aconteceEm);
    const lista = grupos.get(chave) ?? [];
    lista.push(item);
    grupos.set(chave, lista);
  }

  return (
    <section className="mb-9">
      <h2 className="mb-1 text-sm font-semibold text-[var(--color-texto)]">{titulo}</h2>

      <div className="flex flex-col gap-6">
        {[...grupos.entries()].map(([chave, doMes]) => (
          <div key={chave}>
            <p className="mb-1 text-xs text-[var(--color-texto-fraco)]">
              {rotuloDoMes(doMes[0].aconteceEm)}
            </p>
            <ul>
              {doMes.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline gap-4 border-t border-[var(--color-borda)] py-4"
                >
                  {/* Mesma âncora de data do histórico: número grande, dia da semana
                      embaixo, largura fixa para alinhar coluna abaixo. */}
                  <div className="w-14 shrink-0">
                    <p
                      className={`font-mono text-lg leading-none tabular-nums ${
                        esmaecida ? 'text-[var(--color-texto-fraco)]' : 'text-[var(--color-texto)]'
                      }`}
                    >
                      {formatarNumeroDoDia(item.aconteceEm)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-texto-fraco)]">
                      {formatarDiaDaSemana(item.aconteceEm)}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        esmaecida
                          ? 'text-[0.9375rem] font-medium text-[var(--color-texto-suave)]'
                          : 'text-[0.9375rem] font-medium text-[var(--color-texto)]'
                      }
                    >
                      {ROTULO_DO_EVENTO[item.tipo]}
                    </p>
                    <DetalhesDoItem item={item} className="mt-1" />
                  </div>

                  <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--color-texto-fraco)]">
                    {formatarHora(item.aconteceEm)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Local, profissional e observação — o que existir, na ordem em que se procura. */
function DetalhesDoItem({ item, className = '' }: { item: ItemDaAgenda; className?: string }) {
  if (!item.local && !item.profissional && !item.observacoes) return null;

  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      {item.local && (
        <p className="text-sm text-[var(--color-texto-suave)]">{item.local}</p>
      )}
      {item.profissional && (
        <p className="text-sm text-[var(--color-texto-suave)]">
          {item.profissional.nome}
          <span className="text-[var(--color-texto-fraco)]">
            {` · ${ROTULO_DA_FUNCAO[item.profissional.funcao]}`}
          </span>
        </p>
      )}
      {item.observacoes && (
        <p className="text-sm text-[var(--color-texto-fraco)]">{item.observacoes}</p>
      )}
    </div>
  );
}
