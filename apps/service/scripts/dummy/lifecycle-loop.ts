import { setTimeout } from 'node:timers/promises'
import { cliCommandWrapper } from '../utils/cliCommandWrapper.ts'

// Long-running loop used by cliCommandWrapper's integration test to assert that
// the app-scoped AbortSignal propagates through `lifecycle.signal` and cleanly
// exits the loop when SIGTERM arrives. Spawned as a child process by the spec.
await cliCommandWrapper(
  'lifecycle-loop',
  async (_dependencies, requestContext, _args, lifecycle) => {
    requestContext.logger.info('LOOP_STARTED')

    let iteration = 0
    while (!lifecycle.signal.aborted) {
      iteration += 1
      requestContext.logger.info({ iteration }, 'tick')
      await setTimeout(100, undefined, { signal: lifecycle.signal }).catch(() => {})
    }

    requestContext.logger.warn({ iteration }, 'LOOP_EXITED_CLEANLY')
  },
)
