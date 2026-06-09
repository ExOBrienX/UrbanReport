/**
 * uploadPhoto.ts — Sube fotos de reportes ciudadanos a Cloudflare R2.
 *
 * Identico a uploadEvidencia pero usa el prefijo 'reportes/' para
 * separar las fotos ciudadanas de las fotos de evidencia tecnica,
 * facilitando la administracion y limpieza del bucket.
 *
 * La foto se sube antes de crear el reporte en BD — si falla la subida
 * se retorna error inmediatamente sin crear registros huerfanos.
 *
 * Usado por: app/api/reports/route.ts (POST)
 * Depende de: r2Client, R2_BUCKET, CLOUDFLARE_R2_PUBLIC_URL
 */

import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET } from './r2'
import { v4 as uuidv4 } from 'uuid'

/**
 * Sube una foto de reporte ciudadano al bucket R2 y retorna su URL publica.
 *
 * @param file - Imagen capturada por el ciudadano desde ReportModal
 * @returns URL publica accesible desde el navegador
 */
export async function uploadPhoto(file: File): Promise<string> {
  // UUID garantiza nombres unicos — evita sobreescribir fotos existentes
  const extension = file.name.split('.').pop() || 'jpg'
  const fileName  = `reportes/${uuidv4()}.${extension}`

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

  return `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${fileName}`
}