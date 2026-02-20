import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/apiClient.js', () => ({
  apiRequest: vi.fn(),
}))

vi.mock('../lib/config.js', () => ({
  saveConfig: vi.fn().mockResolvedValue(undefined),
  getApiUrl: vi.fn().mockResolvedValue('http://localhost:3000'),
}))

vi.mock('open', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  }),
}))

import { login } from './login.js'
import { apiRequest } from '../lib/apiClient.js'
import { saveConfig } from '../lib/config.js'
import open from 'open'

const mockApiRequest = vi.mocked(apiRequest)

beforeEach(() => {
  vi.clearAllMocks()
  process.exitCode = undefined
})

describe('login command', () => {
  it('creates session, opens browser, polls for token, and saves config', async () => {
    // First call: create session
    mockApiRequest.mockResolvedValueOnce({ sessionId: 'sess-123' })
    // Second call: poll returns pending, then success
    mockApiRequest.mockResolvedValueOnce({ status: 'pending' })
    mockApiRequest.mockResolvedValueOnce({
      token: 'jwt-token',
      user: { id: '1', name: 'Test', email: 'test@test.com', role: 'admin' },
    })

    await login.parseAsync([], { from: 'user' })

    expect(mockApiRequest).toHaveBeenCalledWith('POST', '/auth/session', {
      signal: expect.any(AbortSignal),
    })
    expect(open).toHaveBeenCalledWith('http://localhost:3000/auth/login?session=sess-123')
    expect(saveConfig).toHaveBeenCalledWith({ token: 'jwt-token' })
  })

  it('sets exit code on error', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('Network error'))

    await login.parseAsync([], { from: 'user' })

    expect(process.exitCode).toBe(1)
  })
})
