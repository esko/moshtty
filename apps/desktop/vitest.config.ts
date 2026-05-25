import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@common': resolve('src/common')
    }
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/__mocks__/**',
        'src/renderer/src/fixtures/**',
        'src/renderer/src/env.d.ts',
        'src/renderer/src/main.tsx'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 70,
        'src/common/state.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 85
        },
        'src/common/mux.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 85
        }
      }
    }
  }
})
