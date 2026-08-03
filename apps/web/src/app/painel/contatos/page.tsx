'use client';

/**
 * E4 — Fila de solicitações de contato + E5 — Atender.
 *
 * ADR-004: mesma composição lista-e-detalhe de `/painel` — a fila ocupa a esquerda
 * densa, e a solicitação em foco abre à direita com a ação de atender. Quem espera
 * há mais tempo continua no topo: a fila não é cronológica de criação, é cronológica
 * de espera. Abertas antes de atendidas, e dentro de abertas, a mais antiga primeiro.
 *
 * A situação da solicitação (aberta/em atendimento/atendida) não é classificação de
 * risco — por isso o selo aqui usa só os neutros do sistema, nunca `--color-risco-*`.
 */

import { useEffect, useMemo, useState } from 'react';
import { Bloco, CabecalhoDePainel, CartaoDeIndicador, LinhaDeIndicadores } from '@/componentes/sistema/painel';
import {
  Aviso,
  Botao,
  Carregando,
  EstadoVazio,
  LinkComoBotao,
  juntar,
} from '@/componentes/sistema/primitivos';
import { Modal } from '@/componentes/sistema/modal';
import { ErroDaFonte, buscarFilaDeContatos } from '@/sistema/fonte';
import { formatarDataEHora, formatarTelefone } from '@/sistema/formato';
import type { SituacaoDaSolicitacao, SolicitacaoNaFila } from '@/sistema/tipos';

const ROTULO_DA_SITUACAO_DA_SOLICITACAO: Record<SituacaoDaSolicitacao, string> = {
  ABERTA: 'Aberta',
  EM_ATENDIMENTO: 'Em atendimento',
  ATENDIDA: 'Atendida',
};

/** Abertas antes de atendidas; dentro de cada grupo, quem espera há mais tempo primeiro. */
function pesoDaSituacao(situacao: SituacaoDaSolicitacao): number {
  return situacao === 'ATENDIDA' ? 1 : 0;
}

