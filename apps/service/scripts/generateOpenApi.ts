import { rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { stringify as toYaml } from 'yaml'

import { getApp } from '../src/app.ts'

import { getRootDirectory } from './utils/pathUtils.ts'

const targetPath = resolve(getRootDirectory(), 'openApiSpec.yaml')

async function run() {
  const app = await getApp({
    healthchecksEnabled: false,
    monitoringEnabled: false,
    periodicJobsEnabled: false,
    messageQueueConsumersEnabled: false,
    enqueuedJobWorkersEnabled: false,
    jobQueuesEnabled: false,
  })

  const openApiSpecResponse = app.swagger()
  const openApiSpecAsYaml = toYaml(openApiSpecResponse)

  try {
    await rm(targetPath)
  } catch {
    // it's ok if it doesn't exist
  }
  await writeFile(targetPath, openApiSpecAsYaml)

  await app.close()
}

void run()
