-- AlterTable
ALTER TABLE `pacientes` ADD COLUMN `atividadeFisica` ENUM('SEDENTARIO', 'LEVE', 'MODERADA', 'INTENSA', 'NAO_INFORMADO') NOT NULL DEFAULT 'NAO_INFORMADO',
    ADD COLUMN `consumoDeAlcool` ENUM('NAO_BEBE', 'SOCIAL', 'FREQUENTE', 'NAO_INFORMADO') NOT NULL DEFAULT 'NAO_INFORMADO',
    ADD COLUMN `descricaoDaAtividade` VARCHAR(200) NULL,
    ADD COLUMN `parouDeFumarEm` DATE NULL,
    ADD COLUMN `tabagismo` ENUM('NUNCA_FUMOU', 'EX_FUMANTE', 'FUMANTE_ATUAL', 'NAO_INFORMADO') NOT NULL DEFAULT 'NAO_INFORMADO';

-- CreateTable
CREATE TABLE `comorbidades_do_paciente` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(255) NOT NULL,
    `origem` ENUM('EQUIPE', 'PACIENTE') NOT NULL DEFAULT 'EQUIPE',
    `confirmadaPorId` VARCHAR(191) NULL,
    `confirmadaEm` DATETIME(3) NULL,
    `criadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `comorbidades_do_paciente_pacienteId_confirmadaEm_idx`(`pacienteId`, `confirmadaEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `comorbidades_do_paciente` ADD CONSTRAINT `comorbidades_do_paciente_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comorbidades_do_paciente` ADD CONSTRAINT `comorbidades_do_paciente_confirmadaPorId_fkey` FOREIGN KEY (`confirmadaPorId`) REFERENCES `profissionais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
