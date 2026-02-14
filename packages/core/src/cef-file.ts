import { randomUUID } from 'node:crypto'

export type CefFileType =
  | 'offer-list'
  | 'auctions-schedule'
  | 'licensed-brokers'
  | 'accredited-auctioneers'
  | 'offer-details'

export const CEF_FILE_TYPES: readonly CefFileType[] = [
  'offer-list',
  'auctions-schedule',
  'licensed-brokers',
  'accredited-auctioneers',
  'offer-details',
] as const

export interface CefFileDescriptor {
  readonly extension: string
  readonly contentType: string
  readonly downloadUrl: string
  readonly hasUf: boolean
}

export const CEF_BASE_URL = 'https://venda-imoveis.caixa.gov.br/listaweb'

const CEF_FILE_DESCRIPTORS: Record<CefFileType, CefFileDescriptor> = {
  'offer-list': {
    extension: 'csv',
    contentType: 'text/csv',
    downloadUrl: `${CEF_BASE_URL}/Lista_imoveis_{uf}.csv`,
    hasUf: true,
  },
  'auctions-schedule': {
    extension: 'pdf',
    contentType: 'application/pdf',
    downloadUrl:
      'https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/calendario-leiloes-imoveis-caixa.pdf',
    hasUf: false,
  },
  'licensed-brokers': {
    extension: 'zip',
    contentType: 'application/zip',
    downloadUrl: `${CEF_BASE_URL}/lista_corretores.zip`,
    hasUf: false,
  },
  'accredited-auctioneers': {
    extension: 'pdf',
    contentType: 'application/pdf',
    downloadUrl:
      'https://www.caixa.gov.br/Downloads/habitacao-documentos-gerais/Relacao_Leiloeiros.pdf',
    hasUf: false,
  },
  'offer-details': {
    extension: 'html',
    contentType: 'text/html',
    downloadUrl:
      'https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel={sourceId}',
    hasUf: false,
  },
}

export function getCefFileDescriptor(fileType: CefFileType): CefFileDescriptor {
  return CEF_FILE_DESCRIPTORS[fileType]
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
  const descriptor = getCefFileDescriptor(params.fileType)

  if (params.fileType === 'offer-list') {
    const uf = params.uf ?? 'geral'
    return `cef-downloads/offer-list/${date}.${uf}.${runId}.${descriptor.extension}`
  }

  if (params.fileType === 'offer-details') {
    const offerId = params.offerId ?? 'unknown'
    return `cef-downloads/offer-details/${offerId}/${date}.offer-details.${runId}.${descriptor.extension}`
  }

  return `cef-downloads/${params.fileType}/${date}.${params.fileType}.${runId}.${descriptor.extension}`
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
    return {
      fileType,
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

export function buildCefDownloadUrl(
  fileType: CefFileType,
  options?: { uf?: string; sourceId?: string },
): string {
  const descriptor = getCefFileDescriptor(fileType)
  let url = descriptor.downloadUrl

  if (descriptor.hasUf && options?.uf) {
    url = url.replace('{uf}', options.uf)
  }

  if (options?.sourceId) {
    url = url.replace('{sourceId}', options.sourceId)
  }

  return url
}
