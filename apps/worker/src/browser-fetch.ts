import { existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

export interface BrowserFetchResult {
  html: Buffer
  screenshot: Buffer
}

function findProjectRoot(): string | undefined {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'chrome'))) return dir
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'pnpm-workspace.yaml')))
      return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return undefined
}

function findCachedChrome(cacheDir: string): string | undefined {
  if (!existsSync(cacheDir)) return undefined

  const candidates = [
    // mac arm64
    (base: string) =>
      join(
        base,
        'chrome-mac-arm64',
        'Google Chrome for Testing.app',
        'Contents',
        'MacOS',
        'Google Chrome for Testing',
      ),
    // mac x64
    (base: string) =>
      join(
        base,
        'chrome-mac-x64',
        'Google Chrome for Testing.app',
        'Contents',
        'MacOS',
        'Google Chrome for Testing',
      ),
    // linux
    (base: string) => join(base, 'chrome-linux64', 'chrome'),
  ]

  // @puppeteer/browsers installs to: <cacheDir>/<browser>/<platform-version>/<platform-dir>/chrome
  // e.g. chrome/chrome/linux_arm-145.0.7632.77/chrome-linux64/chrome
  // Walk up to 3 levels deep to find the binary.
  function search(dir: string, depth: number): string | undefined {
    if (depth > 3) return undefined
    for (const check of candidates) {
      const path = check(dir)
      if (existsSync(path)) return path
    }
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const found = search(join(dir, entry.name), depth + 1)
        if (found) return found
      }
    } catch {
      // permission error or similar — skip
    }
    return undefined
  }

  return search(cacheDir, 0)
}

async function resolveChromium(): Promise<{ executablePath: string; args: string[] }> {
  const headlessArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']

  const roots = [findProjectRoot(), process.cwd()].filter(Boolean) as string[]
  for (const root of roots) {
    const cached = findCachedChrome(join(root, 'chrome'))
    if (cached) return { executablePath: cached, args: headlessArgs }
  }
  // CHROME_PATH env var takes highest priority
  const envPath = process.env['CHROME_PATH']
  if (envPath && existsSync(envPath)) {
    return { executablePath: envPath, args: headlessArgs }
  }

  // Playwright installs standalone Chromium (works on ARM64, no snap issues)
  // Path: ~/.cache/ms-playwright/chromium-<version>/chrome-linux/chrome
  const playwrightCache = join(
    process.env['PLAYWRIGHT_BROWSERS_PATH'] ?? join(homedir(), '.cache', 'ms-playwright'),
  )
  if (existsSync(playwrightCache)) {
    try {
      for (const entry of readdirSync(playwrightCache)) {
        if (!entry.startsWith('chromium-')) continue
        const binary = join(playwrightCache, entry, 'chrome-linux', 'chrome')
        if (existsSync(binary)) return { executablePath: binary, args: headlessArgs }
      }
    } catch {
      // permission error — skip
    }
  }

  const systemPaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ]
  const found = systemPaths.find((p) => existsSync(p))
  if (!found) {
    throw new Error(
      'No Chrome/Chromium found. Set CHROME_PATH env var, or run: npx playwright install chromium',
    )
  }
  return { executablePath: found, args: headlessArgs }
}

export async function browserFetch(url: string): Promise<BrowserFetchResult> {
  const puppeteer = await import('puppeteer-core')
  const { executablePath, args } = await resolveChromium()
  const browser = await puppeteer.default.launch({ args, executablePath, headless: true })
  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    )
    await page.setExtraHTTPHeaders({ Referer: new URL(url).origin + '/' })
    await page.goto(url, { waitUntil: 'networkidle0' })
    const screenshot = await page.screenshot({ fullPage: true, type: 'png' })
    const html = await page.content()
    return {
      html: Buffer.from(html, 'utf-8'),
      screenshot: Buffer.from(screenshot),
    }
  } finally {
    await browser.close()
  }
}
