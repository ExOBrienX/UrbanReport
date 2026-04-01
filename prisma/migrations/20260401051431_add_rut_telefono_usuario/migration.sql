/*
  Warnings:

  - A unique constraint covering the columns `[rut]` on the table `usuarios` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `rut` to the `usuarios` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `rut` VARCHAR(12) NOT NULL,
    ADD COLUMN `telefono` VARCHAR(15) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `usuarios_rut_key` ON `usuarios`(`rut`);
