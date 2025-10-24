import { defineConfig } from 'vitest/config'

// biome-ignore lint/style/noDefaultExport: vite expects default export
export default defineConfig({
  test: {
    globals: true,
    maxWorkers: 1,
    isolate: false,
    pool: 'threads',
    watch: false,
    environment: 'node',
    setupFiles: ['test/envSetupHook.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/otel.ts',
        'src/db/*',
        'src/infrastructure/healthchecks/healthchecks.ts',
        'src/infrastructure/jobs/AbstractPeriodicJob.ts',
        'src/infrastructure/CommonModule.ts',
        'src/infrastructure/logger.ts',
        'src/infrastructure/diConfig.ts',
        'src/infrastructure/errors/publicErrors.ts',
        'src/infrastructure/errors/internalErrors.ts',
        'src/infrastructure/fakes/FakeAmplitude.ts',
        'src/infrastructure/fakes/FakeNewrelicTransactionManager.ts',
        'src/schemas/commonTypes.ts',
        'src/server.ts',
        'src/app.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ],
      reporter: ['text'],
      thresholds: {
        lines: 89,
        functions: 89,
        branches: 80,
        statements: 89,
      },
    },
  },
})
