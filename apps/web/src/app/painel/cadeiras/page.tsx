'use client';

/**
 * Giro de cadeiras — capacidade assistencial real.
 *
 * A tela responde o que a agenda convencional não responde: quantas poltronas existem
 * de fato livres agora, quando a próxima se libera, e quanto o dia já atrasou.
 *
 * ## Desenhada para o celular primeiro
 *
 * Esta tela vai ser aberta em pé, no corredor, por quem está de plantão. A grade de
 * cadeiras começa em duas colunas e cresce; a linha do tempo rola na horizontal dentro
 * do próprio contêiner, nunca empurrando a página.
 *
 * ## A cor aqui não é a escala clínica
 *
 * Estado de poltrona não é gravidade de paciente. Os quatro estados usam a paleta de
 * dados do ADR-005 mais o cinza de superfície, e o verde de "disponível" é o
 * `--color-risco-verde`? Não: seria a única cor da escala fora do lugar dela. Cadeira
 * livre é boa notícia operacional, não é paciente estável.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  CabecalhoDePainel,
  CartaoDeIndicador,
  LinhaDeIndicadores,
  Bloco,
} from '@/componentes/sistema/painel';
import {
  Aviso,
  Botao,
  Carregando,
  EstadoVazio,
  juntar,
} from '@/componentes/sistema/primitivos';
import { ErroDaFonte, buscarGiroDeCadeiras } from '@/sistema/fonte';
import {
  ROTULO_DO_ESTADO_DA_CADEIRA,
  type EstadoDaCadeira,
} from '@aurea/contratos';
import type { PainelDeCadeiras } from '@/sistema/tipos';

/**
 * A cor de cada estado.
 *
 * Cinza para disponível e não verde: verde nesta casa significa faixa clínica, e
 * cadeira livre não é paciente estável. O resto sai da paleta de dados.
 */
const COR_DO_ESTADO: Record<EstadoDaCadeira, string> = {
  OCUPADA: 'var(--color-dado-1)',
  EM_PREPARO: 'var(--color-dado-2)',
  AGUARDANDO_MEDICACAO: 'var(--color-dado-4)',
  EM_OBSERVACAO: 'var(--color-dado-3)',
  DISPONIVEL: 'var(--color-borda-forte)',
};

