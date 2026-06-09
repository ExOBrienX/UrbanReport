/**
 * r2.ts — Cliente S3 configurado para Cloudflare R2.
 *
 * Cloudflare R2 es compatible con la API de S3, por lo que se usa
 * el SDK oficial de AWS apuntando al endpoint de R2 en vez de AWS.
 *
 * Se usa para almacenar:
 *   - Fotos de reportes ciudadanos (subidas en POST /api/reports)
 *   - Fotos de evidencia de tareas (subidas en POST /api/tasks/[id])
 *
 * Las variables de entorno deben estar configuradas en Vercel y en .env.local:
 *   CLOUDFLARE_ACCOUNT_ID       — ID de la cuenta Cloudflare
 *   CLOUDFLARE_R2_ACCESS_KEY_ID — clave de acceso del bucket R2
 *   CLOUDFLARE_R2_SECRET_ACCESS_KEY — clave secreta del bucket R2
 *   CLOUDFLARE_R2_BUCKET_NAME   — nombre del bucket
 *
 * Usado por: app/lib/uploadPhoto.ts, app/lib/uploadEvidencia.ts
 */

import { S3Client } from '@aws-sdk/client-s3'

// Cliente S3 apuntando al endpoint de R2 — region 'auto' es requerida por Cloudflare
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
})

export const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!