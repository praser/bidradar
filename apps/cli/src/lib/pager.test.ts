import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { displayWithPager } from './pager.js'

describe('displayWithPager', () => {
  const originalIsTTY = process.stdout.isTTY
  const originalRows = process.stdout.rows

  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true })
    Object.defineProperty(process.stdout, 'rows', { value: originalRows, writable: true })
  })

  it('writes directly to stdout when not a TTY', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true })
    await displayWithPager('hello')
    expect(process.stdout.write).toHaveBeenCalledWith('hello\n')
  })

  it('writes directly when content fits in terminal', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true })
    Object.defineProperty(process.stdout, 'rows', { value: 50, writable: true })
    const shortText = 'line1\nline2\nline3'
    await displayWithPager(shortText)
    expect(process.stdout.write).toHaveBeenCalledWith(shortText + '\n')
  })
})
