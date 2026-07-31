'use client';

/**
 * E1 — Pacientes do dia.
 *
 * A primeira tela que o plantão vê, refeita sobre o padrão lista-e-detalhe do
 * Adaline e do OpenAI Platform: a lista ocupa a esquerda e o paciente selecionado
 * abre à direita, sem trocar de tela.
 *
 * A versão anterior errava por excesso de vazio — cinco cartões grandes e uma
 * tabela solta num mar de bege. Densidade aqui não é aperto: é não obrigar quem
 * está de plantão a navegar para descobrir o que já poderia estar à vista.
 *
 * A cor da escala continua exclusiva da classificação. Tudo o mais é neutro.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CabecalhoDePainel } from '@/componentes/sistema/painel';
import {
  Aviso,
  Carregando,
  EstadoVazio,
  LinkComoBotao,
  SeloDeRisco,
  juntar,
} from '@/componentes/sistema/primitivos';
import { ErroDaFonte, buscarPacientesDoDia } from '@/sistema/fonte';
import { PESO_DA_SITUACAO, ROTULO_DA_SITUACAO } from '@/sistema/formato';
import type { CartaoDoPainel, PacientesDoDia, SituacaoNoPainel } from '@/sistema/tipos';

/** Ordem e cor de cada faixa da escala. Único lugar da tela onde a cor significa algo. */
const FAIXAS = [
  { situacao: 'VERMELHO', cor: 'var(--color-risco-vermelho)' },
  { situacao: 'AMARELO', cor: 'var(--color-risco-amarelo)' },
  { situacao: 'NAO_CLASSIFICADA', cor: 'var(--color-risco-silencio)' },
  { situacao: 'SEM_RESPOSTA_HOJE', cor: 'var(--color-risco-silencio)' },
  { situacao: 'VERDE', cor: 'var(--color-risco-verde)' },
] as const satisfies readonly { situacao: SituacaoNoPainel; cor: string }[];

function textoDoEstado(cartao: CartaoDoPainel): string {
  if (cartao.situacao === 'NAO_CLASSIFICADA') return 'Questionário incompleto';
  if (cartao.nuncaRespondeu) return 'Nunca respondeu';
  if (cartao.diasSemResponder != null && cartao.diasSemResponder > 0) {
    return cartao.diasSemResponder === 1
      ? '1 dia sem responder'
      : `${cartao.diasSemResponder} dias sem responder`;
  }
  if (cartao.respondeuHoje) return 'Respondeu hoje';
  return '—';
}

