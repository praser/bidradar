import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  chmod: vi.fn().mockResolvedValue(undefined),
}))

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { loadConfig, saveConfig, clearToken, getToken, getApiUrl } from './config.js'

const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadConfig', () => {
  it('returns defaults when config file does not exist', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
    const config = await loadConfig()
    expect(config.apiUrl).toBe('http://localhost:3000')
    expect(config.token).toBeUndefined()
  })

  it('parses a valid config file', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ apiUrl: 'https://api.example.com', token: 'abc' }),
    )
    const config = await loadConfig()
    expect(config.apiUrl).toBe('https://api.example.com')
    expect(config.token).toBe('abc')
  })

  it('returns defaults when config file contains invalid JSON', async () => {
    mockReadFile.mockResolvedValue('not json')
    const config = await loadConfig()
    expect(config.apiUrl).toBe('http://localhost:3000')
  })

  it('applies defaults for missing fields', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ token: 'xyz' }))
    const config = await loadConfig()
    expect(config.apiUrl).toBe('http://localhost:3000')
    expect(config.token).toBe('xyz')
  })
})

describe('saveConfig', () => {
  it('merges with existing config and writes', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ apiUrl: 'https://api.example.com', token: 'old' }),
    )
    await saveConfig({ token: 'new' })

    expect(mockWriteFile).toHaveBeenCalledOnce()
    const written = JSON.parse(mockWriteFile.mock.calls[0]![1] as string)
    expect(written.token).toBe('new')
    expect(written.apiUrl).toBe('https://api.example.com')
  })

  it('creates config directory with restricted permissions', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
    await saveConfig({ token: 'test' })

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('.bidradar'), {
      recursive: true,
      mode: 0o700,
    })
  })
})

describe('clearToken', () => {
  it('removes token from config', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ apiUrl: 'https://api.example.com', token: 'secret' }),
    )
    await clearToken()

    const written = JSON.parse(mockWriteFile.mock.calls[0]![1] as string)
    expect(written).not.toHaveProperty('token')
    expect(written.apiUrl).toBe('https://api.example.com')
  })
})

describe('getToken', () => {
  it('returns token when present', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ apiUrl: 'http://localhost:3000', token: 'mytoken' }),
    )
    expect(await getToken()).toBe('mytoken')
  })

  it('returns undefined when no token', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
    expect(await getToken()).toBeUndefined()
  })
})

describe('getApiUrl', () => {
  it('returns configured API URL', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({ apiUrl: 'https://prod.api.com' }),
    )
    expect(await getApiUrl()).toBe('https://prod.api.com')
  })

  it('returns default URL when not configured', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
    expect(await getApiUrl()).toBe('http://localhost:3000')
  })
})
