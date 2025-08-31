import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { validate } from '@readme/openapi-parser'
import { parse as fromYaml } from 'yaml'
import { consoleLog } from './utils/loggingUtils.ts'
import { getRootDirectory } from './utils/pathUtils.ts'

const targetPath = resolve(getRootDirectory(), 'openApiSpec.yaml')

async function run() {
  const yaml = await readFile(targetPath)
  const validationResult = await validate(fromYaml(yaml.toString()))
  if (validationResult.valid) {
    consoleLog('Document is valid')
  } else {
    consoleLog(`Errors: ${JSON.stringify(validationResult.errors)})`)
    consoleLog(`Warnings: ${JSON.stringify(validationResult.warnings)})`)
    throw new Error('Specification validation has failed')
  }
}

void run()
