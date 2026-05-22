-- DropForeignKey
ALTER TABLE `tareas` DROP FOREIGN KEY `tareas_tecnico_id_fkey`;

-- DropIndex
DROP INDEX `tareas_tecnico_id_fkey` ON `tareas`;

-- AlterTable
ALTER TABLE `tareas` MODIFY `tecnico_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `tareas` ADD CONSTRAINT `tareas_tecnico_id_fkey` FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
