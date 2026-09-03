'use client';

/**
 * Bloco 7 dos prints — acompanhamento de intervenções.
 *
 * Responde a pergunta que ficava sem dono: o que aconteceu DEPOIS que a enfermagem
 * ligou. Antes desta tela a intervenção era registrada no prontuário e desaparecia;
 * o follow-up vivia na memória de quem atendeu, e memória não passa de plantão para
 * plantão.
 *
 * ## Duas decisões de leitura
 *
 * **Aberto primeiro, resolvido só sob pedido.** A pergunta do plantão é sobre
 * pendência. Histórico completo existe atrás de um botão, não na frente.
 *
 * **A cor é do desfecho, não da classificação.** "Encaminhado ao pronto atendimento"
 * é vermelho porque o caso saiu daqui para outro serviço, e não porque a triagem
 * classificou vermelho — as duas coisas costumam coincidir e não são a mesma. A
 * classificação de origem aparece em selo próprio, ao lado, dita por palavra.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  CabecalhoDePainel,
  CartaoDeIndicador,
  LinhaDeIndicadores,
} from '@/componentes/sistema/painel';
import {
  Aviso,
  Botao,
  CabecalhoDaTabela,
  Carregando,
  Celula,
  EstadoVazio,
  LinhaDaTabela,
  Tabela,
  juntar,
} from '@/componentes/sistema/primitivos';
import { ErroDaFonte, buscarAcompanhamentoDeIntervencoes } from '@/sistema/fonte';
import { ROTULO_DO_DESFECHO, formatarDataEHora } from '@/sistema/formato';
import type {
  AcompanhamentoDeIntervencoes,
  IntervencaoEmAcompanhamento,
  SituacaoDoSintoma,
} from '@/sistema/tipos';

/**
 * Ordem de leitura da tabela.
 *
 * Encaminhado ao PA no topo porque é o único desfecho em que o paciente saiu do
 * alcance desta equipe: se algo ficou pendente ali, ninguém aqui vai perceber
 * sozinho. Resolvido por último porque não pede ação.
 */
const PESO_DO_DESFECHO: Record<SituacaoDoSintoma, number> = {
  ENCAMINHADO_AO_PA: 0,
  AGUARDANDO_RETORNO: 1,
  REAVALIAR: 2,
  EM_ACOMPANHAMENTO: 3,
  RESOLVIDO: 4,
};

/** Neutros do sistema, salvo o encaminhamento. Ver o comentário do topo. */
const COR_DO_DESFECHO: Record<SituacaoDoSintoma, string> = {
  ENCAMINHADO_AO_PA: 'var(--color-risco-vermelho)',
  AGUARDANDO_RETORNO: 'var(--color-texto-fraco)',
  REAVALIAR: 'var(--color-texto-fraco)',
  EM_ACOMPANHAMENTO: 'var(--color-texto-fraco)',
  RESOLVIDO: 'var(--color-risco-silencio)',
};

const ROTULO_DO_SINTOMA: Record<string, string> = {
  FEBRE: 'Febre',
  DIARREIA: 'Diarreia',
  NAUSEA_VOMITO: 'Náusea e vômito',
  DOR: 'Dor',
  FALTA_DE_AR: 'Falta de ar',
};

