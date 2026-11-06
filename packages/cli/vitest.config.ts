import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // spawn-based subprocess tests and engine scaffolds exceed the 5s default
    // on slow hosted runners (observed: windows-latest unit timeouts).
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
