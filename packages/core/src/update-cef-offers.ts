export interface FileStore {
  store(params: {
    key: string
    content: Buffer
    contentType: string
  }): Promise<{ bucketName: string; bucketKey: string }>

  get(key: string): Promise<Buffer>
}

export interface DownloadMetadata {
  readonly fileName: string
  readonly fileExtension: string
  readonly fileSize: number
  readonly fileType: string
  readonly downloadUrl: string
  readonly downloadedAt: Date
  readonly bucketName: string
  readonly bucketKey: string
  readonly contentHash?: string
}

export interface DownloadMetadataRepository {
  insert(metadata: DownloadMetadata): Promise<string>
  findByContentHash(hash: string): Promise<{ id: string } | undefined>
}
