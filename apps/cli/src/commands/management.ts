import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { Command } from 'commander'
import ora from 'ora'
import { downloadFile } from '@bidradar/cef'
import {
  getCefFileDescriptor,
  buildCefDownloadUrl,
  type CefFileType,
} from '@bidradar/core'
import { apiRequest } from '../lib/apiClient.js'

interface UploadUrlResponse {
  uploadUrl: string
  s3Key: string
  expiresIn: number
}

interface CheckHashResponse {
  exists: boolean
}

interface RecordDownloadResponse {
  downloadId: string
}

interface PendingOfferDetailsResponse {
  offers: Array<{ id: string; sourceId: string; offerUrl: string }>
  total: number
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
  }
  return Buffer.concat(chunks)
}

function computeHash(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FILE_TYPES: readonly CefFileType[] = [
  'offer-list',
  'auctions-schedule',
  'licensed-brokers',
  'accredited-auctioneers',
  'offer-details',
] as const

async function fetchBinary(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function downloadBulkFile(
  fileType: CefFileType,
  spinner: ReturnType<typeof ora>,
): Promise<void> {
  const descriptor = getCefFileDescriptor(fileType)

  // Download
  spinner.start(`Downloading ${fileType} from CEF...`)
  let content: Buffer
  if (fileType === 'offer-list') {
    const stream = await downloadFile('geral')
    content = await streamToBuffer(stream)
  } else {
    const url = buildCefDownloadUrl(fileType)
    content = await fetchBinary(url)
  }
  spinner.succeed(
    `Downloaded ${fileType} (${formatBytes(content.length)})`,
  )

  // Hash + dedup check
  const contentHash = computeHash(content)
  spinner.start(`Checking content hash ${contentHash.slice(0, 12)}...`)
  const { exists } = await apiRequest<CheckHashResponse>(
    'POST',
    '/management/check-hash',
    { body: { contentHash } },
  )

  if (exists) {
    spinner.succeed(`File unchanged — skipped (hash ${contentHash.slice(0, 12)}...)`)
    return
  }
  spinner.succeed(`New content detected (hash ${contentHash.slice(0, 12)}...)`)

  // Get presigned URL
  spinner.start('Requesting upload URL...')
  const { uploadUrl, s3Key } = await apiRequest<UploadUrlResponse>(
    'POST',
    '/management/upload-url',
    { body: { fileType } },
  )
  spinner.succeed(`Got presigned URL for ${s3Key}`)

  // Upload to S3
  spinner.start('Uploading to S3...')
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': descriptor.contentType },
    body: new Uint8Array(content),
  })
  if (!uploadRes.ok) {
    throw new Error(`S3 upload failed: ${uploadRes.status} ${uploadRes.statusText}`)
  }
  spinner.succeed(`Uploaded to S3: ${s3Key}`)

  // Record metadata
  spinner.start('Recording download metadata...')
  const url = fileType === 'offer-list'
    ? buildCefDownloadUrl(fileType, { uf: 'geral' })
    : buildCefDownloadUrl(fileType)
  const fileName = s3Key.split('/').pop()!
  const { downloadId } = await apiRequest<RecordDownloadResponse>(
    'POST',
    '/management/record-download',
    {
      body: {
        fileName,
        fileExtension: descriptor.extension,
        fileSize: content.length,
        fileType,
        downloadUrl: url,
        downloadedAt: new Date().toISOString(),
        bucketName: 'cef-downloads',
        bucketKey: s3Key,
        contentHash,
      },
    },
  )
  spinner.succeed(`Recorded metadata (download ID: ${downloadId})`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function downloadOfferDetailsCli(
  rateLimit: number,
  spinner: ReturnType<typeof ora>,
): Promise<void> {
  // Fetch pending offers
  spinner.start('Fetching offers needing detail downloads...')
  const { offers, total } = await apiRequest<PendingOfferDetailsResponse>(
    'GET',
    '/management/pending-offer-details',
  )
  spinner.succeed(`Found ${total} offers needing detail downloads`)

  if (offers.length === 0) {
    return
  }

  const delay = 1000 / rateLimit
  let uploaded = 0
  let skipped = 0
  let errors = 0

  for (let i = 0; i < offers.length; i++) {
    const offer = offers[i]!
    const descriptor = getCefFileDescriptor('offer-details')

    try {
      spinner.start(`[${i + 1}/${offers.length}] Downloading offer ${offer.sourceId}...`)
      const content = await fetchBinary(offer.offerUrl)
      const contentHash = computeHash(content)

      const { exists } = await apiRequest<CheckHashResponse>(
        'POST',
        '/management/check-hash',
        { body: { contentHash } },
      )

      if (exists) {
        skipped++
        spinner.succeed(
          `[${i + 1}/${offers.length}] Offer ${offer.sourceId}: skipped (unchanged)`,
        )
      } else {
        const { uploadUrl, s3Key } = await apiRequest<UploadUrlResponse>(
          'POST',
          '/management/upload-url',
          { body: { fileType: 'offer-details', offerId: offer.id } },
        )

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': descriptor.contentType },
          body: new Uint8Array(content),
        })
        if (!uploadRes.ok) {
          throw new Error(`S3 upload failed: ${uploadRes.status}`)
        }

        const url = buildCefDownloadUrl('offer-details', { sourceId: offer.sourceId })
        const fileName = s3Key.split('/').pop()!
        await apiRequest<RecordDownloadResponse>(
          'POST',
          '/management/record-download',
          {
            body: {
              fileName,
              fileExtension: descriptor.extension,
              fileSize: content.length,
              fileType: 'offer-details',
              downloadUrl: url,
              downloadedAt: new Date().toISOString(),
              bucketName: 'cef-downloads',
              bucketKey: s3Key,
              contentHash,
            },
          },
        )

        uploaded++
        spinner.succeed(
          `[${i + 1}/${offers.length}] Offer ${offer.sourceId}: uploaded (${formatBytes(content.length)})`,
        )
      }
    } catch (err) {
      errors++
      spinner.fail(
        `[${i + 1}/${offers.length}] Offer ${offer.sourceId}: error — ${err instanceof Error ? err.message : 'Unknown error'}`,
      )
    }

    if (i < offers.length - 1) {
      await sleep(delay)
    }
  }

  console.log(
    `\nCompleted: ${uploaded} uploaded, ${skipped} skipped, ${errors} errors`,
  )
}

