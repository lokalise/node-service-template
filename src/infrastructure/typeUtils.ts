export type StandardizedError = {
  code: string
  message: string
}

export const hasMessage = (maybe: unknown): maybe is { message: string } =>
  isObject(maybe) && typeof maybe.message === 'string'

export const isObject = (maybeObject: unknown): maybeObject is Record<PropertyKey, unknown> =>
  typeof maybeObject === 'object' && maybeObject !== null

export const isError = (error: unknown): error is Error =>
  isObject(error) && typeof error.message === 'string'

export const isStandardizedError = (error: unknown): error is StandardizedError =>
  isObject(error) && typeof error.code === 'string' && typeof error.message === 'string'
