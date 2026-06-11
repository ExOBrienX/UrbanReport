/**
 * vitest.config.ts — Configuracion de Vitest para pruebas unitarias.
 *
 * Vitest se eligio por su compatibilidad nativa con el stack del proyecto
 * (Next.js 15 + TypeScript), velocidad y sintaxis similar a Jest.
 *
 * environment 'node' porque las pruebas son de logica de negocio pura,
 * no requieren DOM ni navegador.
 */

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,            // permite usar describe/it/expect sin importarlos
    include: ['**/*.test.ts'],
  },
})