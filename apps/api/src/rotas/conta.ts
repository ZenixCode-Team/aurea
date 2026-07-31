import type { FastifyInstance } from 'fastify';
import { compare, hash } from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { ambiente } from '../ambiente.js';
import { requisicaoInvalida, semPermissao, ErroDaApi } from '../erros.js';
import { registrarAcesso, usuarioDa } from '../autenticacao/plugin.js';
import { prisma as bancoDeDados } from '../prisma.js';

const trocarSenhaSchema = z.object({
  senhaAtual: z.string().min(1).max(200),
  senhaNova: z.string().min(10, 'A senha nova precisa de pelo menos 10 caracteres.').max(200),
});

export async function rotasDeConta(app: FastifyInstance) {
  const autenticado = {
    preHandler: (requisicao: Parameters<typeof app.autenticar>[0]) => app.autenticar(requisicao),
  };

  /**
   * O que o primeiro acesso precisa consentir.
   *
   * O AUREA coleta diagnóstico oncológico, sintoma e medicação — dado pessoal sensível
   * de saúde, com base legal própria, finalidade declarada e política de retenção. O
   * consentimento é versionado porque o termo muda, e o histórico de qual versão cada
   * pessoa aceitou é o que o Comitê de Ética vai pedir.
   */
  app.get('/conta/consentimento', autenticado, async (requisicao) => {
    const usuario = usuarioDa(requisicao);

    if (!usuario.pacienteId) {
      return { exigido: false, versaoVigente: ambiente.VERSAO_DO_TERMO, aceito: true };
    }

    const aceite = await prisma.consentimento.findUnique({
      where: {
        pacienteId_versaoDoTermo: {
          pacienteId: usuario.pacienteId,
          versaoDoTermo: ambiente.VERSAO_DO_TERMO,
        },
      },
    });

    return {
      exigido: true,
      versaoVigente: ambiente.VERSAO_DO_TERMO,
      aceito: aceite !== null,
      aceitoEm: aceite?.aceitoEm ?? null,
    };
  });

  app.post('/conta/consentimento', autenticado, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);

    if (!usuario.pacienteId) {
      throw semPermissao('Só paciente registra consentimento.');
    }

    const analise = z
      .object({ versaoDoTermo: z.string().min(1).max(40) })
      .safeParse(requisicao.body);

    if (!analise.success) {
      throw requisicaoInvalida('Não foi possível registrar seu aceite.', analise.error.issues);
    }

    // Aceitar uma versão antiga não vale como aceite da vigente. Sem esta checagem, um
    // cliente desatualizado registraria consentimento de um texto que não é mais o que
    // está sendo mostrado — e o registro deixaria de provar o que precisa provar.
    if (analise.data.versaoDoTermo !== ambiente.VERSAO_DO_TERMO) {
      throw new ErroDaApi(409, 'O texto mudou. Leia novamente antes de aceitar.');
    }

    const consentimento = await prisma.consentimento.upsert({
      where: {
        pacienteId_versaoDoTermo: {
          pacienteId: usuario.pacienteId,
          versaoDoTermo: ambiente.VERSAO_DO_TERMO,
        },
      },
      create: {
        pacienteId: usuario.pacienteId,
        versaoDoTermo: ambiente.VERSAO_DO_TERMO,
        ip: requisicao.ip?.slice(0, 45) ?? null,
      },
      update: {},
    });

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { primeiroAcessoEm: new Date() },
    });

    await registrarAcesso(requisicao, {
      acao: 'CONSENTIMENTO_REGISTRADO',
      usuarioId: usuario.id,
      pacienteId: usuario.pacienteId,
    });

    return resposta.status(201).send(consentimento);
  });

  /**
   * Troca da própria senha.
   *
   * Exige a senha atual: sem isso, quem pegasse um aparelho destravado trocaria a senha
   * e tomaria a conta sem saber a antiga. Todas as outras sessões caem — se a troca foi
   * motivada por suspeita de acesso indevido, manter as sessões vivas anularia o motivo.
   */
  app.post('/conta/senha', autenticado, async (requisicao, resposta) => {
    const usuario = usuarioDa(requisicao);
    const analise = trocarSenhaSchema.safeParse(requisicao.body);

    if (!analise.success) {
      throw requisicaoInvalida('Não foi possível trocar a senha.', analise.error.issues);
    }

    const { senhaAtual, senhaNova } = analise.data;

    const registro = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    const confere = await compare(senhaAtual, registro.senhaHash);

    if (!confere) throw new ErroDaApi(401, 'A senha atual não confere.');

    if (await compare(senhaNova, registro.senhaHash)) {
      throw requisicaoInvalida('A senha nova precisa ser diferente da atual.');
    }

    const senhaHash = await hash(senhaNova, 10);
    const agora = new Date();

    await bancoDeDados.$transaction([
      prisma.usuario.update({
        where: { id: usuario.id },
        data: { senhaHash, primeiroAcessoEm: registro.primeiroAcessoEm ?? agora },
      }),
      prisma.sessaoDeAcesso.updateMany({
        where: { usuarioId: usuario.id, revogadaEm: null },
        data: { revogadaEm: agora },
      }),
    ]);

    await registrarAcesso(requisicao, { acao: 'TROCA_DE_SENHA', usuarioId: usuario.id });

    return resposta.status(200).send({
      trocada: true,
      // Avisa explicitamente porque o cliente precisa mandar a pessoa entrar de novo.
      sessoesEncerradas: true,
    });
  });
}
