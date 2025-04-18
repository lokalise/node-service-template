import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { consoleLog } from './utils/loggingUtils.ts'
import { getRootDirectory } from './utils/pathUtils.ts'

const codeBasePath = resolve(getRootDirectory(), 'src/infrastructure/config.ts')
const docPath = resolve(getRootDirectory(), 'docs/environment-variables.md')

function extractEnvVarsFromCode(content: string): Set<string> {
  const regex = /configScope\.\w+\(\s*['"`]([A-Z0-9_]+)['"`]/g
  const matches = content.matchAll(regex)
  const vars = new Set<string>()
  for (const match of matches) {
    const varName = match[1]
    if (varName) vars.add(varName)
  }
  return vars
}

function extractEnvVarsFromDocs(content: string): Set<string> {
  const regex = /^-\s*(\(OPTIONAL\)\s*)?`([A-Z0-9_]+)`/gm
  const matches = content.matchAll(regex)
  const vars = new Set<string>()
  for (const match of matches) {
    const varName = match[2]
    if (varName) vars.add(varName)
  }
  return vars
}

async function run() {
  const content = await readFile(codeBasePath, 'utf-8')
  const varsInFile = extractEnvVarsFromCode(content)

  const docContent = await readFile(docPath, 'utf-8')
  const documentedVars = extractEnvVarsFromDocs(docContent)

  const missing = [...varsInFile].filter((v) => !documentedVars.has(v))

  if (missing.length > 0) {
    console.error('❌ Missing documentation for the following environment variables:')
    for (const v of missing) {
      console.error(`- ${v}`)
    }
    throw new Error('Environment variable documentation validation failed')
  }
  consoleLog('✅ All environment variables are documented!')
}

void run()