/** Só a hora, no fuso de quem lê. É o que a coordenação fala em voz alta. */
function hora(iso: string | null | undefined): string {
  if (!iso) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function duracao(minutos: number | null): string {
  if (minutos == null) return 'sem registro';
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export default function PaginaDeGiroDeCadeiras() {
  const [dados, setDados] = useState<PainelDeCadeiras | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    buscarGiroDeCadeiras()
      .then(setDados)
      .catch((motivo: unknown) => {
        setErro(
          motivo instanceof ErroDaFonte
            ? motivo.message
            : 'Não foi possível carregar o giro de cadeiras.',
        );
      });
  }, []);

  useEffect(() => {
    carregar();
    /* Painel de sala recarrega sozinho: quem está no corredor não volta na tela para
       apertar atualizar. Um minuto é o intervalo em que um estado muda de verdade. */
    const relogio = setInterval(carregar, 60000);
    return () => clearInterval(relogio);
  }, [carregar]);

  if (erro) {
    return (
      <Aviso tom="grave" titulo="Não foi possível carregar">
        {erro}
      </Aviso>
    );
  }

  if (!dados) return <Carregando />;

  const { giro } = dados;

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Plantão', href: '/painel' }, { rotulo: 'Cadeiras' }]}
        titulo="Giro de cadeiras"
        descricao="Capacidade real, não horário livre. A poltrona fica presa do preparo à liberação, e é isso que a agenda convencional não enxerga."
        acao={
          <Botao variante="secundario" onClick={carregar}>
            Atualizar
          </Botao>
        }
      />

      <LinhaDeIndicadores>
        <CartaoDeIndicador
          rotulo="Taxa de ocupação"
          valor={`${giro.taxaDeOcupacao}%`}
          apoio={`${giro.total - giro.disponiveis} de ${giro.total} cadeiras`}
        />
        <CartaoDeIndicador
          rotulo="Tempo médio de ocupação"
          valor={duracao(giro.tempoMedioDeOcupacaoEmMinutos)}
          apoio="sessões encerradas hoje"
        />
        <CartaoDeIndicador
          rotulo="Próxima cadeira livre"
          valor={
            giro.disponiveis > 0 ? 'agora' : hora(giro.proximaCadeiraLivreEm)
          }
          apoio={
            giro.disponiveis > 0
              ? `${giro.disponiveis} disponível${giro.disponiveis > 1 ? 'eis' : ''}`
              : 'todas ocupadas'
          }
        />
        <CartaoDeIndicador
          rotulo="Atraso acumulado"
          valor={duracao(giro.atrasoAcumuladoEmMinutos)}
          apoio="do previsto ao início real"
        />
      </LinhaDeIndicadores>

      {/* Contagem por estado. Em duas colunas no celular, cinco no desktop. */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Contagem estado="OCUPADA" quantos={giro.ocupadas} />
        <Contagem estado="EM_PREPARO" quantos={giro.emPreparo} />
        <Contagem estado="AGUARDANDO_MEDICACAO" quantos={giro.aguardandoMedicacao} />
        <Contagem estado="EM_OBSERVACAO" quantos={giro.emObservacao} />
        <Contagem estado="DISPONIVEL" quantos={giro.disponiveis} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Bloco
          titulo="As cadeiras agora"
          descricao="Cada poltrona, com quem está nela e a que horas ela se libera."
        >
          {giro.porCadeira.length === 0 ? (
            <EstadoVazio
              titulo="Nenhuma cadeira cadastrada"
              descricao="Sem cadeiras, não há capacidade a calcular."
            />
          ) : (
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {giro.porCadeira.map((ocupacao) => (
                <li
                  key={ocupacao.cadeira.id}
                  className="rounded-[var(--radius-sistema)] border border-[var(--color-borda)] bg-[var(--color-superficie-baixa)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs tabular-nums text-[var(--color-texto-fraco)]">
                      #{ocupacao.cadeira.numero}
                    </span>
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: COR_DO_ESTADO[ocupacao.estado] }}
                    />
                  </div>

                  <p className="mt-1.5 truncate text-sm font-medium text-[var(--color-texto)]">
                    {ocupacao.sessaoAtual?.paciente ?? 'Livre'}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-[var(--color-texto-fraco)]">
                    {ROTULO_DO_ESTADO_DA_CADEIRA[ocupacao.estado]}
                    {ocupacao.livreEm ? ` até ${hora(ocupacao.livreEm)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        <Bloco
          titulo="Ainda cabe alguém"
          descricao="Vãos de uma hora ou mais dentro do expediente. É a capacidade que sobra depois de contar a ocupação real."
        >
          {dados.janelasLivres.length === 0 ? (
            <p className="text-sm text-[var(--color-texto-fraco)]">
              Nenhuma janela de uma hora hoje. O dia está cheio.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dados.janelasLivres.slice(0, 8).map((janela) => (
                <li
                  key={`${janela.cadeiraId}-${janela.de}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-borda)] pb-2 text-sm last:border-b-0 last:pb-0"
                >
                  <span className="text-[var(--color-texto)]">
                    Cadeira {janela.numero}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[var(--color-texto-suave)]">
                    {hora(janela.de)} às {hora(janela.ate)}
                    <span className="ml-1.5 text-[var(--color-texto-fraco)]">
                      {duracao(janela.minutos)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>

      <LinhaDoTempo dados={dados} />
    </>
  );
}

function Contagem({
  estado,
  quantos,
}: {
  estado: EstadoDaCadeira;
  quantos: number;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-sistema)] border border-[var(--color-borda)] bg-[var(--color-superficie-alta)] px-3 py-2.5">
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: COR_DO_ESTADO[estado] }}
      />
      <span className="font-mono text-lg leading-none tabular-nums text-[var(--color-texto)]">
        {quantos}
      </span>
      <span className="min-w-0 text-xs leading-tight text-[var(--color-texto-fraco)]">
        {ROTULO_DO_ESTADO_DA_CADEIRA[estado]}
      </span>
    </div>
  );
}

