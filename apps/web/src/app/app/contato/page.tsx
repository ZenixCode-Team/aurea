'use client';

/**
 * P8 — Contato. Se já existe um pedido em aberto, mostra o estado dele em vez de
 * um formulário novo — evitar que a pessoa peça a mesma coisa duas vezes.
 *
 * Não existe função de envio em `fonte.ts` para este pedido (a bancada de teste
 * chama a API diretamente, fora da fronteira que as telas devem respeitar). Por
 * isso o envio aqui fica em estado local, como o briefing pede para as alergias —
 * na Onda F, `enviarSolicitacaoDeContato` entra em `fonte.ts` e só o corpo desta
 * função muda.
 */

import { useEffect, useState } from 'react';
import { CabecalhoDePainel } from '@/componentes/sistema/painel';
import { Aviso, Botao, Cartao, Carregando } from '@/componentes/sistema/primitivos';
import { buscarSolicitacoesDoPaciente } from '@/sistema/fonte';
import { formatarHora } from '@/sistema/formato';
import type { SolicitacaoDeContato } from '@/sistema/tipos';

type Fase = 'carregando' | 'erro' | 'pronto';

export default function PaginaDeContato() {
  const [fase, setFase] = useState<Fase>('carregando');
  const [solicitacoes, setSolicitacoes] = useState<readonly SolicitacaoDeContato[]>([]);
  const [motivo, setMotivo] = useState('');
  const [enviado, setEnviado] = useState<{ motivo: string; horario: string } | null>(null);

  useEffect(() => {
    let cancelado = false;
    buscarSolicitacoesDoPaciente()
      .then((dados) => {
        if (cancelado) return;
        setSolicitacoes(dados);
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
        Não foi possível carregar seus pedidos de contato agora. Tente novamente em instantes.
      </Aviso>
    );
  }

  const solicitacaoAberta = solicitacoes.find((solicitacao) => solicitacao.situacao !== 'ATENDIDA');

  if (solicitacaoAberta) {
    return (
      <div className="flex flex-col gap-4">
        <CabecalhoDePainel titulo="Falar com a enfermagem" descricao="Seu pedido já está com a equipe." />
        <Cartao className="flex flex-col gap-2 p-5">
          <p className="text-base text-[var(--color-texto)]">
            A equipe recebeu seu pedido às {formatarHora(solicitacaoAberta.criadaEm)} e vai entrar em
            contato.
          </p>
          {solicitacaoAberta.motivo && (
            <p className="text-sm text-[var(--color-texto-suave)]">
              Você escreveu: {solicitacaoAberta.motivo}
            </p>
          )}
        </Cartao>
        <p className="text-sm text-[var(--color-texto-fraco)]">
          Este não é um canal de emergência. Se a situação for grave, procure o serviço.
        </p>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="flex flex-col gap-4">
        <CabecalhoDePainel titulo="Falar com a enfermagem" descricao="Seu pedido já está com a equipe." />
        <Cartao className="flex flex-col gap-2 p-5">
          <p className="text-base text-[var(--color-texto)]">
            Recebemos seu pedido às {enviado.horario} e a equipe vai entrar em contato.
          </p>
          {enviado.motivo && (
            <p className="text-sm text-[var(--color-texto-suave)]">Você escreveu: {enviado.motivo}</p>
          )}
        </Cartao>
        <p className="text-sm text-[var(--color-texto-fraco)]">
          Este não é um canal de emergência. Se a situação for grave, procure o serviço.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        setEnviado({ motivo: motivo.trim(), horario: formatarHora(new Date().toISOString()) });
      }}
    >
      <CabecalhoDePainel
        titulo="Falar com a enfermagem"
        descricao="Conte um pouco do que está sentindo e a equipe entra em contato."
      />
      <p className="text-sm text-[var(--color-texto-suave)]">
        Este não é um canal de emergência. Se a situação for grave, procure o serviço.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="motivo" className="text-sm font-medium text-[var(--color-texto)]">
          Motivo (opcional)
        </label>
        <textarea
          id="motivo"
          rows={4}
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          placeholder="Se quiser, conte um pouco do que está sentindo."
          className="rounded-[var(--radius-sistema)] border border-[var(--color-borda-forte)] bg-[var(--color-superficie-alta)] px-3 py-2.5 text-base text-[var(--color-texto)] placeholder:text-[var(--color-texto-fraco)] transition-colors duration-150 focus:border-[var(--color-texto-suave)]"
        />
      </div>
      <Botao type="submit" tamanho="amplo">
        Falar com a enfermagem
      </Botao>
    </form>
  );
}
