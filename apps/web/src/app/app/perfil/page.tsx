'use client';

/**
 * P10 — Seu tratamento.
 *
 * Duas coisas moram aqui, e a ordem entre elas é a decisão da tela.
 *
 * PRIMEIRO O MURAL. É o conteúdo que a pessoa veio buscar: os sintomas que o AUREA
 * acompanha no tratamento dela, explicados no ritmo dela. Existe porque na primeira
 * consulta o médico e a enfermagem passam, de uma vez, mais informação do que
 * qualquer um absorve numa sessão — e o que não coube vira dúvida guardada até o
 * retorno seguinte, que pode ser em três semanas.
 *
 * DEPOIS O CADASTRO. Protocolo, médico assistente, telefones e alergias são
 * consulta pontual: importam no dia em que alguém pede. Ficavam no topo antes, e o
 * resultado era uma tela em que o dado administrativo tinha a primeira posição e o
 * conteúdo clínico não existia.
 *
 * No desktop os dois viram colunas: mural na larga, cadastro na estreita. No
 * celular empilham, mural na frente.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  apelidoDoSintoma,
  MURAL_DE_SINTOMAS,
  MURAL_VALIDADO_CLINICAMENTE,
} from '@aurea/contratos';
import {
  CartaoExpansivel,
  useCartaoAberto,
} from '@/componentes/sistema/cartao-expansivel';
import { Bloco, CabecalhoDePainel } from '@/componentes/sistema/painel';
import { ConteudoDoVerbete } from '@/componentes/sistema/verbete-do-mural';
import {
  Aviso,
  Carregando,
  Medida,
  Rotulo,
  SeloDeNaoValidado,
} from '@/componentes/sistema/primitivos';
import { buscarPerfilDoPaciente } from '@/sistema/fonte';
import { formatarDataPorExtenso, formatarTelefone, ROTULO_DA_FUNCAO } from '@/sistema/formato';
import type { PerfilDoPaciente } from '@/sistema/tipos';

type Fase = 'carregando' | 'erro' | 'pronto';

export default function PaginaDePerfil() {
  const [fase, setFase] = useState<Fase>('carregando');
  const [perfil, setPerfil] = useState<PerfilDoPaciente | null>(null);

  useEffect(() => {
    let cancelado = false;
    buscarPerfilDoPaciente()
      .then((dados) => {
        if (cancelado) return;
        setPerfil(dados);
        setFase('pronto');
      })
      .catch(() => {
        if (!cancelado) setFase('erro');
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (fase === 'carregando') {
    return <Carregando linhas={5} />;
  }

  if (fase === 'erro' || !perfil) {
    return (
      <Aviso tom="grave" titulo="Algo não carregou">
        Não foi possível carregar seu perfil agora. Tente novamente em instantes.
      </Aviso>
    );
  }

  const { tratamento, ciclo, medicoAssistente, contatos, alergias } = perfil;
  const semContatos = contatos.doPaciente.length === 0 && contatos.deEmergencia.length === 0;

  return (
    <>
      <CabecalhoDePainel
        titulo="Seu tratamento"
        descricao="O que a equipe explicou na consulta, para reler quando quiser, e os seus dados de cadastro."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-5">
          <Bloco titulo="Protocolo">
            <div className="flex flex-col gap-2">
              {tratamento ? (
                <p className="text-base text-[var(--color-texto)]">{tratamento.protocolo.nome}</p>
              ) : (
                <p className="text-sm text-[var(--color-texto-suave)]">
                  Nenhum tratamento registrado.
                </p>
              )}
              {ciclo && (
                <p className="text-sm text-[var(--color-texto-suave)]">
                  Ciclo <Medida>{ciclo.numero}</Medida>, dia <Medida>{ciclo.diaDoCiclo}</Medida>
                </p>
              )}
              {ciclo?.previsaoDaProximaSessao && (
                <p className="text-sm text-[var(--color-texto-suave)]">
                  Próxima sessão: {formatarDataPorExtenso(ciclo.previsaoDaProximaSessao)}
                </p>
              )}
            </div>
          </Bloco>

          <MuralDeSintomas />
        </div>

        <div className="flex flex-col gap-5">
          {medicoAssistente && (
            <Bloco titulo="Médico assistente">
              <div className="flex flex-col gap-1">
                <p className="text-base text-[var(--color-texto)]">{medicoAssistente.nome}</p>
                <p className="text-sm text-[var(--color-texto-suave)]">
                  {ROTULO_DA_FUNCAO[medicoAssistente.funcao]}, {medicoAssistente.registroDoConselho}
                </p>
              </div>
            </Bloco>
          )}

          <Bloco titulo="Contatos">
            {semContatos ? (
              <p className="text-sm text-[var(--color-texto-suave)]">Nenhum contato registrado.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {contatos.doPaciente.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <Rotulo>Seus contatos</Rotulo>
                    {contatos.doPaciente.map((contato) => (
                      <p key={contato.id} className="text-sm text-[var(--color-texto)]">
                        {contato.nome}, <Medida>{formatarTelefone(contato.telefone)}</Medida>
                      </p>
                    ))}
                  </div>
                )}
                {contatos.deEmergencia.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <Rotulo>Contato de emergência</Rotulo>
                    {contatos.deEmergencia.map((contato) => (
                      <p key={contato.id} className="text-sm text-[var(--color-texto)]">
                        {contato.nome}
                        {contato.relacao ? ` (${contato.relacao})` : ''},{' '}
                        <Medida>{formatarTelefone(contato.telefone)}</Medida>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Bloco>

          <Bloco
            titulo="Alergias"
            acao={
              <Link
                href="/app/perfil/alergias"
                className="text-sm text-[var(--color-texto-suave)] underline underline-offset-4 hover:text-[var(--color-texto)]"
              >
                Ver e adicionar
              </Link>
            }
          >
            {alergias.length === 0 ? (
              <p className="text-sm text-[var(--color-texto-suave)]">Nenhuma alergia registrada.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {alergias.map((alergia) => (
                  <li key={alergia.id} className="text-sm text-[var(--color-texto)]">
                    {alergia.substancia}
                    {alergia.reacao ? `, ${alergia.reacao}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
        </div>
      </div>
    </>
  );
}

/**
 * O mural.
 *
 * Cartão por sintoma, com o resumo à vista antes de qualquer clique — quem só passa
 * o olho já leva a frase que importa. O texto longo fica a um toque de distância,
 * porque cinco explicações abertas de uma vez são uma parede que ninguém lê.
 *
 * A marca de não validado clinicamente é obrigatória enquanto ninguém com
 * responsabilidade clínica assinar estes textos. Não é ressalva jurídica: é a
 * mesma regra 1 do ADR-001 que vale para os cortes de risco.
 */
