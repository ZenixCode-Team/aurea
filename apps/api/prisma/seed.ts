/**
 * Seed do ambiente de desenvolvimento.
 *
 * ⚠️  TODO PACIENTE AQUI É INVENTADO.
 *
 * Nome, CPF, diagnóstico e sintoma de pessoa real só entram no sistema depois da
 * aprovação do Comitê de Ética. Vale para o banco de desenvolvimento, para o ambiente
 * de demonstração e para print em apresentação. Dado sintético não é limitação da
 * fase 1 — é o que a fase 1 é.
 *
 * Os CPFs são gerados pelo dígito verificador a partir de bases conhecidas de teste, para
 * serem formalmente válidos e ainda assim obviamente falsos. Base de dígito repetido
 * (111111111) produz CPF que a validação padrão rejeita, então não é usada aqui.
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { REGRAS_DO_RASCUNHO, VERSAO_DO_CONJUNTO_RASCUNHO } from './conjunto-rascunho-0.js';
import { publicarVerbetes } from './verbetes-da-biblioteca.js';

const prisma = new PrismaClient();

/** Senha única de todos os usuários sintéticos. Vale só em desenvolvimento. */
const SENHA_DE_DEMONSTRACAO = 'aurea-demo-2026';

function gerarCpf(base: string): string {
  const digitos = base.split('').map(Number);

  for (let posicao = 0; posicao < 2; posicao += 1) {
    const peso = digitos.length + 1;
    const soma = digitos.reduce((total, digito, indice) => total + digito * (peso - indice), 0);
    const resto = (soma * 10) % 11;
    digitos.push(resto === 10 ? 0 : resto);
  }

  return digitos.join('');
}

function emDias(dias: number): Date {
  const data = new Date();
  data.setHours(12, 0, 0, 0);
  data.setDate(data.getDate() + dias);
  return data;
}

