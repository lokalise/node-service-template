import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    threads: false,
    watch: false,
    environment: 'node',
    setupFiles: ['test/dotenvConfig.ts'],
    reporters: ['default'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: [
        'src/infrastructure/diConfig.ts',
        'src/server.ts',
        'src/app.ts',
        'src/modules/jobs.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ],
      reporter: ['text'],
      all: true,
      lines: 87,
      functions: 87,
      branches: 84,
      statements: 87,
    },
  },
})
