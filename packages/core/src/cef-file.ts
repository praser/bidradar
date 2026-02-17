import { randomUUID } from 'node:crypto'

export type CefFileType =
  | 'offer-list'
  | 'auctions-schedule'
  | 'licensed-brokers'
  | 'accredited-auctioneers'
  | 'offer-details'
  | 'offer-details-screenshot'

export const CEF_FILE_TYPES: readonly CefFileType[] = [
  'offer-list',
  'auctions-schedule',
  'licensed-brokers',
  'accredited-auctioneers',
  'offer-details',
  'offer-details-screenshot',
] as const

const CEF_FILE_EXTENSIONS: Record<CefFileType, string> = {
  'offer-list': 'csv',
  'auctions-schedule': 'pdf',
  'licensed-brokers': 'zip',
  'accredited-auctioneers': 'pdf',
  'offer-details': 'html',
  'offer-details-screenshot': 'png',
}

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  csv: 'text/csv',
  pdf: 'application/pdf',
  zip: 'application/zip',
  html: 'text/html',
  png: 'image/png',
}

export function contentTypeFromExtension(ext: string): string {
  return EXTENSION_CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

export function buildCefS3Key(params: {
  fileType: CefFileType
  uf?: string
  offerId?: string
  date?: string
  runId?: string
}): string {
  const date = params.date ?? new Date().toISOString().split('T')[0]!
  const runId = params.runId ?? randomUUID().slice(0, 8)
  const ext = CEF_FILE_EXTENSIONS[params.fileType]

  if (params.fileType === 'offer-list') {
    const uf = params.uf ?? 'geral'
    return `cef-downloads/offer-list/${date}.${uf}.${runId}.${ext}`
  }

  if (params.fileType === 'offer-details' || params.fileType === 'offer-details-screenshot') {
    const offerId = params.offerId ?? 'unknown'
    return `cef-downloads/offer-details/${offerId}/${date}.${params.fileType}.${runId}.${ext}`
  }

  return `cef-downloads/${params.fileType}/${date}.${params.fileType}.${runId}.${ext}`
}

export interface ParsedCefS3Key {
  fileType: CefFileType
  date: string
  runId: string
  fileName: string
  extension: string
  uf?: string
  offerId?: string
}

export function parseCefS3Key(key: string): ParsedCefS3Key {
  const parts = key.split('/')
  const fileType = parts[1] as CefFileType

  if (fileType === 'offer-details') {
    const offerId = parts[2]!
    const fileName = parts[3]!
    const ext = fileName.split('.').pop()!
    const segments = fileName.replace(`.${ext}`, '').split('.')
    const actualFileType = segments[1] === 'offer-details-screenshot'
      ? 'offer-details-screenshot' as CefFileType
      : fileType
    return {
      fileType: actualFileType,
      date: segments[0]!,
      runId: segments[2]!,
      fileName,
      extension: ext,
      offerId,
    }
  }

  if (fileType === 'offer-list') {
    const fileName = parts[2]!
    const ext = fileName.split('.').pop()!
    const segments = fileName.replace(`.${ext}`, '').split('.')
    return {
      fileType,
      date: segments[0]!,
      uf: segments[1]!,
      runId: segments[2]!,
      fileName,
      extension: ext,
    }
  }

  // Bulk types: auctions-schedule, licensed-brokers, accredited-auctioneers
  const fileName = parts[2]!
  const ext = fileName.split('.').pop()!
  const segments = fileName.replace(`.${ext}`, '').split('.')
  return {
    fileType,
    date: segments[0]!,
    runId: segments[2]!,
    fileName,
    extension: ext,
  }
}

