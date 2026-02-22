import { defineConfig } from 'vitest/config'

// biome-ignore lint/style/noDefaultExport: vite expects default export
export default defineConfig({
  test: {
    globals: true,
    maxWorkers: 1,
    pool: 'threads',
    watch: false,
    environment: 'node',
    setupFiles: ['test/envSetupHook.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/db/*',
        'src/infrastructure/CommonModule.ts',
        'src/infrastructure/logger.ts',
        'src/infrastructure/config.ts',
        'src/infrastructure/errors/publicErrors.ts',
        'src/infrastructure/errors/internalErrors.ts',
        'src/infrastructure/fakes/FakeAmplitude.ts',
        'src/schemas/commonTypes.ts',
        'src/server.ts',
        'src/serverInternal.ts',
        'src/otel.ts',
        'src/app.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ],
      reporter: ['text'],
      thresholds: {
        lines: 85,
        functions: 89,
        branches: 65,
        statements: 85,
      },
    },
  },
})
