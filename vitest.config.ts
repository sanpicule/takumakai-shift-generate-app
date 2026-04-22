import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: [
        'src/renderer/src/engine/**',
        'src/renderer/src/store/**'
      ],
      exclude: [
        'src/main/**',
        'src/preload/**',
        'src/renderer/src/pages/**',
        'src/renderer/src/App.tsx',
        'src/renderer/src/main.tsx',
        'src/renderer/src/index.css'
      ],
      thresholds: {
        lines: 70,
        branches: 60
      },
      reporter: ['text', 'html']
    }
  },
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer/src')
    }
  }
})
