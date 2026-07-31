-- CreateTable
CREATE TABLE `usuarios` (
    `id` VARCHAR(191) NOT NULL,
    `cpf` VARCHAR(11) NULL,
    `email` VARCHAR(180) NULL,
    `senhaHash` VARCHAR(120) NOT NULL,
    `perfil` ENUM('PACIENTE', 'PROFISSIONAL', 'ADMINISTRADOR') NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `primeiroAcessoEm` DATETIME(3) NULL,
    `ultimoAcessoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usuarios_cpf_key`(`cpf`),
    UNIQUE INDEX `usuarios_email_key`(`email`),
    INDEX `usuarios_perfil_ativo_idx`(`perfil`, `ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `concessoes_de_permissao` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `permissao` ENUM('ATENDER_PLANTAO', 'VER_HISTORICO_DE_PACIENTE', 'REGISTRAR_INTERVENCAO', 'EDITAR_ALGORITMO', 'PUBLICAR_ALGORITMO', 'EDITAR_ORIENTACAO', 'GERENCIAR_CADASTROS', 'GERENCIAR_USUARIOS', 'EXPORTAR_CONJUNTO_DE_PESQUISA') NOT NULL,
    `concedidaPorId` VARCHAR(191) NULL,
    `concedidaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revogadaEm` DATETIME(3) NULL,

    INDEX `concessoes_de_permissao_usuarioId_revogadaEm_idx`(`usuarioId`, `revogadaEm`),
    UNIQUE INDEX `concessoes_de_permissao_usuarioId_permissao_key`(`usuarioId`, `permissao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessoes_de_acesso` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(120) NOT NULL,
    `expiraEm` DATETIME(3) NOT NULL,
    `revogadaEm` DATETIME(3) NULL,
    `ip` VARCHAR(45) NULL,
    `userAgent` VARCHAR(255) NULL,
    `criadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessoes_de_acesso_tokenHash_key`(`tokenHash`),
    INDEX `sessoes_de_acesso_usuarioId_expiraEm_idx`(`usuarioId`, `expiraEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profissionais` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(180) NOT NULL,
    `funcao` ENUM('MEDICO', 'ENFERMEIRO', 'TECNICO_DE_ENFERMAGEM', 'NUTRICIONISTA', 'PSICOLOGO') NOT NULL,
    `registroDoConselho` VARCHAR(40) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `profissionais_usuarioId_key`(`usuarioId`),
    INDEX `profissionais_funcao_ativo_idx`(`funcao`, `ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pacientes` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(180) NOT NULL,
    `dataNascimento` DATE NOT NULL,
    `sexo` ENUM('FEMININO', 'MASCULINO', 'OUTRO', 'NAO_INFORMADO') NOT NULL DEFAULT 'NAO_INFORMADO',
    `diagnostico` VARCHAR(255) NOT NULL,
    `convenio` VARCHAR(120) NULL,
    `tipoSanguineo` VARCHAR(5) NULL,
    `urlDaFoto` VARCHAR(500) NULL,
    `habitoIntestinalBasal` INTEGER NULL,
    `medicoAssistenteId` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pacientes_usuarioId_key`(`usuarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contatos_do_paciente` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `tipo` ENUM('CONTATO_DO_PACIENTE', 'CONTATO_DE_EMERGENCIA') NOT NULL,
    `nome` VARCHAR(180) NOT NULL,
    `telefone` VARCHAR(20) NOT NULL,
    `relacao` VARCHAR(60) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `contatos_do_paciente_pacienteId_tipo_idx`(`pacienteId`, `tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alergias_do_paciente` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(255) NOT NULL,
    `origem` ENUM('EQUIPE', 'PACIENTE') NOT NULL DEFAULT 'EQUIPE',
    `confirmadaPorId` VARCHAR(191) NULL,
    `confirmadaEm` DATETIME(3) NULL,
    `criadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `alergias_do_paciente_pacienteId_confirmadaEm_idx`(`pacienteId`, `confirmadaEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `protocolos` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(120) NOT NULL,
    `descricao` TEXT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `protocolos_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tratamentos` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `protocoloId` VARCHAR(191) NOT NULL,
    `medicoResponsavelId` VARCHAR(191) NULL,
    `enfermeiroResponsavelId` VARCHAR(191) NULL,
    `iniciadoEm` DATE NOT NULL,
    `encerradoEm` DATE NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tratamentos_pacienteId_encerradoEm_idx`(`pacienteId`, `encerradoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ciclos` (
    `id` VARCHAR(191) NOT NULL,
    `tratamentoId` VARCHAR(191) NOT NULL,
    `numero` INTEGER NOT NULL,
    `sessaoRealizadaEm` DATE NOT NULL,
    `previsaoDaProximaSessao` DATE NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ciclos_sessaoRealizadaEm_idx`(`sessaoRealizadaEm`),
    UNIQUE INDEX `ciclos_tratamentoId_numero_key`(`tratamentoId`, `numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medicamentos` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(160) NOT NULL,
    `principioAtivo` VARCHAR(160) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `medicamentos_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prescricoes` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `medicamentoId` VARCHAR(191) NOT NULL,
    `posologia` VARCHAR(255) NOT NULL,
    `iniciadaEm` DATE NOT NULL,
    `encerradaEm` DATE NULL,
    `prescritaPorId` VARCHAR(191) NULL,
    `criadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `prescricoes_pacienteId_encerradaEm_idx`(`pacienteId`, `encerradaEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conjuntos_de_limiares` (
    `id` VARCHAR(191) NOT NULL,
    `versao` VARCHAR(60) NOT NULL,
    `descricao` TEXT NOT NULL,
    `origem` VARCHAR(255) NOT NULL,
    `validadoClinicamente` BOOLEAN NOT NULL DEFAULT false,
    `validadoPorId` VARCHAR(191) NULL,
    `validadoEm` DATETIME(3) NULL,
    `combinacao` ENUM('PIOR_ISOLADO', 'DOIS_AMARELOS_VIRAM_VERMELHO') NOT NULL DEFAULT 'PIOR_ISOLADO',
    `efeitoDoAntitermico` ENUM('IGNORAR', 'ELEVAR_UM_NIVEL') NOT NULL DEFAULT 'IGNORAR',
    `tratamentoDeAbandono` ENUM('NAO_CLASSIFICAR', 'PIOR_DOS_RESPONDIDOS') NOT NULL DEFAULT 'NAO_CLASSIFICAR',
    `ativo` BOOLEAN NOT NULL DEFAULT false,
    `publicadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `conjuntos_de_limiares_versao_key`(`versao`),
    INDEX `conjuntos_de_limiares_ativo_idx`(`ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `regras_de_limiar` (
    `id` VARCHAR(191) NOT NULL,
    `conjuntoId` VARCHAR(191) NOT NULL,
    `ordem` INTEGER NOT NULL,
    `sintoma` ENUM('FEBRE', 'DIARREIA', 'NAUSEA_VOMITO', 'DOR', 'FALTA_DE_AR') NOT NULL,
    `campo` VARCHAR(64) NOT NULL,
    `operador` ENUM('MAIOR_OU_IGUAL', 'MAIOR_QUE', 'MENOR_OU_IGUAL', 'MENOR_QUE', 'IGUAL', 'ENTRE', 'E_VERDADEIRO', 'E_FALSO', 'ESTA_EM') NOT NULL,
    `valor` DECIMAL(6, 2) NULL,
    `valorSecundario` DECIMAL(6, 2) NULL,
    `valoresDeTexto` JSON NULL,
    `classificacao` ENUM('VERDE', 'AMARELO', 'VERMELHO') NOT NULL,
    `justificativa` TEXT NOT NULL,
    `diaDoCicloMinimo` INTEGER NULL,
    `diaDoCicloMaximo` INTEGER NULL,
    `protocoloId` VARCHAR(191) NULL,

    INDEX `regras_de_limiar_conjuntoId_sintoma_idx`(`conjuntoId`, `sintoma`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conjuntos_de_orientacoes` (
    `id` VARCHAR(191) NOT NULL,
    `versao` VARCHAR(60) NOT NULL,
    `descricao` TEXT NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT false,
    `publicadoEm` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `conjuntos_de_orientacoes_versao_key`(`versao`),
    INDEX `conjuntos_de_orientacoes_ativo_idx`(`ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orientacoes` (
    `id` VARCHAR(191) NOT NULL,
    `conjuntoId` VARCHAR(191) NOT NULL,
    `sintoma` ENUM('FEBRE', 'DIARREIA', 'NAUSEA_VOMITO', 'DOR', 'FALTA_DE_AR') NOT NULL,
    `classificacao` ENUM('VERDE', 'AMARELO', 'VERMELHO') NOT NULL,
    `protocoloId` VARCHAR(191) NULL,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `titulo` VARCHAR(180) NOT NULL,
    `corpo` TEXT NOT NULL,
    `medicamentoId` VARCHAR(191) NULL,
    `verbeteId` VARCHAR(191) NULL,

    INDEX `orientacoes_conjuntoId_sintoma_classificacao_idx`(`conjuntoId`, `sintoma`, `classificacao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessoes_de_triagem` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `cicloId` VARCHAR(191) NULL,
    `chaveDeIdempotencia` VARCHAR(60) NOT NULL,
    `estado` ENUM('EM_ANDAMENTO', 'CONCLUIDA', 'ABANDONADA') NOT NULL DEFAULT 'EM_ANDAMENTO',
    `iniciadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `concluidaEm` DATETIME(3) NULL,

    UNIQUE INDEX `sessoes_de_triagem_chaveDeIdempotencia_key`(`chaveDeIdempotencia`),
    INDEX `sessoes_de_triagem_pacienteId_iniciadaEm_idx`(`pacienteId`, `iniciadaEm`),
    INDEX `sessoes_de_triagem_estado_iniciadaEm_idx`(`estado`, `iniciadaEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `respostas_de_sintoma` (
    `id` VARCHAR(191) NOT NULL,
    `sessaoId` VARCHAR(191) NOT NULL,
    `sintoma` ENUM('FEBRE', 'DIARREIA', 'NAUSEA_VOMITO', 'DOR', 'FALTA_DE_AR') NOT NULL,
    `campo` VARCHAR(64) NOT NULL,
    `valorNumerico` DECIMAL(6, 2) NULL,
    `valorBooleano` BOOLEAN NULL,
    `valorTexto` VARCHAR(120) NULL,
    `respondidaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `respostas_de_sintoma_sintoma_campo_idx`(`sintoma`, `campo`),
    UNIQUE INDEX `respostas_de_sintoma_sessaoId_sintoma_campo_key`(`sessaoId`, `sintoma`, `campo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `classificacoes` (
    `id` VARCHAR(191) NOT NULL,
    `sessaoId` VARCHAR(191) NOT NULL,
    `conjuntoDeLimiaresId` VARCHAR(191) NOT NULL,
    `situacao` ENUM('CLASSIFICADA', 'NAO_CLASSIFICADA') NOT NULL,
    `resultado` ENUM('VERDE', 'AMARELO', 'VERMELHO') NULL,
    `motivoDeNaoClassificar` VARCHAR(255) NULL,
    `explicacao` JSON NOT NULL,
    `origem` ENUM('ORIGINAL', 'REPROCESSAMENTO') NOT NULL DEFAULT 'ORIGINAL',
    `calculadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `classificacoes_resultado_calculadaEm_idx`(`resultado`, `calculadaEm`),
    UNIQUE INDEX `classificacoes_sessaoId_conjuntoDeLimiaresId_key`(`sessaoId`, `conjuntoDeLimiaresId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orientacoes_entregues` (
    `id` VARCHAR(191) NOT NULL,
    `sessaoId` VARCHAR(191) NOT NULL,
    `orientacaoId` VARCHAR(191) NOT NULL,
    `entregueEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `orientacoes_entregues_sessaoId_orientacaoId_key`(`sessaoId`, `orientacaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `intervencoes` (
    `id` VARCHAR(191) NOT NULL,
    `sessaoDeTriagemId` VARCHAR(191) NOT NULL,
    `profissionalId` VARCHAR(191) NOT NULL,
    `conduta` TEXT NOT NULL,
    `situacao` ENUM('RESOLVIDO', 'EM_ACOMPANHAMENTO') NOT NULL,
    `contatoRealizadoEm` DATETIME(3) NOT NULL,
    `registradaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `intervencoes_sessaoDeTriagemId_idx`(`sessaoDeTriagemId`),
    INDEX `intervencoes_situacao_registradaEm_idx`(`situacao`, `registradaEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitacoes_de_contato` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `sessaoId` VARCHAR(191) NULL,
    `solicitadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atendidaEm` DATETIME(3) NULL,
    `atendidaPorId` VARCHAR(191) NULL,

    INDEX `solicitacoes_de_contato_atendidaEm_solicitadaEm_idx`(`atendidaEm`, `solicitadaEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `eventos_de_agenda` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `tipo` ENUM('QUIMIOTERAPIA', 'CONSULTA_MEDICA', 'CONSULTA_NUTRICAO', 'CONSULTA_PSICOLOGIA') NOT NULL,
    `aconteceEm` DATETIME(3) NOT NULL,
    `local` VARCHAR(180) NULL,
    `profissionalId` VARCHAR(191) NULL,
    `observacoes` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `eventos_de_agenda_pacienteId_aconteceEm_idx`(`pacienteId`, `aconteceEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verbetes_da_biblioteca` (
    `id` VARCHAR(191) NOT NULL,
    `categoria` ENUM('MEDICAMENTOS', 'ALIMENTACAO', 'MUCOSITE', 'CATETER', 'QUEDA_DE_CABELO', 'DIARREIA', 'CONSTIPACAO', 'EXERCICIOS', 'VACINAS', 'DIREITOS_DO_PACIENTE') NOT NULL,
    `titulo` VARCHAR(180) NOT NULL,
    `corpo` TEXT NOT NULL,
    `autoria` VARCHAR(180) NOT NULL,
    `fonteExterna` VARCHAR(500) NULL,
    `revisadoPor` VARCHAR(180) NULL,
    `revisadoEm` DATETIME(3) NULL,
    `publicado` BOOLEAN NOT NULL DEFAULT false,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `verbetes_da_biblioteca_categoria_publicado_idx`(`categoria`, `publicado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notificacoes` (
    `id` VARCHAR(191) NOT NULL,
    `destinatarioId` VARCHAR(191) NOT NULL,
    `canal` ENUM('NO_APP', 'EMAIL', 'WHATSAPP', 'SMS', 'PUSH') NOT NULL,
    `assunto` VARCHAR(180) NOT NULL,
    `corpo` TEXT NOT NULL,
    `referenciaTipo` VARCHAR(60) NULL,
    `referenciaId` VARCHAR(60) NULL,
    `enviadaEm` DATETIME(3) NULL,
    `lidaEm` DATETIME(3) NULL,
    `criadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notificacoes_destinatarioId_lidaEm_idx`(`destinatarioId`, `lidaEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `logs_de_acesso` (
    `id` VARCHAR(191) NOT NULL,
    `usuarioId` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NULL,
    `acao` ENUM('LOGIN', 'LOGIN_RECUSADO', 'LEITURA_DE_HISTORICO', 'LEITURA_DE_PACIENTE', 'REGISTRO_DE_INTERVENCAO', 'EDICAO_DE_ALGORITMO', 'PUBLICACAO_DE_ALGORITMO', 'EXPORTACAO_DE_PESQUISA') NOT NULL,
    `rota` VARCHAR(180) NOT NULL,
    `metodo` VARCHAR(10) NOT NULL,
    `ip` VARCHAR(45) NULL,
    `userAgent` VARCHAR(255) NULL,
    `ocorridoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `logs_de_acesso_pacienteId_ocorridoEm_idx`(`pacienteId`, `ocorridoEm`),
    INDEX `logs_de_acesso_usuarioId_ocorridoEm_idx`(`usuarioId`, `ocorridoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consentimentos` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `versaoDoTermo` VARCHAR(40) NOT NULL,
    `aceitoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip` VARCHAR(45) NULL,

    UNIQUE INDEX `consentimentos_pacienteId_versaoDoTermo_key`(`pacienteId`, `versaoDoTermo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `participantes_de_pesquisa` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(20) NOT NULL,
    `incluidoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `excluidoEm` DATETIME(3) NULL,

    UNIQUE INDEX `participantes_de_pesquisa_pacienteId_key`(`pacienteId`),
    UNIQUE INDEX `participantes_de_pesquisa_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `concessoes_de_permissao` ADD CONSTRAINT `concessoes_de_permissao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `concessoes_de_permissao` ADD CONSTRAINT `concessoes_de_permissao_concedidaPorId_fkey` FOREIGN KEY (`concedidaPorId`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessoes_de_acesso` ADD CONSTRAINT `sessoes_de_acesso_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `profissionais` ADD CONSTRAINT `profissionais_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pacientes` ADD CONSTRAINT `pacientes_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pacientes` ADD CONSTRAINT `pacientes_medicoAssistenteId_fkey` FOREIGN KEY (`medicoAssistenteId`) REFERENCES `profissionais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contatos_do_paciente` ADD CONSTRAINT `contatos_do_paciente_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alergias_do_paciente` ADD CONSTRAINT `alergias_do_paciente_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alergias_do_paciente` ADD CONSTRAINT `alergias_do_paciente_confirmadaPorId_fkey` FOREIGN KEY (`confirmadaPorId`) REFERENCES `profissionais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tratamentos` ADD CONSTRAINT `tratamentos_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tratamentos` ADD CONSTRAINT `tratamentos_protocoloId_fkey` FOREIGN KEY (`protocoloId`) REFERENCES `protocolos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tratamentos` ADD CONSTRAINT `tratamentos_medicoResponsavelId_fkey` FOREIGN KEY (`medicoResponsavelId`) REFERENCES `profissionais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tratamentos` ADD CONSTRAINT `tratamentos_enfermeiroResponsavelId_fkey` FOREIGN KEY (`enfermeiroResponsavelId`) REFERENCES `profissionais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ciclos` ADD CONSTRAINT `ciclos_tratamentoId_fkey` FOREIGN KEY (`tratamentoId`) REFERENCES `tratamentos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescricoes` ADD CONSTRAINT `prescricoes_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescricoes` ADD CONSTRAINT `prescricoes_medicamentoId_fkey` FOREIGN KEY (`medicamentoId`) REFERENCES `medicamentos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescricoes` ADD CONSTRAINT `prescricoes_prescritaPorId_fkey` FOREIGN KEY (`prescritaPorId`) REFERENCES `profissionais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `regras_de_limiar` ADD CONSTRAINT `regras_de_limiar_conjuntoId_fkey` FOREIGN KEY (`conjuntoId`) REFERENCES `conjuntos_de_limiares`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `regras_de_limiar` ADD CONSTRAINT `regras_de_limiar_protocoloId_fkey` FOREIGN KEY (`protocoloId`) REFERENCES `protocolos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orientacoes` ADD CONSTRAINT `orientacoes_conjuntoId_fkey` FOREIGN KEY (`conjuntoId`) REFERENCES `conjuntos_de_orientacoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orientacoes` ADD CONSTRAINT `orientacoes_protocoloId_fkey` FOREIGN KEY (`protocoloId`) REFERENCES `protocolos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orientacoes` ADD CONSTRAINT `orientacoes_medicamentoId_fkey` FOREIGN KEY (`medicamentoId`) REFERENCES `medicamentos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orientacoes` ADD CONSTRAINT `orientacoes_verbeteId_fkey` FOREIGN KEY (`verbeteId`) REFERENCES `verbetes_da_biblioteca`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessoes_de_triagem` ADD CONSTRAINT `sessoes_de_triagem_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessoes_de_triagem` ADD CONSTRAINT `sessoes_de_triagem_cicloId_fkey` FOREIGN KEY (`cicloId`) REFERENCES `ciclos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `respostas_de_sintoma` ADD CONSTRAINT `respostas_de_sintoma_sessaoId_fkey` FOREIGN KEY (`sessaoId`) REFERENCES `sessoes_de_triagem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classificacoes` ADD CONSTRAINT `classificacoes_sessaoId_fkey` FOREIGN KEY (`sessaoId`) REFERENCES `sessoes_de_triagem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classificacoes` ADD CONSTRAINT `classificacoes_conjuntoDeLimiaresId_fkey` FOREIGN KEY (`conjuntoDeLimiaresId`) REFERENCES `conjuntos_de_limiares`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orientacoes_entregues` ADD CONSTRAINT `orientacoes_entregues_sessaoId_fkey` FOREIGN KEY (`sessaoId`) REFERENCES `sessoes_de_triagem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orientacoes_entregues` ADD CONSTRAINT `orientacoes_entregues_orientacaoId_fkey` FOREIGN KEY (`orientacaoId`) REFERENCES `orientacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intervencoes` ADD CONSTRAINT `intervencoes_sessaoDeTriagemId_fkey` FOREIGN KEY (`sessaoDeTriagemId`) REFERENCES `sessoes_de_triagem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `intervencoes` ADD CONSTRAINT `intervencoes_profissionalId_fkey` FOREIGN KEY (`profissionalId`) REFERENCES `profissionais`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_de_contato` ADD CONSTRAINT `solicitacoes_de_contato_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_de_contato` ADD CONSTRAINT `solicitacoes_de_contato_sessaoId_fkey` FOREIGN KEY (`sessaoId`) REFERENCES `sessoes_de_triagem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitacoes_de_contato` ADD CONSTRAINT `solicitacoes_de_contato_atendidaPorId_fkey` FOREIGN KEY (`atendidaPorId`) REFERENCES `profissionais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eventos_de_agenda` ADD CONSTRAINT `eventos_de_agenda_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eventos_de_agenda` ADD CONSTRAINT `eventos_de_agenda_profissionalId_fkey` FOREIGN KEY (`profissionalId`) REFERENCES `profissionais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notificacoes` ADD CONSTRAINT `notificacoes_destinatarioId_fkey` FOREIGN KEY (`destinatarioId`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `logs_de_acesso` ADD CONSTRAINT `logs_de_acesso_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `logs_de_acesso` ADD CONSTRAINT `logs_de_acesso_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consentimentos` ADD CONSTRAINT `consentimentos_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `participantes_de_pesquisa` ADD CONSTRAINT `participantes_de_pesquisa_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
