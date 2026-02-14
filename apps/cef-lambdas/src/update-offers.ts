import { Readable } from 'node:stream'
import { updateCefOffers } from '@bidradar/core'
import { downloadFile, parseOffers } from '@bidradar/cef'
import {
  createOfferRepository,
  createDownloadMetadataRepository,
} from '@bidradar/db'
import { createS3FileStore } from './s3-file-store.js'

const CEF_BASE_URL = 'https://venda-imoveis.caixa.gov.br/listaweb'

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
  }
  return Buffer.concat(chunks)
}

export async function handler() {
  const bucketName = process.env.BUCKET_NAME
  if (!bucketName) {
    throw new Error('BUCKET_NAME environment variable is required')
  }

  const result = await updateCefOffers({
    fetchOffersCsv: async (uf) => {
      const stream = await downloadFile(uf)
      const content = await streamToBuffer(stream)
      return {
        content,
        downloadUrl: `${CEF_BASE_URL}/Lista_imoveis_${uf}.csv`,
      }
    },
    parseOffers: async (content) => {
      return parseOffers(Readable.from(content))
    },
    fileStore: createS3FileStore(bucketName),
    metadataRepo: createDownloadMetadataRepository(),
    offerRepo: createOfferRepository(),
  })

  console.log(
    `Updated CEF offers: ${result.totalOffers} offers across ${result.states} states (file: ${result.fileSize} bytes)`,
  )
  for (const [state, r] of result.results) {
    console.log(
      `  ${state}: +${r.created} ~${r.updated} =${r.skipped} -${r.removed}`,
    )
  }

  return {
    statusCode: 200,
    body: {
      fileSize: result.fileSize,
      totalOffers: result.totalOffers,
      states: result.states,
    },
  }
}
