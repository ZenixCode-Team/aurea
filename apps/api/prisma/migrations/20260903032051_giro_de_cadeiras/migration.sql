-- AlterTable
ALTER TABLE `protocolos` ADD COLUMN `tempoDeInfusaoEmMinutos` INTEGER NOT NULL DEFAULT 120,
    ADD COLUMN `tempoDeObservacaoEmMinutos` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `tempoDePreMedicacaoEmMinutos` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `tempoDePreparoEmMinutos` INTEGER NOT NULL DEFAULT 20;

-- CreateTable
CREATE TABLE `cadeiras` (
    `id` VARCHAR(191) NOT NULL,
    `numero` INTEGER NOT NULL,
    `ativa` BOOLEAN NOT NULL DEFAULT true,
    `observacao` VARCHAR(180) NULL,
    `criadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cadeiras_numero_key`(`numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessoes_de_infusao` (
    `id` VARCHAR(191) NOT NULL,
    `pacienteId` VARCHAR(191) NOT NULL,
    `cadeiraId` VARCHAR(191) NULL,
    `tratamentoId` VARCHAR(191) NULL,
    `previsaoDeInicio` DATETIME(3) NOT NULL,
    `previsaoDeFim` DATETIME(3) NOT NULL,
    `inicioReal` DATETIME(3) NULL,
    `fimReal` DATETIME(3) NULL,
    `estado` ENUM('AGENDADA', 'AGUARDANDO_MEDICACAO', 'EM_PREPARO', 'EM_INFUSAO', 'EM_OBSERVACAO', 'CONCLUIDA', 'CANCELADA') NOT NULL DEFAULT 'AGENDADA',
    `medicacaoLiberadaEm` DATETIME(3) NULL,
    `observacao` VARCHAR(255) NULL,
    `criadaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadaEm` DATETIME(3) NOT NULL,

    INDEX `sessoes_de_infusao_previsaoDeInicio_estado_idx`(`previsaoDeInicio`, `estado`),
    INDEX `sessoes_de_infusao_cadeiraId_previsaoDeInicio_idx`(`cadeiraId`, `previsaoDeInicio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessoes_de_infusao` ADD CONSTRAINT `sessoes_de_infusao_pacienteId_fkey` FOREIGN KEY (`pacienteId`) REFERENCES `pacientes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessoes_de_infusao` ADD CONSTRAINT `sessoes_de_infusao_cadeiraId_fkey` FOREIGN KEY (`cadeiraId`) REFERENCES `cadeiras`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessoes_de_infusao` ADD CONSTRAINT `sessoes_de_infusao_tratamentoId_fkey` FOREIGN KEY (`tratamentoId`) REFERENCES `tratamentos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
