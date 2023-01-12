# Scheduling

## Overview

Two libraries are used for managing scheduled jobs: [toad-scheduler](https://github.com/kibertoad/toad-scheduler) and [redis-semaphore](https://github.com/swarthy/redis-semaphore).

### Rationale

Earlier versions of this template were using existing queue engines and job schedulers with built-in clustering support.
We have found their behaviour to be unpredictable, often surprising, causing either bugs or performance issues.
Complexity of their implementation and their data structure is also unnecessary in the majority of typical cases.

In our experience, manual management of concurrency via obtaining and releasing locks is significantly easier conceptually, is fully transparent and very easy to reason about.

### Configuration

[AbstractBackgroundJob](../src/infrastructure/AbstractBackgroundJob.ts) is the base class that you should extend when implementing your background jobs.

You should register all of your jobs to `app.scheduler` in [jobs.ts](../src/modules/jobs.ts) to ensure that they are launched when application starts.
If you choose to do your own job registration instead of using `jobs.ts`, note that it needs to happen within the `app.after(() => {})` block.

Both period ("run job every X hours/minutes/seconds") and cron ("0 \* \* \* \*") configuration styles are supported. Check [jobs.ts](../src/modules/jobs.ts) for examples.

### Concurrency management

When running your application in a clustered environment, before executing your jobs, acquire an exclusive lock:

```ts
const lock = await this.tryAcquireExclusiveLock({
  lockTimeout: LOCK_TIMEOUT_IN_MSECS,
  refreshInterval: LOCK_REFRESH_IN_MSECS,
})
```

If lock is undefined, it means that someone else is currently executing this job, so there is no need to do anything at this time, you can early return.

If lock is truthy, you can proceed with executing your job. Note that if you set `refreshInterval` parameter, lock will be automatically bumped to be
`lockTimeout`, until you cancel the refresh. This is useful for long-running jobs, to ensure that you are sending heartbeat on periodic basis, to avoid
lock expiring and someone else starting to process it in parallel.

After your job is completed, you typically have two options.

Either release the lock, if it is fine for someone else to pickup the job at this time again:

```ts
try {
  // Process job logic here
  await this.deleteOldUsers()
} finally {
  await lock.release()
}
```

Or force all jobs to sleep until a later period of time, if it is no longer going to be relevant for a while:

```ts
// Process job logic here
await this.sendEmails()

// If successful, we don't want to process this job again for a longer period of time, let's put a new lock
await this.updateMutex(lock, LOCK_ON_SUCCESS_IN_MSECS)
```

## Notable details

- All jobs are automatically stopped when fastify instance is stopped

- Default template implementation disables background scheduling of jobs when running tests (see `// Register background jobs` block in [app.ts](../src/app.ts) if you would like to change this behaviour)

- If you are not using cron expressions for scheduling your jobs, you can drop the optional dependency `croner` from `package.json`.
