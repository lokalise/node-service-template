import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { validate } from 'oas-validator'
import { parse as fromYaml } from 'yaml'

import { consoleLog } from './utils/loggingUtils.ts'
import { getRootDirectory } from './utils/pathUtils.ts'

const targetPath = resolve(getRootDirectory(), 'openApiSpec.yaml')

const hasOptions = (error: unknown): error is { options: unknown } =>
  typeof error === 'object' && error !== null && 'options' in error

async function run() {
  const yaml = await readFile(targetPath)
  try {
    await validate(fromYaml(yaml.toString()), {})
    consoleLog('Document is valid')
  } catch (err) {
    consoleLog(hasOptions(err) ? JSON.stringify(err.options) : err)
    throw new Error('Specification validation has failed')
  }
}

void run()
