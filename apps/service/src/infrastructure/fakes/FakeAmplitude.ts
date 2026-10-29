import type { AmplitudeReturn, Result } from '@amplitude/analytics-types'
import { Amplitude } from '@lokalise/fastify-extras'

export class FakeAmplitude extends Amplitude {
  constructor() {
    super(false)
  }

  override track(): AmplitudeReturn<Result | null> {
    return {
      promise: Promise.resolve(null),
    }
  }
}
