import { readFile } from 'node:fs/promises'

/** Reads a file as ISO-8859-1 (latin1) and returns its content as a Unicode string (safe to use or write as UTF-8). */
export const readLocalFile = async (path: string): Promise<string> => {
  const buffer = await readFile(path, { encoding: null })
  return buffer.toString('latin1')
}
