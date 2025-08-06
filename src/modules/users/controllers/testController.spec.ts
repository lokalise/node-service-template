import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getTestConfigurationOverrides } from '../../../../test/jwtUtils.ts'
import type { AppInstance } from '../../../app.ts'
import { getApp } from '../../../app.ts'
import { parse as fromYaml, stringify as toYaml } from 'yaml'
import { validate } from 'oas-validator'
import { isError } from '@lokalise/node-core'


describe('testController', () => {
  let app: AppInstance

  beforeAll(async () => {
    app = await getApp(getTestConfigurationOverrides())
  })

  afterAll(async () => {
    await app.close()
  })

  it('should generate valid OpenAPI', async () => {
    const openApiSpecResponse = await app.inject().get('/documentation/openapi.json')
    const openApiSpecAsYaml = toYaml(JSON.parse(openApiSpecResponse.body))

    let valid = true
    try {
      await validate(fromYaml(openApiSpecAsYaml), {})
      console.log('OpenAPI specification is valid')
    } catch(e) {
      console.error(`OpenAPI validation failed: ${isError(e) ? e.message : e}`)
      valid = false
    }

    expect(valid).toBe(true)
  })
})
