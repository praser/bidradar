import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync } from 'node:fs'
import { getDevApiUrl, getCliBinPath, runCli } from './helpers.js'

describe('Live: CLI commands', () => {
  beforeAll(async () => {
    await getDevApiUrl()

    const binPath = getCliBinPath()
    if (!existsSync(binPath)) {
      throw new Error(
        `CLI binary not found at ${binPath}. Run "pnpm --filter @bidradar/cli build" first.`,
      )
    }
  })

  describe('bidradar --version', () => {
    it('prints the version', async () => {
      const result = await runCli(['--version'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
    })
  })

  describe('bidradar --help', () => {
    it('prints help text with available commands', async () => {
      const result = await runCli(['--help'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('login')
      expect(result.stdout).toContain('logout')
      expect(result.stdout).toContain('query')
      expect(result.stdout).toContain('whoami')
    })
  })

  describe('bidradar whoami (unauthenticated)', () => {
    it('fails with auth error when not logged in', async () => {
      const result = await runCli(['whoami'])
      expect(result.exitCode).not.toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toContain('Not logged in')
    })
  })

  describe('bidradar query (unauthenticated)', () => {
    it('fails with auth error when not logged in', async () => {
      const result = await runCli(['query', '--no-pager'])
      expect(result.exitCode).not.toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toContain('Not authenticated')
    })
  })

  describe('bidradar query --help', () => {
    it('prints query help text with filter and sort options', async () => {
      const result = await runCli(['query', '--help'])
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('--filter')
      expect(result.stdout).toContain('--sort')
      expect(result.stdout).toContain('--page-size')
      expect(result.stdout).toContain('--page')
    })
  })

  describe('bidradar query with invalid filter', () => {
    it('fails with filter syntax error', async () => {
      const result = await runCli(['query', '-f', 'invalid!!!filter', '--no-pager'])
      expect(result.exitCode).not.toBe(0)
      const output = result.stdout + result.stderr
      expect(output).toContain('Filter syntax error')
    })
  })

})
