import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function getRootDirectory() {
  const pathUtilsFilename = fileURLToPath(import.meta.url)
  return resolve(dirname(pathUtilsFilename), '..', '..')
}
