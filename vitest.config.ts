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
    // Sin `hookTimeout` a propósito: subirlo fue el intento anterior y sólo cambió la forma
    // del fallo — el timeout se corrió del montaje al cuerpo del test. Ahora el montaje cuesta
    // una instancia PGlite por archivo en vez de una por test (ver `src/lib/db/testdb.ts`), y
    // el default de 10s vuelve a alcanzar de sobra.
    //
    // El tope de workers es la otra mitad del arreglo: aun con una sola instancia por archivo,
    // arrancar la suite con un fork por núcleo hacía que varios Postgres-en-WASM se levantaran
    // en el mismo instante y el primer montaje se pasara de los 10s. Con cuatro, el arranque
    // se escalona y la suite no tarda más. Va acá arriba y no en `poolOptions.forks`, que
    // vitest 4 eliminó y aceptaba en silencio sin aplicar nada.
    maxWorkers: 4,
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
