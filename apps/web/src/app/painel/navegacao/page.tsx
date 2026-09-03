'use client';

/**
 * Blocos 6, 9, 10 e 11 dos prints — navegação.
 *
 * Quatro leituras que respondem à mesma pergunta: onde o serviço está travando.
 *
 * - **Mural operacional (11)** — o estado do dia em quatro números.
 * - **Alertas pré-tratamento (6)** — o que ameaça o tratamento de amanhã. Evita
 *   deslocamento inútil, que é o custo real de descobrir a pendência na recepção.
 * - **Indicadores de navegação (9)** — volume, tempo de resposta e desfechos.
 * - **Mapa de barreiras (10)** — quantos pacientes esbarram na mesma coisa.
 *
 * Nada aqui é classificação de paciente, então nada aqui usa `--color-risco-*`.
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
import { ErroDaFonte, buscarNavegacao } from '@/sistema/fonte';
import { formatarData } from '@/sistema/formato';
import type { PainelDeNavegacao } from '@/sistema/tipos';

const ROTULO_DA_BARREIRA: Record<string, string> = {
  TRANSPORTE: 'Transporte',
  AUTORIZACAO: 'Autorização',
  FINANCEIRA: 'Financeira',
  ANSIEDADE: 'Ansiedade',
  REDE_DE_APOIO: 'Rede de apoio',
  DISTANCIA: 'Distância',
  TRABALHO: 'Trabalho',
  OUTRA: 'Outra',
};

const ROTULO_DA_PENDENCIA: Record<string, string> = {
  EXAME: 'Exame pendente',
  AUTORIZACAO: 'Autorização pendente',
  CONSULTA_MEDICA: 'Consulta médica pendente',
  TOXICIDADE_EM_ACOMPANHAMENTO: 'Toxicidade em acompanhamento',
  INTERNACAO_RECENTE: 'Internação recente',
  OUTRA: 'Outra pendência',
};

const CORES_DE_DADO = [
  'var(--color-dado-1)',
  'var(--color-dado-2)',
  'var(--color-dado-3)',
  'var(--color-dado-4)',
  'var(--color-dado-5)',
  'var(--color-dado-neutro)',
];

/** Minutos viram hora quando passam de 90: "184 minutos" não é lido, é convertido. */
function formatarDuracao(minutos: number | null): string {
  if (minutos == null) return 'sem registro';
  if (minutos < 90) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

export default function PaginaDeNavegacao() {
  const [dados, setDados] = useState<PainelDeNavegacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    buscarNavegacao()
      .then((resultado) => {
        if (!cancelado) setDados(resultado);
      })
      .catch((motivo: unknown) => {
        if (cancelado) return;
        setErro(
          motivo instanceof ErroDaFonte
            ? motivo.message
            : 'Não foi possível carregar a navegação.',
        );
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Plantão', href: '/painel' }, { rotulo: 'Navegação' }]}
        titulo="Navegação"
        descricao="Onde o serviço está travando. Contagem de operação, não classificação de paciente."
      />

      {erro && (
        <Aviso tom="grave" titulo="Não foi possível carregar">
          {erro}
        </Aviso>
      )}

      {!dados && !erro && <Carregando />}

      {dados && (
        <>
          {/* Mural operacional — bloco 11. O estado do dia antes de qualquer análise. */}
          <LinhaDeIndicadores>
            <CartaoDeIndicador
              rotulo="Pacientes internados"
              valor={dados.mural.pacientesInternados}
              apoio="agora"
            />
            <CartaoDeIndicador
              rotulo="Tratamentos suspensos"
              valor={dados.mural.tratamentosSuspensos}
            />
            <CartaoDeIndicador
              rotulo="Pendências para amanhã"
              valor={dados.mural.pendenciasParaAmanha}
            />
            <CartaoDeIndicador
              rotulo="Barreiras abertas"
              valor={dados.mural.barreirasAbertas}
            />
          </LinhaDeIndicadores>

          {/* Alertas pré-tratamento — bloco 6. Antes do resto: é o único com prazo. */}
          <div className="mb-4">
            <Bloco
              titulo="Tratamento amanhã"
              descricao="O que pode suspender a sessão. Descobrir isto na recepção custa uma viagem ao paciente."
            >
              {dados.alertasPreTratamento.length === 0 ? (
                <p className="text-sm text-[var(--color-texto-fraco)]">
                  Nenhuma pendência registrada para amanhã. Ausência de registro não é
                  ausência de pendência.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {dados.alertasPreTratamento.map((alerta) => (
                    <li
                      key={alerta.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-borda)] pb-2.5 text-sm last:border-b-0 last:pb-0"
                    >
                      <span>
                        <a
                          href={`/painel/pacientes/${alerta.pacienteId}`}
                          className="font-medium text-[var(--color-texto)] underline-offset-2 hover:underline"
                        >
                          {alerta.paciente}
                        </a>
                        <span className="ml-2 text-[var(--color-texto-suave)]">
                          {ROTULO_DA_PENDENCIA[alerta.tipo] ?? alerta.tipo}
                        </span>
                        {alerta.descricao && (
                          <span className="ml-1.5 text-xs text-[var(--color-texto-fraco)]">
                            {alerta.descricao}
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-[var(--color-texto-fraco)]">
                        {formatarData(alerta.referenteA)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Bloco>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {/* Indicadores de navegação — bloco 9. */}
            <Bloco
              titulo="Últimos 30 dias"
              descricao="Volume, tempo de resposta e desfechos do acompanhamento."
            >
              <dl className="flex flex-col gap-2.5 text-sm">
                <LinhaDeNumero
                  rotulo="Pacientes acompanhados"
                  valor={dados.indicadores.pacientesAcompanhados}
                />
                <LinhaDeNumero
                  rotulo="Intervenções realizadas"
                  valor={dados.indicadores.intervencoesRealizadas}
                />
                <LinhaDeNumero
                  rotulo="Tempo médio de resposta"
                  valor={formatarDuracao(
                    dados.indicadores.tempoMedioDeRespostaEmMinutos,
                  )}
                />
                <LinhaDeNumero
                  rotulo="Encaminhamentos"
                  valor={dados.indicadores.encaminhamentos}
                />
                <LinhaDeNumero
                  rotulo="Internações notificadas"
                  valor={dados.indicadores.internacoesNotificadas}
                />
                <LinhaDeNumero
                  rotulo="Tratamentos suspensos"
                  valor={dados.indicadores.tratamentosSuspensos}
                />
                <LinhaDeNumero
                  rotulo="Sem rede de apoio"
                  valor={dados.indicadores.pacientesSemRedeDeApoio}
                />
                <LinhaDeNumero
                  rotulo="Com dificuldade de acesso"
                  valor={dados.indicadores.pacientesComDificuldadeDeAcesso}
                />
              </dl>
            </Bloco>

            {/* Mapa de barreiras — bloco 10. */}
            <Bloco
              titulo="Mapa de barreiras"
              descricao="Quantos pacientes esbarram na mesma coisa. Só as que continuam abertas."
            >
              {dados.barreiras.length === 0 ? (
                <EstadoVazio
                  titulo="Nenhuma barreira registrada"
                  descricao="Ninguém registrou barreira de acesso ainda. Isso costuma querer dizer que o registro não começou, e não que não existam."
                />
              ) : (
                <Tabela rotulo="Barreiras de acesso por tipo">
                  <CabecalhoDaTabela colunas={['Barreira', 'Pacientes', '']} />
                  <tbody>
                    {dados.barreiras.map((barreira, indice) => {
                      const maior = dados.barreiras[0]?.quantidade ?? 1;
                      return (
                        <LinhaDaTabela key={barreira.tipo}>
                          <Celula>
                            <span className="text-[var(--color-texto)]">
                              {ROTULO_DA_BARREIRA[barreira.tipo] ?? barreira.tipo}
                            </span>
                          </Celula>
                          <Celula>
                            <span className="font-mono tabular-nums text-[var(--color-texto)]">
                              {barreira.quantidade}
                            </span>
                          </Celula>
                          <Celula>
                            <span
                              className="block h-2 rounded-[var(--radius-pilula)]"
                              style={{
                                width: `${Math.max((barreira.quantidade / maior) * 100, 6)}%`,
                                backgroundColor:
                                  CORES_DE_DADO[indice % CORES_DE_DADO.length],
                              }}
                            />
                          </Celula>
                        </LinhaDaTabela>
                      );
                    })}
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

function LinhaDeNumero({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: number | string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-borda)] pb-2.5 last:border-b-0 last:pb-0">
      <dt className="text-[var(--color-texto-suave)]">{rotulo}</dt>
      <dd className="font-mono tabular-nums text-[var(--color-texto)]">{valor}</dd>
    </div>
  );
}
