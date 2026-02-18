import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/apiClient.js', () => ({
  apiRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public readonly statusCode: number,
      public readonly errorCode: string,
      message: string,
    ) {
      super(message)
      this.name = 'ApiError'
    }
  },
}))

import { whoami } from './whoami.js'
import { apiRequest, ApiError } from '../lib/apiClient.js'

const mockApiRequest = vi.mocked(apiRequest)

beforeEach(() => {
  vi.clearAllMocks()
  process.exitCode = undefined
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('whoami command', () => {
  it('prints user info on success', async () => {
    mockApiRequest.mockResolvedValue({
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin',
    })

    await whoami.parseAsync([], { from: 'user' })

    expect(console.log).toHaveBeenCalledWith(
      'Test User <test@example.com> [admin]',
    )
  })

  it('shows login prompt on 401 error', async () => {
    mockApiRequest.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Not authorized'))

    await whoami.parseAsync([], { from: 'user' })

    expect(console.log).toHaveBeenCalledWith(
      'Not logged in. Run `bidradar login` to authenticate.',
    )
    expect(process.exitCode).toBeUndefined()
  })

  it('shows error message for other errors', async () => {
    mockApiRequest.mockRejectedValue(new Error('Network error'))

    await whoami.parseAsync([], { from: 'user' })

    expect(console.error).toHaveBeenCalledWith('Failed: Network error')
    expect(process.exitCode).toBe(1)
  })
})
