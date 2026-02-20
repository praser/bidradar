export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  keyHash: string
  userId: string
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
}

export interface ApiKeyRepository {
  insert(apiKey: {
    name: string
    keyPrefix: string
    keyHash: string
    userId: string
  }): Promise<string>

  findByKeyHash(keyHash: string): Promise<
    | (ApiKey & { userEmail: string; userName: string; userRole: string })
    | undefined
  >

  updateLastUsed(id: string): Promise<void>

  revoke(id: string): Promise<void>

  revokeByName(userId: string, name: string): Promise<boolean>

  listByUserId(userId: string): Promise<ApiKey[]>
}