/**
 * A linha do tempo do dia, cadeira por cadeira.
 *
 * É a peça que torna o argumento visível: a barra de cada paciente é a ocupação REAL,
 * já com preparo, pré-medicação, observação e virada. Duas horas de infusão viram uma
 * barra de duas horas e vinte, e o vão que sobra no fim do dia é capacidade de verdade.
 *
 * Rola na horizontal dentro do próprio contêiner. Num celular em pé, doze horas de
 * expediente não cabem na largura da tela, e espremer produziria barras de três pixels.
 */
function LinhaDoTempo({ dados }: { dados: PainelDeCadeiras }) {
  const abertura = new Date(dados.expediente.abertura).getTime();
  const fechamento = new Date(dados.expediente.fechamento).getTime();
  const duracaoTotal = fechamento - abertura;

  if (duracaoTotal <= 0 || dados.giro.porCadeira.length === 0) return null;

  const horas: number[] = [];
  for (let h = 0; h <= 12; h += 2) horas.push(h);

  return (
    <div className="mt-4">
      <Bloco
        titulo="Ocupação prevista do dia"
        descricao="A barra é a ocupação real da poltrona, não só o tempo de infusão."
      >
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="min-w-[640px]">
            {/* Régua de horas */}
            <div className="relative mb-2 h-4">
              {horas.map((h) => {
                const instante = abertura + h * 3600000;
                if (instante > fechamento) return null;
                const esquerda = ((instante - abertura) / duracaoTotal) * 100;
                return (
                  <span
                    key={h}
                    className="absolute font-mono text-[0.625rem] tabular-nums text-[var(--color-texto-fraco)]"
                    style={{ left: `${esquerda}%` }}
                  >
                    {hora(new Date(instante).toISOString())}
                  </span>
                );
              })}
            </div>

            <ul className="flex flex-col gap-1.5">
              {dados.giro.porCadeira.map((ocupacao) => {
                const sessoes = dados.sessoesDoDia.filter(
                  (s) => s.cadeiraId === ocupacao.cadeira.id && s.estado !== 'CANCELADA',
                );

                return (
                  <li
                    key={ocupacao.cadeira.id}
                    className="flex items-center gap-2"
                  >
                    <span className="w-8 shrink-0 text-right font-mono text-[0.6875rem] tabular-nums text-[var(--color-texto-fraco)]">
                      #{ocupacao.cadeira.numero}
                    </span>

                    <div className="relative h-7 flex-1 overflow-hidden rounded-[var(--radius-sistema)] bg-[var(--color-superficie-baixa)]">
                      {sessoes.map((sessao) => {
                        const inicio = new Date(sessao.previsaoDeInicio).getTime();
                        const fim = new Date(sessao.previsaoDeFim).getTime();
                        if (Number.isNaN(inicio) || Number.isNaN(fim)) return null;

                        const esquerda = ((inicio - abertura) / duracaoTotal) * 100;
                        const largura = ((fim - inicio) / duracaoTotal) * 100;
                        if (largura <= 0) return null;

                        return (
                          <div
                            key={sessao.id}
                            title={`${sessao.paciente} · ${hora(sessao.previsaoDeInicio)} às ${hora(sessao.previsaoDeFim)}`}
                            className={juntar(
                              'absolute inset-y-0 flex items-center overflow-hidden',
                              'rounded-[var(--radius-sistema)] px-2',
                            )}
                            style={{
                              left: `${Math.max(esquerda, 0)}%`,
                              width: `${Math.min(largura, 100)}%`,
                              backgroundColor:
                                sessao.estado === 'CONCLUIDA'
                                  ? 'var(--color-borda-forte)'
                                  : 'var(--color-dado-1)',
                            }}
                          >
                            <span className="truncate text-[0.6875rem] leading-none text-white">
                              {sessao.paciente}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Bloco>
    </div>
  );
}
