'use client';

/**
 * A9 — Registro de acessos.
 *
 * Existe por exigência de LGPD: todo acesso a prontuário — leitura, exportação,
 * edição ou publicação do algoritmo, entrada no sistema — fica rastreado e
 * auditável. Não é telemetria de produto, é obrigação legal.
 *
 * Composição refeita conforme o ADR-004: cabeçalho com contexto, indicadores do
 * volume registrado e o filtro por ação como pílulas — a lista de ações é dado
 * (vem do próprio registro), não um enum fixo desenhado à mão.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  BarrasDeVolume,
  Bloco,
  CabecalhoDePainel,
  CartaoDeIndicador,
  FiltroEmPilula,
  LinhaDeIndicadores,
  SeloDeBloco,
  type ColunaDeVolume,
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
import { ErroDaFonte, buscarRegistroDeAcessos } from '@/sistema/fonte';
import { ROTULO_DA_ACAO, formatarDataEHora } from '@/sistema/formato';
import type { AcaoDeAcesso, RegistroDeAcesso } from '@/sistema/tipos';

type Carregamento =
  | { situacao: 'CARREGANDO' }
  | { situacao: 'ERRO'; mensagem: string }
  | { situacao: 'PRONTO'; registros: readonly RegistroDeAcesso[] };

const TODAS = 'TODAS' as const;

export default function PaginaDeAcessos() {
  const [estado, setEstado] = useState<Carregamento>({ situacao: 'CARREGANDO' });
  const [filtro, setFiltro] = useState<AcaoDeAcesso | typeof TODAS>(TODAS);

  useEffect(() => {
    buscarRegistroDeAcessos()
      .then((registros) => setEstado({ situacao: 'PRONTO', registros }))
      .catch((erro: unknown) => {
        setEstado({
          situacao: 'ERRO',
          mensagem:
            erro instanceof ErroDaFonte ? erro.message : 'Não foi possível carregar o registro.',
        });
      });
  }, []);

  const acoesPresentes = useMemo(() => {
    if (estado.situacao !== 'PRONTO') return [];
    return Array.from(new Set(estado.registros.map((registro) => registro.acao)));
  }, [estado]);

  const registrosFiltrados = useMemo(() => {
    if (estado.situacao !== 'PRONTO') return [];
    if (filtro === TODAS) return estado.registros;
    return estado.registros.filter((registro) => registro.acao === filtro);
  }, [estado, filtro]);

  const usuariosDistintos = useMemo(() => {
    if (estado.situacao !== 'PRONTO') return 0;
    return new Set(estado.registros.map((registro) => registro.usuario)).size;
  }, [estado]);

  const ultimoAcesso = estado.situacao === 'PRONTO' ? estado.registros[0] ?? null : null;

  /**
   * Volume por dia, empilhado por ação.
   *
   * Duas decisões que valem comentário:
   *
   * O agrupamento é pela STRING da data (`slice(0, 10)`), nunca por `new Date`. É a
   * mesma escolha do histórico do paciente e pelo mesmo motivo: um registro de 22h em
   * São Paulo vira o dia seguinte se a conta passar por UTC, e um pico noturno de
   * acesso a prontuário migrar de dia numa tela de auditoria é o oposto de auditável.
   *
   * A paleta tem seis séries, e o registro tem doze tipos de ação. As cinco mais
   * frequentes ganham série própria e o resto vira "Outras" — em vez de repetir cor,
   * que faria duas ações diferentes ficarem idênticas no gráfico.
   */
  const { volumePorDia, seriesDoVolume } = useMemo((): {
    volumePorDia: readonly ColunaDeVolume[];
    seriesDoVolume: readonly string[];
  } => {
    if (estado.situacao !== 'PRONTO') return { volumePorDia: [], seriesDoVolume: [] };

    const contagemPorAcao = new Map<string, number>();
    for (const registro of estado.registros) {
      contagemPorAcao.set(registro.acao, (contagemPorAcao.get(registro.acao) ?? 0) + 1);
    }

    const principais = [...contagemPorAcao.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([acao]) => acao);

    const temOutras = contagemPorAcao.size > principais.length;
    const series = [
      ...principais.map((acao) => ROTULO_DA_ACAO[acao] ?? acao),
      ...(temOutras ? ['Outras'] : []),
    ];

    const porDia = new Map<string, number[]>();
    for (const registro of estado.registros) {
      const dia = registro.aconteceuEm.slice(0, 10);
      const parcelas = porDia.get(dia) ?? new Array<number>(series.length).fill(0);
      const indice = principais.indexOf(registro.acao);
      const alvo = indice === -1 ? series.length - 1 : indice;
      parcelas[alvo] = (parcelas[alvo] ?? 0) + 1;
      porDia.set(dia, parcelas);
    }

    /* Últimos 14 dias com registro. Barra fina demais não é gráfico, é textura. */
    const colunas = [...porDia.entries()]
      .sort(([umDia], [outroDia]) => umDia.localeCompare(outroDia))
      .slice(-14)
      .map(([dia, partes]) => ({
        rotulo: `${dia.slice(8, 10)}/${dia.slice(5, 7)}`,
        partes,
      }));

    return { volumePorDia: colunas, seriesDoVolume: series };
  }, [estado]);

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Administração' }, { rotulo: 'Registro de acessos' }]}
        titulo="Registro de acessos"
        descricao="Toda leitura de prontuário, exportação e alteração do algoritmo fica registrada, exigência de LGPD, não telemetria de produto."
      />

      {estado.situacao === 'CARREGANDO' && <Carregando linhas={6} />}

      {estado.situacao === 'ERRO' && (
        <Aviso tom="grave" titulo="Não foi possível carregar o registro">
          {estado.mensagem}
        </Aviso>
      )}

      {estado.situacao === 'PRONTO' && (
        <>
          <LinhaDeIndicadores>
            <CartaoDeIndicador rotulo="Registros" valor={estado.registros.length} tom="neutro" />
            <CartaoDeIndicador rotulo="Usuários distintos" valor={usuariosDistintos} tom="neutro" />
            <CartaoDeIndicador rotulo="Tipos de ação" valor={acoesPresentes.length} tom="neutro" />
            <CartaoDeIndicador
              rotulo="Último registro"
              valor={ultimoAcesso ? formatarDataEHora(ultimoAcesso.aconteceuEm) : 'sem registro'}
              formato="texto"
              tom="neutro"
            />
          </LinhaDeIndicadores>

          {/*
            Volume por dia — a primeira aplicação da paleta de dados do ADR-005.

            Registro de acesso é operação pura: exigência de LGPD, não sinal clínico.
            Nenhuma barra aqui diz nada sobre paciente, e é justamente por isso que
            esta tela é o lugar certo para estrear a paleta fria. Se o gráfico
            estivesse no plantão, azul e ameixa dividiriam a tela com vermelho e âmbar
            da escala, e alguém em algum plantão leria uma barra como classificação.

            O recorte é dos registros JÁ carregados: nenhuma chamada nova, nenhum
            endpoint de agregação. Quando a auditoria precisar de período longo, isso
            vira consulta no servidor — hoje seria complexidade sem demanda.
          */}
          <div className="mb-6">
            <Bloco
              titulo="Volume por dia"
              selo={<SeloDeBloco>{volumePorDia.length} dias</SeloDeBloco>}
              descricao="Distribuição dos registros carregados, por tipo de ação. Serve para achar pico fora do horário e concentração num único usuário."
            >
              {volumePorDia.length === 0 ? (
                <EstadoVazio titulo="Sem registros no período carregado" />
              ) : (
                <BarrasDeVolume
                  titulo="Registros de acesso por dia, empilhados por tipo de ação"
                  series={seriesDoVolume}
                  colunas={volumePorDia}
                />
              )}
            </Bloco>
          </div>

          <Bloco
            titulo="Acessos"
            descricao="Filtre por tipo de ação para auditar um recorte específico."
            semPadding
          >
            <div className="flex flex-wrap gap-1.5 border-b border-[var(--color-borda)] px-5 py-3">
              <FiltroEmPilula rotulo="Todas" ativo={filtro === TODAS} aoClicar={() => setFiltro(TODAS)} />
              {acoesPresentes.map((acao) => (
                <FiltroEmPilula
                  key={acao}
                  rotulo={ROTULO_DA_ACAO[acao] ?? acao}
                  ativo={filtro === acao}
                  aoClicar={() => setFiltro(acao)}
                />
              ))}
            </div>

            {registrosFiltrados.length === 0 ? (
              <div className="p-6">
                <EstadoVazio titulo="Nenhum acesso registrado para este filtro" />
              </div>
            ) : (
              <Tabela rotulo="Registro de acessos">
                <CabecalhoDaTabela
                  colunas={['Quando', 'Usuário', 'Ação', 'Recurso', 'Endereço de origem']}
                />
                <tbody>
                  {registrosFiltrados.map((registro) => (
                    <LinhaDaTabela key={registro.id}>
                      <Celula mono>{formatarDataEHora(registro.aconteceuEm)}</Celula>
                      <Celula>{registro.usuario}</Celula>
                      <Celula>{ROTULO_DA_ACAO[registro.acao] ?? registro.acao}</Celula>
                      <Celula>{registro.recurso ?? 'não informado'}</Celula>
                      <Celula mono>{registro.enderecoDeOrigem ?? 'não informado'}</Celula>
                    </LinhaDaTabela>
                  ))}
                </tbody>
              </Tabela>
            )}
          </Bloco>
        </>
      )}
    </>
  );
}
