import { Readable } from 'node:stream'
import { Command } from 'commander'
import ora from 'ora'
import { downloadFile } from '@bidradar/cef'
import { apiRequest, ApiError } from '../lib/apiClient.js'

interface UploadUrlResponse {
  uploadUrl: string
  s3Key: string
  expiresIn: number
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
  }
  return Buffer.concat(chunks)
}

const download = new Command('download')
  .description('Download a CEF file and upload it to S3 via presigned URL')
  .argument('<file-type>', 'File type to download (e.g. offer-list)')
  .action(async (fileType: string) => {
    const spinner = ora()
    try {
      spinner.start('Downloading CSV from CEF...')
      const stream = await downloadFile('geral')
      const content = await streamToBuffer(stream)
      spinner.succeed(`Downloaded ${content.length} bytes from CEF`)

      spinner.start('Requesting upload URL...')
      const { uploadUrl, s3Key } = await apiRequest<UploadUrlResponse>(
        'POST',
        '/management/upload-url',
        { body: { fileType } },
      )
      spinner.succeed(`Got presigned URL for ${s3Key}`)

      spinner.start('Uploading to S3...')
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/csv' },
        body: new Uint8Array(content),
      })
      if (!res.ok) {
        throw new Error(`S3 upload failed: ${res.status} ${res.statusText}`)
      }
      spinner.succeed(`Uploaded to S3: ${s3Key}`)
    } catch (err) {
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
