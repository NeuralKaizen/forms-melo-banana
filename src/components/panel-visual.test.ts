import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/** Archivos del panel: la entrevista pública tiene su propio lenguaje y no entra acá. */
function archivosDelPanel(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e === 'interview' || e === 'gracias') continue
      archivosDelPanel(p, acc)
    } else if (/\.tsx$/.test(e) && !/\.test\.tsx$/.test(e)) acc.push(p)
  }
  return acc
}

/**
 * Los componentes de la entrevista pública: conjunto cerrado y conocido, con lenguaje visual
 * propio. Se excluyen por nombre en vez de mantener una lista blanca de qué sí revisar —
 * así cualquier componente nuevo que se agregue a src/components/ queda cubierto por default,
 * en vez de depender de que alguien se acuerde de sumarlo a mano.
 */
const DE_LA_ENTREVISTA = new Set([
  'InterviewLayout', 'MicButton', 'ProjectiveScreen', 'InterviewScreen', 'ColorGrid',
  'AgeGrid', 'GenderChoice', 'Breather', 'IdentityForm', 'ImageGrid', 'SectionNav',
])

const raiz = path.resolve(__dirname, '..')
const panel = [
  ...archivosDelPanel(path.join(raiz, 'app', 'admin')),
  ...archivosDelPanel(path.join(raiz, 'components')).filter(
    f => !DE_LA_ENTREVISTA.has(path.basename(f, '.tsx')),
  ),
]

describe('lenguaje visual del panel', () => {
  it('no quedan grises del lenguaje viejo', () => {
    // `#1a1510` es el `--ink` viejo: la Task 3 lo cambió a `#15120C` en globals.css, pero
    // varios componentes del panel lo tenían hardcodeado en vez de usar la variable.
    const viejos = ['#a59c89', '#8a8170', '#6b6155', '#4a4438', '#b3ab9b', '#fffdf0', '#faf7ee', '#1a1510']
    for (const f of panel) {
      const src = readFileSync(f, 'utf8').toLowerCase()
      for (const g of viejos) expect(`${f}: ${src.includes(g) ? g : 'ok'}`).toBe(`${f}: ok`)
    }
  })

  it('no quedan tarjetas con sombra en el panel', () => {
    for (const f of panel) {
      const src = readFileSync(f, 'utf8')
      expect(`${f}: ${src.includes('shadow-sm') ? 'shadow-sm' : 'ok'}`).toBe(`${f}: ok`)
    }
  })
})
