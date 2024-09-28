import { describe, expect, it } from 'vitest'
import { getArgs } from './cliContextUtils.js'

describe('getArgs', () => {
  it('parses long arguments with values', () => {
    process.argv = ['node', 'script.js', '--key=value']
    const args = getArgs()
    expect(args).toEqual({ key: 'value' })
  })

  it('parses long arguments without values', () => {
    process.argv = ['node', 'script.js', '--flag']
    const args = getArgs()
    expect(args).toEqual({ flag: true })
  })

  it('parses short arguments', () => {
    process.argv = ['node', 'script.js', '-abc']
    const args = getArgs()
    expect(args).toEqual({ a: true, b: true, c: true })
  })

  it('parses mixed arguments', () => {
    process.argv = ['node', 'script.js', '--key=value', '-abc', '--flag']
    const args = getArgs()
    expect(args).toEqual({ key: 'value', a: true, b: true, c: true, flag: true })
  })

  it('handles no arguments', () => {
    process.argv = ['node', 'script.js']
    const args = getArgs()
    expect(args).toEqual({})
  })

  it('handles empty long argument', () => {
    process.argv = ['node', 'script.js', '--']
    const args = getArgs()
    console.info(args)
    expect(args).toEqual({})
  })

  it('handles empty short argument', () => {
    process.argv = ['node', 'script.js', '-']
    const args = getArgs()
    expect(args).toEqual({})
  })
})
