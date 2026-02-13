import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { z } from 'zod'

const CONFIG_DIR = join(homedir(), '.bidradar')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

const ConfigSchema = z.object({
  apiUrl: z.string().url().default('http://localhost:3000'),
  token: z.string().optional(),
})

type Config = z.infer<typeof ConfigSchema>

export async function loadConfig(): Promise<Config> {
  try {
    const raw = await readFile(CONFIG_FILE, 'utf-8')
    return ConfigSchema.parse(JSON.parse(raw))
  } catch {
    return ConfigSchema.parse({})
  }
}

export async function saveConfig(config: Partial<Config>): Promise<void> {
  const current = await loadConfig()
  const merged = { ...current, ...config }
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
  await writeFile(CONFIG_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 })
  await chmod(CONFIG_FILE, 0o600)
}

export async function clearToken(): Promise<void> {
  const current = await loadConfig()
  const { token: _, ...rest } = current
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 })
  await writeFile(CONFIG_FILE, JSON.stringify(rest, null, 2), { mode: 0o600 })
  await chmod(CONFIG_FILE, 0o600)
}

export async function getToken(): Promise<string | undefined> {
  const config = await loadConfig()
  return config.token
}

export async function getApiUrl(): Promise<string> {
  const config = await loadConfig()
  return config.apiUrl
}