export default function PaginaDeAcompanhamentoDeIntervencoes() {
  const [dados, setDados] = useState<AcompanhamentoDeIntervencoes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [incluirResolvidas, setIncluirResolvidas] = useState(false);

  /* O reset de estado mora no clique que muda o filtro, e não aqui: `setState`
     síncrono dentro de efeito dispara renderização em cascata, e o lint do projeto
     barra com razão. */
  useEffect(() => {
    let cancelado = false;

    buscarAcompanhamentoDeIntervencoes(incluirResolvidas)
      .then((resultado) => {
        if (!cancelado) setDados(resultado);
      })
      .catch((motivo: unknown) => {
        if (cancelado) return;
        setErro(
          motivo instanceof ErroDaFonte
            ? motivo.message
            : 'Não foi possível carregar as intervenções.',
        );
      });

    return () => {
      cancelado = true;
    };
  }, [incluirResolvidas]);

  const linhas = useMemo(() => {
    if (!dados) return [];
    return [...dados.itens].sort((a, b) => {
      const porDesfecho = PESO_DO_DESFECHO[a.situacao] - PESO_DO_DESFECHO[b.situacao];
      if (porDesfecho !== 0) return porDesfecho;
      /* Dentro do mesmo desfecho, o mais antigo primeiro: quem espera há mais tempo
         é quem corre risco de ser esquecido. */
      return (
        new Date(a.registradaEm).getTime() - new Date(b.registradaEm).getTime()
      );
    });
  }, [dados]);

  return (
    <>
      <CabecalhoDePainel
        trilha={[{ rotulo: 'Plantão', href: '/painel' }, { rotulo: 'Intervenções' }]}
        titulo="Acompanhamento de intervenções"
        descricao="O que aconteceu depois do contato. Intervenção sem desfecho registrado é paciente esperando retorno que ninguém sabe que prometeu."
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
            <CartaoDeIndicador rotulo="Em aberto" valor={dados.resumo.abertas} />
            <CartaoDeIndicador
              rotulo="Encaminhados ao PA"
              valor={linhas.filter((i) => i.situacao === 'ENCAMINHADO_AO_PA').length}
            />
            <CartaoDeIndicador
              rotulo="Aguardando retorno"
              valor={linhas.filter((i) => i.situacao === 'AGUARDANDO_RETORNO').length}
            />
            <CartaoDeIndicador
              rotulo="A reavaliar"
              valor={linhas.filter((i) => i.situacao === 'REAVALIAR').length}
            />
          </LinhaDeIndicadores>

          <div className="mb-4 flex justify-end">
            <Botao
              variante="secundario"
              onClick={() => {
                setDados(null);
                setErro(null);
                setIncluirResolvidas((atual) => !atual);
              }}
            >
              {incluirResolvidas ? 'Mostrar só as abertas' : 'Incluir resolvidas'}
            </Botao>
          </div>

          {linhas.length === 0 ? (
            <EstadoVazio
              titulo="Nenhuma intervenção em aberto"
              descricao="Toda intervenção registrada foi encerrada. Isso é bom, e também vale conferir se alguma deixou de ser registrada."
            />
          ) : (
            <Tabela rotulo="Intervenções em acompanhamento" larguraMinima="58rem">
              <CabecalhoDaTabela
                colunas={[
                  { rotulo: 'Paciente', largura: '14rem' },
                  { rotulo: 'Motivo' },
                  { rotulo: 'Situação', largura: '10rem' },
                  { rotulo: 'Conduta' },
                  { rotulo: 'Registrada', largura: '7.5rem' },
                ]}
              />
              <tbody>
                {linhas.map((item) => (
                  <LinhaDeIntervencao key={item.id} item={item} />
                ))}
              </tbody>
            </Tabela>
          )}
        </>
      )}
    </>
  );
}

function LinhaDeIntervencao({ item }: { item: IntervencaoEmAcompanhamento }) {
  return (
    <LinhaDaTabela>
      <Celula>
        <a
          href={`/painel/pacientes/${item.pacienteId}`}
          className="font-medium text-[var(--color-texto)] underline-offset-2 hover:underline"
        >
          {item.paciente}
        </a>
      </Celula>

      <Celula>
        <span className="text-[var(--color-texto)]">
          {item.motivo ? (ROTULO_DO_SINTOMA[item.motivo] ?? item.motivo) : 'não registrado'}
        </span>
        {item.justificativa && (
          <span className="mt-0.5 block text-xs text-[var(--color-texto-fraco)]">
            {item.justificativa}
          </span>
        )}
      </Celula>

      <Celula>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: COR_DO_DESFECHO[item.situacao] }}
          />
          <span
            className={juntar(
              'text-[var(--color-texto)]',
              item.situacao === 'ENCAMINHADO_AO_PA' && 'font-medium',
            )}
          >
            {ROTULO_DO_DESFECHO[item.situacao] ?? item.situacao}
          </span>
        </span>
      </Celula>

      <Celula>
        <span className="block max-w-md text-[var(--color-texto-suave)]">
          {item.conduta}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--color-texto-fraco)]">
          {item.profissional}
        </span>
      </Celula>

      <Celula>
        <span className="whitespace-nowrap text-[var(--color-texto-fraco)]">
          {formatarDataEHora(item.registradaEm)}
        </span>
      </Celula>
    </LinhaDaTabela>
  );
}
