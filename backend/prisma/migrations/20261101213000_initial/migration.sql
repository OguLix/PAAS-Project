-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessions_token_hash_key`(`token_hash`),
    INDEX `sessions_user_id_expires_at_idx`(`user_id`, `expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `applications` (
    `id` VARCHAR(36) NOT NULL,
    `owner_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `source_repository` VARCHAR(2048) NOT NULL,
    `default_branch` VARCHAR(255) NOT NULL,
    `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `applications_owner_id_created_at_idx`(`owner_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `runtime_nodes` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `host` VARCHAR(255) NOT NULL,
    `ssh_port` INTEGER NOT NULL DEFAULT 22,
    `status` ENUM('ONLINE', 'DEGRADED', 'OFFLINE', 'MAINTENANCE') NOT NULL DEFAULT 'OFFLINE',
    `capacity_cpu_millicores` INTEGER NOT NULL DEFAULT 0,
    `capacity_memory_mb` INTEGER NOT NULL DEFAULT 0,
    `last_heartbeat_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `runtime_nodes_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deployments` (
    `id` VARCHAR(36) NOT NULL,
    `application_id` VARCHAR(36) NOT NULL,
    `runtime_node_id` VARCHAR(36) NULL,
    `status` ENUM('QUEUED', 'PREPARING', 'BUILDING', 'STARTING', 'HEALTH_CHECKING', 'RUNNING', 'STOPPING', 'STOPPED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
    `commit_sha` VARCHAR(64) NULL,
    `image_reference` VARCHAR(512) NULL,
    `image_digest` VARCHAR(128) NULL,
    `allocated_port` INTEGER NULL,
    `idempotency_key` VARCHAR(128) NULL,
    `error_code` VARCHAR(64) NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `deployments_application_id_created_at_idx`(`application_id`, `created_at`),
    INDEX `deployments_runtime_node_id_status_idx`(`runtime_node_id`, `status`),
    UNIQUE INDEX `deployments_application_id_idempotency_key_key`(`application_id`, `idempotency_key`),
    UNIQUE INDEX `deployments_runtime_node_id_allocated_port_key`(`runtime_node_id`, `allocated_port`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deployment_logs` (
    `id` VARCHAR(36) NOT NULL,
    `deployment_id` VARCHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `level` ENUM('INFO', 'WARN', 'ERROR') NOT NULL DEFAULT 'INFO',
    `stream` ENUM('BUILD', 'SYSTEM') NOT NULL DEFAULT 'BUILD',
    `message` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `deployment_logs_deployment_id_created_at_idx`(`deployment_id`, `created_at`),
    UNIQUE INDEX `deployment_logs_deployment_id_sequence_key`(`deployment_id`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `domains` (
    `id` VARCHAR(36) NOT NULL,
    `application_id` VARCHAR(36) NOT NULL,
    `hostname` VARCHAR(253) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('PENDING', 'ACTIVE', 'FAILED', 'DISABLED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `domains_hostname_key`(`hostname`),
    INDEX `domains_application_id_idx`(`application_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `environment_variables` (
    `id` VARCHAR(36) NOT NULL,
    `application_id` VARCHAR(36) NOT NULL,
    `key` VARCHAR(128) NOT NULL,
    `encrypted_value` TEXT NOT NULL,
    `is_secret` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `environment_variables_application_id_key_key`(`application_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_events` (
    `id` VARCHAR(36) NOT NULL,
    `actor_user_id` VARCHAR(36) NULL,
    `action` VARCHAR(64) NOT NULL,
    `resource_type` VARCHAR(64) NOT NULL,
    `resource_id` VARCHAR(64) NULL,
    `request_id` VARCHAR(64) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_events_actor_user_id_created_at_idx`(`actor_user_id`, `created_at`),
    INDEX `audit_events_resource_type_resource_id_idx`(`resource_type`, `resource_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `applications` ADD CONSTRAINT `applications_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deployments` ADD CONSTRAINT `deployments_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deployments` ADD CONSTRAINT `deployments_runtime_node_id_fkey` FOREIGN KEY (`runtime_node_id`) REFERENCES `runtime_nodes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deployment_logs` ADD CONSTRAINT `deployment_logs_deployment_id_fkey` FOREIGN KEY (`deployment_id`) REFERENCES `deployments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `domains` ADD CONSTRAINT `domains_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `environment_variables` ADD CONSTRAINT `environment_variables_application_id_fkey` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
