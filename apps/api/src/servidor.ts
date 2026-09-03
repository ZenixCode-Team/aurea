import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ambiente, origensPermitidas } from './ambiente.js';
import { ErroDaApi } from './erros.js';
import { autenticacao } from './autenticacao/plugin.js';
import { rotasDeAutenticacao } from './rotas/autenticacao.js';
import { rotasDeTriagem } from './rotas/triagem.js';
import { rotasDoPainel } from './rotas/painel.js';
import { rotasDeCadeiras } from './rotas/cadeiras.js';
import { rotasDeConta } from './rotas/conta.js';
import { rotasDeAdmin } from './rotas/admin.js';
import { rotasDoPaciente } from './rotas/paciente.js';
import { rotasDeAtendimento } from './rotas/atendimento.js';
import { rotasDeCadastroDePacientes } from './rotas/cadastro-de-pacientes.js';
import { rotasDeCadastroDeTratamentos } from './rotas/cadastro-de-tratamentos.js';
import { rotasDeGestaoDeUsuarios } from './rotas/gestao-de-usuarios.js';
import { rotasDeConteudoEPesquisa } from './rotas/conteudo-e-pesquisa.js';
import { prisma } from './prisma.js';
import { agendarManutencaoDeSessoes } from './servicos/manutencao-de-sessoes.js';
import { agendarLimpezaDeTentativas } from './autenticacao/tentativas.js';

export async function montarServidor() {
  const app = Fastify({
    logger:
      ambiente.AMBIENTE === 'desenvolvimento'
        ? { level: 'info' }
        : { level: 'warn' },
    /**
     * Confia em UM salto de proxy, nunca na cadeia inteira.
     *
     * Com `trustProxy: true`, o IP passa a ser o primeiro valor de `X-Forwarded-For` —
     * e esse cabeçalho é escolhido pelo cliente. O efeito era duplo e grave: força
     * bruta com IP forjado atravessava o limite por origem, e o `ip` gravado em
     * `LogDeAcesso` e `SessaoDeAcesso` virava ficção. A trilha de acesso que a regra 5
     * do ADR-001 existe para produzir não pode ser escrita por quem está sendo
     * auditado.
     *
     * `1` significa: pegue o último salto antes do proxy da Coolify, ignore o resto.
     */
    trustProxy: ambiente.AMBIENTE === 'producao' ? 1 : false,
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: origensPermitidas,
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
  });

  await app.register(autenticacao);

  app.setErrorHandler((erro: FastifyError, requisicao, resposta) => {
    if (erro instanceof ErroDaApi) {
      return resposta.status(erro.status).send({
        erro: erro.message,
        detalhes: erro.detalhes ?? undefined,
      });
    }

    // Erros que o próprio Fastify classifica como culpa do cliente (corpo malformado,
    // limite de requisições) já trazem status e mensagem seguros de repassar.
    const status = erro.statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return resposta.status(status).send({ erro: erro.message });
    }

    // Erro não previsto: o detalhe fica no log do servidor, nunca na resposta. Mensagem
    // de erro de banco vazando para o cliente é vazamento de informação, e este banco
    // carrega diagnóstico oncológico.
    requisicao.log.error({ erro }, 'Erro não tratado');
    return resposta.status(500).send({ erro: 'Erro interno.' });
  });

  app.get('/saude', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { estado: 'ok', ambiente: ambiente.AMBIENTE };
  });

  await app.register(rotasDeAutenticacao);
  await app.register(rotasDeConta);
  await app.register(rotasDeTriagem);
  await app.register(rotasDoPainel);
  await app.register(rotasDeCadeiras);
  await app.register(rotasDeAdmin);
  await app.register(rotasDoPaciente);
  await app.register(rotasDeAtendimento);
  await app.register(rotasDeCadastroDePacientes);
  await app.register(rotasDeCadastroDeTratamentos);
  await app.register(rotasDeGestaoDeUsuarios);
  await app.register(rotasDeConteudoEPesquisa);

  return app;
}

async function principal() {
  const app = await montarServidor();

  try {
    await app.listen({ port: ambiente.PORTA, host: '0.0.0.0' });
    app.log.info(`AUREA API ouvindo na porta ${ambiente.PORTA} (${ambiente.AMBIENTE})`);
    app.log.info(`Fuso do serviço: ${ambiente.FUSO_HORARIO}`);

    agendarLimpezaDeTentativas();

    // Fecha check-in começado e não terminado. Sem isto, a política de abandono do
    // conjunto de limiares nunca é exercida e quem parou no meio fica invisível.
    agendarManutencaoDeSessoes((resultado) => {
      if (resultado.encerradas > 0) {
        app.log.info(
          { ...resultado },
          'Sessões abandonadas encerradas e classificadas.',
        );
      }
    });
  } catch (erro) {
    app.log.error(erro);
    process.exit(1);
  }

  /* O handler de sinal é síncrono por assinatura: `process.on` descarta o que a função
     devolve, então uma função `async` aqui é promessa que ninguém aguarda — se o
     `app.close()` rejeitar, o erro vira `unhandledRejection` e o processo morre sem
     fechar a conexão do banco. Chamando o desligamento com `void` + `catch` explícito, a
     falha vira log e o `process.exit` acontece de qualquer jeito. */
  const desligar = async () => {
    await app.close();
    await prisma.$disconnect();
  };

  for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sinal, () => {
      void desligar()
        .catch((erro: unknown) => app.log.error(erro))
        .finally(() => process.exit(0));
    });
  }
}

// Só sobe o servidor quando executado direto. Importado por teste, apenas exporta.
if (process.argv[1]?.endsWith('servidor.ts') || process.argv[1]?.endsWith('servidor.js')) {
  void principal();
}
