import type { FastifyInstance } from 'fastify';
import { FuncaoProfissional, Permissao, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { cpfEhValido, normalizarCpf } from '@aurea/contratos';
import { prisma } from '../prisma.js';
import { ErroDaApi, conflito, naoEncontrado, requisicaoInvalida } from '../erros.js';
import { exigirPermissao, registrarAcesso, usuarioDa } from '../autenticacao/plugin.js';

/**
 * Gestão de contas de profissional e administrador, e recuperação de senha.
 *
 * Duas coisas correm em paralelo neste arquivo e não podem se confundir:
 *
 * - As quatro rotas `/admin/usuarios*` exigem `GERENCIAR_USUARIOS` e nunca devolvem
 *   `senhaHash` — nem no `select`, nem em log, nem em mensagem de erro.
 * - `/autenticacao/recuperar` é pública e segue a MESMA lógica de `autenticacao.ts`:
 *   resposta idêntica, no mesmo tempo, exista ou não a conta. Cadastro de paciente
 *   oncológico — dizer "essa pessoa está cadastrada" já é vazamento de dado de saúde,
 *   com ou sem abrir o prontuário.
 */

const idNaUrlSchema = z.object({ id: z.string().uuid() });

/**
 * Regra 6 do ADR-001, imposta aqui além de no `exigirPermissao`.
 *
 * `exigirPermissao` garante que uma ação exige a permissão certa; não impede que as
 * DUAS permissões coexistam na mesma pessoa. Quem edita o algoritmo muda o risco de
 * todos os pacientes de uma vez; quem está de plantão responde por um paciente por
 * vez. Misturar os dois papéis é exatamente o que a regra proíbe — e a proibição
 * precisa valer tanto na criação da conta quanto em qualquer troca de permissão
 * depois, senão vira uma regra que só vale no dia 1.
 */
function recusarCombinacaoProibida(permissoes: readonly Permissao[]): void {
  const editaAlgoritmo = permissoes.includes('EDITAR_ALGORITMO');
  const atendePlantao = permissoes.includes('ATENDER_PLANTAO');

  if (editaAlgoritmo && atendePlantao) {
    throw new ErroDaApi(
      422,
      'EDITAR_ALGORITMO e ATENDER_PLANTAO não podem coexistir no mesmo usuário. Quem edita o ' +
        'algoritmo muda o risco de todos os pacientes de uma vez; quem está de plantão responde ' +
        'por um paciente. A separação é deliberada, Regra 6 do ADR-001.',
    );
  }
}

const permissoesSchema = z
  .array(z.enum(Permissao))
  .max(Object.keys(Permissao).length)
  .refine((lista) => new Set(lista).size === lista.length, 'A lista de permissões tem repetição.');

const criarProfissionalSchema = z.object({
  nome: z.string().trim().min(2).max(180),
  email: z.string().trim().email().max(180),
  funcao: z.enum(FuncaoProfissional),
  registroDoConselho: z.string().trim().min(1).max(40).optional(),
  // Só estes dois perfis nascem aqui. PACIENTE tem fluxo próprio, fora deste arquivo.
  perfil: z.enum(['PROFISSIONAL', 'ADMINISTRADOR']),
  permissoes: permissoesSchema.default([]),
  senhaProvisoria: z.string().min(8).max(200),
});

const substituirPermissoesSchema = z.object({ permissoes: permissoesSchema });

const ativarSchema = z.object({ ativo: z.boolean() });

const recuperarSchema = z
  .object({
    /** Paciente é identificado por CPF em todo o resto da API — a recuperação segue o mesmo padrão. */
    cpf: z
      .string()
      .transform(normalizarCpf)
      .refine(cpfEhValido, 'CPF inválido.')
      .optional(),
    /** Profissional e administrador, por e-mail — como no login. */
    email: z.string().trim().email().optional(),
  })
  .refine((dados) => Boolean(dados.cpf) !== Boolean(dados.email), {
    message: 'Informe CPF ou e-mail, nunca os dois.',
  });

export async function rotasDeGestaoDeUsuarios(app: FastifyInstance) {
  const autenticar = (requisicao: Parameters<typeof app.autenticar>[0]) => app.autenticar(requisicao);
  const comGestao = { preHandler: [autenticar, exigirPermissao('GERENCIAR_USUARIOS')] };

  /**
   * Lista só profissional e administrador — quem faz login por e-mail e é alvo desta
   * tela. Paciente tem cadastro e ciclo de vida próprios, e nem `email` nem os campos
   * de profissional fazem sentido pra ele aqui.
   */
  app.get('/admin/usuarios', comGestao, async () => {
    const usuarios = await prisma.usuario.findMany({
      where: { perfil: { in: ['PROFISSIONAL', 'ADMINISTRADOR'] } },
      orderBy: [{ ativo: 'desc' }, { criadoEm: 'desc' }],
      select: {
        id: true,
        email: true,
        perfil: true,
        ativo: true,
        ultimoAcessoEm: true,
        criadoEm: true,
        // Nunca `senhaHash` — nem por engano: este `select` é exaustivo de propósito,
        // em vez de usar `include`, que traria a coluna inteira do relacionamento base.
        profissional: { select: { nome: true, funcao: true, registroDoConselho: true } },
        permissoes: {
          where: { revogadaEm: null },
          select: { permissao: true },
        },
      },
    });

    return usuarios.map((usuario) => ({
      id: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
      ativo: usuario.ativo,
      ultimoAcessoEm: usuario.ultimoAcessoEm,
      criadoEm: usuario.criadoEm,
      // Nulo para conta antiga sem registro de profissional (ex.: admin da seed). A
      // tela de gestão precisa saber disso pra pedir o cadastro completo, não pra quebrar.
      profissional: usuario.profissional,
      permissoes: usuario.permissoes.map((concessao) => concessao.permissao),
    }));
  });

  /**
   * Cria a conta, o registro de profissional e as permissões concedidas juntos.
   *
   * `prisma.usuario.create` com `profissional.create` e `permissoes.create` aninhados é
   * uma escrita só: ou as três tabelas mudam juntas, ou nenhuma muda — sem isso, uma
   * queda no meio do caminho deixaria login sem nome de profissional atrelado, ou
   * conta sem nenhuma permissão e sem ninguém perceber.
   */
  app.post('/admin/usuarios/profissional', comGestao, async (requisicao, resposta) => {
    const quemConcede = usuarioDa(requisicao);
    const analise = criarProfissionalSchema.safeParse(requisicao.body);

    if (!analise.success) {
      throw requisicaoInvalida('Dados de cadastro inválidos.', analise.error.issues);
    }

    const dados = analise.data;
    recusarCombinacaoProibida(dados.permissoes);

    // Checagem prévia para devolver 409 com mensagem clara no caminho comum; a captura
    // de `P2002` abaixo cobre a corrida rara de duas criações com o mesmo e-mail ao
    // mesmo tempo, que a checagem prévia sozinha não fecha.
    const jaExiste = await prisma.usuario.findUnique({ where: { email: dados.email } });
    if (jaExiste) throw conflito('Já existe um usuário com este e-mail.');

    const senhaHash = await hash(dados.senhaProvisoria, 10);

    try {
      const criado = await prisma.usuario.create({
        data: {
          email: dados.email,
          senhaHash,
          perfil: dados.perfil,
          profissional: {
            create: {
              nome: dados.nome,
              funcao: dados.funcao,
              registroDoConselho: dados.registroDoConselho ?? null,
            },
          },
          permissoes: {
            create: dados.permissoes.map((permissao) => ({
              permissao,
              concedidaPorId: quemConcede.id,
            })),
          },
        },
        select: {
          id: true,
          email: true,
          perfil: true,
          ativo: true,
          profissional: { select: { nome: true, funcao: true, registroDoConselho: true } },
          permissoes: { select: { permissao: true } },
        },
      });

      await registrarAcesso(requisicao, { acao: 'CRIACAO_DE_CADASTRO', usuarioId: quemConcede.id });

      return resposta.status(201).send({
        id: criado.id,
        email: criado.email,
        perfil: criado.perfil,
        ativo: criado.ativo,
        profissional: criado.profissional,
        permissoes: criado.permissoes.map((concessao) => concessao.permissao),
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw conflito('Já existe um usuário com este e-mail.');
      }
      throw erro;
    }
  });

  /**
   * Substitui o conjunto de permissões do usuário pelo conjunto enviado.
   *
   * `ConcessaoDePermissao` tem `@@unique([usuarioId, permissao])` — só existe UMA linha
   * por par usuário/permissão pra sempre, mesmo revogada. Reconceder uma permissão que
   * já foi revogada um dia não pode ser um `create` (violaria a unicidade): é um
   * `update` que zera `revogadaEm`. Tratar isso como "revoga tudo e cria tudo de novo"
   * pareceria funcionar em teste manual e quebraria na primeira reconcessão em produção.
   */
  app.patch('/admin/usuarios/:id/permissoes', comGestao, async (requisicao) => {
    const quemConcede = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);
    const analise = substituirPermissoesSchema.safeParse(requisicao.body);

    if (!analise.success) {
      throw requisicaoInvalida('Lista de permissões inválida.', analise.error.issues);
    }

    const novasPermissoes = analise.data.permissoes;
    recusarCombinacaoProibida(novasPermissoes);

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: { permissoes: true },
    });
    if (!usuario) throw naoEncontrado('Usuário não encontrado.');

    const novasComoConjunto = new Set(novasPermissoes);
    const agora = new Date();
    const operacoes: Prisma.PrismaPromise<unknown>[] = [];

    // Revoga o que está ativo e não está mais no conjunto pedido.
    for (const concessao of usuario.permissoes) {
      const aindaAtiva = concessao.revogadaEm === null;
      if (aindaAtiva && !novasComoConjunto.has(concessao.permissao)) {
        operacoes.push(
          prisma.concessaoDePermissao.update({
            where: { id: concessao.id },
            data: { revogadaEm: agora },
          }),
        );
      }
    }

    // Concede o que falta: reativa a linha existente (revogada um dia) ou cria linha nova.
    for (const permissao of novasComoConjunto) {
      const existente = usuario.permissoes.find((concessao) => concessao.permissao === permissao);

      if (!existente) {
        operacoes.push(
          prisma.concessaoDePermissao.create({
            data: { usuarioId: id, permissao, concedidaPorId: quemConcede.id },
          }),
        );
      } else if (existente.revogadaEm !== null) {
        operacoes.push(
          prisma.concessaoDePermissao.update({
            where: { id: existente.id },
            data: { revogadaEm: null, concedidaPorId: quemConcede.id, concedidaEm: agora },
          }),
        );
      }
      // Já concedida e ativa: nada a fazer.
    }

    if (operacoes.length > 0) {
      await prisma.$transaction(operacoes);
    }

    await registrarAcesso(requisicao, { acao: 'EDICAO_DE_CADASTRO', usuarioId: quemConcede.id });

    return { id, permissoes: [...novasComoConjunto] };
  });

  /**
   * Ativa ou desativa a conta.
   *
   * Desativar sem encerrar sessão deixaria a definição de "desativado" mentindo: a
   * pessoa continuaria dentro do sistema até o token expirar sozinho, dias depois.
   * As duas mudanças — `ativo: false` e encerrar sessão — andam juntas na mesma
   * transação pelo mesmo motivo de `conta.ts` na troca de senha: uma sem a outra é
   * pior que nenhuma das duas.
   */
  app.patch('/admin/usuarios/:id/ativo', comGestao, async (requisicao) => {
    const quemAltera = usuarioDa(requisicao);
    const { id } = idNaUrlSchema.parse(requisicao.params);
    const analise = ativarSchema.safeParse(requisicao.body);

    if (!analise.success) {
      throw requisicaoInvalida('Corpo inválido.', analise.error.issues);
    }

    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw naoEncontrado('Usuário não encontrado.');

    const { ativo } = analise.data;
    const agora = new Date();

    await prisma.$transaction([
      prisma.usuario.update({ where: { id }, data: { ativo } }),
      ...(ativo
        ? []
        : [
            prisma.sessaoDeAcesso.updateMany({
              where: { usuarioId: id, revogadaEm: null },
              data: { revogadaEm: agora },
            }),
          ]),
    ]);

    await registrarAcesso(requisicao, { acao: 'EDICAO_DE_CADASTRO', usuarioId: quemAltera.id });

    return { id, ativo, sessoesEncerradas: !ativo };
  });

  /**
   * Recuperação de senha — pública, sem `comGestao` e sem `app.autenticar`.
   *
   * Mesma regra do login em `autenticacao.ts`: a resposta é sempre 202, sempre a mesma
   * mensagem, exista ou não a conta, e pelo mesmo custo de tempo nos dois casos. Um
   * serviço de monitoramento de toxicidade oncológica que responde diferente pra CPF
   * cadastrado e pra CPF não cadastrado virou, sem ninguém pedir, um jeito de descobrir
   * quem é paciente do serviço — vazamento de dado de saúde antes mesmo de abrir
   * qualquer prontuário.
   *
   * Limite de tentativas por origem, generoso, pelo mesmo motivo do `/autenticacao/entrar`:
   * conter varredura automatizada sem travar quem só errou a digitação.
   */
  app.post(
    '/autenticacao/recuperar',
    { config: { rateLimit: { max: 20, timeWindow: '5 minutes' } } },
    async (requisicao, resposta) => {
      const analise = recuperarSchema.safeParse(requisicao.body);
      if (!analise.success) {
        throw requisicaoInvalida('Dados de entrada inválidos.', analise.error.issues);
      }

      const { cpf, email } = analise.data;

      /**
       * Piso de tempo, não "trabalho equivalente".
       *
       * A primeira versão desta rota tentava igualar o custo dos dois caminhos
       * fazendo uma consulta barata no lado de "não existe". Medido, o caminho com
       * usuário levava ~4,4 ms e o sem usuário ~2,2 ms — o dobro, de forma
       * consistente, porque gravar no log custa muito mais que um `count`. Com
       * amostras suficientes isso é um oráculo de "esta pessoa é paciente daqui".
       *
       * Igualar custo de operações diferentes é frágil por natureza: basta um índice
       * novo ou uma coluna a mais para o equilíbrio quebrar em silêncio. Esperar até
       * um piso fixo não depende do que cada caminho faz.
       */
      const inicio = Date.now();
      const PISO_DE_RESPOSTA_EM_MS = 150;

      const usuario = await prisma.usuario.findFirst({ where: cpf ? { cpf } : { email } });

      if (usuario) {
        // PENDENTE: não há serviço de e-mail nesta fase. O que existe hoje é o registro
        // da solicitação — o envio real (e-mail com link ou código de redefinição) fica
        // para quando houver provedor configurado. Não inventar envio aqui.
        //
        // `AcaoDeAcesso` não tem um valor dedicado a "solicitação de recuperação", e criar
        // um exige migração de schema — fora do escopo desta entrega (ver instrução do
        // briefing: nenhuma migração neste arquivo). Uso `TROCA_DE_SENHA` por ser o mais
        // próximo do domínio (ciclo de vida de credencial), mas a linha registra o PEDIDO,
        // não uma senha efetivamente trocada — quem for auditar `LogDeAcesso` não pode
        // confundir os dois. Sinalizar para o MAESTRO: vale um ADR + migração criando
        // `RECUPERACAO_DE_SENHA_SOLICITADA` em `AcaoDeAcesso`.
        await registrarAcesso(requisicao, { acao: 'TROCA_DE_SENHA', usuarioId: usuario.id });
      }
      /* Sem usuário não há o que registrar: `LogDeAcesso.usuarioId` é obrigatório e
         tem chave estrangeira. O silêncio aqui é coberto pelo piso de tempo abaixo. */

      const decorrido = Date.now() - inicio;
      if (decorrido < PISO_DE_RESPOSTA_EM_MS) {
        await new Promise((resolver) =>
          setTimeout(resolver, PISO_DE_RESPOSTA_EM_MS - decorrido),
        );
      }

      return resposta.status(202).send({
        mensagem: 'Se os dados informados corresponderem a um cadastro, você receberá instruções em breve.',
      });
    },
  );
}
