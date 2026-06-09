/**
 * uploadEvidencia.ts — Sube fotos de evidencia de tareas a Cloudflare R2.
 *
 * Genera un nombre unico con UUID para evitar colisiones entre archivos
 * y los almacena bajo el prefijo 'evidencias/' para separarlos de los
 * reportes ciudadanos que van bajo 'reportes/'.
 *
 * Retorna la URL publica del archivo en R2, que se guarda en
 * tarea.foto_evidencia_url para que el admin pueda verla en el historial.
 *
 * Usado por: app/lib/services/TareaService.ts (completarConEvidencia)
 * Depende de: r2Client, R2_BUCKET, CLOUDFLARE_R2_PUBLIC_URL
 */

import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET } from './r2'
import { v4 as uuidv4 } from 'uuid'

/**
 * Sube una foto de evidencia al bucket R2 y retorna su URL publica.
 *
 * @param file - Archivo de imagen capturado por el tecnico en terreno
 * @returns URL publica accesible desde el navegador
 */
export async function uploadEvidencia(file: File): Promise<string> {
  // UUID garantiza nombres unicos — evita sobreescribir fotos existentes
  const extension = file.name.split('.').pop() || 'jpg'
  const fileName  = `evidencias/${uuidv4()}.${extension}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer      = Buffer.from(arrayBuffer)

  await r2Client.send(
    new PutObjectCommand({
      Bucket:      R2_BUCKET,
      Key:         fileName,
      Body:        buffer,
      ContentType: file.type,
    })
  )

  // Construir URL publica usando el dominio publico del bucket R2
  return `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${fileName}`
}