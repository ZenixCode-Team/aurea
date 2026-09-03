-- AlterTable
ALTER TABLE `tratamentos` ADD COLUMN `motivoDaSuspensao` VARCHAR(255) NULL,
    ADD COLUMN `suspensoEm` DATE NULL;

-- CreateTable
CREATE TABLE `barreiras_do_paciente` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `tipo` ENUM('TRANSPORTE', 'AUTORIZACAO', 'FINANCEIRA', 'ANSIEDADE', 'REDE_DE_APOIO', 'DISTANCIA', 'TRABALHO', 'OUTRA') NOT NULL,
    `descricao` VARCHAR(255) NULL,
    `resolvidaEm` DATETIME(3) NULL,
    `registradaPorId` VARCHAR(191) NULL,
    `criadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `barreiras_do_paciente_tipo_resolvidaEm_idx`(`tipo`, `resolvidaEm`),
    INDEX `barreiras_do_paciente_pacienteId_idx`(`pacienteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pendencias_pre_tratamento` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `tipo` ENUM('EXAME', 'AUTORIZACAO', 'CONSULTA_MEDICA', 'TOXICIDADE_EM_ACOMPANHAMENTO', 'INTERNACAO_RECENTE', 'OUTRA') NOT NULL,
    `descricao` VARCHAR(255) NULL,
    `referenteA` DATE NOT NULL,
    `resolvidaEm` DATETIME(3) NULL,
    `criadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pendencias_pre_tratamento_referenteA_resolvidaEm_idx`(`referenteA`, `resolvidaEm`),
    INDEX `pendencias_pre_tratamento_pacienteId_idx`(`pacienteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `internacoes` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `motivo` VARCHAR(255) NOT NULL,
    `local` VARCHAR(160) NULL,
    `iniciadaEm` DATE NOT NULL,
    `altaEm` DATE NULL,
    `criadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `internacoes_pacienteId_altaEm_idx`(`pacienteId`, `altaEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `barreiras_do_paciente` ADD CONSTRAINT `barreiras_do_paciente_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `barreiras_do_paciente` ADD CONSTRAINT `barreiras_do_paciente_registradaPorId_fkey` FOREIGN KEY (`registradaPorId`) REFERENCES `profissionais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pendencias_pre_tratamento` ADD CONSTRAINT `pendencias_pre_tratamento_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `internacoes` ADD CONSTRAINT `internacoes_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
