import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import z from 'zod'
import { cliCommandWrapper } from './cliCommandWrapper.ts'

describe('cliCommandWrapper', () => {
  let exitSpy: MockInstance

  beforeEach(() => {
    // Mock process.exit before each test
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    { inputArgs: ['--key=value'], schema: undefined, expected: undefined },
    {
      inputArgs: ['--key=value'],
      schema: z.object({ key: z.string() }),
      expected: { key: 'value' },
    },
    { inputArgs: ['--flag'], schema: z.object({ flag: z.boolean() }), expected: { flag: true } },
    {
      inputArgs: ['--key=value'],
      schema: z.object({ flag: z.boolean().optional(), key: z.string() }),
      expected: { key: 'value' },
    },
    {
      inputArgs: ['--key=value', '-abc', '--flag'],
      schema: z.object({
        key: z.string(),
        flag: z.boolean(),
        a: z.boolean(),
        b: z.boolean(),
        c: z.boolean(),
      }),
      expected: { key: 'value', flag: true, a: true, b: true, c: true },
    },
  ])('should parse arguments', async ({ inputArgs, schema, expected }) => {
    process.argv = ['node', 'script.ts', ...inputArgs]
    await cliCommandWrapper(
      'command',
      (dependencies, requestContext, args) => {
        expect(dependencies).toBeDefined()
        expect(requestContext).toBeDefined()
        expect(args).toEqual(expected)
      },
      schema,
    )
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('should fail if arguments are not valid', async () => {
    process.argv = ['node', 'script.ts', '--key=value']
    await cliCommandWrapper('command', () => undefined, z.object({ key: z.number() }))
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('should fail if cli command fail', async () => {
    process.argv = ['node', 'script.ts', '--key=value']
    await cliCommandWrapper('command', () => {
      throw new Error()
    })
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
