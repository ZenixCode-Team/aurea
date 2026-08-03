'use client';

/**
 * A2 + A5 — Detalhe de um conjunto de limiares, publicação e validação clínica.
 *
 * Cada regra aparece com a justificativa por extenso: número de corte sem
 * justificativa é indefensável em auditoria clínica. Publicar é irreversível
 * na prática — conjunto publicado nunca é editado, publica-se outro — por isso
 * a confirmação é explícita sobre o que vai acontecer.
 *
 * Composição refeita conforme o ADR-004, no padrão lista-e-detalhe do exemplo
 * canônico (`/painel`): a lista à esquerda navega por sintoma — não por regra
 * individual — porque cada seleção revela a tabela COMPLETA das regras daquele
 * sintoma, com toda justificativa clínica visível de uma vez. Nada fica atrás
 * de tooltip, acordeão ou "ver mais": a navegação troca qual sintoma está em
 * foco, nunca esconde uma regra que já está em foco.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Bloco, CabecalhoDePainel, CartaoDeIndicador, LinhaDeIndicadores } from '@/componentes/sistema/painel';
import { Modal } from '@/componentes/sistema/modal';
import {
  Aviso,
  Botao,
  CabecalhoDaTabela,
  Carregando,
  Celula,
  LinhaDaTabela,
  SeloDeNaoValidado,
  SeloDeRisco,
  Tabela,
  juntar,
} from '@/componentes/sistema/primitivos';
import { ErroDaFonte, buscarConjuntos, buscarRegrasDoConjunto } from '@/sistema/fonte';
import { ROTULO_DO_OPERADOR, ROTULO_DO_SINTOMA, formatarDataEHora, formatarMedida } from '@/sistema/formato';
import type { Classificacao, ConjuntoResumido, EstadoDoConjunto, RegraResumida, Sintoma } from '@/sistema/tipos';

type Carregamento =
  | { situacao: 'CARREGANDO' }
  | { situacao: 'ERRO'; mensagem: string }
  | { situacao: 'PRONTO'; conjunto: ConjuntoResumido; regras: readonly RegraResumida[] };

/** Ordem de gravidade — só usada para destacar, na lista de sintomas, qual
 *  grupo tem a regra mais severa. É classificação clínica, não decoração:
 *  a mesma cor que aparece no `SeloDeRisco` de cada regra. */
const ORDEM_DA_CLASSIFICACAO: Record<Classificacao, number> = {
  VERMELHO: 0,
  AMARELO: 1,
  VERDE: 2,
};

const COR_DA_CLASSIFICACAO: Record<Classificacao, string> = {
  VERMELHO: 'var(--color-risco-vermelho)',
  AMARELO: 'var(--color-risco-amarelo)',
  VERDE: 'var(--color-risco-verde)',
};

function formatarValorDaRegra(valor: number | null): string {
  if (valor === null) return 'sem valor';
  const casas = Number.isInteger(valor) ? 0 : 1;
  return formatarMedida(valor, casas);
}

function agruparPorSintoma(
  regras: readonly RegraResumida[],
): readonly { sintoma: Sintoma; regras: readonly RegraResumida[] }[] {
  const grupos = new Map<Sintoma, RegraResumida[]>();
  for (const regra of regras) {
    const grupo = grupos.get(regra.sintoma);
    if (grupo) grupo.push(regra);
    else grupos.set(regra.sintoma, [regra]);
  }
  return Array.from(grupos.entries()).map(([sintoma, regrasDoSintoma]) => ({
    sintoma,
    regras: regrasDoSintoma,
  }));
}

function piorClassificacao(regras: readonly RegraResumida[]): Classificacao {
  return regras.reduce<Classificacao>(
    (pior, regra) =>
      ORDEM_DA_CLASSIFICACAO[regra.classificacao] < ORDEM_DA_CLASSIFICACAO[pior]
        ? regra.classificacao
        : pior,
    'VERDE',
  );
}

const ROTULO_DO_ESTADO: Record<EstadoDoConjunto, string> = {
  PUBLICADO: 'Publicado',
  RASCUNHO: 'Rascunho',
  ARQUIVADO: 'Arquivado',
};