const download = new Command('download')
  .description('Download a CEF file and upload it to S3 via presigned URL')
  .argument('[file-type]', `File type to download (${FILE_TYPES.join(', ')})`)
  .option('--rate-limit <n>', 'Requests per second for offer-details downloads', '5')
  .action(async (fileType?: string, opts?: { rateLimit?: string }) => {
    if (!fileType) {
      console.log('Available file types: ' + FILE_TYPES.join(', '))
      console.log()
      download.help()
      return
    }
    if (!FILE_TYPES.includes(fileType as CefFileType)) {
      console.error(`Unknown file type: ${fileType}`)
      console.log('Available file types: ' + FILE_TYPES.join(', '))
      process.exitCode = 1
      return
    }
    const spinner = ora()
    try {
      if (fileType === 'offer-details') {
        const rateLimit = Number(opts?.rateLimit ?? '5')
        await downloadOfferDetailsCli(rateLimit, spinner)
      } else {
        await downloadBulkFile(fileType as CefFileType, spinner)
      }
    } catch (err) {
      const { ApiError } = await import('../lib/apiClient.js')
      if (err instanceof ApiError && err.statusCode === 401) {
        spinner.fail('Not authenticated. Run `bidradar login` to authenticate.')
      } else if (err instanceof ApiError && err.statusCode === 403) {
        spinner.fail('Forbidden. This command requires admin permissions.')
      } else {
        spinner.fail(
          `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        )
      }
      process.exitCode = 1
    }
  })

export const manager = new Command('manager')
  .description('Management commands (admin only)')
  .addCommand(download)
  .action(function (this: Command) {
    this.help()
  })
