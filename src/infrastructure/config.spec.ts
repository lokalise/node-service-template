import type { AppInstance } from '../app.js'
import { getApp } from '../app.js'

describe('config', () => {
  let app: AppInstance

  beforeAll(async () => {
    app = await getApp({
      monitoringEnabled: false,
    })
  })

  afterAll(async () => {
    await app.close()
  })

  it('support multi line values', () => {
    const value = app.diContainer.cradle.config.multiLinevalue

    expect(value).toBe(`multi
line
value`)
  })
})
