import type { Classificacao, Sintoma } from '@aurea/contratos';
import { prisma } from '../prisma.js';

export interface OrientacaoParaOPaciente {
  readonly id: string;
  readonly sintoma: Sintoma;
  readonly classificacao: Classificacao;
  readonly titulo: string;
  readonly corpo: string;
  readonly verbeteId: string | null;
}

/**
 * Monta a tela 7 e registra o que foi entregue.
 *
 * Regra 8 do ADR-001 mora aqui: orientação que nomeia medicamento só sai para quem tem
 * aquele medicamento prescrito e ativo. Sugerir remédio não prescrito, ou dose, sai do
 * campo de orientação e entra no de conduta médica — e o AUREA não pode fazer isso.
 *
 * Como a preferência funciona: para o mesmo par sintoma + cor pode haver mais de um
 * texto, e o campo `ordem` é a preferência. O primeiro que passar no filtro da prescrição
 * é o entregue, e só ele. É isso que permite manter a versão que cita o remédio (ordem 1)
 * ao lado da versão que orienta sem nomear (ordem 2) sem entregar as duas.
 */
export async function entregarOrientacoes(
  sessaoId: string,
  pacienteId: string,
  porSintoma: ReadonlyArray<{ sintoma: Sintoma; classificacao: Classificacao }>,
): Promise<OrientacaoParaOPaciente[]> {
  const relevantes = porSintoma.filter((item) => item.classificacao !== 'VERDE');
  if (relevantes.length === 0) return [];

  const conjunto = await prisma.conjuntoDeOrientacoes.findFirst({ where: { ativo: true } });
  if (!conjunto) return [];

  const hoje = new Date();
  const prescricoes = await prisma.prescricao.findMany({
    where: {
      pacienteId,
      iniciadaEm: { lte: hoje },
      OR: [{ encerradaEm: null }, { encerradaEm: { gte: hoje } }],
    },
    select: { medicamentoId: true },
  });
  const medicamentosPrescritos = new Set(prescricoes.map((p) => p.medicamentoId));

  const candidatas = await prisma.orientacao.findMany({
    where: {
      conjuntoId: conjunto.id,
      OR: relevantes.map((item) => ({
        sintoma: item.sintoma,
        classificacao: item.classificacao,
      })),
    },
    orderBy: [{ sintoma: 'asc' }, { classificacao: 'asc' }, { ordem: 'asc' }],
  });

  const escolhidas: OrientacaoParaOPaciente[] = [];
  const jaEscolhido = new Set<string>();

  for (const candidata of candidatas) {
    const chave = `${candidata.sintoma}.${candidata.classificacao}`;
    if (jaEscolhido.has(chave)) continue;

    if (candidata.medicamentoId && !medicamentosPrescritos.has(candidata.medicamentoId)) {
      continue;
    }

    jaEscolhido.add(chave);
    escolhidas.push({
      id: candidata.id,
      sintoma: candidata.sintoma as Sintoma,
      classificacao: candidata.classificacao as Classificacao,
      titulo: candidata.titulo,
      corpo: candidata.corpo,
      verbeteId: candidata.verbeteId,
    });
  }

  if (escolhidas.length > 0) {
    await prisma.orientacaoEntregue.createMany({
      data: escolhidas.map((orientacao) => ({ sessaoId, orientacaoId: orientacao.id })),
      skipDuplicates: true,
    });
  }

  return escolhidas;
}

/**
 * Avisa a enfermagem quando o resultado é amarelo ou vermelho.
 *
 * O alerta ainda não tem dono nem prazo: não existe regra de escala, de horário nem de
 * tempo máximo de retorno, e enquanto não existir, a notificação vai para todo mundo com
 * permissão de plantão. Está registrado como pendência no ADR-001 e é decisão de
 * segurança clínica, não de programação.
 *
 * O canal também é provisório: NO_APP até o ADR de notificação decidir entre PWA,
 * WhatsApp e SMS.
 */
export async function avisarEnfermagem(
  pacienteNome: string,
  sessaoId: string,
  resultado: Classificacao,
): Promise<number> {
  if (resultado === 'VERDE') return 0;

  const dePlantao = await prisma.concessaoDePermissao.findMany({
    where: { permissao: 'ATENDER_PLANTAO', revogadaEm: null },
    select: { usuarioId: true },
  });

  if (dePlantao.length === 0) return 0;

  const assunto =
    resultado === 'VERMELHO'
      ? `Alerta vermelho: ${pacienteNome}`
      : `Atenção: ${pacienteNome}`;

  await prisma.notificacao.createMany({
    data: dePlantao.map((concessao) => ({
      destinatarioId: concessao.usuarioId,
      canal: 'NO_APP' as const,
      assunto,
      corpo: `Check-in classificado como ${resultado.toLowerCase()}. Abra o histórico do paciente.`,
      referenciaTipo: 'SessaoDeTriagem',
      referenciaId: sessaoId,
      enviadaEm: new Date(),
    })),
  });

  return dePlantao.length;
}
