/**
 * ConfiguracionService.ts — Gestión de configuración del sistema.
 * Patrón: Repository — abstrae el acceso a la tabla configuracion_sistema.
 *
 * Responsabilidades:
 *   - Leer valores de configuración por clave
 *   - Actualizar valores de configuración (solo admin)
 *   - Proveer acceso tipado al umbral de confianza de la IA
 *
 * La tabla configuracion_sistema permite ajustar parámetros del sistema
 * sin necesidad de modificar el código ni redesplegar la aplicación.
 *
 * Usado por: app/api/admin/config/route.ts, AIService.ts
 * Depende de: prisma
 */

import { prisma } from '../prisma'

// Claves conocidas del sistema — deben existir como registros en configuracion_sistema
export const CONFIG_KEYS = {
  UMBRAL_CONFIANZA_IA: 'umbral_confianza_ia',
} as const

export class ConfiguracionService {

  /**
   * Obtiene todas las configuraciones del sistema.
   * Usado por el admin para ver y editar los parámetros desde el panel.
   */
  static async obtenerTodas() {
    return await prisma.configuracionSistema.findMany({
      orderBy: { clave: 'asc' }
    })
  }

  /**
   * Obtiene el valor de una configuración específica por su clave.
   * Retorna null si la clave no existe en vez de lanzar error,
   * para que el caller pueda usar un valor por defecto.
   *
   * @param clave - Clave de la configuración (ej: 'umbral_confianza_ia')
   */
  static async obtener(clave: string) {
    return await prisma.configuracionSistema.findUnique({
      where: { clave }
    })
  }

  /**
   * Actualiza el valor de una configuración existente.
   * Solo el admin puede llamar a este método — la verificación de rol
   * se hace en el route antes de llamar al servicio.
   *
   * @param clave   - Clave de la configuración a actualizar
   * @param valor   - Nuevo valor en formato string
   * @param adminId - ID del admin que realiza el cambio (para trazabilidad en logs)
   */
  static async actualizar(clave: string, valor: string, adminId: number) {
    // Verificar que la clave exista antes de actualizar
    const config = await prisma.configuracionSistema.findUnique({ where: { clave } })
    if (!config) throw new Error('CONFIG_NO_ENCONTRADA')

    const actualizado = await prisma.configuracionSistema.update({
      where: { clave },
      data: { valor: valor.trim() }
    })

    console.log(`✅ Configuración '${clave}' actualizada a '${valor}' por admin ${adminId}`)
    return actualizado
  }

  /**
   * Obtiene el umbral de confianza de la IA como número.
   * Si no existe la configuración, retorna 60 como valor por defecto.
   * Es el mismo método que usa AIService pero centralizado aquí.
   */
  static async getUmbralConfianza(): Promise<number> {
    const config = await prisma.configuracionSistema.findUnique({
      where: { clave: CONFIG_KEYS.UMBRAL_CONFIANZA_IA }
    })
    return config ? parseInt(config.valor, 10) : 60
  }
}