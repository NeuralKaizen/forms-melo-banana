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

const raiz = path.resolve(__dirname, '..')
const panel = [
  ...archivosDelPanel(path.join(raiz, 'app', 'admin')),
  path.join(raiz, 'components', 'AdminShell.tsx'),
  path.join(raiz, 'components', 'ProjectIndex.tsx'),
  path.join(raiz, 'components', 'EtapaDocumento.tsx'),
  path.join(raiz, 'components', 'BarraProyectos.tsx'),
  path.join(raiz, 'components', 'ComparadorVersiones.tsx'),
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
