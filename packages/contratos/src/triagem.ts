import { z } from 'zod';
import { SINTOMAS, buscarCampo, buscarRamo, camposDoRamo, type Sintoma } from './sintomas.js';

export const sintomaSchema = z.enum(SINTOMAS);

/**
 * Uma resposta crua, do jeito que o paciente respondeu.
 *
 * ADR-001, regra 2: a resposta crua é persistida sempre. `temperaturaMaxima = 38.4`
 * fica gravado ao lado da classificação que ele produziu — sem isso não há como
 * reprocessar o histórico quando o corte mudar, nem explicar depois por que aquele
 * dia foi amarelo. É o dado mais importante do banco.
 */
export const respostaDeCampoSchema = z
  .object({
    campo: z.string().min(1).max(64),
    valorNumerico: z.number().finite().nullable().optional(),
    valorBooleano: z.boolean().nullable().optional(),
    valorTexto: z.string().max(120).nullable().optional(),
  })
  .refine(
    (resposta) =>
      [resposta.valorNumerico, resposta.valorBooleano, resposta.valorTexto].filter(
        (valor) => valor !== null && valor !== undefined,
      ).length === 1,
    { message: 'Cada resposta carrega exatamente um valor: numérico, booleano ou texto.' },
  );

export type RespostaDeCampo = z.infer<typeof respostaDeCampoSchema>;

export const respostaDeSintomaSchema = z.object({
  sintoma: sintomaSchema,
  respostas: z.array(respostaDeCampoSchema).min(1).max(12),
});

export type RespostaDeSintoma = z.infer<typeof respostaDeSintomaSchema>;

export const iniciarTriagemSchema = z.object({
  /** Enviado pelo cliente para que reenvio de rede não crie duas sessões do mesmo check-in. */
  chaveDeIdempotencia: z.string().uuid(),
});

export const enviarTriagemSchema = z.object({
  sessaoId: z.string().uuid(),
  sintomas: z.array(respostaDeSintomaSchema).min(1).max(SINTOMAS.length),
});

export type EnvioDeTriagem = z.infer<typeof enviarTriagemSchema>;

export interface ProblemaDeValidacao {
  readonly sintoma: Sintoma;
  readonly campo: string;
  readonly problema: string;
}

/**
 * Valida o envio contra a árvore: campo que não existe, campo obrigatório ausente,
 * campo fora da faixa, opção fora da lista, e detalhe respondido com a porta fechada.
 *
 * O Zod garante o formato; isto garante a coerência com a árvore. São camadas
 * diferentes e a segunda não pode viver no schema, porque depende do valor da porta.
 */
export function validarContraArvore(envio: EnvioDeTriagem): ProblemaDeValidacao[] {
  const problemas: ProblemaDeValidacao[] = [];

  for (const respostaDoSintoma of envio.sintomas) {
    const ramo = buscarRamo(respostaDoSintoma.sintoma);
    const porChave = new Map(respostaDoSintoma.respostas.map((r) => [r.campo, r]));

    for (const resposta of respostaDoSintoma.respostas) {
      if (!buscarCampo(respostaDoSintoma.sintoma, resposta.campo)) {
        problemas.push({
          sintoma: respostaDoSintoma.sintoma,
          campo: resposta.campo,
          problema: 'campo não existe neste sintoma',
        });
      }
    }

    if (!porChave.has(ramo.porta.campo)) {
      problemas.push({
        sintoma: respostaDoSintoma.sintoma,
        campo: ramo.porta.campo,
        problema: 'pergunta de porta não respondida',
      });
      continue;
    }

    for (const definicao of camposDoRamo(ramo)) {
      const resposta = porChave.get(definicao.campo);

      if (definicao.dependeDe) {
        const dependencia = porChave.get(definicao.dependeDe.campo);
        const dependenciaSatisfeita = dependencia?.valorBooleano === definicao.dependeDe.valor;

        if (!dependenciaSatisfeita) {
          if (resposta) {
            problemas.push({
              sintoma: respostaDoSintoma.sintoma,
              campo: definicao.campo,
              problema: `respondido sem que "${definicao.dependeDe.campo}" o liberasse`,
            });
          }
          continue;
        }
      }

      if (!resposta) {
        problemas.push({
          sintoma: respostaDoSintoma.sintoma,
          campo: definicao.campo,
          problema: 'obrigatório neste ramo e não respondido',
        });
        continue;
      }

      problemas.push(
        ...conferirTipoEFaixa(respostaDoSintoma.sintoma, definicao.campo, resposta, definicao),
      );
    }
  }

  return problemas;
}

function conferirTipoEFaixa(
  sintoma: Sintoma,
  campo: string,
  resposta: RespostaDeCampo,
  definicao: NonNullable<ReturnType<typeof buscarCampo>>,
): ProblemaDeValidacao[] {
  const problemas: ProblemaDeValidacao[] = [];
  const reprovar = (problema: string) => problemas.push({ sintoma, campo, problema });

  switch (definicao.tipo) {
    case 'BOOLEANO': {
      if (typeof resposta.valorBooleano !== 'boolean') reprovar('esperava sim ou não');
      break;
    }
    case 'OPCAO': {
      const valor = resposta.valorTexto;
      if (typeof valor !== 'string') {
        reprovar('esperava uma das opções');
      } else if (definicao.opcoes && !definicao.opcoes.includes(valor)) {
        reprovar(`opção fora da lista: ${valor}`);
      }
      break;
    }
    case 'NUMERICO':
    case 'INTEIRO': {
      const valor = resposta.valorNumerico;
      if (typeof valor !== 'number') {
        reprovar('esperava um número');
        break;
      }
      if (definicao.tipo === 'INTEIRO' && !Number.isInteger(valor)) {
        reprovar('esperava um número inteiro');
      }
      if (definicao.minimo !== undefined && valor < definicao.minimo) {
        reprovar(`abaixo do mínimo ${definicao.minimo}`);
      }
      if (definicao.maximo !== undefined && valor > definicao.maximo) {
        reprovar(`acima do máximo ${definicao.maximo}`);
      }
      break;
    }
  }

  return problemas;
}
