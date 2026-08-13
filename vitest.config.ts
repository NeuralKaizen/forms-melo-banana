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
    // El `beforeEach` de los tests de base levanta una instancia PGlite entera (Postgres en
    // WASM) y corre el DDL completo. Con los archivos en paralelo eso no entra en los 10s del
    // default, y los fallos aparecen como timeouts de hook, nunca como aserciones rotas.
    hookTimeout: 30000,
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
