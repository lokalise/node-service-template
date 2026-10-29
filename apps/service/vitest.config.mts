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
        'src/db/**',
        'src/infrastructure/CommonModule.ts',
        'src/infrastructure/config.ts',
        'src/infrastructure/fakes/FakeAmplitude.ts',
        'src/server.ts',
        'src/serverInternal.ts',
        'src/app.ts',
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
