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
  Bloco,
  CabecalhoDePainel,
  CartaoDeIndicador,
  FiltroEmPilula,
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

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Administração' }, { rotulo: 'Registro de acessos' }]}
        titulo="Registro de acessos"
        descricao="Toda leitura de prontuário, exportação e alteração do algoritmo fica registrada — exigência de LGPD, não telemetria de produto."
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
              valor={ultimoAcesso ? formatarDataEHora(ultimoAcesso.aconteceuEm) : '—'}
              tom="neutro"
            />
          </LinhaDeIndicadores>

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
                      <Celula>{registro.recurso ?? '—'}</Celula>
                      <Celula mono>{registro.enderecoDeOrigem ?? '—'}</Celula>
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
