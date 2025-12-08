import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { createSigner, createVerifier } from 'fast-jwt'

import { consoleLog } from './utils/loggingUtils.ts'
import { getRootDirectory } from './utils/pathUtils.ts'

const scriptsPath = resolve(getRootDirectory(), 'scripts')
const keysPath = join(scriptsPath, 'keys')

const privateKey = readFileSync(`${keysPath}/jwtRS256.key`, 'utf8')
const publicKey = readFileSync(`${keysPath}/jwtRS256.key.pub`, 'utf8')

const sign = createSigner({ algorithm: 'RS256', key: privateKey })
const verify = createVerifier({ key: publicKey })

const token = sign({ claim: 'value' })
consoleLog(`Public key: \n${publicKey.replaceAll('\n', '||')}`)
consoleLog(`JWT: \n${token}`)
const payload = verify(token) as string
consoleLog(`Verified payload: \n${JSON.stringify(payload)}`)
