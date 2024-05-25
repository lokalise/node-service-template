import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    watch: false,
    environment: 'node',
    setupFiles: ['test/envSetupHook.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
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
      all: true,
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
})
