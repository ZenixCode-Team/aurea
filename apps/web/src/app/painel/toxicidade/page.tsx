'use client';

/**
 * Bloco 5 dos prints — indicadores de toxicidade.
 *
 * Duas leituras de gestão que hoje exigiriam abrir paciente por paciente: o que mais
 * apareceu na janela, e qual sintoma cada protocolo produz.
 *
 * ## A cor aqui é lei, não gosto
 *
 * Nenhuma barra usa `--color-risco-*`. Isto é contagem de operação, não classificação
 * de ninguém, e a regra 3 do ADR-005 é explícita: série de gráfico sai de
 * `--color-dado-*` por índice. A paleta é fria de propósito — gráfico neste produto
 * deve parecer de outro lugar, porque é informação de operação e não sinal clínico.
 * `scripts/conformidade.mjs` barra a violação inversa; esta é a mesma regra pelo lado
 * de cá.
 *
 * ## Amostra pequena é dita
 *
 * Percentual sobre poucas sessões parece preciso e não é. Abaixo do mínimo a tela
 * avisa em vez de exibir 33% com cara de estatística.
 */

import { useEffect, useState } from 'react';
import {
  Bloco,
  CabecalhoDePainel,
  CartaoDeIndicador,
  LinhaDeIndicadores,
} from '@/componentes/sistema/painel';
import {
  Aviso,
  CabecalhoDaTabela,
  Carregando,
  Celula,
  EstadoVazio,
  LinhaDaTabela,
  Tabela,
} from '@/componentes/sistema/primitivos';
import { ErroDaFonte, buscarIndicadoresDeToxicidade } from '@/sistema/fonte';
import type { IndicadoresDeToxicidade } from '@/sistema/tipos';

/** ADR-005: por índice, sempre. Nunca escolhida por "combina com o sintoma". */
const CORES_DE_DADO = [
  'var(--color-dado-1)',
  'var(--color-dado-2)',
  'var(--color-dado-3)',
  'var(--color-dado-4)',
  'var(--color-dado-5)',
  'var(--color-dado-neutro)',
];

const ROTULO_DO_SINTOMA: Record<string, string> = {
  FEBRE: 'Febre',
  DIARREIA: 'Diarreia',
  NAUSEA_VOMITO: 'Náusea e vômito',
  DOR: 'Dor',
  FALTA_DE_AR: 'Falta de ar',
};

