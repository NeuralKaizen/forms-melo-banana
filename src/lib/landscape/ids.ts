/** El esquema define todos los ids como `uuid('id').defaultRandom()`; ver src/lib/db/schema.ts. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Valida forma, no existencia: un string sin pinta de UUID no puede corresponder a
 * ninguna fila, así que es un pedido mal formado, no una falla del servidor. Es solo
 * un regex: nada de ir a la base para descubrir esto, que sería un round-trip de más
 * por cada pedido mal formado.
 */
export function esUuidValido(valor: string): boolean {
  return UUID_RE.test(valor)
}
