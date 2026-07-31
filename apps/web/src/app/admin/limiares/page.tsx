'use client';

/**
 * A1 — Lista de conjuntos de limiares.
 *
 * O algoritmo inteiro é isto: uma lista de versões congeladas do corte clínico
 * (ADR-001, regra 1). Só um conjunto classifica pacientes reais por vez — o
 * publicado — e é obrigatório que essa tela deixe isso óbvio à primeira vista.
 *
 * Composição refeita conforme o ADR-004: cabeçalho com contexto, linha de
 * indicadores mostrando o que importa (quantos conjuntos, qual está publicado,
 * quantos ainda não foram validados clinicamente) e a lista dentro de um bloco
 * identificado.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bloco, CabecalhoDePainel, CartaoDeIndicador, LinhaDeIndicadores } from '@/componentes/sistema/painel';
import {
  Aviso,
  CabecalhoDaTabela,
  Carregando,
  Celula,
  EstadoVazio,
  LinkComoBotao,
  LinhaDaTabela,
  SeloDeNaoValidado,
  Tabela,
  juntar,
} from '@/componentes/sistema/primitivos';
import { ErroDaFonte, buscarConjuntos } from '@/sistema/fonte';
import { formatarDataEHora } from '@/sistema/formato';
import type { ConjuntoResumido, EstadoDoConjunto } from '@/sistema/tipos';

const ESTILO_DO_ESTADO: Record<EstadoDoConjunto, string> = {
  PUBLICADO:
    'border-[var(--color-superficie-invertida)] bg-[var(--color-superficie-invertida)] text-[var(--color-texto-invertido)]',
  RASCUNHO: 'border-[var(--color-borda-forte)] text-[var(--color-texto-suave)]',
  ARQUIVADO: 'border-[var(--color-borda)] text-[var(--color-texto-fraco)]',
};

const ROTULO_DO_ESTADO: Record<EstadoDoConjunto, string> = {
  PUBLICADO: 'Publicado — classificando agora',
  RASCUNHO: 'Rascunho',
  ARQUIVADO: 'Arquivado',
};

function SeloDoEstado({ estado }: { estado: EstadoDoConjunto }) {
  return (
    <span
      className={juntar(
        'inline-flex items-center rounded-full border px-2.5 py-0.5',
        'font-mono text-[0.6875rem] font-medium uppercase tracking-[0.1em]',
        ESTILO_DO_ESTADO[estado],
      )}
    >
      {ROTULO_DO_ESTADO[estado]}
    </span>
  );
}

type Carregamento =
  | { situacao: 'CARREGANDO' }
  | { situacao: 'ERRO'; mensagem: string }
  | { situacao: 'PRONTO'; conjuntos: readonly ConjuntoResumido[] };

export default function PaginaDeLimiares() {
  const [estado, setEstado] = useState<Carregamento>({ situacao: 'CARREGANDO' });

  useEffect(() => {
    buscarConjuntos()
      .then((conjuntos) => setEstado({ situacao: 'PRONTO', conjuntos }))
      .catch((erro: unknown) => {
        const mensagem =
          erro instanceof ErroDaFonte ? erro.message : 'Não foi possível carregar os conjuntos.';
        setEstado({ situacao: 'ERRO', mensagem });
      });
  }, []);

  const resumo = useMemo(() => {
    if (estado.situacao !== 'PRONTO') return null;
    const publicado = estado.conjuntos.find((conjunto) => conjunto.estado === 'PUBLICADO') ?? null;
    const aguardandoValidacao = estado.conjuntos.filter(
      (conjunto) => !conjunto.validadoClinicamente,
    ).length;
    return { publicado, aguardandoValidacao };
  }, [estado]);

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Administração' }, { rotulo: 'Conjuntos de limiares' }]}
        titulo="Conjuntos de limiares"
        descricao="Cada linha é uma versão inteira do algoritmo de classificação, congelada. Publicar troca qual delas classifica pacientes reais."
        acao={
          <div className="flex gap-2">
            <LinkComoBotao href="/admin/limiares/diferenca" variante="secundario">
              Comparar versões
            </LinkComoBotao>
            <LinkComoBotao href="/admin/limiares/novo">Novo conjunto</LinkComoBotao>
          </div>
        }
      />

      {estado.situacao === 'CARREGANDO' && <Carregando linhas={5} />}

      {estado.situacao === 'ERRO' && (
        <Aviso tom="grave" titulo="Não foi possível carregar os conjuntos">
          {estado.mensagem}
        </Aviso>
      )}

      {estado.situacao === 'PRONTO' && estado.conjuntos.length === 0 && (
        <EstadoVazio
          titulo="Nenhum conjunto de limiares cadastrado"
          descricao="Crie o primeiro conjunto para que o algoritmo tenha o que aplicar."
          acao={
            <LinkComoBotao href="/admin/limiares/novo">Novo conjunto</LinkComoBotao>
          }
        />
      )}

      {estado.situacao === 'PRONTO' && estado.conjuntos.length > 0 && resumo && (
        <>
          <LinhaDeIndicadores>
            <CartaoDeIndicador
              rotulo="Conjuntos cadastrados"
              valor={estado.conjuntos.length}
              tom="neutro"
            />
            <CartaoDeIndicador
              rotulo="Publicado"
              valor={resumo.publicado ? resumo.publicado.versao : '—'}
              apoio={resumo.publicado ? 'classificando pacientes agora' : 'nenhum conjunto publicado'}
              tom="neutro"
            />
            <CartaoDeIndicador
              rotulo="Regras no publicado"
              valor={resumo.publicado ? resumo.publicado.quantidadeDeRegras : 0}
              tom="neutro"
            />
            <CartaoDeIndicador
              rotulo="Aguardam validação clínica"
              valor={resumo.aguardandoValidacao}
              tom="neutro"
            />
          </LinhaDeIndicadores>

          <Bloco
            titulo="Todos os conjuntos"
            descricao="Toque na versão para abrir o detalhe, as regras e o histórico de publicação."
            semPadding
          >
            <Tabela rotulo="Conjuntos de limiares">
              <CabecalhoDaTabela
                colunas={[
                  'Versão',
                  'Descrição',
                  'Origem',
                  'Estado',
                  'Regras',
                  'Criado em',
                  'Publicado em',
                ]}
              />
              <tbody>
                {estado.conjuntos.map((conjunto) => (
                  <LinhaDaTabela key={conjunto.id}>
                    <Celula mono>
                      <Link
                        href={`/admin/limiares/${conjunto.id}`}
                        className="underline decoration-[var(--color-borda-forte)] underline-offset-2 hover:decoration-[var(--color-texto)]"
                      >
                        {conjunto.versao}
                      </Link>
                    </Celula>
                    <Celula>
                      <div className="flex flex-col gap-1">
                        <span>{conjunto.descricao}</span>
                        {!conjunto.validadoClinicamente && <SeloDeNaoValidado />}
                      </div>
                    </Celula>
                    <Celula>{conjunto.origem}</Celula>
                    <Celula>
                      <SeloDoEstado estado={conjunto.estado} />
                    </Celula>
                    <Celula mono>{conjunto.quantidadeDeRegras}</Celula>
                    <Celula mono>{formatarDataEHora(conjunto.criadoEm)}</Celula>
                    <Celula mono>
                      {conjunto.publicadoEm ? formatarDataEHora(conjunto.publicadoEm) : '—'}
                    </Celula>
                  </LinhaDaTabela>
                ))}
              </tbody>
            </Tabela>
          </Bloco>

          <div className="mt-4">
            <Aviso tom="informacao">
              Apenas um conjunto fica no estado publicado por vez. É ele — e só ele — que
              classifica o check-in dos pacientes hoje.
            </Aviso>
          </div>
        </>
      )}
    </>
  );
}
