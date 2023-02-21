import { readFileSync } from 'fs'
import path from 'path'

import { createSigner, createVerifier } from 'fast-jwt'

const privateKey = readFileSync(`${path.join(__dirname, 'keys')}/jwtRS256.key`, 'utf8')
const publicKey = readFileSync(`${path.join(__dirname, 'keys')}/jwtRS256.key.pub`, 'utf8')

const sign = createSigner({ algorithm: 'RS256', key: privateKey })
const verify = createVerifier({ key: publicKey })

const token = sign({ claim: 'value' })
console.log(`Public key: \n${publicKey.replaceAll('\n', '||')}`)
console.log(`JWT: \n${token}`)
const payload = verify(token) as string
console.log(`Verified payload: \n${JSON.stringify(payload)}`)
