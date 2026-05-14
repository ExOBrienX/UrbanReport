import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET } from './r2'
import { v4 as uuidv4 } from 'uuid'

export async function uploadPhoto(file: File): Promise<string> {
  const extension = file.name.split('.').pop() || 'jpg'
  const fileName = `reportes/${uuidv4()}.${extension}`
  
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    })
  )

  return `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${fileName}`
}