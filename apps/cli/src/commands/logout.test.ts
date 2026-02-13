import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/config.js', () => ({
  clearToken: vi.fn(),
}))

vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  }),
}))

import { logout } from './logout.js'
import { clearToken } from '../lib/config.js'

const mockClearToken = vi.mocked(clearToken)

beforeEach(() => {
  vi.clearAllMocks()
  process.exitCode = undefined
})

describe('logout command', () => {
  it('clears stored token', async () => {
    mockClearToken.mockResolvedValue(undefined)

    await logout.parseAsync([], { from: 'user' })

    expect(clearToken).toHaveBeenCalledOnce()
  })

  it('sets exit code when clearToken fails', async () => {
    mockClearToken.mockRejectedValue(new Error('Permission denied'))

    await logout.parseAsync([], { from: 'user' })

    expect(process.exitCode).toBe(1)
  })
})
