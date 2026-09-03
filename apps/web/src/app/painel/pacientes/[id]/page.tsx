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
  LinkComoBotao,
  Medida,
  SeloDeNaoValidado,
  SeloDeRisco,
  Tabela,
  juntar,
} from '@/componentes/sistema/primitivos';
import { Modal } from '@/componentes/sistema/modal';
import {
  completudeDaHistoria,
  montarHistoriaDoPaciente,
  type DadosDaHistoria,
} from '@aurea/contratos';
import {
  ErroDaFonte,
  buscarHistoricoNoPainel,
  registrarIntervencao,
} from '@/sistema/fonte';
import {
  formatarData,
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
import { ROTULO_DO_DESFECHO } from '@/sistema/formato';

const ROTULO_DA_SITUACAO_DO_SINTOMA: Record<SituacaoDoSintoma, string> =
  ROTULO_DO_DESFECHO;

/* Exatamente o que `POST /painel/sessoes/:id/intervencoes` aceita. Oferecer opção que
   o servidor recusa é fazer o profissional descobrir isso no erro. A ordem é a da
   conversa real: primeiro o que resolveu, depois o que continua aberto, por último o
   encaminhamento — que é o desfecho mais grave e o menos frequente. */
const OPCOES_DE_SITUACAO: readonly SituacaoDoSintoma[] = [
  'RESOLVIDO',
  'EM_ACOMPANHAMENTO',
  'AGUARDANDO_RETORNO',
  'REAVALIAR',
  'ENCAMINHADO_AO_PA',
];

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
  if (valor === null) return 'não informado';
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
  /** Falha ao gravar a conduta. Precisa aparecer: registro clínico que não salvou não pode passar por salvo. */
  const [erroDoRegistro, setErroDoRegistro] = useState<string | null>(null);

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

  /**
   * Registra a conduta NO SERVIDOR, e só depois confirma na tela.
   *
   * Esta função se chamava `registrarIntervencao`, exatamente como a função de API
   * em `sistema/fonte.ts`. O nome igual é a razão de o defeito ter sobrevivido a
   * revisão: no ponto de uso, `registrarIntervencao(...)` lia como chamada à API e
   * era chamada ao estado local. A enfermagem registrava a conduta, via aparecer na
   * tela, e o registro morria no recarregar — sem chegar ao prontuário e sem o resto
   * do plantão nunca ver. Renomeada de propósito: nenhuma função local volta a
   * disputar nome com a camada de dados.
   *
   * A inserção é otimista porque o plantão não pode esperar ida e volta de rede para
   * seguir. Mas ela é DESFEITA se o servidor recusar, e o erro aparece na tela: em
   * registro clínico, mostrar "salvo" para algo que não salvou é pior do que travar.
   */
  async function registrarIntervencaoNaSessao(
    sessaoId: string,
    conduta: string,
    situacaoDoSintoma: SituacaoDoSintoma,
  ) {
    const idOtimista = `intervencao-local-${Date.now()}`;
    const nova: Intervencao = {
      id: idOtimista,
      registradaEm: new Date().toISOString(),
      profissional: usuario?.nome ?? 'Profissional do plantão',
      conduta,
      situacaoDoSintoma,
    };

    setErroDoRegistro(null);
    setIntervencoesLocais((atual) => ({
      ...atual,
      [sessaoId]: [nova, ...(atual[sessaoId] ?? [])],
    }));
    setSessaoNoModal(null);
    setSessaoConfirmada(sessaoId);

    try {
      await registrarIntervencao(sessaoId, conduta, situacaoDoSintoma);
    } catch (motivo: unknown) {
      /* Tira da tela o que não existe no banco. */
      setIntervencoesLocais((atual) => ({
        ...atual,
        [sessaoId]: (atual[sessaoId] ?? []).filter((item) => item.id !== idOtimista),
      }));
      setSessaoConfirmada(null);
      setErroDoRegistro(
        motivo instanceof ErroDaFonte
          ? motivo.message
          : 'A conduta não foi salva. Registre de novo antes de sair da tela.',
      );
    }
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

      {/* O registro operacional fica a um clique do prontuário: quem descobre a
          barreira está aqui, olhando o histórico, não numa tela de administração. */}
      <div className="mb-4 flex justify-end">
        <LinkComoBotao
          href={`/painel/pacientes/${historico.paciente.id}/registro`}
          variante="secundario"
        >
          Registro operacional
        </LinkComoBotao>
      </div>

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
          valor={historico.paciente.diaDoCiclo ?? 'não informado'}
          apoio={
            historico.paciente.numeroDoCiclo != null
              ? `ciclo ${historico.paciente.numeroDoCiclo}`
              : 'sem tratamento ativo'
          }
        />
        <CartaoDeIndicador rotulo="Sessões registradas" valor={sessoesOrdenadas.length} />
        <CartaoDeIndicador
          rotulo="Intervenções"
          valor={sessoesOrdenadas.reduce((total, s) => total + s.intervencoes.length, 0)}
        />
      </LinhaDeIndicadores>

      <BreveHistoria historico={historico} />

      {/* Cadastro e receitas antes do histórico de sessões.
          A ordem responde ao que a enfermagem faz de verdade: ela abre esta tela com o
          telefone na mão. Quem é, quem cuida, o que a pessoa toma — e só então o que
          ela relatou nos últimos dias. Histórico primeiro obrigaria a rolar a tela
          inteira para achar um número de telefone. */}
      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <Bloco titulo="Cadastro" descricao="Dados de identificação e de contato.">
          <dl className="flex flex-col gap-3 text-sm">
            <LinhaDeDado rotulo="Diagnóstico" valor={historico.paciente.diagnostico} />
            <LinhaDeDado
              rotulo="Nascimento"
              valor={
                historico.paciente.dataNascimento
                  ? formatarData(historico.paciente.dataNascimento)
                  : null
              }
            />
            <LinhaDeDado rotulo="Convênio" valor={historico.paciente.convenio ?? null} />
            <LinhaDeDado
              rotulo="Médico assistente"
              valor={historico.paciente.medicoAssistente ?? null}
            />
            <LinhaDeDado rotulo="Protocolo" valor={historico.paciente.protocolo} />
          </dl>

          {/* Alergias. A API já mandava este dado e a tela o descartava — a mesma
              classe de defeito das tarefas 065 e 067, mas nesta o custo é maior:
              alergia que ninguém lê é alergia que ninguém respeita na hora de
              orientar medicação por telefone. */}
          <div className="mt-5 border-t border-[var(--color-borda)] pt-4">
            <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-texto-fraco)]">
              Alergias
            </p>
            {(historico.paciente.alergias ?? []).length === 0 ? (
              <p className="text-sm text-[var(--color-texto-fraco)]">
                Nenhuma alergia registrada. Ausência de registro não é ausência de
                alergia.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(historico.paciente.alergias ?? []).map((alergia) => (
                  <li
                    key={alergia.descricao}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="text-[var(--color-texto)]">{alergia.descricao}</span>
                    {/* Confirmada ou não dito por palavra, nunca por cor: a cor desta
                        tela pertence à escala de risco. */}
                    <span className="text-xs text-[var(--color-texto-fraco)]">
                      {alergia.confirmadaEm
                        ? 'confirmada pela equipe'
                        : alergia.origem === 'PACIENTE'
                          ? 'relatada pelo paciente'
                          : 'não confirmada'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 border-t border-[var(--color-borda)] pt-4">
            <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-texto-fraco)]">
              Quem cuida em casa
            </p>
            {(historico.paciente.contatos ?? []).length === 0 ? (
              <p className="text-sm text-[var(--color-texto-fraco)]">
                Nenhum contato cadastrado.
              </p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {(historico.paciente.contatos ?? []).map((contato) => (
                  <li
                    key={`${contato.nome}-${contato.telefone}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="text-[var(--color-texto)]">
                      {contato.nome}
                      <span className="ml-1.5 text-xs text-[var(--color-texto-fraco)]">
                        {contato.relacao ?? 'relação não informada'}
                        {contato.deEmergencia ? ' · emergência' : ''}
                      </span>
                    </span>
                    <a
                      href={`tel:${contato.telefone}`}
                      className="font-mono text-sm tabular-nums text-[var(--color-texto)] underline-offset-2 hover:underline"
                    >
                      {contato.telefone}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Bloco>

        <Bloco
          titulo="Receitas"
          descricao="Em vigor primeiro. O que a pessoa tomava fica visível como contexto, marcado como encerrado."
        >
          {(historico.prescricoes ?? []).length === 0 ? (
            <p className="text-sm text-[var(--color-texto-fraco)]">
              Nenhuma prescrição registrada para este paciente.
            </p>
          ) : (
            <ul className="flex flex-col gap-3.5">
              {(historico.prescricoes ?? []).map((prescricao) => (
                <li
                  key={prescricao.id}
                  className="border-b border-[var(--color-borda)] pb-3.5 last:border-b-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--color-texto)]">
                      {prescricao.medicamento}
                    </span>
                    {/* Encerrada é dito por palavra, não por cor esmaecida: receita
                        antiga lida como atual é erro de medicação. */}
                    {!prescricao.emVigor && (
                      <span className="rounded-[var(--radius-pilula)] bg-[var(--color-superficie-baixa)] px-2 py-0.5 text-xs text-[var(--color-texto-suave)]">
                        encerrada em {formatarData(prescricao.encerradaEm ?? '')}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-texto-suave)]">
                    {prescricao.posologia}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-texto-fraco)]">
                    desde {formatarData(prescricao.iniciadaEm)}
                    {prescricao.prescritaPor ? ` · ${prescricao.prescritaPor}` : ''}
                    {prescricao.principioAtivo ? ` · ${prescricao.principioAtivo}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>

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

      {erroDoRegistro && (
        <div className="mt-4">
          <Aviso tom="grave" titulo="A conduta não foi registrada">
            {erroDoRegistro}
          </Aviso>
        </div>
      )}

      <ModalDeIntervencao
        aberto={sessaoNoModal !== null}
        aoFechar={() => setSessaoNoModal(null)}
        aoConfirmar={(conduta, situacao) => {
          if (sessaoNoModal) void registrarIntervencaoNaSessao(sessaoNoModal, conduta, situacao);
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

/** Uma linha de `rótulo: valor` do cartão de cadastro. Vazio vira travessão, nunca some. */
/**
 * A breve história — quem é a pessoa, antes do que ela respondeu ontem.
 *
 * O texto NÃO é escrito aqui: vem de `montarHistoriaDoPaciente`, função pura em
 * `@aurea/contratos`, que só monta frase a partir de campo cadastrado. Esta camada
 * decide layout e mais nada, e é de propósito: no dia em que existir exportação de
 * prontuário, o servidor produz o mesmo texto sem passar por React.
 *
 * A barra de completude existe porque duas linhas de história podem ser lidas como
 * "esta pessoa não tem nada relevante", quando o que houve foi cadastro pela metade.
 * Dizer quanto falta é a diferença entre um retrato e uma lacuna disfarçada.
 */
function BreveHistoria({ historico }: { historico: HistoricoDoPaciente }) {
  const p = historico.paciente;

  const dados: DadosDaHistoria = {
    nome: p.nome,
    sexo: p.sexo ?? null,
    dataNascimento: p.dataNascimento ?? null,
    diagnostico: p.diagnostico,
    protocolo: p.protocolo,
    numeroDoCiclo: p.numeroDoCiclo ?? null,
    diaDoCiclo: p.diaDoCiclo,
    /* Só o que a pessoa TOMA hoje. Receita encerrada é contexto e vive no bloco de
       receitas; misturá-la aqui faria a história afirmar um uso que acabou. */
    medicamentosEmUso: (historico.prescricoes ?? [])
      .filter((prescricao) => prescricao.emVigor)
      .map((prescricao) => ({
        nome: prescricao.medicamento,
        posologia: prescricao.posologia,
      })),
    alergias: (p.alergias ?? []).map((a) => ({
      descricao: a.descricao,
      confirmada: a.confirmadaEm != null,
    })),
    comorbidades: (p.comorbidades ?? []).map((c) => ({
      descricao: c.descricao,
      confirmada: c.confirmadaEm != null,
    })),
    tabagismo: p.tabagismo ?? null,
    parouDeFumarEm: p.parouDeFumarEm ?? null,
    atividadeFisica: p.atividadeFisica ?? null,
    descricaoDaAtividade: p.descricaoDaAtividade ?? null,
    consumoDeAlcool: p.consumoDeAlcool ?? null,
    habitoIntestinalBasal: p.habitoIntestinalBasal ?? null,
  };

  const trechos = montarHistoriaDoPaciente(dados);
  const completude = completudeDaHistoria(dados);
  const percentual = Math.round(completude * 100);

  return (
    <div className="mb-6">
      <Bloco
        titulo="Quem é esta pessoa"
        descricao="Montado do cadastro. Nada aqui é inferido: campo em branco vira silêncio, não suposição."
      >
        <div className="flex flex-col gap-2.5">
          {trechos.map((trecho) => (
            <p
              key={trecho.assunto}
              className={juntar(
                'text-[0.9375rem] leading-relaxed',
                trecho.destacar
                  ? 'font-medium text-[var(--color-texto)]'
                  : 'text-[var(--color-texto-suave)]',
              )}
            >
              {trecho.texto}
            </p>
          ))}
        </div>

        {percentual < 100 && (
          <p className="mt-4 border-t border-[var(--color-borda)] pt-3 text-xs text-[var(--color-texto-fraco)]">
            Cadastro {percentual}% preenchido. O que falta não aparece acima porque
            ainda não foi perguntado, e não porque a resposta seja negativa.
          </p>
        )}
      </Bloco>
    </div>
  );
}

function LinhaDeDado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-[var(--color-texto-suave)]">{rotulo}</dt>
      <dd className="text-right text-[var(--color-texto)]">
        {valor && valor.length > 0 ? (
          valor
        ) : (
          <span className="text-[var(--color-texto-fraco)]">não informado</span>
        )}
      </dd>
    </div>
  );
}
