import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { loadEnv } from './env.js'

describe('loadEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('parses valid environment variables', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db'
    process.env.JWT_SECRET = 'a-very-secret-key-that-is-at-least-32-characters-long!!'
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'
    process.env.ADMIN_EMAILS = 'admin@example.com, admin2@example.com'
    process.env.PORT = '4000'

    const env = loadEnv()
    expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/db')
    expect(env.JWT_SECRET).toBe('a-very-secret-key-that-is-at-least-32-characters-long!!')
    expect(env.GOOGLE_CLIENT_ID).toBe('google-client-id')
    expect(env.GOOGLE_CLIENT_SECRET).toBe('google-client-secret')
    expect(env.ADMIN_EMAILS).toEqual(['admin@example.com', 'admin2@example.com'])
    expect(env.PORT).toBe(4000)
  })

  it('uses default DATABASE_URL when not provided', () => {
    delete process.env.DATABASE_URL
    process.env.JWT_SECRET = 'a-very-secret-key-that-is-at-least-32-characters-long!!'
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'

    const env = loadEnv()
    expect(env.DATABASE_URL).toBe('postgresql://imoveis:imoveis@localhost:5432/imoveis')
  })

  it('uses default PORT when not provided', () => {
    delete process.env.PORT
    process.env.JWT_SECRET = 'a-very-secret-key-that-is-at-least-32-characters-long!!'
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'

    const env = loadEnv()
    expect(env.PORT).toBe(3000)
  })

  it('parses empty ADMIN_EMAILS to empty array', () => {
    process.env.JWT_SECRET = 'a-very-secret-key-that-is-at-least-32-characters-long!!'
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'
    process.env.ADMIN_EMAILS = ''

    const env = loadEnv()
    expect(env.ADMIN_EMAILS).toEqual([])
  })

  it('defaults ADMIN_EMAILS to empty array when not provided', () => {
    delete process.env.ADMIN_EMAILS
    process.env.JWT_SECRET = 'a-very-secret-key-that-is-at-least-32-characters-long!!'
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'

    const env = loadEnv()
    expect(env.ADMIN_EMAILS).toEqual([])
  })

  it('rejects JWT_SECRET shorter than 32 characters', () => {
    process.env.JWT_SECRET = 'short'
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'

    expect(() => loadEnv()).toThrow()
  })

  it('rejects JWT_SECRET starting with "change-me"', () => {
    process.env.JWT_SECRET = 'change-me-this-is-a-long-enough-secret-placeholder'
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'

    expect(() => loadEnv()).toThrow()
  })

  it('throws when required GOOGLE_CLIENT_ID is missing', () => {
    process.env.JWT_SECRET = 'a-very-secret-key-that-is-at-least-32-characters-long!!'
    delete process.env.GOOGLE_CLIENT_ID
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'

    expect(() => loadEnv()).toThrow()
  })

  it('throws when required GOOGLE_CLIENT_SECRET is missing', () => {
    process.env.JWT_SECRET = 'a-very-secret-key-that-is-at-least-32-characters-long!!'
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    delete process.env.GOOGLE_CLIENT_SECRET

    expect(() => loadEnv()).toThrow()
  })
})
