import type { Classificacao, Sintoma } from '@aurea/contratos';
import { classificar, type RespostaCrua } from '@aurea/triagem';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { carregarConjuntoAtivo } from './conjunto-de-limiares.js';
import { calcularDiaDoCiclo as calcularDia } from '../tempo.js';

/**
 * Reexportado de `src/tempo.ts`, que é a única fonte de conta de data do sistema.
 * Antes esta função fazia o cálculo em UTC por conta própria enquanto o painel
 * fazia na hora local do processo — as duas coincidiam na máquina do
 * desenvolvedor e divergiam em produção. Continua exportada daqui porque é aqui
 * que os consumidores já a importam.
 */
export { calcularDiaDoCiclo } from '../tempo.js';

function paraNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'object' && 'toNumber' in valor) {
    return (valor as { toNumber: () => number }).toNumber();
  }
  return Number(valor);
}

export interface ResultadoDaTriagem {
  readonly classificacaoId: string;
  readonly situacao: 'CLASSIFICADA' | 'NAO_CLASSIFICADA';
  readonly resultado: Classificacao | null;
  readonly versaoDoConjunto: string;
  readonly validadoClinicamente: boolean;
  readonly explicacao: unknown;
}

/**
 * Classifica uma sessão e grava o resultado.
 *
 * A classificação é sempre feita no servidor, com respostas relidas do banco. Nunca a
 * partir do que o cliente mandou junto: o cliente informa sintoma, o servidor decide
 * risco. Confiar na classificação enviada pelo aplicativo seria deixar o dispositivo do
 * paciente definir se a enfermagem é acionada.
 */
export async function classificarSessao(
  sessaoId: string,
  opcoes: {
    origem?: 'ORIGINAL' | 'REPROCESSAMENTO';
    /**
     * Cliente da transação em curso. Classificar precisa acontecer DENTRO da mesma
     * transação que gravou a resposta crua: separadas, uma corrida grava a resposta de
     * um envio e a classificação de outro, e o banco fica com 41 °C classificado como
     * verde — permanentemente, porque a classificação ORIGINAL é imutável.
     */
    cliente?: Pick<
      typeof prisma,
      'sessaoDeTriagem' | 'classificacao_' | 'conjuntoDeLimiares'
    >;
  } = {},
): Promise<ResultadoDaTriagem> {
  const banco = (opcoes.cliente ?? prisma) as typeof prisma;

  const sessao = await banco.sessaoDeTriagem.findUniqueOrThrow({
    where: { id: sessaoId },
    include: {
      respostas: true,
      ciclo: { include: { tratamento: { select: { protocoloId: true } } } },
    },
  });

  const conjunto = await carregarConjuntoAtivo();

  const respostas: RespostaCrua[] = sessao.respostas.map((resposta) => ({
    sintoma: resposta.sintoma as Sintoma,
    campo: resposta.campo,
    valorNumerico: paraNumero(resposta.valorNumerico),
    valorBooleano: resposta.valorBooleano,
    valorTexto: resposta.valorTexto,
  }));

  const momento = sessao.concluidaEm ?? sessao.iniciadaEm;

  const saida = classificar(respostas, conjunto, {
    diaDoCiclo: sessao.ciclo ? calcularDia(sessao.ciclo.sessaoRealizadaEm, momento) : null,
    protocoloId: sessao.ciclo?.tratamento.protocoloId ?? null,
    sessaoAbandonada: sessao.estado !== 'CONCLUIDA',
  });

  const comum = {
    sessaoId,
    conjuntoDeLimiaresId: conjunto.id,
    origem: opcoes.origem ?? 'ORIGINAL',
  } as const;

  const dados: Prisma.Classificacao_UncheckedCreateInput =
    saida.situacao === 'CLASSIFICADA'
      ? {
          ...comum,
          situacao: 'CLASSIFICADA',
          resultado: saida.resultado,
          explicacao: saida.explicacao as unknown as Prisma.InputJsonValue,
        }
      : {
          ...comum,
          situacao: 'NAO_CLASSIFICADA',
          resultado: null,
          motivoDeNaoClassificar: saida.motivo,
          explicacao: {
            sintomasRespondidos: saida.sintomasRespondidos,
          } as unknown as Prisma.InputJsonValue,
        };

  // A classificação ORIGINAL é imutável. Nunca, em hipótese nenhuma, é sobrescrita.
  //
  // Isto já foi um defeito real neste arquivo: o upsert reescrevia a linha existente,
  // inclusive `origem`. O caminho para o dano era discreto — reprocessar o histórico sob
  // o conjunto que está ATIVO casa com a chave (sessaoId, conjuntoDeLimiaresId) da linha
  // original, e cada `ORIGINAL` virava um `REPROCESSAMENTO` reescrito. A contagem de
  // linhas ficava idêntica, então nenhum teste de "antes e depois" acusava nada, e o
  // experimento da dissertação — "o que mudou quando o corte de febre desceu de 38,5
  // para 38,0" — perdia justamente o "antes".
  const existente = await banco.classificacao_.findUnique({
    where: {
      sessaoId_conjuntoDeLimiaresId: { sessaoId, conjuntoDeLimiaresId: conjunto.id },
    },
    select: { id: true, origem: true },
  });

  let registro: { id: string };

  if (!existente) {
    registro = await banco.classificacao_.create({ data: dados });
  } else if (existente.origem === 'ORIGINAL') {
    // Reprocessar sob o mesmo conjunto que já produziu a original é operação sem
    // efeito: o motor é função pura das mesmas respostas. Devolve a que existe.
    registro = existente;
  } else {
    const { sessaoId: _mesmaSessao, conjuntoDeLimiaresId: _mesmoConjunto, ...camposAtualizaveis } = dados;
    registro = await banco.classificacao_.update({
      where: { id: existente.id },
      data: {
        ...camposAtualizaveis,
        motivoDeNaoClassificar: dados.motivoDeNaoClassificar ?? null,
        calculadaEm: new Date(),
      },
    });
  }

  return {
    classificacaoId: registro.id,
    situacao: saida.situacao,
    resultado: saida.situacao === 'CLASSIFICADA' ? saida.resultado : null,
    versaoDoConjunto: conjunto.versao,
    validadoClinicamente: conjunto.validadoClinicamente,
    explicacao: saida.situacao === 'CLASSIFICADA' ? saida.explicacao : { motivo: saida.motivo },
  };
}

/** O ciclo aberto mais recente do paciente, se houver. */
export async function cicloAtualDoPaciente(pacienteId: string) {
  return prisma.ciclo.findFirst({
    where: { tratamento: { pacienteId, encerradoEm: null } },
    orderBy: { sessaoRealizadaEm: 'desc' },
  });
}
