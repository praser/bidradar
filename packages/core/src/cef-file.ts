import { randomUUID } from 'node:crypto'

export type CefFileType = 'offer-list'

export const CEF_BASE_URL = 'https://venda-imoveis.caixa.gov.br/listaweb'

export function buildCefS3Key(params: {
  fileType: CefFileType
  uf: string
  date?: string
  runId?: string
}): string {
  const date = params.date ?? new Date().toISOString().split('T')[0]!
  const runId = params.runId ?? randomUUID().slice(0, 8)
  return `cef-downloads/${params.fileType}/${date}.${params.uf}.${runId}.csv`
}

export function parseCefS3Key(key: string): {
  fileType: CefFileType
  date: string
  uf: string
  runId: string
  fileName: string
} {
  const parts = key.split('/')
  const fileType = parts[1] as CefFileType
  const fileName = parts[2]!
  const segments = fileName.replace(/\.csv$/, '').split('.')
  return {
    fileType,
    date: segments[0]!,
    uf: segments[1]!,
    runId: segments[2]!,
    fileName,
  }
}

export function buildCefDownloadUrl(
  fileType: CefFileType,
  uf: string,
): string {
  switch (fileType) {
    case 'offer-list':
      return `${CEF_BASE_URL}/Lista_imoveis_${uf}.csv`
  }
}
