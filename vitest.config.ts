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
    // un fork por núcleo levantaba varios Postgres-en-WASM en el mismo instante y el primer
    // montaje —2s con la máquina libre— se estiraba a 12-16s y se pasaba de los 10s del hook.
    // Con dos no sólo deja de fallar: la suite tarda menos y mucho más parejo que con cuatro,
    // porque lo que sobraba era contención, no trabajo. Va acá arriba y no en
    // `poolOptions.forks`, que vitest 4 eliminó y aceptaba en silencio sin aplicar nada.
    maxWorkers: 2,
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
