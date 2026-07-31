import 'dotenv/config';
import { z } from 'zod';

const PLACEHOLDER_DO_SEGREDO = 'troque-este-valor-antes-de-subir-qualquer-ambiente';

const esquema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória.'),
  SEGREDO_DA_SESSAO: z
    .string()
    .min(32, 'SEGREDO_DA_SESSAO precisa de pelo menos 32 caracteres.')
    .refine((valor) => valor !== PLACEHOLDER_DO_SEGREDO, {
      message: 'SEGREDO_DA_SESSAO ainda está com o valor de exemplo. Gere um: openssl rand -hex 32',
    }),
  ORIGENS_PERMITIDAS: z.string().default('http://localhost:3210'),
  /**
   * Fuso do serviço de saúde — nunca o do servidor nem o do navegador.
   * Toda conta de dia do ciclo e de "hoje" no painel passa por ele. Container
   * em UTC com fuso não declarado faz check-in noturno cair no dia seguinte, e
   * regra de risco com janela de ciclo deixa de disparar em silêncio.
   */
  FUSO_HORARIO: z
    .string()
    .default('America/Sao_Paulo')
    .refine((fuso) => {
      try {
        new Intl.DateTimeFormat('en-CA', { timeZone: fuso });
        return true;
      } catch {
        return false;
      }
    }, { message: 'FUSO_HORARIO não é um fuso IANA válido (ex.: America/Sao_Paulo).' }),
  /**
   * Depois de quantas horas um check-in começado e não terminado é considerado
   * abandonado. É configuração e não constante no código pela mesma razão dos
   * limiares: o número certo é decisão clínica e vai mudar na validação.
   */
  HORAS_ATE_ABANDONO: z.coerce.number().positive().default(6),
  MINUTOS_ENTRE_MANUTENCOES: z.coerce.number().positive().default(15),
  /** Janela em que o mesmo paciente clicando de novo em "falar com a enfermagem"
   * reaproveita a solicitação aberta em vez de criar outra. Curta de propósito:
   * cobre o clique repetido sem transformar o botão em uso único. */
  MINUTOS_DE_JANELA_DE_CONTATO: z.coerce.number().positive().default(30),
  /** Versão do termo de consentimento que vale hoje. Muda quando o termo muda. */
  VERSAO_DO_TERMO: z.string().default('demo-0'),
  PORTA: z.coerce.number().int().positive().default(3333),
  AMBIENTE: z.enum(['desenvolvimento', 'teste', 'producao']).default('desenvolvimento'),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  // Falhar no boot é deliberado. API de dado sensível de saúde subindo com segredo de
  // exemplo é pior do que API que não sobe.
  console.error('Ambiente inválido:');
  for (const problema of resultado.error.issues) {
    console.error(`  ${problema.path.join('.')}: ${problema.message}`);
  }
  process.exit(1);
}

export const ambiente = resultado.data;

export const origensPermitidas = ambiente.ORIGENS_PERMITIDAS.split(',')
  .map((origem) => origem.trim())
  .filter(Boolean);
