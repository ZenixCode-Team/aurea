'use client';

/**
 * E2 — Histórico do paciente + E3 — Registrar intervenção.
 *
 * Esta é a tela que evita que o painel vire caixa-preta: toda classificação
 * exibida vem acompanhada da regra que a produziu, com justificativa por
 * extenso. Sem isso, cor de risco é uma afirmação sem prova — inaceitável em
 * software clínico.
 */

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bloco,
  CabecalhoDePainel,
  CartaoDeIndicador,
  LinhaDeIndicadores,
} from '@/componentes/sistema/painel';
import {
  Aviso,
  Botao,
  CabecalhoDaTabela,
  Carregando,
  Celula,
  EstadoVazio,
  LinhaDaTabela,
  Medida,
  SeloDeNaoValidado,
  SeloDeRisco,
  Tabela,
  juntar,
} from '@/componentes/sistema/primitivos';
import { Modal } from '@/componentes/sistema/modal';
import { ErroDaFonte, buscarHistoricoNoPainel } from '@/sistema/fonte';
import {
  formatarDataEHora,
  formatarMedida,
  nomeDoCampoLegivel,
  ROTULO_DA_SITUACAO,
  ROTULO_DO_SINTOMA,
} from '@/sistema/formato';
import { useSessao } from '@/sistema/sessao';
import type {
  HistoricoDoPaciente,
  Intervencao,
  RegraDisparada,
  RespostaRegistrada,
  SessaoNoHistorico,
  SituacaoDoSintoma,
} from '@/sistema/tipos';

const ROTULO_DA_SITUACAO_DO_SINTOMA: Record<SituacaoDoSintoma, string> = {
  RESOLVIDO: 'Resolvido',
  EM_ACOMPANHAMENTO: 'Em acompanhamento',
};

/* Só estas duas: é o que `POST /painel/sessoes/:id/intervencoes` aceita. Oferecer
   opção que o servidor recusa é fazer o profissional descobrir isso no erro. */
const OPCOES_DE_SITUACAO: readonly SituacaoDoSintoma[] = ['RESOLVIDO', 'EM_ACOMPANHAMENTO'];

/** O tom do indicador de classificação. Fora daqui, cor de risco não decora nada. */
function tomDaClassificacao(
  classificacao: SessaoNoHistorico['classificacao'],
): 'vermelho' | 'amarelo' | 'verde' | 'silencio' {
  if (classificacao === 'VERMELHO') return 'vermelho';
  if (classificacao === 'AMARELO') return 'amarelo';
  if (classificacao === 'VERDE') return 'verde';
  return 'silencio';
}

/** Um valor observado (regra ou resposta) formatado para leitura clínica. */
function formatarValorClinico(
  valor: number | string | boolean | null,
  unidade?: string | null,
): string {
  if (valor === null) return '—';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'number') {
    const casas = Number.isInteger(valor) ? 0 : 1;
    return formatarMedida(valor, casas, unidade ?? undefined);
  }
  return unidade ? `${valor} ${unidade}` : valor;
}

export default function PaginaDeHistoricoDoPaciente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  /* `key={id}` remonta o conteúdo quando o paciente muda: cada montagem começa
     com estado limpo, então o efeito de busca nunca precisa "resetar" estado
     sincronamente no corpo — só chama setState dentro de then/catch. */
  return <ConteudoDoHistorico key={id} pacienteId={id} />;
}

