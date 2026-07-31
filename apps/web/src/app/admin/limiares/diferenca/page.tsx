'use client';

/**
 * A4 — Diferença entre duas versões de conjunto de limiares.
 *
 * A troca de estado fica na URL (`?de=...&para=...`) de propósito: quem está
 * revisando uma publicação precisa poder mandar o link exato para outra pessoa
 * conferir o mesmo comparativo.
 *
 * Os dados sintéticos devolvem a mesma lista de regras para qualquer conjunto —
 * por isso a diferença é calculada de verdade no cliente, comparando por `id` e
 * por valor. Quando a Onda F ligar a API, o mesmo cálculo passa a mostrar
 * diferenças reais sem precisar mudar esta tela.
 *
 * Composição refeita conforme o ADR-004: cabeçalho com contexto, seletores das
 * duas versões dentro de um bloco próprio, indicadores do tamanho da diferença
 * e cada categoria (incluídas/removidas/alteradas) como bloco identificado —
 * nenhuma justificativa fica truncada ou atrás de "ver mais".
 */

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Bloco, CabecalhoDePainel, CartaoDeIndicador, LinhaDeIndicadores } from '@/componentes/sistema/painel';
import {
  Aviso,
  CabecalhoDaTabela,
  Carregando,
  Celula,
  EstadoVazio,
  LinhaDaTabela,
  SeloDeNaoValidado,
  SeloDeRisco,
  Tabela,
  juntar,
} from '@/componentes/sistema/primitivos';
import { ErroDaFonte, buscarConjuntos, buscarRegrasDoConjunto } from '@/sistema/fonte';
import { ROTULO_DO_OPERADOR, ROTULO_DO_SINTOMA, formatarMedida } from '@/sistema/formato';
import type { ConjuntoResumido, DiferencaEntreConjuntos, RegraResumida } from '@/sistema/tipos';

function formatarValor(valor: number | null): string {
  if (valor === null) return '—';
  const casas = Number.isInteger(valor) ? 0 : 1;
  return formatarMedida(valor, casas);
}

function regrasIguais(a: RegraResumida, b: RegraResumida): boolean {
  return (
    a.sintoma === b.sintoma &&
    a.campo === b.campo &&
    a.operador === b.operador &&
    a.valor === b.valor &&
    a.classificacao === b.classificacao &&
    a.justificativa === b.justificativa
  );
}

function calcularDiferenca(
  de: string,
  para: string,
  regrasDe: readonly RegraResumida[],
  regrasPara: readonly RegraResumida[],
): DiferencaEntreConjuntos {
  const mapaDe = new Map(regrasDe.map((regra) => [regra.id, regra]));
  const mapaPara = new Map(regrasPara.map((regra) => [regra.id, regra]));

  const incluidas = regrasPara.filter((regra) => !mapaDe.has(regra.id));
  const removidas = regrasDe.filter((regra) => !mapaPara.has(regra.id));
  const alteradas: { antes: RegraResumida; depois: RegraResumida }[] = [];

  for (const regraDe of regrasDe) {
    const regraPara = mapaPara.get(regraDe.id);
    if (regraPara && !regrasIguais(regraDe, regraPara)) {
      alteradas.push({ antes: regraDe, depois: regraPara });
    }
  }

  return { de, para, incluidas, removidas, alteradas };
}

export default function PaginaDeDiferenca() {
  return (
    <Suspense fallback={<Carregando linhas={6} />}>
      <ConteudoDaDiferenca />
    </Suspense>
  );
}