async function main() {
  console.log('Limpando o banco de desenvolvimento...');
  // Ordem importa: filhos antes dos pais, porque nem toda relação é cascata.
  await prisma.$transaction([
    prisma.logDeAcesso.deleteMany(),
    prisma.orientacaoEntregue.deleteMany(),
    prisma.classificacao_.deleteMany(),
    prisma.respostaDeSintoma.deleteMany(),
    prisma.intervencao.deleteMany(),
    prisma.solicitacaoDeContato.deleteMany(),
    prisma.sessaoDeTriagem.deleteMany(),
    prisma.orientacao.deleteMany(),
    prisma.conjuntoDeOrientacoes.deleteMany(),
    prisma.regraDeLimiar.deleteMany(),
    prisma.conjuntoDeLimiares.deleteMany(),
    prisma.eventoDeAgenda.deleteMany(),
    prisma.prescricao.deleteMany(),
    prisma.ciclo.deleteMany(),
    prisma.tratamento.deleteMany(),
    prisma.consentimento.deleteMany(),
    prisma.participanteDePesquisa.deleteMany(),
    prisma.alergiaDoPaciente.deleteMany(),
    prisma.contatoDoPaciente.deleteMany(),
    prisma.verbeteDaBiblioteca.deleteMany(),
    prisma.medicamento.deleteMany(),
    prisma.concessaoDePermissao.deleteMany(),
    prisma.sessaoDeAcesso.deleteMany(),
    prisma.paciente.deleteMany(),
    prisma.profissional.deleteMany(),
    prisma.protocolo.deleteMany(),
    prisma.usuario.deleteMany(),
  ]);

  const senhaHash = await hash(SENHA_DE_DEMONSTRACAO, 10);

  // ---- protocolo e medicamento ----
  const protocolo = await prisma.protocolo.create({
    data: {
      nome: 'Protocolo de demonstração',
      descricao:
        'Protocolo sintético para desenvolvimento. Não representa nenhum esquema terapêutico real.',
    },
  });

  const ondansetrona = await prisma.medicamento.create({
    data: { nome: 'Ondansetrona', principioAtivo: 'Ondansetrona' },
  });

  // ---- administrador ----
  const admin = await prisma.usuario.create({
    data: {
      email: 'admin@aurea.local',
      senhaHash,
      perfil: 'ADMINISTRADOR',
      permissoes: {
        create: [
          { permissao: 'GERENCIAR_CADASTROS' },
          { permissao: 'GERENCIAR_USUARIOS' },
          { permissao: 'EDITAR_ALGORITMO' },
          { permissao: 'PUBLICAR_ALGORITMO' },
          { permissao: 'EDITAR_ORIENTACAO' },
        ],
      },
    },
  });

  // ---- enfermeira de plantão ----
  // Regra 6 na prática: ela atende, lê histórico e registra intervenção — e NÃO edita
  // algoritmo. Quem muda o corte muda o risco de todos os pacientes de uma vez.
  const usuarioEnfermeira = await prisma.usuario.create({
    data: {
      email: 'enfermagem@aurea.local',
      senhaHash,
      perfil: 'PROFISSIONAL',
      permissoes: {
        create: [
          { permissao: 'ATENDER_PLANTAO' },
          { permissao: 'VER_HISTORICO_DE_PACIENTE' },
          { permissao: 'REGISTRAR_INTERVENCAO' },
        ],
      },
    },
  });

  const enfermeira = await prisma.profissional.create({
    data: {
      usuarioId: usuarioEnfermeira.id,
      nome: 'Enfermeira de demonstração',
      funcao: 'ENFERMEIRO',
      registroDoConselho: 'COREN-XX 000000',
    },
  });

  const usuarioMedico = await prisma.usuario.create({
    data: {
      email: 'medico@aurea.local',
      senhaHash,
      perfil: 'PROFISSIONAL',
      permissoes: { create: [{ permissao: 'VER_HISTORICO_DE_PACIENTE' }] },
    },
  });

  const medico = await prisma.profissional.create({
    data: {
      usuarioId: usuarioMedico.id,
      nome: 'Médico de demonstração',
      funcao: 'MEDICO',
      registroDoConselho: 'CRM-XX 000000',
    },
  });

  // ---- conjunto de limiares provisório ----
  const conjunto = await prisma.conjuntoDeLimiares.create({
    data: {
      versao: VERSAO_DO_CONJUNTO_RASCUNHO,
      descricao:
        'Conjunto provisório de demonstração. Nenhum corte foi validado clinicamente. Existe para que o sistema ' +
        'funcione enquanto o protocolo de graduação de toxicidade do serviço não é definido.',
      origem: 'PROVISÓRIO, sem base clínica. Aguarda definição do orientador (CTCAE ou protocolo institucional).',
      validadoClinicamente: false,
      combinacao: 'PIOR_ISOLADO',
      efeitoDoAntitermico: 'IGNORAR',
      tratamentoDeAbandono: 'NAO_CLASSIFICAR',
      ativo: true,
      publicadoEm: new Date(),
    },
  });

  await prisma.regraDeLimiar.createMany({
    data: REGRAS_DO_RASCUNHO.map((regra) => ({ ...regra, conjuntoId: conjunto.id })),
  });

  // ---- biblioteca ----
  // Uma categoria só, e apontando para material de instituição de referência em vez de
  // texto próprio: dez categorias de conteúdo clínico é trabalho de redação e revisão,
  // não de programa, e texto errado sobre neutropenia é dano direto.
  const verbeteNausea = await prisma.verbeteDaBiblioteca.create({
    data: {
      categoria: 'ALIMENTACAO',
      titulo: 'Enjoo durante o tratamento',
      corpo:
        'Comer em porções pequenas ao longo do dia costuma pesar menos do que três refeições grandes. ' +
        'Beba líquidos em goles, mesmo sem vontade. Se o enjoo não passar ou você não conseguir beber água, ' +
        'avise a equipe.',
      autoria: 'RASCUNHO, sem autoria clínica definida',
      publicado: false,
    },
  });

  // ---- conjunto de orientações ----
  const conjuntoDeOrientacoes = await prisma.conjuntoDeOrientacoes.create({
    data: {
      versao: 'rascunho-0',
      descricao: 'Textos provisórios de orientação. Nenhum foi revisado por responsável técnico.',
      ativo: true,
      publicadoEm: new Date(),
    },
  });

  await prisma.orientacao.createMany({
    data: [
      {
        conjuntoId: conjuntoDeOrientacoes.id,
        sintoma: 'NAUSEA_VOMITO',
        classificacao: 'AMARELO',
        ordem: 1,
        titulo: 'Enjoo',
        // Regra 8: este texto nomeia um medicamento, então só é entregue a quem tem
        // Ondansetrona prescrita. Quem não tem recebe a versão de baixo, sem nome.
        medicamentoId: ondansetrona.id,
        verbeteId: verbeteNausea.id,
        corpo:
          'Use a Ondansetrona conforme a receita. Coma em porções menores ao longo do dia e beba líquidos em goles. ' +
          'Se começar a vomitar sem parar, toque em "Falar com a enfermagem".',
      },
      {
        conjuntoId: conjuntoDeOrientacoes.id,
        sintoma: 'NAUSEA_VOMITO',
        classificacao: 'AMARELO',
        ordem: 2,
        titulo: 'Enjoo',
        verbeteId: verbeteNausea.id,
        corpo:
          'Coma em porções menores ao longo do dia e beba líquidos em goles. Se você tem remédio para enjoo receitado, ' +
          'use conforme a receita. Se começar a vomitar sem parar, toque em "Falar com a enfermagem".',
      },
      {
        conjuntoId: conjuntoDeOrientacoes.id,
        sintoma: 'NAUSEA_VOMITO',
        classificacao: 'VERMELHO',
        ordem: 1,
        titulo: 'Procure atendimento',
        corpo:
          'Não espere melhorar sozinho. Vá ao serviço de saúde agora. Se não conseguir ir por conta própria, ' +
          'peça ajuda a alguém da sua casa ou ligue para o seu contato de emergência.',
      },
      {
        conjuntoId: conjuntoDeOrientacoes.id,
        sintoma: 'FEBRE',
        classificacao: 'AMARELO',
        ordem: 1,
        titulo: 'Febre',
        corpo:
          'Meça a temperatura de novo daqui a duas horas e anote. Beba bastante líquido e descanse. ' +
          'Se a temperatura subir, toque em "Falar com a enfermagem".',
      },
      {
        conjuntoId: conjuntoDeOrientacoes.id,
        sintoma: 'FEBRE',
        classificacao: 'VERMELHO',
        ordem: 1,
        titulo: 'Procure atendimento',
        corpo:
          'Vá ao serviço de saúde agora e leve seus documentos e a receita do tratamento. ' +
          'Febre durante a quimioterapia precisa ser avaliada no mesmo dia.',
      },
      {
        conjuntoId: conjuntoDeOrientacoes.id,
        sintoma: 'DIARREIA',
        classificacao: 'AMARELO',
        ordem: 1,
        titulo: 'Diarreia',
        corpo:
          'Beba mais líquido do que o normal, em goles, ao longo do dia. Prefira comida leve. ' +
          'Se aparecer sangue ou você não conseguir beber, toque em "Falar com a enfermagem".',
      },
      {
        conjuntoId: conjuntoDeOrientacoes.id,
        sintoma: 'DIARREIA',
        classificacao: 'VERMELHO',
        ordem: 1,
        titulo: 'Procure atendimento',
        corpo: 'Vá ao serviço de saúde agora. Leve seus documentos e a receita do tratamento.',
      },
      {
        conjuntoId: conjuntoDeOrientacoes.id,
        sintoma: 'DOR',
        classificacao: 'AMARELO',
        ordem: 1,
        titulo: 'Dor',
        corpo:
          'Se você tem remédio para dor receitado, use conforme a receita. Anote onde dói e em que horas piora; ' +
          'isso ajuda a equipe. Se a dor aumentar, toque em "Falar com a enfermagem".',
      },
      {
        conjuntoId: conjuntoDeOrientacoes.id,
        sintoma: 'DOR',
        classificacao: 'VERMELHO',
        ordem: 1,
        titulo: 'Procure atendimento',
        corpo: 'Vá ao serviço de saúde agora.',
      },
      {
        conjuntoId: conjuntoDeOrientacoes.id,
        sintoma: 'FALTA_DE_AR',
        classificacao: 'AMARELO',
        ordem: 1,
        titulo: 'Falta de ar',
        corpo:
          'Sente-se, descanse e evite esforço. Repare se melhora em repouso. ' +
          'Se piorar ou você sentir falta de ar parado, toque em "Falar com a enfermagem".',
      },
      {
        conjuntoId: conjuntoDeOrientacoes.id,
        sintoma: 'FALTA_DE_AR',
        classificacao: 'VERMELHO',
        ordem: 1,
        titulo: 'Procure atendimento',
        corpo: 'Vá ao serviço de saúde agora. Se estiver difícil respirar parado, chame ajuda.',
      },
    ],
  });

  // ---- pacientes sintéticos ----
  const pacientesSinteticos = [
    { nome: 'Paciente Um (fictício)', base: '123456789', diaDoCiclo: 3, comPrescricao: true },
    { nome: 'Paciente Dois (fictício)', base: '111444777', diaDoCiclo: 9, comPrescricao: false },
    { nome: 'Paciente Três (fictício)', base: '987654321', diaDoCiclo: 15, comPrescricao: true },
  ];

  for (const [indice, sintetico] of pacientesSinteticos.entries()) {
    const cpf = gerarCpf(sintetico.base);

    const usuario = await prisma.usuario.create({
      data: { cpf, senhaHash, perfil: 'PACIENTE', primeiroAcessoEm: new Date() },
    });

    const paciente = await prisma.paciente.create({
      data: {
        usuarioId: usuario.id,
        nome: sintetico.nome,
        dataNascimento: new Date(1970 + indice * 5, indice, 10),
        sexo: indice % 2 === 0 ? 'FEMININO' : 'MASCULINO',
        diagnostico: 'Diagnóstico sintético de demonstração',
        habitoIntestinalBasal: 1,
        medicoAssistenteId: medico.id,
        contatos: {
          create: [
            {
              tipo: 'CONTATO_DO_PACIENTE',
              nome: sintetico.nome,
              telefone: '79900000000',
            },
            {
              tipo: 'CONTATO_DE_EMERGENCIA',
              nome: 'Contato de emergência (fictício)',
              telefone: '79911111111',
              relacao: 'familiar',
            },
          ],
        },
        consentimentos: { create: [{ versaoDoTermo: 'demo-0', aceitoEm: new Date() }] },
      },
    });

    const tratamento = await prisma.tratamento.create({
      data: {
        pacienteId: paciente.id,
        protocoloId: protocolo.id,
        medicoResponsavelId: medico.id,
        enfermeiroResponsavelId: enfermeira.id,
        iniciadoEm: emDias(-60),
      },
    });

    await prisma.ciclo.create({
      data: {
        tratamentoId: tratamento.id,
        numero: 3,
        sessaoRealizadaEm: emDias(-sintetico.diaDoCiclo),
        previsaoDaProximaSessao: emDias(21 - sintetico.diaDoCiclo),
      },
    });

    if (sintetico.comPrescricao) {
      await prisma.prescricao.create({
        data: {
          pacienteId: paciente.id,
          medicamentoId: ondansetrona.id,
          posologia: '8 mg, via oral, a cada 8 horas se enjoo',
          iniciadaEm: emDias(-60),
          prescritaPorId: medico.id,
        },
      });
    }

    await prisma.eventoDeAgenda.create({
      data: {
        pacienteId: paciente.id,
        tipo: 'QUIMIOTERAPIA',
        aconteceEm: emDias(21 - sintetico.diaDoCiclo),
        local: 'Local de demonstração',
        profissionalId: enfermeira.id,
      },
    });

    console.log(`  paciente "${sintetico.nome}" — CPF ${cpf} — dia ${sintetico.diaDoCiclo} do ciclo`);
  }

  /* A biblioteca vem do mesmo arquivo que publica em produção — uma fonte de
     conteúdo, dois caminhos até o banco. Aqui roda no banco recém-limpo; lá roda
     sozinha, sem apagar nada. */
  const biblioteca = await publicarVerbetes(prisma);

  console.log('');
  console.log('Seed concluído.');
  console.log(`  biblioteca: ${biblioteca.criados} verbetes publicados (rascunho, sem autoria clínica)`);
  console.log(`  conjunto de limiares: ${VERSAO_DO_CONJUNTO_RASCUNHO} (NÃO validado clinicamente)`);
  console.log(`  regras de corte: ${REGRAS_DO_RASCUNHO.length}`);
  console.log(`  admin: admin@aurea.local | enfermagem: enfermagem@aurea.local | senha: ${SENHA_DE_DEMONSTRACAO}`);
  console.log(`  administrador criado: ${admin.email}`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
