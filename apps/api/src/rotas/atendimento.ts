import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { conflito, naoEncontrado, requisicaoInvalida, semPermissao } from '../erros.js';
import { exigirPermissao, registrarAcesso, usuarioDa } from '../autenticacao/plugin.js';
import {
  fatiaDoCursor,
  lerPaginacao,
  montarPagina,
  type ChaveDeOrdenacao,
} from '../servicos/paginacao.js';

/**
 * A outra ponta do botão "falar com a enfermagem": a fila de pedidos e o fechamento.
 *
 * Sem fechamento a fila não é fila — é uma lista que só cresce. E o efeito não fica na
 * tela do painel: enquanto o pedido antigo continuar aberto, ele é o que aparece para
 * qualquer regra que olhe "existe pedido em aberto", e o pedido de hoje some atrás dele.
 * Por isso esta rota nasce junto com a de abrir, e não depois.
 *
 * É rota do painel: exige `ATENDER_PLANTAO` (regra 6 do ADR-001 — permissão nominal, nunca
 * perfil) e registra `LogDeAcesso` (regra 5).
 */

const idNaUrlSchema = z.object({ id: z.string().uuid() });

export async function rotasDeAtendimento(app: FastifyInstance) {
  // Fechar pedido é botão sem campo: `POST` com `content-type: application/json` e corpo
  // vazio é o que o painel manda, e o analisador padrão do Fastify recusaria isso antes de
  // chegar à rota. Local a este plugin, como em `paciente.ts`.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser<string>(
    'application/json',
    { parseAs: 'string' },
    (_requisicao, corpo, feito) => {
      if (corpo.trim() === '') {
        feito(null, {});
        return;
      }

      try {
        feito(null, JSON.parse(corpo));
      } catch {
        feito(requisicaoInvalida('Não foi possível ler os dados enviados.'), undefined);
      }
    },
  );

  const dePlantao = {
    preHandler: [
      (requisicao: FastifyRequest) => app.autenticar(requisicao),
      exigirPermissao('ATENDER_PLANTAO'),
    ],
  };

  /**
   * A fila de pedidos em aberto, do mais antigo para o mais novo.
   *
   * O mais antigo primeiro porque quem esperou mais é quem está há mais tempo sem resposta.
   * `aguardando` vem junto para que a tela mostre o tamanho da fila sem paginar até o fim.
   */
  app.get('/painel/solicitacoes-de-contato', dePlantao, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const parametros = lerPaginacao(requisicao.query);

    const chave: ChaveDeOrdenacao = { campo: 'solicitadaEm', direcao: 'asc', tipo: 'data' };
    const fatia = fatiaDoCursor<
      Prisma.SolicitacaoDeContatoWhereInput,
      Prisma.SolicitacaoDeContatoOrderByWithRelationInput
    >(chave, parametros);

    const [linhas, aguardando] = await Promise.all([
      prisma.solicitacaoDeContato.findMany({
        where: { atendidaEm: null, ...(fatia.filtro ? { AND: [fatia.filtro] } : {}) },
        orderBy: fatia.ordenacao,
        take: fatia.quantidade,
        select: {
          id: true,
          solicitadaEm: true,
          sessaoId: true,
          paciente: { select: { id: true, nome: true } },
        },
      }),
      prisma.solicitacaoDeContato.count({ where: { atendidaEm: null } }),
    ]);

    await registrarAcesso(requisicao, { acao: 'LEITURA_DE_PACIENTE', usuarioId: usuario.id });

    return { ...montarPagina(linhas, chave, parametros), aguardando };
  });

  /**
   * Fecha o pedido: grava `atendidaEm` e `atendidaPorId`.
   *
   * O fechamento é um `updateMany` com `atendidaEm: null` na condição, e não um `update`
   * depois de ler. Duas pessoas de plantão clicando no mesmo pedido é o caso normal, não o
   * excepcional: com leitura seguida de escrita, as duas passariam pela conferência e a
   * segunda sobrescreveria quem realmente atendeu. Com a condição na escrita, a segunda
   * afeta zero linhas e recebe 409.
   *
   * PENDÊNCIA — `AcaoDeAcesso` não tem valor para "atendeu pedido de contato", então o log
   * sai como `REGISTRO_DE_INTERVENCAO`, que é o mais próximo. Está pedido no relatório.
   */
  app.post('/painel/solicitacoes-de-contato/:id/atendimento', dePlantao, async (requisicao) => {
    const usuario = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);

    if (!usuario.profissionalId) {
      throw semPermissao('Só profissional registra atendimento de pedido de contato.');
    }

    const solicitacao = await prisma.solicitacaoDeContato.findUnique({
      where: { id },
      select: { id: true, pacienteId: true, atendidaEm: true },
    });

    if (!solicitacao) throw naoEncontrado('Pedido de contato não encontrado.');
    if (solicitacao.atendidaEm) throw conflito('Este pedido já foi atendido.');

    const resultado = await prisma.solicitacaoDeContato.updateMany({
      where: { id, atendidaEm: null },
      data: { atendidaEm: new Date(), atendidaPorId: usuario.profissionalId },
    });

    if (resultado.count === 0) {
      throw conflito('Este pedido acabou de ser atendido por outra pessoa.');
    }

    const atendida = await prisma.solicitacaoDeContato.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        pacienteId: true,
        solicitadaEm: true,
        atendidaEm: true,
        atendidaPorId: true,
        atendidaPor: { select: { nome: true, funcao: true } },
      },
    });

    await registrarAcesso(requisicao, {
      acao: 'REGISTRO_DE_INTERVENCAO',
      usuarioId: usuario.id,
      pacienteId: solicitacao.pacienteId,
    });

    return atendida;
  });
}
