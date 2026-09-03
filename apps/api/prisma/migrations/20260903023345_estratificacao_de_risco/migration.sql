-- AlterTable
ALTER TABLE `pacientes` ADD COLUMN `contextoSocialAvaliadoEm` DATETIME(3) NULL,
    ADD COLUMN `dificuldadeDeTransporte` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `ecog` ENUM('ZERO', 'UM', 'DOIS', 'TRES', 'QUATRO', 'NAO_AVALIADO') NOT NULL DEFAULT 'NAO_AVALIADO',
    ADD COLUMN `moraSozinho` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `temCuidador` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `protocolos` ADD COLUMN `altoRiscoDeNeutropenia` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `bombaInfusora` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `imunoterapia` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `tratamentoOral` BOOLEAN NOT NULL DEFAULT false;
