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
        'src/infrastructure/errors/publicErrors.ts',
        'src/infrastructure/errors/internalErrors.ts',
        'src/schemas/commonTypes.ts',
        'src/server.ts',
        'src/app.ts',
        'src/**/*.spec.ts',
        'src/**/*.test.ts',
      ],
      reporter: ['text'],
      all: true,
      lines: 90,
      functions: 90,
      branches: 85,
      statements: 90,
    },
  },
})
