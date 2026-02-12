import { spawn } from 'node:child_process'

export function displayWithPager(text: string): Promise<void> {
  if (!process.stdout.isTTY) {
    process.stdout.write(text + '\n')
    return Promise.resolve()
  }

  const lines = text.split('\n').length
  const termRows = process.stdout.rows ?? 24
  if (lines <= termRows) {
    process.stdout.write(text + '\n')
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    const less = spawn(
      'less',
      ['-S', '-R', '--no-init', '--quit-if-one-screen'],
      { stdio: ['pipe', process.stdout, process.stderr] },
    )

    less.on('error', () => {
      process.stdout.write(text + '\n')
      resolve()
    })

    less.on('close', () => {
      resolve()
    })

    less.stdin.write(text)
    less.stdin.end()
  })
}
