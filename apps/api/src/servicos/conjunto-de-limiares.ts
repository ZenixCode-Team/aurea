import type { ConjuntoDeLimiares, Operador, Sintoma } from '@aurea/contratos';
import { conferirIntegridadeDoConjunto } from '@aurea/triagem';
import { prisma } from '../prisma.js';
import { ErroDaApi, naoEncontrado } from '../erros.js';

/**
 * Carrega o conjunto de limiares do banco e o entrega ao motor no formato dele.
 *
 * É aqui que a regra 1 do ADR-001 encosta na realidade: o motor não tem nenhum número
 * clínico dentro, e todo corte que ele aplica passou por esta função. Trocar o algoritmo
 * do AUREA é publicar uma linha nova em `conjuntos_de_limiares` — não é deploy.
 */

function paraNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  // Prisma devolve Decimal, que tem toNumber. Number() sozinho não dá conta do objeto.
  if (typeof valor === 'object' && 'toNumber' in valor) {
    return (valor as { toNumber: () => number }).toNumber();
  }
  return Number(valor);
}

function paraListaDeTexto(valor: unknown): string[] | undefined {
  if (!Array.isArray(valor)) return undefined;
  return valor.filter((item): item is string => typeof item === 'string');
}

export async function carregarConjuntoAtivo(): Promise<ConjuntoDeLimiares> {
  const registro = await prisma.conjuntoDeLimiares.findFirst({
    where: { ativo: true },
    include: { regras: { orderBy: { ordem: 'asc' } } },
  });

  if (!registro) {
    // Sem conjunto ativo o sistema não classifica. Devolver verde seria inventar
    // segurança que não existe; devolver erro deixa a falha visível.
    throw new ErroDaApi(
      503,
      'Nenhum conjunto de limiares está publicado. O sistema não classifica sem algoritmo ativo.',
    );
  }

  return montar(registro);
}

export async function carregarConjuntoPorId(id: string): Promise<ConjuntoDeLimiares> {
  const registro = await prisma.conjuntoDeLimiares.findUnique({
    where: { id },
    include: { regras: { orderBy: { ordem: 'asc' } } },
  });

  if (!registro) throw naoEncontrado('Conjunto de limiares não encontrado.');

  return montar(registro);
}

type RegistroComRegras = Awaited<ReturnType<typeof prisma.conjuntoDeLimiares.findFirstOrThrow>> & {
  regras: Array<{
    id: string;
    ordem: number;
    sintoma: Sintoma;
    campo: string;
    operador: Operador;
    valor: unknown;
    valorSecundario: unknown;
    valoresDeTexto: unknown;
    classificacao: 'VERDE' | 'AMARELO' | 'VERMELHO';
    justificativa: string;
    diaDoCicloMinimo: number | null;
    diaDoCicloMaximo: number | null;
    protocoloId: string | null;
  }>;
};

function montar(registro: RegistroComRegras): ConjuntoDeLimiares {
  return {
    id: registro.id,
    versao: registro.versao,
    descricao: registro.descricao,
    origem: registro.origem,
    validadoClinicamente: registro.validadoClinicamente,
    politica: {
      combinacao: registro.combinacao,
      efeitoDoAntitermico: registro.efeitoDoAntitermico,
      tratamentoDeAbandono: registro.tratamentoDeAbandono,
    },
    regras: registro.regras.map((regra) => ({
      id: regra.id,
      ordem: regra.ordem,
      sintoma: regra.sintoma,
      campo: regra.campo,
      operador: regra.operador,
      valor: paraNumero(regra.valor),
      valorSecundario: paraNumero(regra.valorSecundario),
      valoresDeTexto: paraListaDeTexto(regra.valoresDeTexto),
      classificacao: regra.classificacao,
      justificativa: regra.justificativa,
      diaDoCicloMinimo: regra.diaDoCicloMinimo,
      diaDoCicloMaximo: regra.diaDoCicloMaximo,
      protocoloId: regra.protocoloId,
    })),
  };
}

/**
 * Roda antes de ativar um conjunto. Regra que aponta para campo inexistente na árvore
 * nunca dispara: é um corte que a equipe pensa que está valendo e não está. Silencioso
 * e perigoso — por isso a publicação falha em vez de avisar.
 */
export async function ativarConjunto(id: string): Promise<void> {
  const conjunto = await carregarConjuntoPorId(id);
  const problemas = conferirIntegridadeDoConjunto(conjunto);

  if (problemas.length > 0) {
    throw new ErroDaApi(422, 'Conjunto incoerente com a árvore de triagem.', problemas);
  }

  await prisma.$transaction([
    prisma.conjuntoDeLimiares.updateMany({ where: { ativo: true }, data: { ativo: false } }),
    prisma.conjuntoDeLimiares.update({
      where: { id },
      data: { ativo: true, publicadoEm: new Date() },
    }),
  ]);
}