function ConteudoDoHistorico({ pacienteId: id }: { pacienteId: string }) {
  const router = useRouter();
  const { usuario, pode } = useSessao();

  const [historico, setHistorico] = useState<HistoricoDoPaciente | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /** Intervenções registradas nesta sessão de navegador, por sessão clínica. */
  const [intervencoesLocais, setIntervencoesLocais] = useState<
    Record<string, readonly Intervencao[]>
  >({});
  const [sessaoNoModal, setSessaoNoModal] = useState<string | null>(null);
  const [sessaoConfirmada, setSessaoConfirmada] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    buscarHistoricoNoPainel(id)
      .then((resultado) => {
        if (!cancelado) setHistorico(resultado);
      })
      .catch((motivo: unknown) => {
        if (cancelado) return;
        if (motivo instanceof ErroDaFonte && motivo.causa === 'NAO_ENCONTRADO') {
          setNaoEncontrado(true);
          return;
        }
        setErro(
          motivo instanceof ErroDaFonte
            ? motivo.message
            : 'Não foi possível carregar o histórico deste paciente.',
        );
      });
    return () => {
      cancelado = true;
    };
  }, [id]);

  function registrarIntervencao(
    sessaoId: string,
    conduta: string,
    situacaoDoSintoma: SituacaoDoSintoma,
  ) {
    const nova: Intervencao = {
      id: `intervencao-local-${Date.now()}`,
      registradaEm: new Date().toISOString(),
      profissional: usuario?.nome ?? 'Profissional do plantão',
      conduta,
      situacaoDoSintoma,
    };
    setIntervencoesLocais((atual) => ({
      ...atual,
      [sessaoId]: [nova, ...(atual[sessaoId] ?? [])],
    }));
    setSessaoNoModal(null);
    setSessaoConfirmada(sessaoId);
  }

  const acaoDeVoltar = (
    <Botao variante="secundario" onClick={() => router.push('/painel')}>
      Voltar
    </Botao>
  );

  if (naoEncontrado) {
    return (
      <>
        <CabecalhoDePainel
          trilha={[
            { rotulo: 'Plantão', href: '/painel' },
            { rotulo: 'Pacientes do dia', href: '/painel' },
            { rotulo: 'Histórico' },
          ]}
          titulo="Histórico do paciente"
          acao={acaoDeVoltar}
        />
        <EstadoVazio
          titulo="Este paciente ainda não tem sessão registrada"
          descricao="Nenhum check-in foi concluído ou iniciado até o momento. Volte para acompanhar quando houver dado."
        />
      </>
    );
  }

  if (erro) {
    return (
      <>
        <CabecalhoDePainel
          trilha={[
            { rotulo: 'Plantão', href: '/painel' },
            { rotulo: 'Pacientes do dia', href: '/painel' },
            { rotulo: 'Histórico' },
          ]}
          titulo="Histórico do paciente"
          acao={acaoDeVoltar}
        />
        <Aviso tom="grave" titulo="Não foi possível carregar">
          {erro}
        </Aviso>
      </>
    );
  }

  if (!historico) {
    return (
      <>
        <CabecalhoDePainel
          trilha={[
            { rotulo: 'Plantão', href: '/painel' },
            { rotulo: 'Pacientes do dia', href: '/painel' },
            { rotulo: 'Histórico' },
          ]}
          titulo="Histórico do paciente"
          acao={acaoDeVoltar}
        />
        <Carregando linhas={8} />
      </>
    );
  }

  const sessoesOrdenadas = [...historico.sessoes].sort((a, b) => b.dia.localeCompare(a.dia));

  return (
    <>
      <CabecalhoDePainel
        trilha={[
          { rotulo: 'Plantão', href: '/painel' },
          { rotulo: 'Pacientes do dia', href: '/painel' },
          { rotulo: historico.paciente.nome },
        ]}
        titulo={historico.paciente.nome}
        descricao={[
          historico.paciente.diagnostico,
          historico.paciente.protocolo,
          historico.paciente.diaDoCiclo != null
            ? `dia ${historico.paciente.diaDoCiclo} do ciclo`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        acao={acaoDeVoltar}
      />

      <LinhaDeIndicadores>
        {/* A classificação mais recente é o único indicador desta tela que pode usar
            a cor da escala — aqui ela significa exatamente o que deve significar. */}
        <CartaoDeIndicador
          rotulo="Última classificação"
          valor={
            sessoesOrdenadas[0]?.classificacao
              ? ROTULO_DA_SITUACAO[sessoesOrdenadas[0].classificacao]
              : 'Sem'
          }
          apoio={
            sessoesOrdenadas[0] ? formatarDataEHora(sessoesOrdenadas[0].dia) : 'nenhuma sessão'
          }
          tom={tomDaClassificacao(sessoesOrdenadas[0]?.classificacao ?? null)}
        />
        <CartaoDeIndicador
          rotulo="Dia do ciclo"
          valor={historico.paciente.diaDoCiclo ?? '—'}
        />
        <CartaoDeIndicador rotulo="Sessões registradas" valor={sessoesOrdenadas.length} />
        <CartaoDeIndicador
          rotulo="Intervenções"
          valor={sessoesOrdenadas.reduce((total, s) => total + s.intervencoes.length, 0)}
        />
      </LinhaDeIndicadores>

      <div className="flex flex-col gap-6">
        {sessoesOrdenadas.map((sessao) => (
          <SecaoDaSessao
            key={sessao.sessaoId}
            sessao={sessao}
            podeRegistrar={pode('REGISTRAR_INTERVENCAO')}
            intervencoesLocais={intervencoesLocais[sessao.sessaoId] ?? []}
            confirmacaoVisivel={sessaoConfirmada === sessao.sessaoId}
            aoAbrirModal={() => {
              setSessaoConfirmada(null);
              setSessaoNoModal(sessao.sessaoId);
            }}
          />
        ))}
      </div>

      <ModalDeIntervencao
        aberto={sessaoNoModal !== null}
        aoFechar={() => setSessaoNoModal(null)}
        aoConfirmar={(conduta, situacao) => {
          if (sessaoNoModal) registrarIntervencao(sessaoNoModal, conduta, situacao);
        }}
      />
    </>
  );
}

function SecaoDaSessao({
  sessao,
  podeRegistrar,
  intervencoesLocais,
  confirmacaoVisivel,
  aoAbrirModal,
}: {
  sessao: SessaoNoHistorico;
  podeRegistrar: boolean;
  intervencoesLocais: readonly Intervencao[];
  confirmacaoVisivel: boolean;
  aoAbrirModal(): void;
}) {
  const todasIntervencoes = [...intervencoesLocais, ...sessao.intervencoes];

  return (
    <Bloco
      titulo={formatarDataEHora(sessao.dia)}
      descricao={[
        sessao.diaDoCiclo != null ? `Dia ${sessao.diaDoCiclo} do ciclo` : null,
        `Conjunto ${sessao.versaoDoConjunto}`,
      ]
        .filter(Boolean)
        .join(' · ')}
      acao={
        <div className="flex flex-wrap items-center gap-2">
          <SeloDeRisco situacao={sessao.classificacao ?? 'NAO_CLASSIFICADA'} />
          {!sessao.validadoClinicamente && <SeloDeNaoValidado />}
        </div>
      }
    >

      {sessao.naoClassificadaPorque && (
        <Aviso tom="atencao" titulo="Sem classificação">
          {sessao.naoClassificadaPorque}
        </Aviso>
      )}

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <h3 className="mb-2 text-sm font-medium text-[var(--color-texto)]">
            Regras que dispararam
          </h3>
          {sessao.regrasDisparadas.length === 0 ? (
            <p className="text-sm text-[var(--color-texto-suave)]">
              Nenhuma regra disparou nesta sessão.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sessao.regrasDisparadas.map((regra) => (
                <RegraDisparadaItem key={regra.regraId} regra={regra} />
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-[var(--color-texto)]">
            Respostas registradas
          </h3>
          {sessao.respostas.length === 0 ? (
            <p className="text-sm text-[var(--color-texto-suave)]">Sem respostas registradas.</p>
          ) : (
            <Tabela rotulo={`Respostas da sessão de ${formatarDataEHora(sessao.dia)}`}>
              <CabecalhoDaTabela colunas={['Pergunta', 'Valor']} />
              <tbody>
                {sessao.respostas.map((resposta) => (
                  <LinhaDaTabela key={`${resposta.sintoma}-${resposta.campo}`}>
                    <Celula>{resposta.pergunta}</Celula>
                    <Celula mono>{formatarRespostaClinica(resposta)}</Celula>
                  </LinhaDaTabela>
                ))}
              </tbody>
            </Tabela>
          )}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-[var(--color-texto)]">Intervenções</h3>
            {podeRegistrar && (
              <Botao variante="secundario" tamanho="compacto" onClick={aoAbrirModal}>
                Registrar intervenção
              </Botao>
            )}
          </div>

          {confirmacaoVisivel && (
            <Aviso tom="informacao">Intervenção registrada.</Aviso>
          )}

          {todasIntervencoes.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-texto-suave)]">
              Nenhuma intervenção registrada.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {todasIntervencoes.map((intervencao) => (
                <li
                  key={intervencao.id}
                  className="rounded-[var(--radius-sistema)] border border-[var(--color-borda)] p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-[var(--color-texto)]">
                      {intervencao.profissional}
                    </span>
                    <Medida>{formatarDataEHora(intervencao.registradaEm)}</Medida>
                  </div>
                  <p className="mt-1 text-[var(--color-texto)]">{intervencao.conduta}</p>
                  <p className="mt-1 text-[var(--color-texto-suave)]">
                    Situação: {ROTULO_DA_SITUACAO_DO_SINTOMA[intervencao.situacaoDoSintoma]}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Bloco>
  );
}

function RegraDisparadaItem({ regra }: { regra: RegraDisparada }) {
  return (
    <li className="rounded-[var(--radius-sistema)] border border-[var(--color-borda)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SeloDeRisco situacao={regra.classificacao} />
        <span className="text-sm font-medium text-[var(--color-texto)]">
          {ROTULO_DO_SINTOMA[regra.sintoma] ?? regra.sintoma}
        </span>
        <span className="text-sm text-[var(--color-texto-suave)]">
          {nomeDoCampoLegivel(regra.campo)}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-[var(--color-texto-suave)]">
        Valor observado: <Medida>{formatarValorClinico(regra.valorObservado)}</Medida>
      </p>
      <p className="mt-1.5 text-sm text-[var(--color-texto)]">{regra.justificativa}</p>
    </li>
  );
}

function formatarRespostaClinica(resposta: RespostaRegistrada): string {
  return formatarValorClinico(resposta.valor, resposta.unidade);
}

/* ==========================================================================
   E3 — Modal de intervenção
   ========================================================================== */

function ModalDeIntervencao({
  aberto,
  aoFechar,
  aoConfirmar,
}: {
  aberto: boolean;
  aoFechar(): void;
  aoConfirmar(conduta: string, situacao: SituacaoDoSintoma): void;
}) {
  const [conduta, setConduta] = useState('');
  const [situacao, setSituacao] = useState<SituacaoDoSintoma | null>(null);

  /* Reinicia o formulário no próprio evento que fecha o modal — não em efeito,
     que dispararia setState síncrono a cada mudança de `aberto`. */
  function fecharEReiniciar() {
    setConduta('');
    setSituacao(null);
    aoFechar();
  }

  const podeConfirmar = conduta.trim().length > 0 && situacao !== null;

  return (
    <Modal
      aberto={aberto}
      titulo="Registrar intervenção"
      descricao="A conduta fica anexada a esta sessão, junto da classificação que a motivou."
      aoFechar={fecharEReiniciar}
      rodape={
        <>
          <Botao variante="secundario" onClick={fecharEReiniciar}>
            Cancelar
          </Botao>
          <Botao
            variante="principal"
            disabled={!podeConfirmar}
            onClick={() => {
              if (!situacao) return;
              aoConfirmar(conduta.trim(), situacao);
              setConduta('');
              setSituacao(null);
            }}
          >
            Salvar
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="conduta-da-intervencao"
            className="text-sm font-medium text-[var(--color-texto)]"
          >
            Conduta
          </label>
          <textarea
            id="conduta-da-intervencao"
            value={conduta}
            onChange={(evento) => setConduta(evento.target.value)}
            rows={4}
            placeholder="O que foi orientado ou feito"
            className="rounded-[var(--radius-sistema)] border border-[var(--color-borda-forte)] bg-[var(--color-superficie-alta)] px-3 py-2.5 text-base text-[var(--color-texto)] placeholder:text-[var(--color-texto-fraco)] transition-colors duration-150 focus:border-[var(--color-texto-suave)]"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-[var(--color-texto)]">
            Situação do sintoma
          </legend>
          <div className="flex flex-wrap gap-2">
            {OPCOES_DE_SITUACAO.map((opcao) => (
              <button
                key={opcao}
                type="button"
                aria-pressed={situacao === opcao}
                onClick={() => setSituacao(opcao)}
                className={juntar(
                  'rounded-[var(--radius-sistema)] border px-3 py-1.5 text-sm transition-colors duration-150',
                  situacao === opcao
                    ? 'border-[var(--color-superficie-invertida)] bg-[var(--color-superficie-invertida)] text-[var(--color-texto-invertido)]'
                    : 'border-[var(--color-borda-forte)] bg-[var(--color-superficie-alta)] text-[var(--color-texto)] hover:bg-[var(--color-superficie-baixa)]',
                )}
              >
                {ROTULO_DA_SITUACAO_DO_SINTOMA[opcao]}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
