import { spawn } from 'node:child_process'
import path from 'node:path'
import { setTimeout as wait } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const LOOP_SCRIPT = path.join(REPO_ROOT, 'scripts/dummy/lifecycle-loop.ts')
const READY_DEADLINE_MS = 10_000
const EXIT_DEADLINE_MS = 10_000

const waitFor = async (predicate: () => boolean, deadlineMs: number, label: string) => {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > deadlineMs) {
      throw new Error(`Timed out waiting for: ${label}`)
    }
    await wait(50)
  }
}

describe('cliCommandWrapper — SIGTERM abort propagation (integration)', () => {
  it('aborts the running command via lifecycle.signal and exits cleanly', async () => {
    // NODE_ENV=production triggers `fastify-graceful-shutdown` registration in
    // src/app.ts. Without it, SIGTERM would force-kill the process instead of
    // routing through our handler.
    const child = spawn('node', ['--env-file-if-exists=.env', LOOP_SCRIPT], {
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      output += chunk.toString()
    })

    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
      child.on('exit', (code, signal) => resolve({ code, signal })),
    )

    try {
      // Let the loop run a few iterations so we can prove the abort actually
      // interrupted real work (vs. the script crashing on startup).
      await waitFor(
        () => /"iteration":\s*3/.test(output),
        READY_DEADLINE_MS,
        'loop to reach iteration 3',
      )

      child.kill('SIGTERM')

      const result = await Promise.race([
        exited,
        wait(EXIT_DEADLINE_MS).then(() => {
          throw new Error('Child did not exit within deadline after SIGTERM')
        }),
      ])

      expect(result.signal).toBeNull()
      expect(result.code).toBe(0)
      expect(output).toContain('LOOP_STARTED')
      expect(output).toContain('Shutdown signal received, stopping after current step')
      expect(output).toContain('LOOP_EXITED_CLEANLY')
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
      }
    }
  }, 30_000)
})
