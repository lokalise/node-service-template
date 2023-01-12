export const TIMEOUT = Symbol()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rejecter = (reason?: any) => void

class CancelToken {
  timeoutId?: NodeJS.Timeout
  rejecter?: Rejecter

  cancel() {
    if (this.timeoutId) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      clearTimeout(this.timeoutId)
    }
    if (this.rejecter) {
      this.rejecter()
    }
  }

  init(timeoutId: NodeJS.Timeout, rejecter: Rejecter) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.timeoutId = timeoutId
    this.rejecter = rejecter
  }
}

const timeoutWithCancel = (timeout: number) => {
  const cancelToken = new CancelToken()
  const timeoutPromise = new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, timeout, TIMEOUT)
    cancelToken.init(timeoutId, reject)
  })

  return {
    timeoutPromise,
    cancelToken,
  }
}

export const runWithTimeout = async <T>(promise: PromiseLike<T>, timeout: number) => {
  const { timeoutPromise, cancelToken } = timeoutWithCancel(timeout)

  const response = await Promise.race([timeoutPromise, promise])
  cancelToken.cancel()

  return response
}
