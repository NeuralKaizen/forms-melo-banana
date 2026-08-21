import { describe, it, expect } from 'vitest'
import { armarCorreoDeEntrevista } from './notify'

const sesion = { sessionId: 'abc-123', nombre: 'Ana', empresa: 'Acme' }

describe('armarCorreoDeEntrevista', () => {
  it('sin destinatarios no hay correo: es "no configurado", no un error', () => {
    expect(armarCorreoDeEntrevista(sesion, {})).toBeNull()
    expect(armarCorreoDeEntrevista(sesion, { to: ' , ' })).toBeNull()
  })

  it('acepta varios destinatarios separados por coma', () => {
    const c = armarCorreoDeEntrevista(sesion, { to: 'a@x.com, b@x.com' })!
    expect(c.to).toEqual(['a@x.com', 'b@x.com'])
  })

  it('nombra a la persona y arma el link al panel sin doblar la barra', () => {
    const c = armarCorreoDeEntrevista({ ...sesion, proyecto: 'Acme' }, {
      to: 'equipo@mellowbanana.co', baseUrl: 'https://forms.example.com/',
    })!
    expect(c.subject).toBe('Nueva entrevista completa: Ana · Acme')
    expect(c.text).toContain('Proyecto: Acme')
    expect(c.text).toContain('https://forms.example.com/admin/abc-123')
  })

  it('sin base pública el correo sale igual, solo que sin link', () => {
    const c = armarCorreoDeEntrevista(sesion, { to: 'a@x.com' })!
    expect(c.text).not.toContain('/admin/')
    expect(c.subject).toContain('Ana')
  })
})
