import { ambiente } from '../ambiente.js';
import { prisma } from '../prisma.js';
import { classificarSessao } from './triagem.js';

/**
 * Fecha as sessões de check-in que o paciente começou e não terminou.
 *
 * Sem isto, quem abandona o questionário no meio fica `EM_ANDAMENTO` para sempre, e a
 * política `tratamentoDeAbandono` do conjunto de limiares — que é uma das seis decisões
 * clínicas em aberto — nunca chega a ser exercida. O motor sabia tratar abandono desde o
 * primeiro dia; faltava alguém puxar o gatilho.
 *
 * Abandonar não é o mesmo que responder verde. As duas causas mais prováveis de parar no
 * meio são opostas: a pessoa está bem e se distraiu, ou está mal demais para continuar.
 * Por isso a sessão abandonada é classificada, e o resultado depende da política — hoje o
 * conjunto de demonstração usa `NAO_CLASSIFICAR`, que grava a ausência de classificação
 * em vez de inventar uma cor.
 */

export interface ResultadoDaManutencao {
  readonly encerradas: number;
  readonly classificadas: number;
  readonly falhas: number;
}

export async function encerrarSessoesAbandonadas(
  agora: Date = new Date(),
): Promise<ResultadoDaManutencao> {
  const limite = new Date(agora.getTime() - ambiente.HORAS_ATE_ABANDONO * 60 * 60 * 1000);

  const paradas = await prisma.sessaoDeTriagem.findMany({
    where: { estado: 'EM_ANDAMENTO', iniciadaEm: { lt: limite } },
    select: { id: true },
  });

  if (paradas.length === 0) {
    return { encerradas: 0, classificadas: 0, falhas: 0 };
  }

  await prisma.sessaoDeTriagem.updateMany({
    where: { id: { in: paradas.map((sessao) => sessao.id) } },
    data: { estado: 'ABANDONADA' },
  });

  let classificadas = 0;
  let falhas = 0;

  for (const sessao of paradas) {
    try {
      await classificarSessao(sessao.id);
      classificadas += 1;
    } catch {
      // Uma sessão que não classifica não pode impedir as outras de fechar. A sessão
      // já está marcada como abandonada, então o painel a enxerga; o que falta é só a
      // linha de classificação, e reprocessar depois é barato.
      falhas += 1;
    }
  }

  return { encerradas: paradas.length, classificadas, falhas };
}

/**
 * Roda a manutenção em intervalo, dentro do próprio processo.
 *
 * Sem fila e sem cron externo de propósito: o ADR-001 escolheu Coolify com deploy
 * simples, e introduzir infraestrutura nova para uma varredura que roda em milissegundos
 * seria pagar operação por nada. Quando houver mais de uma instância, isto vira trabalho
 * duplicado inofensivo — `updateMany` sobre o mesmo conjunto é idempotente.
 */
export function agendarManutencaoDeSessoes(
  aoTerminar: (resultado: ResultadoDaManutencao) => void = () => {},
): () => void {
  const intervalo = setInterval(
    () => {
      void encerrarSessoesAbandonadas()
        .then(aoTerminar)
        .catch(() => {});
    },
    ambiente.MINUTOS_ENTRE_MANUTENCOES * 60 * 1000,
  );

  // Não segura o processo vivo só por causa da varredura.
  intervalo.unref?.();

  return () => clearInterval(intervalo);
}