function MuralDeSintomas() {
  const cartoes = useCartaoAberto();

  return (
    <Bloco
      titulo="O que pode aparecer no seu tratamento"
      acao={MURAL_VALIDADO_CLINICAMENTE ? undefined : <SeloDeNaoValidado />}
    >
      <p className="mb-4 text-sm leading-relaxed text-[var(--color-texto-suave)]">
        São os sintomas sobre os quais o AUREA pergunta todos os dias. Toque em um para
        ler o que costuma acontecer, o que dá para fazer em casa e em que momento vale
        procurar a equipe.
      </p>

      {/* Uma coluna, não duas. Cartão que abre no lugar precisa empurrar só o que está
          abaixo dele; em duas colunas o vizinho de linha salta junto e a pessoa perde
          de vista o que acabou de tocar. */}
      <ul className="flex flex-col gap-3">
        {MURAL_DE_SINTOMAS.map((verbete) => (
          <li key={verbete.sintoma}>
            <CartaoExpansivel
              titulo={verbete.titulo}
              resumo={verbete.resumo}
              aberto={cartoes.estaAberto(verbete.sintoma)}
              aoAlternar={() => cartoes.alternar(verbete.sintoma)}
            >
              <ConteudoDoVerbete verbete={verbete} />
              <p className="mt-6 border-t border-[var(--color-borda)] pt-4 text-sm">
                <Link
                  href={`/app/perfil/sintomas/${apelidoDoSintoma(verbete.sintoma)}`}
                  className="text-[var(--color-texto-suave)] underline underline-offset-4 hover:text-[var(--color-texto)]"
                >
                  Abrir só este assunto
                </Link>
              </p>
            </CartaoExpansivel>
          </li>
        ))}
      </ul>
    </Bloco>
  );
}
