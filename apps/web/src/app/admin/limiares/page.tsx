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

/**
 * O selo diz o estado; a consequencia clinica vem na linha de apoio embaixo dele.
 * "Publicado, classificando agora" dentro da pilula davam 30 caracteres em versalete
 * espacejado numa coluna estreita: quebrava em tres linhas e o `rounded-full` virava
 * uma bolha preta.
 */
const ROTULO_DO_ESTADO: Record<EstadoDoConjunto, string> = {
  PUBLICADO: 'Publicado',
  RASCUNHO: 'Rascunho',
  ARQUIVADO: 'Arquivado',
};

function SeloDoEstado({ estado }: { estado: EstadoDoConjunto }) {
  return (
    <span
      className={juntar(
        'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5',
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
              valor={resumo.publicado ? resumo.publicado.versao : 'nenhum'}
              apoio={resumo.publicado ? 'classificando pacientes agora' : 'nenhum conjunto publicado'}
              formato="texto"
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
            {/* Descricao e origem sao prosa de 200 caracteres, nao dado tabular. Como
                colunas proprias elas disputavam a mesma largura das datas e acabavam
                com duas palavras por linha. Aqui a origem desce como linha secundaria
                da descricao, as duas ficam presas a duas linhas, e o texto inteiro
                mora no detalhe do conjunto, que e para onde a linha leva. */}
            <Tabela rotulo="Conjuntos de limiares" larguraMinima="68rem">
              <CabecalhoDaTabela
                colunas={[
                  { rotulo: 'Versão', largura: '10rem' },
                  { rotulo: 'Descrição' },
                  { rotulo: 'Estado', largura: '15rem' },
                  { rotulo: 'Regras', largura: '6rem', alinhamento: 'direita' },
                  { rotulo: 'Criado em', largura: '11rem' },
                  { rotulo: 'Publicado em', largura: '11rem' },
                ]}
              />
              <tbody>
                {estado.conjuntos.map((conjunto) => (
                  <LinhaDaTabela key={conjunto.id}>
                    <Celula mono inteira>
                      <Link
                        href={`/admin/limiares/${conjunto.id}`}
                        className="underline decoration-[var(--color-borda-forte)] underline-offset-2 hover:decoration-[var(--color-texto)]"
                      >
                        {conjunto.versao}
                      </Link>
                    </Celula>
                    <Celula>
                      <p className="line-clamp-2" title={conjunto.descricao}>
                        {conjunto.descricao}
                      </p>
                      <p
                        className="mt-1 line-clamp-2 text-xs text-[var(--color-texto-fraco)]"
                        title={conjunto.origem}
                      >
                        Origem: {conjunto.origem}
                      </p>
                    </Celula>
                    <Celula>
                      <div className="flex flex-col items-start gap-1.5">
                        <SeloDoEstado estado={conjunto.estado} />
                        {conjunto.estado === 'PUBLICADO' && (
                          <span className="text-xs text-[var(--color-texto-fraco)]">
                            classificando pacientes agora
                          </span>
                        )}
                        {!conjunto.validadoClinicamente && <SeloDeNaoValidado />}
                      </div>
                    </Celula>
                    <Celula mono inteira alinhamento="direita">
                      {conjunto.quantidadeDeRegras}
                    </Celula>
                    <Celula mono inteira>{formatarDataEHora(conjunto.criadoEm)}</Celula>
                    <Celula mono inteira>
                      {conjunto.publicadoEm ? formatarDataEHora(conjunto.publicadoEm) : 'não publicado'}
                    </Celula>
                  </LinhaDaTabela>
                ))}
              </tbody>
            </Tabela>
          </Bloco>

          <div className="mt-4">
            <Aviso tom="informacao">
              Apenas um conjunto fica no estado publicado por vez. É ele, e só ele, que
              classifica o check-in dos pacientes hoje.
            </Aviso>
          </div>
        </>
      )}
    </>
  );
}