export default function PaginaDeDetalheDoConjunto() {
  const parametros = useParams<{ id: string }>();
  const id = parametros.id;

  const [estado, setEstado] = useState<Carregamento>({ situacao: 'CARREGANDO' });
  const [sintomaSelecionado, setSintomaSelecionado] = useState<Sintoma | null>(null);
  const [modalDePublicacaoAberto, setModalDePublicacaoAberto] = useState(false);
  const [modalDeValidacaoAberto, setModalDeValidacaoAberto] = useState(false);
  const [acabouDePublicar, setAcabouDePublicar] = useState(false);
  const [acabouDeValidar, setAcabouDeValidar] = useState(false);

  useEffect(() => {
    Promise.all([buscarConjuntos(), buscarRegrasDoConjunto(id)])
      .then(([conjuntos, regras]) => {
        const conjunto = conjuntos.find((c) => c.id === id);
        if (!conjunto) {
          setEstado({ situacao: 'ERRO', mensagem: 'Conjunto não encontrado.' });
          return;
        }
        setEstado({ situacao: 'PRONTO', conjunto, regras });
      })
      .catch((erro: unknown) => {
        const mensagem =
          erro instanceof ErroDaFonte ? erro.message : 'Não foi possível carregar o conjunto.';
        setEstado({ situacao: 'ERRO', mensagem });
      });
  }, [id]);

  const grupos = useMemo(
    () => (estado.situacao === 'PRONTO' ? agruparPorSintoma(estado.regras) : []),
    [estado],
  );

  const grupoEmFoco = useMemo(
    () => grupos.find((grupo) => grupo.sintoma === sintomaSelecionado) ?? grupos[0] ?? null,
    [grupos, sintomaSelecionado],
  );

  function confirmarPublicacao() {
    if (estado.situacao !== 'PRONTO') return;
    setEstado({
      situacao: 'PRONTO',
      conjunto: { ...estado.conjunto, estado: 'PUBLICADO', publicadoEm: new Date().toISOString() },
      regras: estado.regras,
    });
    setModalDePublicacaoAberto(false);
    setAcabouDePublicar(true);
  }

  function confirmarValidacao() {
    if (estado.situacao !== 'PRONTO') return;
    setEstado({
      situacao: 'PRONTO',
      conjunto: { ...estado.conjunto, validadoClinicamente: true },
      regras: estado.regras,
    });
    setModalDeValidacaoAberto(false);
    setAcabouDeValidar(true);
  }

  return (
    <>
      {estado.situacao === 'CARREGANDO' && (
        <>
          <CabecalhoDePainel
            trilha={[
              { rotulo: 'Administração' },
              { rotulo: 'Conjuntos de limiares', href: '/admin/limiares' },
              { rotulo: '…' },
            ]}
            titulo="Carregando conjunto…"
          />
          <Carregando linhas={6} />
        </>
      )}

      {estado.situacao === 'ERRO' && (
        <>
          <p className="mb-4">
            <Link
              href="/admin/limiares"
              className="text-sm text-[var(--color-texto-suave)] underline decoration-[var(--color-borda-forte)] underline-offset-2 hover:text-[var(--color-texto)]"
            >
              ← Conjuntos de limiares
            </Link>
          </p>
          <Aviso tom="grave" titulo="Não foi possível carregar o conjunto">
            {estado.mensagem}
          </Aviso>
        </>
      )}

      {estado.situacao === 'PRONTO' && (
        <>
          <CabecalhoDePainel
            trilha={[
              { rotulo: 'Administração' },
              { rotulo: 'Conjuntos de limiares', href: '/admin/limiares' },
              { rotulo: estado.conjunto.versao },
            ]}
            titulo={`Conjunto ${estado.conjunto.versao}`}
            descricao={estado.conjunto.descricao}
            acao={
              <div className="flex gap-2">
                <Botao
                  variante="secundario"
                  disabled={estado.conjunto.validadoClinicamente}
                  onClick={() => setModalDeValidacaoAberto(true)}
                >
                  Marcar como validado clinicamente
                </Botao>
                <Botao
                  variante="principal"
                  disabled={estado.conjunto.estado !== 'RASCUNHO'}
                  onClick={() => setModalDePublicacaoAberto(true)}
                >
                  Publicar
                </Botao>
              </div>
            }
          />

          {/* Sem exceção: todo conjunto ainda não assinado por alguém com
              responsabilidade clínica mostra esta marca, publicado ou não. */}
          {!estado.conjunto.validadoClinicamente && (
            <div className="mb-6">
              <SeloDeNaoValidado />
            </div>
          )}

          {acabouDePublicar && (
            <div className="mb-6">
              <Aviso tom="atencao" titulo="Conjunto publicado">
                Este conjunto passou a classificar pacientes reais a partir de agora. Ele não será
                editado; qualquer ajuste futuro nasce em um conjunto novo.
              </Aviso>
            </div>
          )}

          {acabouDeValidar && (
            <div className="mb-6">
              <Aviso tom="informacao" titulo="Validação clínica registrada">
                O conjunto está marcado como validado clinicamente.
              </Aviso>
            </div>
          )}

          <LinhaDeIndicadores>
            <CartaoDeIndicador
              rotulo="Estado"
              valor={ROTULO_DO_ESTADO[estado.conjunto.estado]}
              tom="neutro"
            />
            <CartaoDeIndicador rotulo="Origem" valor={estado.conjunto.origem} tom="neutro" />
            <CartaoDeIndicador
              rotulo="Criado em"
              valor={formatarDataEHora(estado.conjunto.criadoEm)}
              tom="neutro"
            />
            <CartaoDeIndicador
              rotulo="Publicado em"
              valor={
                estado.conjunto.publicadoEm ? formatarDataEHora(estado.conjunto.publicadoEm) : 'não publicado'
              }
              tom="neutro"
            />
          </LinhaDeIndicadores>

          <div className="mb-6">
            <Aviso tom="informacao" titulo="Política de classificação não exposta aqui">
              A política de combinação de sintomas, efeito do antitérmico e tratamento de
              abandono é definida na criação do conjunto, mas a listagem de conjuntos
              (`buscarConjuntos`) ainda não devolve esse campo, pendente da Onda F.
            </Aviso>
          </div>

          {grupos.length === 0 && (
            <Aviso tom="informacao">Este conjunto não tem nenhuma regra cadastrada.</Aviso>
          )}

          {grupos.length > 0 && grupoEmFoco && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
              {/* Lista: um sintoma por linha, não uma regra por linha — a regra
                  nunca fica escondida atrás da seleção, só o AGRUPAMENTO muda
                  de foco, do mesmo jeito que o /painel troca de paciente. */}
              <Bloco titulo="Sintomas" descricao={`${estado.regras.length} regra(s) no total`} semPadding>
                <ul>
                  {grupos.map(({ sintoma, regras }) => {
                    const ativo = grupoEmFoco.sintoma === sintoma;
                    const pior = piorClassificacao(regras);
                    return (
                      <li key={sintoma}>
                        <button
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => setSintomaSelecionado(sintoma)}
                          className={juntar(
                            'flex w-full items-center gap-3 border-b border-[var(--color-borda)] px-4 py-2.5 text-left',
                            'transition-colors duration-100 last:border-b-0',
                            ativo
                              ? 'bg-[var(--color-superficie-baixa)]'
                              : 'hover:bg-[var(--color-superficie-baixa)]',
                          )}
                        >
                          <span
                            aria-hidden
                            className="h-8 w-[3px] shrink-0 rounded-[var(--radius-pilula)]"
                            style={{ backgroundColor: COR_DA_CLASSIFICACAO[pior] }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[var(--color-texto)]">
                              {ROTULO_DO_SINTOMA[sintoma] ?? sintoma}
                            </span>
                            <span className="block text-xs text-[var(--color-texto-fraco)]">
                              {regras.length === 1 ? '1 regra' : `${regras.length} regras`}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Bloco>

              {/* Detalhe: TODAS as regras do sintoma em foco, cada uma com a
                  justificativa clínica por extenso — é o que defende o corte
                  em auditoria, então não entra em coluna truncada. */}
              <Bloco
                titulo={ROTULO_DO_SINTOMA[grupoEmFoco.sintoma] ?? grupoEmFoco.sintoma}
                descricao="Regras deste sintoma neste conjunto, com a justificativa clínica de cada corte."
                semPadding
              >
                <Tabela rotulo={`Regras de ${ROTULO_DO_SINTOMA[grupoEmFoco.sintoma] ?? grupoEmFoco.sintoma}`}>
                  <CabecalhoDaTabela
                    colunas={['Campo', 'Operador', 'Valor', 'Classificação', 'Justificativa clínica']}
                  />
                  <tbody>
                    {grupoEmFoco.regras.map((regra) => (
                      <LinhaDaTabela key={regra.id}>
                        <Celula mono>{regra.campo}</Celula>
                        <Celula>{ROTULO_DO_OPERADOR[regra.operador] ?? regra.operador}</Celula>
                        <Celula mono>{formatarValorDaRegra(regra.valor)}</Celula>
                        <Celula>
                          <SeloDeRisco situacao={regra.classificacao} />
                        </Celula>
                        <Celula>{regra.justificativa}</Celula>
                      </LinhaDaTabela>
                    ))}
                  </tbody>
                </Tabela>
              </Bloco>
            </div>
          )}

          <Modal
            aberto={modalDePublicacaoAberto}
            titulo="Publicar este conjunto?"
            descricao="Esta ação tem efeito clínico imediato."
            aoFechar={() => setModalDePublicacaoAberto(false)}
            rodape={
              <>
                <Botao variante="secundario" onClick={() => setModalDePublicacaoAberto(false)}>
                  Cancelar
                </Botao>
                <Botao variante="principal" onClick={confirmarPublicacao}>
                  Publicar conjunto
                </Botao>
              </>
            }
          >
            <p className="text-sm text-[var(--color-texto)]">
              A partir da publicação, este conjunto passa a classificar pacientes reais no
              check-in diário; substitui o conjunto publicado hoje.
            </p>
            <p className="mt-3 text-sm text-[var(--color-texto)]">
              Conjunto publicado nunca é editado depois. Se um corte precisar mudar mais tarde,
              a correção nasce em um conjunto novo, não numa edição deste.
            </p>
          </Modal>

          <Modal
            aberto={modalDeValidacaoAberto}
            titulo="Marcar como validado clinicamente?"
            aoFechar={() => setModalDeValidacaoAberto(false)}
            rodape={
              <>
                <Botao variante="secundario" onClick={() => setModalDeValidacaoAberto(false)}>
                  Cancelar
                </Botao>
                <Botao variante="principal" onClick={confirmarValidacao}>
                  Confirmar validação
                </Botao>
              </>
            }
          >
            <p className="text-sm text-[var(--color-texto)]">
              Esta marca declara que uma pessoa com responsabilidade clínica revisou e assinou
              os cortes deste conjunto. Enquanto ausente, todo resultado gerado por ele carrega
              o selo de não validado, inclusive se já estiver publicado.
            </p>
          </Modal>
        </>
      )}
    </>
  );
}
