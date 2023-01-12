import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { validate } from 'oas-validator'
import { parse as fromYaml } from 'yaml'

const targetPath = resolve(__dirname, '../openApiSpec.yaml')

const hasOptions = (error: unknown): error is { options: unknown } =>
  typeof error === 'object' && error !== null && 'options' in error

async function run() {
  const yaml = await readFile(targetPath)
  try {
    await validate(fromYaml(yaml.toString()), {})
    console.log('Document is valid')
  } catch (err) {
    console.log(hasOptions(err) ? JSON.stringify(err.options) : err)
    throw new Error('Specification validation has failed')
  }
}

void run()
