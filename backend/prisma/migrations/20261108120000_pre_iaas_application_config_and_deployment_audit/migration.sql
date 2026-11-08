-- Pre-IAAS Sprint A: application deployment configuration and deployment audit metadata.
-- This migration is additive and keeps existing rows valid through defaults.

-- AlterTable
ALTER TABLE `applications`
    ADD COLUMN `dockerfile_path` VARCHAR(255) NOT NULL DEFAULT 'Dockerfile',
    ADD COLUMN `build_context` VARCHAR(255) NOT NULL DEFAULT '.',
    ADD COLUMN `internal_port` INTEGER NOT NULL DEFAULT 3000,
    ADD COLUMN `health_check_path` VARCHAR(255) NOT NULL DEFAULT '/',
    ADD COLUMN `cpu_cores` DOUBLE NOT NULL DEFAULT 0.5,
    ADD COLUMN `memory_mb` INTEGER NOT NULL DEFAULT 512,
    ADD COLUMN `pids_limit` INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE `deployments`
    ADD COLUMN `branch` VARCHAR(255) NULL,
    ADD COLUMN `request_fingerprint` VARCHAR(64) NULL,
    ADD COLUMN `requested_by_user_id` VARCHAR(36) NULL,
    ADD COLUMN `log_line_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `log_byte_count` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `deployments_status_created_at_idx` ON `deployments`(`status`, `created_at`);

-- CreateIndex
CREATE INDEX `deployments_requested_by_user_id_created_at_idx` ON `deployments`(`requested_by_user_id`, `created_at`);

-- CreateIndex
CREATE INDEX `runtime_nodes_status_last_heartbeat_at_idx` ON `runtime_nodes`(`status`, `last_heartbeat_at`);

-- AddForeignKey
ALTER TABLE `deployments` ADD CONSTRAINT `deployments_requested_by_user_id_fkey` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
