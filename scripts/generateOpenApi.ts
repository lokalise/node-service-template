import { writeFile, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

import { stringify as toYaml } from 'yaml'

import { getApp } from '../src/app'

const targetPath = resolve(__dirname, '../openApiSpec.yaml')

async function run() {
  const app = await getApp({
    amqpEnabled: false,
    healthchecksEnabled: false,
  })

  const openApiSpecResponse = await app.inject().get('/documentation/json')
  const openApiSpecAsYaml = toYaml(JSON.parse(openApiSpecResponse.body))

  try {
    await rm(targetPath)
  } catch {
    // it's ok if it doesn't exist
  }
  await writeFile(targetPath, openApiSpecAsYaml)

  await app.close()
}

void run()