export default function PaginaDePacientesDoDia() {
  const [dados, setDados] = useState<PacientesDoDia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<SituacaoNoPainel | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    buscarPacientesDoDia()
      .then((resultado) => {
        if (!cancelado) setDados(resultado);
      })
      .catch((motivo: unknown) => {
        if (cancelado) return;
        setErro(
          motivo instanceof ErroDaFonte
            ? motivo.message
            : 'Não foi possível carregar os pacientes do dia.',
        );
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const lista = useMemo(() => {
    if (!dados) return [];
    const filtrados = filtro ? dados.cards.filter((c) => c.situacao === filtro) : dados.cards;
    return [...filtrados].sort(
      (a, b) => PESO_DA_SITUACAO[a.situacao] - PESO_DA_SITUACAO[b.situacao],
    );
  }, [dados, filtro]);

  const emFoco = useMemo(
    () => lista.find((c) => c.pacienteId === selecionado) ?? lista[0] ?? null,
    [lista, selecionado],
  );

  const contagem = (situacao: SituacaoNoPainel) =>
    dados?.cards.filter((c) => c.situacao === situacao).length ?? 0;

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Plantão' }, { rotulo: 'Pacientes do dia' }]}
        titulo="Pacientes do dia"
        descricao="Ordenados por gravidade. Silêncio vem antes do verde: quem não respondeu é pendência, não resultado tranquilo."
      />

      {erro && (
        <Aviso tom="grave" titulo="Não foi possível carregar">
          {erro}
        </Aviso>
      )}

      {!erro && !dados && <Carregando linhas={8} />}

      {!erro && dados && (
        <>
          {/* Faixa da escala: proporção e contagem na mesma peça, no lugar de cinco
              cartões vazios. Cada segmento é um filtro. */}
          <div className="mb-5 rounded-[var(--radius-amplo)] border border-[var(--color-borda)] bg-[var(--color-superficie-alta)] p-4 shadow-[var(--sombra-cartao)]">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-[var(--color-texto-fraco)]">
                Escala de hoje
              </span>
              <span className="font-mono text-sm tabular-nums text-[var(--color-texto-suave)]">
                {dados.resumo.total} em acompanhamento
              </span>
            </div>

            <div className="flex h-2 w-full overflow-hidden rounded-[var(--radius-pilula)] bg-[var(--color-superficie-baixa)]">
              {FAIXAS.map((faixa) => {
                const quantos = contagem(faixa.situacao);
                if (quantos === 0) return null;
                return (
                  <span
                    key={faixa.situacao}
                    className="h-full"
                    style={{
                      width: `${(quantos / Math.max(dados.resumo.total, 1)) * 100}%`,
                      backgroundColor: faixa.cor,
                    }}
                  />
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <BotaoDeFiltro
                rotulo="Todos"
                quantidade={dados.resumo.total}
                ativo={filtro === null}
                aoClicar={() => setFiltro(null)}
              />
              {FAIXAS.map((faixa) => (
                <BotaoDeFiltro
                  key={faixa.situacao}
                  rotulo={ROTULO_DA_SITUACAO[faixa.situacao]}
                  quantidade={contagem(faixa.situacao)}
                  cor={faixa.cor}
                  ativo={filtro === faixa.situacao}
                  aoClicar={() =>
                    setFiltro((atual) => (atual === faixa.situacao ? null : faixa.situacao))
                  }
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            {/* Lista densa */}
            <div className="overflow-hidden rounded-[var(--radius-amplo)] border border-[var(--color-borda)] bg-[var(--color-superficie-alta)] shadow-[var(--sombra-cartao)]">
              {lista.length === 0 ? (
                <div className="p-6">
                  <EstadoVazio
                    titulo="Ninguém nesta situação"
                    descricao="Escolha outro filtro ou volte para a lista completa."
                  />
                </div>
              ) : (
                <ul>
                  {lista.map((cartao) => {
                    const ativo = emFoco?.pacienteId === cartao.pacienteId;
                    return (
                      <li key={cartao.pacienteId}>
                        <button
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => setSelecionado(cartao.pacienteId)}
                          className={juntar(
                            'flex w-full items-center gap-3 border-b border-[var(--color-borda)] px-4 py-2.5 text-left',
                            'transition-colors duration-100 last:border-b-0',
                            ativo
                              ? 'bg-[var(--color-superficie-baixa)]'
                              : 'hover:bg-[var(--color-superficie-baixa)]',
                          )}
                        >
                          {/* Marca de gravidade na borda: dá para varrer a coluna
                              inteira sem ler nenhum texto. */}
                          <span
                            aria-hidden
                            className="h-8 w-[3px] shrink-0 rounded-[var(--radius-pilula)]"
                            style={{
                              backgroundColor:
                                FAIXAS.find((f) => f.situacao === cartao.situacao)?.cor ??
                                'var(--color-borda-forte)',
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[var(--color-texto)]">
                              {cartao.nome}
                            </span>
                            <span className="block truncate text-xs text-[var(--color-texto-fraco)]">
                              {textoDoEstado(cartao)}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--color-texto-fraco)]">
                            {cartao.diaDoCiclo != null ? `D${cartao.diaDoCiclo}` : '—'}
                          </span>
                          <SeloDeRisco situacao={cartao.situacao} className="shrink-0" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Detalhe do selecionado */}
            {emFoco && <PainelDeDetalhe cartao={emFoco} />}
          </div>
        </>
      )}
    </>
  );
}

function BotaoDeFiltro({
  rotulo,
  quantidade,
  cor,
  ativo,
  aoClicar,
}: {
  rotulo: string;
  quantidade: number;
  cor?: string;
  ativo: boolean;
  aoClicar(): void;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={aoClicar}
      className={juntar(
        'inline-flex items-center gap-1.5 rounded-[var(--radius-pilula)] border px-2.5 py-1 text-xs',
        'transition-colors duration-150',
        ativo
          ? 'border-[var(--color-borda-forte)] bg-[var(--color-superficie-baixa)] text-[var(--color-texto)]'
          : 'border-transparent text-[var(--color-texto-suave)] hover:bg-[var(--color-superficie-baixa)]',
      )}
    >
      {cor && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: cor }}
        />
      )}
      {rotulo}
      <span className="font-mono tabular-nums text-[var(--color-texto-fraco)]">{quantidade}</span>
    </button>
  );
}

/**
 * O painel da direita.
 *
 * Mostra o que já se sabe do cartão e leva ao histórico completo. Não inventa dado:
 * o que não veio de `/painel/pacientes-do-dia` não aparece aqui — quem quiser o
 * detalhe clínico abre o histórico, onde ele existe de verdade.
 */
function PainelDeDetalhe({ cartao }: { cartao: CartaoDoPainel }) {
  const router = useRouter();
  const destino = `/painel/pacientes/${cartao.pacienteId}`;

  const linhas = [
    { rotulo: 'Situação', valor: ROTULO_DA_SITUACAO[cartao.situacao] },
    { rotulo: 'Protocolo', valor: cartao.protocolo },
    {
      rotulo: 'Dia do ciclo',
      valor: cartao.diaDoCiclo != null ? String(cartao.diaDoCiclo) : 'Sem ciclo aberto',
      mono: true,
    },
    { rotulo: 'Respondeu hoje', valor: cartao.respondeuHoje ? 'Sim' : 'Não' },
    { rotulo: 'Acompanhamento', valor: textoDoEstado(cartao) },
  ];

  return (
    <aside className="h-fit overflow-hidden rounded-[var(--radius-amplo)] border border-[var(--color-borda)] bg-[var(--color-superficie-alta)] shadow-[var(--sombra-cartao)]">
      <header className="border-b border-[var(--color-borda)] px-5 py-4">
        <SeloDeRisco situacao={cartao.situacao} />
        <h2 className="mt-2.5 text-lg font-semibold leading-tight text-[var(--color-texto)]">
          {cartao.nome}
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
        <LinkComoBotao href={destino} tamanho="amplo">
          Abrir histórico
        </LinkComoBotao>
        {cartao.situacao === 'NAO_CLASSIFICADA' && (
          <p className="text-xs leading-relaxed text-[var(--color-texto-fraco)]">
            Questionário começado e não terminado não recebe classificação. As duas causas
            mais prováveis são opostas — trate como pendência.
          </p>
        )}
      </div>

      {/* Atalho de teclado para quem trabalha de teclado o dia inteiro. */}
      <button
        type="button"
        onClick={() => router.push(destino)}
        className="sr-only focus:not-sr-only focus:block focus:px-5 focus:py-2 focus:text-sm"
      >
        Ir para o histórico de {cartao.nome}
      </button>
    </aside>
  );
}
