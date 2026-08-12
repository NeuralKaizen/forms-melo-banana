/**
 * El `content` de una etapa es jsonb libre: cada etapa guarda lo suyo y no hay
 * un esquema cerrado. Esto lo muestra legible sin conocer la forma de antemano.
 */

function humanizar(clave: string): string {
  const conEspacios = clave.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1)
}

const SIN_DATOS = <p className="text-[13px] text-[var(--apagado)]">Sin datos</p>

function Valor({ valor }: { valor: unknown }) {
  if (valor === null || valor === undefined || valor === '')
    return SIN_DATOS

  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean')
    return <p className="text-[14px] leading-[1.66] text-[var(--cuerpo)]">{String(valor)}</p>

  if (Array.isArray(valor)) {
    // Vacío: se ve como "Sin datos", no como una lista sin nada adentro.
    if (valor.length === 0) return SIN_DATOS
    return (
      <ul className="space-y-1.5">
        {valor.map((item, i) => (
          <li key={i} className="text-[14px] leading-[1.66] text-[var(--cuerpo)]">
            {Array.isArray(item)
              // Un array dentro de un array: se anida como lista, no como ficha de
              // campos "0", "1", "2" — Object.entries de un array numera sus índices.
              ? <Valor valor={item} />
              : typeof item === 'object' && item !== null
                ? <Ficha objeto={item as Record<string, unknown>} />
                : String(item)}
          </li>
        ))}
      </ul>
    )
  }

  // Objeto vacío: mismo criterio que el array vacío.
  if (Object.keys(valor as Record<string, unknown>).length === 0) return SIN_DATOS

  return <Campos objeto={valor as Record<string, unknown>} />
}

/**
 * Una ficha por elemento cuando un campo es un array de objetos (competidores,
 * candidatas de arquetipo). La caja sigue existiendo acá nada más: con varios
 * elementos en fila, el borde es lo que separa uno del siguiente.
 */
function Ficha({ objeto }: { objeto: Record<string, unknown> }) {
  return (
    <div className="space-y-2 rounded-xl bg-[#faf7ee] p-3">
      {Object.entries(objeto).map(([clave, valor]) => (
        <div key={clave}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--rotulo)]">{humanizar(clave)}</p>
          <div className="mt-0.5"><Valor valor={valor} /></div>
        </div>
      ))}
    </div>
  )
}

// Fila de rótulo al margen y valor en columna de lectura — el patrón que usan
// tanto un objeto anidado (acá) como el nivel superior del documento (abajo).
function Campos({ objeto }: { objeto: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      {Object.entries(objeto).map(([clave, valor]) => (
        <div key={clave} className="flex flex-col gap-1 sm:flex-row sm:gap-6">
          <p className="w-[112px] flex-none pt-[3px] text-[10px] font-bold uppercase tracking-[.14em] text-[var(--rotulo)]">
            {humanizar(clave)}
          </p>
          <div className="min-w-0 max-w-[60ch] flex-1"><Valor valor={valor} /></div>
        </div>
      ))}
    </div>
  )
}

export function ContenidoEtapa({ content }: { content: unknown }) {
  if (typeof content !== 'object' || content === null)
    return <Valor valor={content} />

  // Objeto vacío al tope (una etapa guardada sin campos todavía): mismo "Sin
  // datos" que cualquier otro vacío, en vez de una sección en blanco.
  const entradas = Object.entries(content as Record<string, unknown>)
  if (entradas.length === 0) return <Valor valor={content} />

  return (
    <div className="space-y-4">
      {entradas.map(([clave, valor]) => (
        <div
          key={clave}
          className="flex flex-col gap-1 border-b border-[var(--line)] pb-4 last:border-b-0 last:pb-0 sm:flex-row sm:gap-6"
        >
          <p className="w-[112px] flex-none pt-[3px] text-[10px] font-bold uppercase tracking-[.14em] text-[var(--rotulo)]">
            {humanizar(clave)}
          </p>
          <div className="min-w-0 max-w-[60ch] flex-1"><Valor valor={valor} /></div>
        </div>
      ))}
    </div>
  )
}
