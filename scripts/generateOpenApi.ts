import { rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { stringify as toYaml } from 'yaml'

import { getApp } from '../src/app.js'

import { getRootDirectory } from './utils/pathUtils.js'

const targetPath = resolve(getRootDirectory(), 'openApiSpec.yaml')

async function run() {
  const app = await getApp({
    queuesEnabled: false,
    jobsEnabled: false,
    healthchecksEnabled: false,
    monitoringEnabled: false,
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
