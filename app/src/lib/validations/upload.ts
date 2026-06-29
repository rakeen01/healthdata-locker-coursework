import { z } from 'zod'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10MB, matches next.config serverActions.bodySizeLimit

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number]

export function validateUploadFile(file: File): { ok: true } | { ok: false; message: string } {
  if (file.size === 0) {
    return { ok: false, message: 'Please choose a file to upload.' }
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: 'File is too large. Maximum size is 10MB.' }
  }

  const mime = file.type || 'application/octet-stream'
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(mime as AllowedUploadMimeType)) {
    return { ok: false, message: 'Unsupported file type. Upload a PDF or image file.' }
  }

  return { ok: true }
}

export const reportIdSchema = z.string().uuid()
