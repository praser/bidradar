const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 } as const

type LogLevel = keyof typeof LEVELS

export interface Logger {
  debug(msg: string, extra?: Record<string, unknown>): void
  info(msg: string, extra?: Record<string, unknown>): void
  warn(msg: string, extra?: Record<string, unknown>): void
  error(msg: string, extra?: Record<string, unknown>): void
}

export function createLogger(minLevel: string): Logger {
  const threshold = LEVELS[minLevel as LogLevel] ?? LEVELS.INFO

  function log(level: LogLevel, msg: string, extra?: Record<string, unknown>): void {
    if (LEVELS[level] < threshold) return
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      msg,
    }
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        entry[k] = v
      }
    }
    process.stdout.write(JSON.stringify(entry) + '\n')
  }

  return {
    debug: (msg, extra) => log('DEBUG', msg, extra),
    info: (msg, extra) => log('INFO', msg, extra),
    warn: (msg, extra) => log('WARN', msg, extra),
    error: (msg, extra) => log('ERROR', msg, extra),
  }
}