export default function PaginaDeIndicadoresDeToxicidade() {
  const [dados, setDados] = useState<IndicadoresDeToxicidade | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    buscarIndicadoresDeToxicidade()
      .then((resultado) => {
        if (!cancelado) setDados(resultado);
      })
      .catch((motivo: unknown) => {
        if (cancelado) return;
        setErro(
          motivo instanceof ErroDaFonte
            ? motivo.message
            : 'Não foi possível carregar os indicadores.',
        );
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Plantão', href: '/painel' }, { rotulo: 'Toxicidade' }]}
        titulo="Indicadores de toxicidade"
        descricao="Contagem de operação, não classificação de paciente. Conta o sintoma que passou do limiar; o que ficou dentro dele não é evento de toxicidade."
      />

      {erro && (
        <Aviso tom="grave" titulo="Não foi possível carregar">
          {erro}
        </Aviso>
      )}

      {!dados && !erro && <Carregando />}

      {dados && (
        <>
          <LinhaDeIndicadores>
            <CartaoDeIndicador
              rotulo="Sessões na janela"
              valor={dados.totalDeSessoes}
              apoio={`últimos ${dados.diasConsiderados} dias`}
            />
            <CartaoDeIndicador
              rotulo="Sintomas acima do limiar"
              valor={dados.taxas.reduce((total, t) => total + t.ocorrencias, 0)}
            />
            <CartaoDeIndicador
              rotulo="Protocolos com registro"
              valor={dados.porProtocolo.length}
            />
          </LinhaDeIndicadores>

          {!dados.amostraSuficiente && (
            <Aviso tom="atencao" titulo="Amostra pequena">
              São {dados.totalDeSessoes} sessões nos últimos {dados.diasConsiderados}{' '}
              dias. Os percentuais abaixo são verdadeiros, mas variam muito com uma
              resposta a mais ou a menos. Leia como ordem de grandeza, não como taxa.
            </Aviso>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <Bloco
              titulo={`Últimos ${dados.diasConsiderados} dias`}
              descricao="Percentual sobre o total de sessões concluídas na janela, não sobre o total de sintomas."
            >
              {dados.taxas.length === 0 ? (
                <EstadoVazio
                  titulo="Nenhum sintoma acima do limiar"
                  descricao="Ninguém passou do critério na janela. Vale conferir se os check-ins estão sendo respondidos."
                />
              ) : (
                <ul className="flex flex-col gap-3.5">
                  {dados.taxas.map((taxa, indice) => (
                    <li key={taxa.sintoma}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-[var(--color-texto)]">
                          {ROTULO_DO_SINTOMA[taxa.sintoma] ?? taxa.sintoma}
                        </span>
                        <span className="font-mono text-sm tabular-nums text-[var(--color-texto)]">
                          {taxa.percentual}%
                          {/* O denominador ao lado do percentual, sempre: "40%" sozinho
                              é número que mente por omissão. */}
                          <span className="ml-1.5 text-xs text-[var(--color-texto-fraco)]">
                            {taxa.ocorrencias} de {taxa.totalDeSessoes}
                          </span>
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-2 w-full overflow-hidden rounded-[var(--radius-pilula)] bg-[var(--color-superficie-baixa)]"
                        role="img"
                        aria-label={`${ROTULO_DO_SINTOMA[taxa.sintoma] ?? taxa.sintoma}: ${taxa.percentual}%`}
                      >
                        <div
                          className="h-full rounded-[var(--radius-pilula)]"
                          style={{
                            width: `${Math.min(taxa.percentual, 100)}%`,
                            backgroundColor:
                              CORES_DE_DADO[indice % CORES_DE_DADO.length],
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Bloco>

            <Bloco
              titulo="Toxicidades por protocolo"
              descricao="O sintoma que mais apareceu em cada protocolo. Muda o que a enfermagem pergunta antes de a pessoa reclamar."
            >
              {dados.porProtocolo.length === 0 ? (
                <EstadoVazio
                  titulo="Sem registro por protocolo"
                  descricao="Nenhuma ocorrência na janela veio de paciente com tratamento ativo."
                />
              ) : (
                <Tabela rotulo="Sintoma mais frequente por protocolo" larguraMinima="26rem">
                  <CabecalhoDaTabela
                    colunas={[
                    { rotulo: 'Protocolo' },
                    { rotulo: 'Sintoma mais frequente', largura: '11rem' },
                    { rotulo: 'Sessões', largura: '7.5rem' },
                  ]}
                  />
                  <tbody>
                    {dados.porProtocolo.map((linha) => (
                      <LinhaDaTabela key={linha.protocolo}>
                        <Celula>
                          <span className="text-[var(--color-texto)]">
                            {linha.protocolo}
                          </span>
                        </Celula>
                        <Celula>
                          <span className="text-[var(--color-texto)]">
                            {linha.sintomaMaisFrequente
                              ? (ROTULO_DO_SINTOMA[linha.sintomaMaisFrequente] ??
                                linha.sintomaMaisFrequente)
                              : 'nenhum'}
                          </span>
                          <span className="ml-1.5 text-xs text-[var(--color-texto-fraco)]">
                            {linha.ocorrenciasDoMaisFrequente}x
                          </span>
                        </Celula>
                        <Celula>
                          <span className="font-mono tabular-nums text-[var(--color-texto)]">
                            {linha.totalDeSessoes}
                          </span>
                          {!linha.amostraSuficiente && (
                            <span className="ml-1.5 text-xs text-[var(--color-texto-fraco)]">
                              amostra pequena
                            </span>
                          )}
                        </Celula>
                      </LinhaDaTabela>
                    ))}
                  </tbody>
                </Tabela>
              )}
            </Bloco>
          </div>
        </>
      )}
    </>
  );
}
