import { existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface BrowserFetchResult {
  html: Buffer
  screenshot: Buffer
}

function findProjectRoot(): string | undefined {
  // Walk up from the running file's directory looking for a `chrome/` sibling
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'chrome'))) return dir
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return undefined
}

async function resolveChromium(): Promise<{ executablePath: string; args: string[] }> {
  if (process.platform === 'linux') {
    const chromium = await import('@sparticuz/chromium')
    return {
      executablePath: await chromium.default.executablePath(),
      args: chromium.default.args,
    }
  }

  // Local dev: find project root, then look for cached Chrome
  const roots = [findProjectRoot(), process.cwd()].filter(Boolean) as string[]
  for (const root of roots) {
    const cached = findCachedChrome(join(root, 'chrome'))
    if (cached) {
      return { executablePath: cached, args: [] }
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
      `No local Chrome found (roots searched: ${roots.join(', ')}). Run: npx @puppeteer/browsers install chrome@stable`,
    )
  }

  return { executablePath: found, args: [] }
}

function findCachedChrome(cacheDir: string): string | undefined {
  if (!existsSync(cacheDir)) return undefined

  for (const entry of readdirSync(cacheDir)) {
    const macBinary = join(
      cacheDir, entry, 'chrome-mac-arm64',
      'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing',
    )
    if (existsSync(macBinary)) return macBinary

    const macX64Binary = join(
      cacheDir, entry, 'chrome-mac-x64',
      'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing',
    )
    if (existsSync(macX64Binary)) return macX64Binary
  }

  return undefined
}

export async function browserFetch(url: string): Promise<BrowserFetchResult> {
  const puppeteer = await import('puppeteer-core')
  const { executablePath, args } = await resolveChromium()

  const browser = await puppeteer.default.launch({
    args,
    executablePath,
    headless: true,
  })

  try {
    const page = await browser.newPage()
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
