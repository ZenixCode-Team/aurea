'use client';

/**
 * P1 — Hoje.
 *
 * O centro da tela é uma pergunta só: o check-in de hoje está pendente ou feito?
 * O resto (ciclo, próximo compromisso, atalho para a enfermagem) é contexto de apoio.
 *
 * O resultado do check-in de hoje é lido de `sessionStorage` — é onde a página de
 * check-in grava a resposta ao terminar (chave local, sem backend). Sem essa leitura
 * "Hoje" nunca saberia que a pessoa já respondeu, porque cada rota tem seu próprio
 * estado local.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  BarraDeProgresso,
  CartaoDeIndicador,
  LinhaDeIndicadores,
} from '@/componentes/sistema/painel';
import {
  Aviso,
  Cartao,
  Carregando,
  LinkComoBotao,
  Rotulo,
} from '@/componentes/sistema/primitivos';
import { buscarAgenda, buscarPerfilDoPaciente } from '@/sistema/fonte';
import { formatarDataPorExtenso, formatarHora, ROTULO_DO_EVENTO } from '@/sistema/formato';
import type { ItemDaAgenda, PerfilDoPaciente, RetornoDoCheckin } from '@/sistema/tipos';

const CHAVE_CHECKIN_DE_HOJE = 'aurea.checkinDeHoje';

type EstadoDaPagina =
  | { fase: 'carregando' }
  | { fase: 'erro' }
  | {
      fase: 'pronto';
      perfil: PerfilDoPaciente;
      proximoCompromisso: ItemDaAgenda | null;
      resultadoDeHoje: RetornoDoCheckin | null;
    };

export default function PaginaHoje() {
  const [estado, setEstado] = useState<EstadoDaPagina>({ fase: 'carregando' });

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        const [perfil, agenda] = await Promise.all([buscarPerfilDoPaciente(), buscarAgenda()]);
        if (cancelado) return;

        const agora = Date.now();
        const proximoCompromisso =
          agenda.find((item) => new Date(item.aconteceEm).getTime() >= agora) ?? null;

        let resultadoDeHoje: RetornoDoCheckin | null = null;
        const bruto = sessionStorage.getItem(CHAVE_CHECKIN_DE_HOJE);
        if (bruto) {
          try {
            resultadoDeHoje = JSON.parse(bruto) as RetornoDoCheckin;
          } catch {
            resultadoDeHoje = null;
          }
        }

        setEstado({ fase: 'pronto', perfil, proximoCompromisso, resultadoDeHoje });
      } catch {
        if (!cancelado) setEstado({ fase: 'erro' });
      }
    }

    void carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  if (estado.fase === 'carregando') {
    return <Carregando linhas={4} />;
  }

  if (estado.fase === 'erro') {
    return (
      <Aviso tom="grave" titulo="Algo não carregou">
        Não foi possível carregar as informações de hoje. Tente novamente em instantes.
      </Aviso>
    );
  }

  const { perfil, proximoCompromisso, resultadoDeHoje } = estado;

  return (
    <div className="flex flex-col gap-4">
      {/* Só a data. O nome já está no cabeçalho, e saudação personalizada em app de
          uso diário cansa na terceira vez — além de sair errada quando o cadastro
          traz um nome que não é o primeiro nome da pessoa. */}
      <p className="text-sm text-[var(--color-texto-suave)]">
        Hoje é {formatarDataPorExtenso(new Date().toISOString())}.
      </p>

      {resultadoDeHoje ? (
        <Cartao className="flex flex-col gap-5 p-6">
          <div>
            <Rotulo>Check-in de hoje</Rotulo>
            <p className="mt-2 text-[1.375rem] font-medium leading-snug text-[var(--color-texto)]">
              Recebemos sua resposta de hoje.
            </p>
            <p className="mt-1 text-base text-[var(--color-texto-suave)]">
              Obrigada por contar pra gente.
            </p>
          </div>

          {resultadoDeHoje.pedeContatoComServico && (
            <Aviso tom="grave" titulo="Entre em contato com o serviço hoje">
              Pelo que você relatou, a equipe pede que você entre em contato com o serviço
              ainda hoje.
            </Aviso>
          )}

          <div className="flex flex-col gap-4 border-t border-[var(--color-borda)] pt-4">
            {resultadoDeHoje.orientacoes.map((orientacao) => (
              <div key={orientacao.id} className="flex flex-col gap-1.5">
                <p className="text-base font-medium text-[var(--color-texto)]">
                  {orientacao.titulo}
                </p>
                <p className="text-[1.0625rem] leading-relaxed text-[var(--color-texto-suave)]">
                  {orientacao.texto}
                </p>
              </div>
            ))}
          </div>
        </Cartao>
      ) : (
        /* O cartão do check-in é deliberadamente o maior elemento da tela: é a única
           coisa que a pessoa precisa fazer aqui, e ela pode estar cansada. */
        <Cartao className="flex flex-col gap-5 p-6 shadow-[var(--sombra-elevada)]">
          <div>
            <Rotulo>Check-in de hoje</Rotulo>
            <p className="mt-2 text-[1.625rem] font-medium leading-tight tracking-[-0.01em] text-[var(--color-texto)]">
              Como você está hoje?
            </p>
            <p className="mt-2 text-base leading-relaxed text-[var(--color-texto-suave)]">
              Leva cerca de dois minutos. Você pode parar no meio e voltar depois.
            </p>
          </div>
          <LinkComoBotao href="/app/checkin" tamanho="amplo">
            Começar
          </LinkComoBotao>
        </Cartao>
      )}

      {/* Os números do tratamento na mesma malha de filete dos painéis da equipe —
          três células dividindo uma moldura só. É o mesmo objeto que o plantão vê, com
          o conteúdo que cabe a esta pessoa: nenhum deles é classificação, e nenhum é
          colorido. A prosa que estava aqui ("Dia 17 desde a sua última sessão") virou
          número grande porque é isso que a pessoa procura ao abrir o app.

          As três contas saem de duas datas já guardadas, sem consultar "hoje" em
          momento nenhum: dia do ciclo e previsão vêm da API, e o total é a diferença
          entre elas. É o que mantém o cartão imune ao bug de fuso que já custou uma
          correção neste projeto. */}
      {perfil.ciclo && (
        <div className="flex flex-col gap-3">
          <LinhaDeIndicadores colunas="tres">
            <CartaoDeIndicador rotulo="Ciclo" valor={perfil.ciclo.numero} />
            <CartaoDeIndicador
              rotulo="Dia"
              valor={perfil.ciclo.diaDoCiclo}
              apoio={
                perfil.ciclo.previsaoDaProximaSessao
                  ? `de ${diasEntre(perfil.ciclo.sessaoRealizadaEm, perfil.ciclo.previsaoDaProximaSessao)}`
                  : 'desde a última sessão'
              }
            />
            <CartaoDeIndicador
              rotulo="Faltam"
              valor={
                perfil.ciclo.previsaoDaProximaSessao
                  ? Math.max(
                      diasEntre(
                        perfil.ciclo.sessaoRealizadaEm,
                        perfil.ciclo.previsaoDaProximaSessao,
                      ) - perfil.ciclo.diaDoCiclo,
                      0,
                    )
                  : '—'
              }
              apoio={perfil.ciclo.previsaoDaProximaSessao ? 'dias' : 'sem previsão'}
            />
          </LinhaDeIndicadores>

          {perfil.ciclo.previsaoDaProximaSessao && (
            <Cartao className="p-5">
              <BarraDeProgresso
                atual={perfil.ciclo.diaDoCiclo}
                total={diasEntre(
                  perfil.ciclo.sessaoRealizadaEm,
                  perfil.ciclo.previsaoDaProximaSessao,
                )}
                rotulo="Até a próxima sessão prevista"
                descricao={formatarDataPorExtenso(perfil.ciclo.previsaoDaProximaSessao)}
              />
            </Cartao>
          )}
        </div>
      )}

      <Cartao className="flex flex-col gap-2 p-5">
        <Rotulo>Próximo compromisso</Rotulo>
        {proximoCompromisso ? (
          <>
            <p className="text-lg text-[var(--color-texto)]">
              {ROTULO_DO_EVENTO[proximoCompromisso.tipo]}
            </p>
            <p className="text-base text-[var(--color-texto-suave)]">
              {formatarDataPorExtenso(proximoCompromisso.aconteceEm)} às{' '}
              {formatarHora(proximoCompromisso.aconteceEm)}
              {proximoCompromisso.local ? ` — ${proximoCompromisso.local}` : ''}
            </p>
          </>
        ) : (
          <p className="text-base text-[var(--color-texto-suave)]">Nada marcado por enquanto.</p>
        )}
      </Cartao>

      <Link
        href="/app/contato"
        className="rounded-[var(--radius-amplo)] border border-dashed border-[var(--color-borda-forte)] px-5 py-4 text-center text-base text-[var(--color-texto-suave)] transition-colors hover:bg-[var(--color-superficie-baixa)] hover:text-[var(--color-texto)]"
      >
        Falar com a enfermagem
      </Link>
    </div>
  );
}

/** Quantos dias separam duas datas. Mínimo de 1 para a barra nunca dividir por zero. */
function diasEntre(de: string, ate: string): number {
  const diferenca = new Date(ate).getTime() - new Date(de).getTime();
  return Math.max(Math.round(diferenca / 86_400_000), 1);
}
