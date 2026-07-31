'use client';

/**
 * A8 — Orientações mostradas ao paciente por sintoma e classificação.
 *
 * Somente leitura: a fonte de dados não tem escrita para orientações ainda.
 * Simular um editor que não salva seria mentir para quem usa a tela — por isso
 * o aviso abaixo é explícito sobre o que falta (Onda F).
 *
 * Composição refeita conforme o ADR-004: cabeçalho com contexto, indicadores do
 * volume de orientações cadastradas e um bloco por sintoma — em vez de cartões
 * soltos, cada grupo é uma seção identificada dentro da mesma gramática do
 * restante do painel.
 */

import { useEffect, useState } from 'react';
import { Bloco, CabecalhoDePainel, CartaoDeIndicador, LinhaDeIndicadores } from '@/componentes/sistema/painel';
import { Aviso, Carregando, EstadoVazio, SeloDeRisco } from '@/componentes/sistema/primitivos';
import { ErroDaFonte, buscarOrientacoes } from '@/sistema/fonte';
import { ROTULO_DO_SINTOMA } from '@/sistema/formato';
import type { Orientacao, Sintoma } from '@/sistema/tipos';

type Carregamento =
  | { situacao: 'CARREGANDO' }
  | { situacao: 'ERRO'; mensagem: string }
  | { situacao: 'PRONTO'; orientacoes: readonly Orientacao[] };

const GERAL = 'GERAL' as const;

function agruparPorSintoma(
  orientacoes: readonly Orientacao[],
): readonly { chave: Sintoma | typeof GERAL; orientacoes: readonly Orientacao[] }[] {
  const grupos = new Map<Sintoma | typeof GERAL, Orientacao[]>();
  for (const orientacao of orientacoes) {
    const chave = orientacao.sintoma ?? GERAL;
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(orientacao);
    else grupos.set(chave, [orientacao]);
  }
  return Array.from(grupos.entries()).map(([chave, orientacoesDoGrupo]) => ({
    chave,
    orientacoes: orientacoesDoGrupo,
  }));
}

export default function PaginaDeOrientacoes() {
  const [estado, setEstado] = useState<Carregamento>({ situacao: 'CARREGANDO' });

  useEffect(() => {
    buscarOrientacoes()
      .then((orientacoes) => setEstado({ situacao: 'PRONTO', orientacoes }))
      .catch((erro: unknown) => {
        setEstado({
          situacao: 'ERRO',
          mensagem:
            erro instanceof ErroDaFonte ? erro.message : 'Não foi possível carregar as orientações.',
        });
      });
  }, []);

  const grupos = estado.situacao === 'PRONTO' ? agruparPorSintoma(estado.orientacoes) : [];
  const sintomasCobertos = grupos.filter((grupo) => grupo.chave !== GERAL).length;

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Administração' }, { rotulo: 'Orientações' }]}
        titulo="Orientações"
        descricao="Os textos que o paciente recebe ao final do check-in, por sintoma e classificação."
      />

      {/* A tela declara com honestidade a limitação atual: não existe rota de
          escrita para orientações, e fingir um editor que não salva seria
          enganar quem usa a tela. */}
      <div className="mb-6">
        <Aviso tom="informacao" titulo="Edição ainda não disponível">
          A origem de dados atual não tem endpoint de escrita para orientações. Esta tela é
          somente leitura até a Onda F expor a rota de edição.
        </Aviso>
      </div>

      {estado.situacao === 'CARREGANDO' && <Carregando linhas={6} />}

      {estado.situacao === 'ERRO' && (
        <Aviso tom="grave" titulo="Não foi possível carregar as orientações">
          {estado.mensagem}
        </Aviso>
      )}

      {estado.situacao === 'PRONTO' && grupos.length === 0 && (
        <EstadoVazio titulo="Nenhuma orientação cadastrada" />
      )}

      {estado.situacao === 'PRONTO' && grupos.length > 0 && (
        <>
          <LinhaDeIndicadores>
            <CartaoDeIndicador rotulo="Orientações" valor={estado.orientacoes.length} tom="neutro" />
            <CartaoDeIndicador rotulo="Sintomas cobertos" valor={sintomasCobertos} tom="neutro" />
            <CartaoDeIndicador
              rotulo="Gerais"
              valor={grupos.find((g) => g.chave === GERAL)?.orientacoes.length ?? 0}
              apoio="não ligadas a um sintoma específico"
              tom="neutro"
            />
          </LinhaDeIndicadores>

          <div className="flex flex-col gap-4">
            {grupos.map(({ chave, orientacoes }) => (
              <Bloco
                key={chave}
                titulo={chave === GERAL ? 'Geral' : ROTULO_DO_SINTOMA[chave] ?? chave}
                descricao={`${orientacoes.length} orientação(ões) cadastrada(s)`}
                semPadding
              >
                <div className="flex flex-col divide-y divide-[var(--color-borda)]">
                  {orientacoes.map((orientacao) => (
                    <div key={orientacao.id} className="flex flex-col gap-2 px-5 py-4">
                      <div className="flex items-center gap-2">
                        <SeloDeRisco situacao={orientacao.classificacao} />
                        <p className="font-medium text-[var(--color-texto)]">{orientacao.titulo}</p>
                      </div>
                      <p className="text-sm leading-relaxed text-[var(--color-texto-suave)]">
                        {orientacao.texto}
                      </p>
                    </div>
                  ))}
                </div>
              </Bloco>
            ))}
          </div>
        </>
      )}
    </>
  );
}
