-- CreateTable
CREATE TABLE `usuarios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `rol` ENUM('admin', 'tecnico') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `usuarios_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categorias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(100) NOT NULL,
    `peligrosidad` INTEGER NOT NULL,
    `radio_agrupacion` INTEGER NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `categorias_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `especialidades` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_id` INTEGER NOT NULL,
    `categoria_id` INTEGER NOT NULL,

    UNIQUE INDEX `especialidades_usuario_id_categoria_id_key`(`usuario_id`, `categoria_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reportes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `descripcion` TEXT NOT NULL,
    `foto_url` VARCHAR(500) NOT NULL,
    `latitud` DECIMAL(10, 8) NOT NULL,
    `longitud` DECIMAL(11, 8) NOT NULL,
    `estado` ENUM('pendiente_revision', 'pendiente', 'asignado', 'descartado') NOT NULL DEFAULT 'pendiente_revision',
    `confianza_ia` DECIMAL(5, 2) NULL,
    `categoria_ia_id` INTEGER NULL,
    `resumen_ia` TEXT NULL,
    `incidencia_id` INTEGER NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `incidencias` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoria_id` INTEGER NOT NULL,
    `latitud` DECIMAL(10, 8) NOT NULL,
    `longitud` DECIMAL(11, 8) NOT NULL,
    `estado` ENUM('pendiente', 'asignado', 'en_curso', 'completado') NOT NULL DEFAULT 'pendiente',
    `puntaje_prioridad` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `contador_reportes` INTEGER NOT NULL DEFAULT 1,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tareas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `incidencia_id` INTEGER NOT NULL,
    `tecnico_id` INTEGER NOT NULL,
    `estado` ENUM('asignada', 'aceptada', 'en_curso', 'atrasada', 'completada', 'cancelada') NOT NULL DEFAULT 'asignada',
    `motivo_atraso` ENUM('materiales', 'complejidad', 'clima', 'otro') NULL,
    `motivo_cancelacion` TEXT NULL,
    `foto_evidencia_url` VARCHAR(500) NULL,
    `cancelada_por_id` INTEGER NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizado_en` DATETIME(3) NOT NULL,
    `completada_en` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historial_estados` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tarea_id` INTEGER NOT NULL,
    `estado_anterior` ENUM('asignada', 'aceptada', 'en_curso', 'atrasada', 'completada', 'cancelada') NOT NULL,
    `estado_nuevo` ENUM('asignada', 'aceptada', 'en_curso', 'atrasada', 'completada', 'cancelada') NOT NULL,
    `cambiado_por_id` INTEGER NULL,
    `creado_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configuracion_sistema` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clave` VARCHAR(100) NOT NULL,
    `valor` VARCHAR(255) NOT NULL,
    `descripcion` VARCHAR(255) NULL,

    UNIQUE INDEX `configuracion_sistema_clave_key`(`clave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `especialidades` ADD CONSTRAINT `especialidades_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `especialidades` ADD CONSTRAINT `especialidades_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reportes` ADD CONSTRAINT `reportes_categoria_ia_id_fkey` FOREIGN KEY (`categoria_ia_id`) REFERENCES `categorias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reportes` ADD CONSTRAINT `reportes_incidencia_id_fkey` FOREIGN KEY (`incidencia_id`) REFERENCES `incidencias`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incidencias` ADD CONSTRAINT `incidencias_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tareas` ADD CONSTRAINT `tareas_incidencia_id_fkey` FOREIGN KEY (`incidencia_id`) REFERENCES `incidencias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tareas` ADD CONSTRAINT `tareas_tecnico_id_fkey` FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tareas` ADD CONSTRAINT `tareas_cancelada_por_id_fkey` FOREIGN KEY (`cancelada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_estados` ADD CONSTRAINT `historial_estados_tarea_id_fkey` FOREIGN KEY (`tarea_id`) REFERENCES `tareas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historial_estados` ADD CONSTRAINT `historial_estados_cambiado_por_id_fkey` FOREIGN KEY (`cambiado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
