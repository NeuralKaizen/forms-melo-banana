// Aviso por correo al estudio cuando alguien termina una entrevista, para que no
// tengan que entrar al panel a revisar si llegó algo nuevo. Va por Resend (integración
// del marketplace de Vercel): un POST a su API, sin SDK.
//
// El correo es un efecto secundario del cierre, nunca su condición: si falta
// configuración o Resend falla, la entrevista se completa igual y el error queda en
// el log. Por eso todo sale por `notificarEntrevistaCompleta`, que no lanza.

interface EntrevistaCompleta {
  sessionId: string
  nombre?: string | null
  empresa?: string | null
  proyecto?: string | null
}

export interface CorreoArmado {
  from: string
  to: string[]
  subject: string
  text: string
}

/**
 * `NOTIFY_EMAIL_TO` acepta varios destinos separados por coma. Sin destinatarios o sin
 * API key no hay envío — es la señal de "todavía no configurado", no un error.
 */
export function armarCorreoDeEntrevista(
  s: EntrevistaCompleta,
  env: { to?: string; from?: string; baseUrl?: string },
): CorreoArmado | null {
  const to = (env.to ?? '').split(',').map(d => d.trim()).filter(Boolean)
  if (!to.length) return null

  const quien = [s.nombre, s.empresa].filter(Boolean).join(' · ')
  const base = (env.baseUrl ?? '').replace(/\/$/, '')
  const link = base ? `${base}/admin/${s.sessionId}` : null

  return {
    from: env.from ?? 'Mellow & Banana <onboarding@resend.dev>',
    to,
    subject: `Nueva entrevista completa${quien ? `: ${quien}` : ''}`,
    text: [
      `Se completó una entrevista${quien ? ` de ${quien}` : ''}.`,
      s.proyecto ? `Proyecto: ${s.proyecto}` : null,
      link ? `Leerla: ${link}` : null,
    ].filter(Boolean).join('\n\n'),
  }
}

export async function notificarEntrevistaCompleta(s: EntrevistaCompleta): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    const correo = armarCorreoDeEntrevista(s, {
      to: process.env.NOTIFY_EMAIL_TO,
      from: process.env.NOTIFY_EMAIL_FROM,
      baseUrl: process.env.MCP_PUBLIC_URL,
    })
    if (!apiKey || !correo) return

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(correo),
    })
    if (!res.ok) console.error('aviso de entrevista no salió:', res.status, await res.text())
  } catch (e) {
    console.error('aviso de entrevista no salió:', e)
  }
}