export default function PaginaDeSolicitacoesDeContato() {
  const [fila, setFila] = useState<readonly SolicitacaoNaFila[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [solicitacaoNoModal, setSolicitacaoNoModal] = useState<string | null>(null);
  const [confirmacaoVisivelPara, setConfirmacaoVisivelPara] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    buscarFilaDeContatos()
      .then((resultado) => {
        if (!cancelado) setFila(resultado);
      })
      .catch((motivo: unknown) => {
        if (cancelado) return;
        setErro(
          motivo instanceof ErroDaFonte
            ? motivo.message
            : 'Não foi possível carregar a fila de contatos.',
        );
      });
    return () => {
      cancelado = true;
    };
  }, []);

  function atender(solicitacaoId: string) {
    setFila((atual) =>
      (atual ?? []).map((item) =>
        item.id === solicitacaoId
          ? { ...item, situacao: 'ATENDIDA' as const, atendidaEm: new Date().toISOString() }
          : item,
      ),
    );
    setSolicitacaoNoModal(null);
    setConfirmacaoVisivelPara(solicitacaoId);
  }

  const filaOrdenada = useMemo(() => {
    if (!fila) return [];
    return [...fila].sort((a, b) => {
      const diferencaDePeso = pesoDaSituacao(a.situacao) - pesoDaSituacao(b.situacao);
      if (diferencaDePeso !== 0) return diferencaDePeso;
      return a.criadaEm.localeCompare(b.criadaEm);
    });
  }, [fila]);

  const emFoco = useMemo(
    () => filaOrdenada.find((item) => item.id === selecionado) ?? filaOrdenada[0] ?? null,
    [filaOrdenada, selecionado],
  );

  const contar = (situacao: SituacaoDaSolicitacao) =>
    fila?.filter((item) => item.situacao === situacao).length ?? 0;

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Plantão' }, { rotulo: 'Solicitações de contato' }]}
        titulo="Solicitações de contato"
        descricao="Quem espera há mais tempo aparece primeiro na fila."
      />

      {erro && (
        <Aviso tom="grave" titulo="Não foi possível carregar">
          {erro}
        </Aviso>
      )}

      {!erro && !fila && <Carregando linhas={6} />}

      {!erro && fila && (
        <>
          <LinhaDeIndicadores>
            <CartaoDeIndicador rotulo="Abertas" valor={contar('ABERTA')} apoio="aguardando atendimento" />
            <CartaoDeIndicador rotulo="Em atendimento" valor={contar('EM_ATENDIMENTO')} />
            <CartaoDeIndicador rotulo="Atendidas" valor={contar('ATENDIDA')} />
            <CartaoDeIndicador rotulo="Total" valor={fila.length} apoio="na fila hoje" />
          </LinhaDeIndicadores>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <Bloco titulo="Fila" descricao="Ordenada por tempo de espera." semPadding>
              {filaOrdenada.length === 0 ? (
                <div className="p-6">
                  <EstadoVazio
                    titulo="Nenhuma solicitação de contato"
                    descricao="Quando um paciente pedir contato, a solicitação aparece aqui."
                  />
                </div>
              ) : (
                <ul>
                  {filaOrdenada.map((item) => {
                    const ativo = emFoco?.id === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => setSelecionado(item.id)}
                          className={juntar(
                            'flex w-full items-center gap-3 border-b border-[var(--color-borda)] px-4 py-3 text-left',
                            'transition-colors duration-100 last:border-b-0',
                            ativo
                              ? 'bg-[var(--color-superficie-baixa)]'
                              : 'hover:bg-[var(--color-superficie-baixa)]',
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[var(--color-texto)]">
                              {item.paciente.nome}
                            </span>
                            <span className="block truncate text-xs text-[var(--color-texto-fraco)]">
                              {item.motivo ?? 'Sem motivo informado'}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--color-texto-fraco)]">
                            {formatarDataEHora(item.criadaEm)}
                          </span>
                          <SeloDeSituacaoDaSolicitacao situacao={item.situacao} className="shrink-0" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Bloco>

            {emFoco && (
              <PainelDeDetalheDaSolicitacao
                item={emFoco}
                confirmacaoVisivel={confirmacaoVisivelPara === emFoco.id}
                aoAtender={() => setSolicitacaoNoModal(emFoco.id)}
              />
            )}
          </div>
        </>
      )}

      <ModalDeAtendimento
        aberto={solicitacaoNoModal !== null}
        aoFechar={() => setSolicitacaoNoModal(null)}
        aoConfirmar={() => {
          if (solicitacaoNoModal) atender(solicitacaoNoModal);
        }}
      />
    </>
  );
}

function SeloDeSituacaoDaSolicitacao({
  situacao,
  className,
}: {
  situacao: SituacaoDaSolicitacao;
  className?: string;
}) {
  const estilo = {
    ABERTA:
      'border-[var(--color-superficie-invertida)] bg-[var(--color-superficie-invertida)] text-[var(--color-texto-invertido)]',
    EM_ATENDIMENTO: 'border-[var(--color-borda-forte)] bg-[var(--color-superficie-baixa)] text-[var(--color-texto)]',
    ATENDIDA: 'border-[var(--color-borda)] bg-transparent text-[var(--color-texto-fraco)]',
  }[situacao];

  return (
    <span
      className={juntar(
        'inline-flex items-center rounded-[var(--radius-pilula)] border px-2.5 py-1 text-xs font-medium',
        estilo,
        className,
      )}
    >
      {ROTULO_DA_SITUACAO_DA_SOLICITACAO[situacao]}
    </span>
  );
}

/**
 * O painel da direita.
 *
 * Mostra a solicitação em foco e o botão de atender, quando ainda cabe atender.
 */
function PainelDeDetalheDaSolicitacao({
  item,
  confirmacaoVisivel,
  aoAtender,
}: {
  item: SolicitacaoNaFila;
  confirmacaoVisivel: boolean;
  aoAtender(): void;
}) {
  const linhas = [
    { rotulo: 'Telefone', valor: item.paciente.telefone ? formatarTelefone(item.paciente.telefone) : 'não informado', mono: true },
    { rotulo: 'Motivo', valor: item.motivo ?? 'Sem motivo informado' },
    { rotulo: 'Solicitado em', valor: formatarDataEHora(item.criadaEm), mono: true },
    ...(item.atendidaEm
      ? [{ rotulo: 'Atendida em', valor: formatarDataEHora(item.atendidaEm), mono: true }]
      : []),
  ];

  return (
    <aside className="h-fit overflow-hidden rounded-[var(--radius-amplo)] border border-[var(--color-borda)] bg-[var(--color-superficie-alta)] shadow-[var(--sombra-cartao)]">
      <header className="border-b border-[var(--color-borda)] px-5 py-4">
        <SeloDeSituacaoDaSolicitacao situacao={item.situacao} />
        <h2 className="mt-2.5 text-lg font-semibold leading-tight text-[var(--color-texto)]">
          {item.paciente.nome}
        </h2>
      </header>

      <dl className="px-5 py-1">
        {linhas.map((linha) => (
          <div
            key={linha.rotulo}
            className="flex items-baseline justify-between gap-4 border-b border-[var(--color-borda)] py-2.5 last:border-b-0"
          >
            <dt className="text-sm text-[var(--color-texto-fraco)]">{linha.rotulo}</dt>
            <dd
              className={juntar(
                'text-right text-sm text-[var(--color-texto)]',
                linha.mono && 'font-mono tabular-nums',
              )}
            >
              {linha.valor}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2 border-t border-[var(--color-borda)] px-5 py-4">
        {confirmacaoVisivel && (
          <p className="text-xs text-[var(--color-texto-fraco)]">Atendimento registrado.</p>
        )}
        <LinkComoBotao href={`/painel/pacientes/${item.paciente.id}`} variante="secundario" tamanho="amplo">
          Abrir histórico
        </LinkComoBotao>
        {item.situacao === 'ABERTA' && (
          <Botao type="button" tamanho="amplo" onClick={aoAtender}>
            Atender
          </Botao>
        )}
      </div>
    </aside>
  );
}

/* ==========================================================================
   E5 — Modal de atendimento
   ========================================================================== */

function ModalDeAtendimento({
  aberto,
  aoFechar,
  aoConfirmar,
}: {
  aberto: boolean;
  aoFechar(): void;
  aoConfirmar(registro: string): void;
}) {
  const [registro, setRegistro] = useState('');

  /* Reinicia o formulário no próprio evento que fecha o modal — não em efeito,
     que dispararia setState síncrono a cada mudança de `aberto`. */
  function fecharEReiniciar() {
    setRegistro('');
    aoFechar();
  }

  return (
    <Modal
      aberto={aberto}
      titulo="Atender solicitação"
      descricao="Registre o que foi conversado ou decidido no contato."
      aoFechar={fecharEReiniciar}
      rodape={
        <>
          <Botao variante="secundario" onClick={fecharEReiniciar}>
            Cancelar
          </Botao>
          <Botao
            variante="principal"
            disabled={registro.trim().length === 0}
            onClick={() => {
              aoConfirmar(registro.trim());
              setRegistro('');
            }}
          >
            Confirmar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="registro-do-atendimento"
          className="text-sm font-medium text-[var(--color-texto)]"
        >
          Registro do atendimento
        </label>
        <textarea
          id="registro-do-atendimento"
          value={registro}
          onChange={(evento) => setRegistro(evento.target.value)}
          rows={4}
          placeholder="O que foi conversado ou decidido"
          className="rounded-[var(--radius-sistema)] border border-[var(--color-borda-forte)] bg-[var(--color-superficie-alta)] px-3 py-2.5 text-base text-[var(--color-texto)] placeholder:text-[var(--color-texto-fraco)] transition-colors duration-150 focus:border-[var(--color-texto-suave)]"
        />
      </div>
    </Modal>
  );
}
