import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    environmentMatchGlobs: [['**/*.tsx', 'jsdom']],
    testTimeout: 30000,
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
