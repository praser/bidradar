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

vi.mock('../lib/formatTable.js', () => ({
  renderTable: vi.fn().mockReturnValue('rendered table'),
}))

vi.mock('../lib/pager.js', () => ({
  displayWithPager: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  }),
}))

import { query } from './query.js'
import { apiRequest, ApiError } from '../lib/apiClient.js'
import { renderTable } from '../lib/formatTable.js'
import { displayWithPager } from '../lib/pager.js'

const mockApiRequest = vi.mocked(apiRequest)

beforeEach(() => {
  vi.clearAllMocks()
  process.exitCode = undefined
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('query command', () => {
  const mockOfferResponse = {
    data: [
      {
        id: '1',
        uf: 'DF',
        city: 'Brasilia',
        neighborhood: 'Asa Sul',
        address: 'SQS 123',
        askingPrice: 100000,
        evaluationPrice: 150000,
        discountPercent: 33.33,
        description: 'Apt 3 qto(s)',
        propertyType: 'Apartamento',
        sellingType: 'Venda Direta',
        offerUrl: 'https://example.com/offer/1',
      },
    ],
    pagination: { page: 1, pageSize: 50, total: 1 },
  }

  it('fetches and displays offers with default options', async () => {
    mockApiRequest.mockResolvedValue(mockOfferResponse)

    await query.parseAsync([], { from: 'user' })

    expect(mockApiRequest).toHaveBeenCalledWith('GET', '/offers', {
      query: expect.objectContaining({
        sort: 'createdAt desc',
        pageSize: '50',
        page: '1',
      }),
    })
    expect(renderTable).toHaveBeenCalledWith(mockOfferResponse.data, undefined)
    expect(displayWithPager).toHaveBeenCalledWith('rendered table')
  })

  it('passes filter to API request', async () => {
    mockApiRequest.mockResolvedValue(mockOfferResponse)

    await query.parseAsync(['-f', "uf eq 'DF'"], { from: 'user' })

    expect(mockApiRequest).toHaveBeenCalledWith('GET', '/offers', {
      query: expect.objectContaining({
        filter: "uf eq 'DF'",
      }),
    })
  })

  it('rejects invalid filter syntax before making API call', async () => {
    await query.parseAsync(['-f', 'invalid filter !!!'], { from: 'user' })

    expect(mockApiRequest).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })

  it('rejects invalid sort expression', async () => {
    await query.parseAsync(['-s', 'invalidField desc'], { from: 'user' })

    expect(mockApiRequest).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })

  it('displays message when no results', async () => {
    mockApiRequest.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 50, total: 0 },
    })

    await query.parseAsync([], { from: 'user' })

    expect(console.log).toHaveBeenCalledWith('\nNo results match the given criteria.')
  })

  it('disables pager with --no-pager', async () => {
    mockApiRequest.mockResolvedValue(mockOfferResponse)

    await query.parseAsync(['--no-pager'], { from: 'user' })

    expect(displayWithPager).not.toHaveBeenCalled()
    expect(console.log).toHaveBeenCalledWith('rendered table')
  })

  it('shows login prompt on 401 error', async () => {
    mockApiRequest.mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'Not authorized'))

    await query.parseAsync([], { from: 'user' })

    expect(process.exitCode).toBe(1)
  })

  it('shows generic error for non-auth errors', async () => {
    mockApiRequest.mockRejectedValue(new Error('Network error'))

    await query.parseAsync([], { from: 'user' })

    expect(process.exitCode).toBe(1)
  })
})
