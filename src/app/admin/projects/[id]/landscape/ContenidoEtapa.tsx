/**
 * El `content` de una etapa es jsonb libre: cada etapa guarda lo suyo y no hay
 * un esquema cerrado. Esto lo muestra legible sin conocer la forma de antemano.
 */

function humanizar(clave: string): string {
  const conEspacios = clave.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1)
}

function Valor({ valor }: { valor: unknown }) {
  if (valor === null || valor === undefined || valor === '')
    return <p className="text-[13px] text-[#b3ab9b]">Sin datos</p>

  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean')
    return <p className="text-[13.5px] leading-relaxed text-[#4a4438]">{String(valor)}</p>

  if (Array.isArray(valor))
    return (
      <ul className="space-y-1.5">
        {valor.map((item, i) => (
          <li key={i} className="text-[13.5px] leading-relaxed text-[#4a4438]">
            {typeof item === 'object' && item !== null
              ? <Campos objeto={item as Record<string, unknown>} />
              : String(item)}
          </li>
        ))}
      </ul>
    )

  return <Campos objeto={valor as Record<string, unknown>} />
}

function Campos({ objeto }: { objeto: Record<string, unknown> }) {
  return (
    <div className="space-y-2 rounded-xl bg-[#faf7ee] p-3">
      {Object.entries(objeto).map(([clave, valor]) => (
        <div key={clave}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a59c89]">{humanizar(clave)}</p>
          <div className="mt-0.5"><Valor valor={valor} /></div>
        </div>
      ))}
    </div>
  )
}

export function ContenidoEtapa({ content }: { content: unknown }) {
  if (typeof content !== 'object' || content === null)
    return <Valor valor={content} />

  return (
    <div className="space-y-5">
      {Object.entries(content as Record<string, unknown>).map(([clave, valor]) => (
        <section key={clave}>
          <h3 className="mb-2 text-[13px] font-semibold text-ink">{humanizar(clave)}</h3>
          <Valor valor={valor} />
        </section>
      ))}
    </div>
  )
}