function ConteudoDaDiferenca() {
  const parametros = useSearchParams();
  const router = useRouter();
  const caminho = usePathname();

  const deInicial = parametros.get('de') ?? '';
  const paraInicial = parametros.get('para') ?? '';

  const [conjuntos, setConjuntos] = useState<readonly ConjuntoResumido[] | null>(null);
  const [erroDosConjuntos, setErroDosConjuntos] = useState<string | null>(null);

  const [de, setDe] = useState(deInicial);
  const [para, setPara] = useState(paraInicial);

  /** Guarda o par de ids junto do resultado — evita mostrar regras de uma
   *  seleção anterior enquanto a nova ainda carrega, sem precisar "limpar"
   *  estado de forma síncrona dentro do efeito. */
  const [resultado, setResultado] = useState<{
    deId: string;
    paraId: string;
    regrasDe: readonly RegraResumida[];
    regrasPara: readonly RegraResumida[];
  } | null>(null);
  const [erroDasRegras, setErroDasRegras] = useState<string | null>(null);

  useEffect(() => {
    buscarConjuntos()
      .then(setConjuntos)
      .catch((erro: unknown) => {
        setErroDosConjuntos(
          erro instanceof ErroDaFonte ? erro.message : 'Não foi possível carregar os conjuntos.',
        );
      });
  }, []);

  useEffect(() => {
    if (!de || !para) return;
    let cancelado = false;
    Promise.all([buscarRegrasDoConjunto(de), buscarRegrasDoConjunto(para)])
      .then(([regrasDoDe, regrasDoPara]) => {
        if (cancelado) return;
        setResultado({ deId: de, paraId: para, regrasDe: regrasDoDe, regrasPara: regrasDoPara });
        setErroDasRegras(null);
      })
      .catch((erro: unknown) => {
        if (cancelado) return;
        setErroDasRegras(
          erro instanceof ErroDaFonte ? erro.message : 'Não foi possível carregar as regras.',
        );
      });
    return () => {
      cancelado = true;
    };
  }, [de, para]);

  const resultadoValeParaSelecaoAtual =
    resultado !== null && resultado.deId === de && resultado.paraId === para;

  const carregandoRegras =
    Boolean(de) && Boolean(para) && !resultadoValeParaSelecaoAtual && !erroDasRegras;

  const diferenca = useMemo(() => {
    if (!resultadoValeParaSelecaoAtual || !resultado) return null;
    return calcularDiferenca(de, para, resultado.regrasDe, resultado.regrasPara);
  }, [resultadoValeParaSelecaoAtual, resultado, de, para]);

  function atualizarQuery(novoDe: string, novoPara: string) {
    const busca = new URLSearchParams();
    if (novoDe) busca.set('de', novoDe);
    if (novoPara) busca.set('para', novoPara);
    router.replace(busca.size > 0 ? `${caminho}?${busca.toString()}` : caminho);
  }

  function selecionarDe(valor: string) {
    setDe(valor);
    atualizarQuery(valor, para);
  }

  function selecionarPara(valor: string) {
    setPara(valor);
    atualizarQuery(de, valor);
  }

  const totalDeDiferencas = diferenca
    ? diferenca.incluidas.length + diferenca.removidas.length + diferenca.alteradas.length
    : 0;

  const conjuntoDe = conjuntos?.find((conjunto) => conjunto.id === de) ?? null;
  const conjuntoPara = conjuntos?.find((conjunto) => conjunto.id === para) ?? null;

  return (
    <>
      <CabecalhoDePainel
        trilha={[
          { rotulo: 'Administração' },
          { rotulo: 'Conjuntos de limiares', href: '/admin/limiares' },
          { rotulo: 'Comparar versões' },
        ]}
        titulo="Comparar versões"
        descricao="Compara as regras de dois conjuntos de limiares — incluídas, removidas e alteradas."
      />

      {erroDosConjuntos && (
        <div className="mb-4">
          <Aviso tom="grave" titulo="Não foi possível carregar os conjuntos">
            {erroDosConjuntos}
          </Aviso>
        </div>
      )}

      <Bloco titulo="Versões a comparar" descricao="Escolha a versão de origem e a de destino.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <SeletorDeConjunto
              rotulo="De (versão anterior)"
              valor={de}
              conjuntos={conjuntos}
              aoMudar={selecionarDe}
            />
            {/* Sem exceção: se o conjunto de origem não foi validado
                clinicamente, quem compara precisa saber disso antes de ler a
                diferença. */}
            {conjuntoDe && !conjuntoDe.validadoClinicamente && <SeloDeNaoValidado />}
          </div>
          <div className="flex flex-col gap-2">
            <SeletorDeConjunto
              rotulo="Para (versão nova)"
              valor={para}
              conjuntos={conjuntos}
              aoMudar={selecionarPara}
            />
            {conjuntoPara && !conjuntoPara.validadoClinicamente && <SeloDeNaoValidado />}
          </div>
        </div>
      </Bloco>

      <div className="mt-6">
        {(!de || !para) && (
          <EstadoVazio
            titulo="Selecione as duas versões para comparar"
            descricao="Escolha um conjunto de origem e um conjunto de destino acima."
          />
        )}

        {carregandoRegras && <Carregando linhas={5} />}

        {erroDasRegras && (
          <Aviso tom="grave" titulo="Não foi possível comparar">
            {erroDasRegras}
          </Aviso>
        )}

        {diferenca && totalDeDiferencas === 0 && (
          <EstadoVazio
            titulo="Nenhuma diferença entre as duas versões selecionadas"
            descricao="As regras dos dois conjuntos são idênticas — mesmo sintoma, campo, operador, valor, classificação e justificativa."
          />
        )}

        {diferenca && totalDeDiferencas > 0 && (
          <>
            <LinhaDeIndicadores>
              <CartaoDeIndicador rotulo="Diferenças" valor={totalDeDiferencas} tom="neutro" />
              <CartaoDeIndicador rotulo="Incluídas" valor={diferenca.incluidas.length} tom="neutro" />
              <CartaoDeIndicador rotulo="Removidas" valor={diferenca.removidas.length} tom="neutro" />
              <CartaoDeIndicador rotulo="Alteradas" valor={diferenca.alteradas.length} tom="neutro" />
            </LinhaDeIndicadores>

            <div className="flex flex-col gap-4">
              {diferenca.incluidas.length > 0 && (
                <Bloco titulo={`Incluídas (${diferenca.incluidas.length})`} semPadding>
                  <Tabela rotulo="Regras incluídas">
                    <CabecalhoDaTabela
                      colunas={['Sintoma', 'Campo', 'Operador', 'Valor', 'Classificação', 'Justificativa']}
                    />
                    <tbody>
                      {diferenca.incluidas.map((regra) => (
                        <LinhaDaTabela key={regra.id}>
                          <Celula>{ROTULO_DO_SINTOMA[regra.sintoma] ?? regra.sintoma}</Celula>
                          <Celula mono>{regra.campo}</Celula>
                          <Celula>{ROTULO_DO_OPERADOR[regra.operador] ?? regra.operador}</Celula>
                          <Celula mono>{formatarValor(regra.valor)}</Celula>
                          <Celula>
                            <SeloDeRisco situacao={regra.classificacao} />
                          </Celula>
                          <Celula className="max-w-sm">{regra.justificativa}</Celula>
                        </LinhaDaTabela>
                      ))}
                    </tbody>
                  </Tabela>
                </Bloco>
              )}

              {diferenca.removidas.length > 0 && (
                <Bloco titulo={`Removidas (${diferenca.removidas.length})`} semPadding>
                  <Tabela rotulo="Regras removidas">
                    <CabecalhoDaTabela
                      colunas={['Sintoma', 'Campo', 'Operador', 'Valor', 'Classificação', 'Justificativa']}
                    />
                    <tbody>
                      {diferenca.removidas.map((regra) => (
                        <LinhaDaTabela key={regra.id}>
                          <Celula>{ROTULO_DO_SINTOMA[regra.sintoma] ?? regra.sintoma}</Celula>
                          <Celula mono>{regra.campo}</Celula>
                          <Celula>{ROTULO_DO_OPERADOR[regra.operador] ?? regra.operador}</Celula>
                          <Celula mono>{formatarValor(regra.valor)}</Celula>
                          <Celula>
                            <SeloDeRisco situacao={regra.classificacao} />
                          </Celula>
                          <Celula className="max-w-sm">{regra.justificativa}</Celula>
                        </LinhaDaTabela>
                      ))}
                    </tbody>
                  </Tabela>
                </Bloco>
              )}

              {diferenca.alteradas.length > 0 && (
                <Bloco titulo={`Alteradas (${diferenca.alteradas.length})`} semPadding>
                  <Tabela rotulo="Regras alteradas">
                    <CabecalhoDaTabela colunas={['Sintoma', 'Campo', 'Antes', 'Depois']} />
                    <tbody>
                      {diferenca.alteradas.map(({ antes, depois }) => (
                        <LinhaDaTabela key={antes.id}>
                          <Celula>{ROTULO_DO_SINTOMA[antes.sintoma] ?? antes.sintoma}</Celula>
                          <Celula mono>{antes.campo}</Celula>
                          <Celula>
                            <div className="flex flex-col gap-1 text-sm">
                              <span>
                                {ROTULO_DO_OPERADOR[antes.operador] ?? antes.operador}{' '}
                                <span className="font-mono">{formatarValor(antes.valor)}</span>
                              </span>
                              <SeloDeRisco situacao={antes.classificacao} />
                              <span className="text-[var(--color-texto-suave)]">{antes.justificativa}</span>
                            </div>
                          </Celula>
                          <Celula>
                            <div className="flex flex-col gap-1 text-sm">
                              <span>
                                {ROTULO_DO_OPERADOR[depois.operador] ?? depois.operador}{' '}
                                <span className="font-mono">{formatarValor(depois.valor)}</span>
                              </span>
                              <SeloDeRisco situacao={depois.classificacao} />
                              <span className="text-[var(--color-texto-suave)]">{depois.justificativa}</span>
                            </div>
                          </Celula>
                        </LinhaDaTabela>
                      ))}
                    </tbody>
                  </Tabela>
                </Bloco>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function SeletorDeConjunto({
  rotulo,
  valor,
  conjuntos,
  aoMudar,
}: {
  rotulo: string;
  valor: string;
  conjuntos: readonly ConjuntoResumido[] | null;
  aoMudar(valor: string): void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--color-texto)]">{rotulo}</label>
      <select
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        disabled={!conjuntos}
        className={juntar(
          'rounded-[var(--radius-sistema)] border bg-[var(--color-superficie-alta)] px-3 py-2.5 text-base',
          'text-[var(--color-texto)] transition-colors duration-150',
          'border-[var(--color-borda-forte)] focus:border-[var(--color-texto-suave)]',
        )}
      >
        <option value="">Selecione…</option>
        {(conjuntos ?? []).map((conjunto) => (
          <option key={conjunto.id} value={conjunto.id}>
            {`${conjunto.versao} — ${conjunto.estado === 'PUBLICADO' ? 'publicado' : conjunto.estado.toLowerCase()}`}
          </option>
        ))}
      </select>
    </div>
  );
}
