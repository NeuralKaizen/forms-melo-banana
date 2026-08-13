import { describe, it, expect } from 'vitest'
import { autorDeVersion, procedenciaDeVersion } from './procedencia'

const ahora = new Date('2026-08-12T18:00:00Z')
const haceDosHoras = new Date('2026-08-12T16:00:00Z')

describe('autorDeVersion', () => {
  it('Claude escribe por MCP y se llama Claude', () => {
    expect(autorDeVersion({ author: 'claude', createdAt: ahora })).toBe('Claude')
  })

  it('una escritura humana con nombre lo usa', () => {
    expect(autorDeVersion({ author: 'humano', authorLabel: 'Flor', createdAt: ahora })).toBe('Flor')
  })

  it('una escritura humana sin nombre es el equipo', () => {
    expect(autorDeVersion({ author: 'humano', authorLabel: null, createdAt: ahora })).toBe('el equipo')
    expect(autorDeVersion({ author: 'humano', authorLabel: '  ', createdAt: ahora })).toBe('el equipo')
    expect(autorDeVersion({ author: 'humano', createdAt: ahora })).toBe('el equipo')
  })
})

describe('procedenciaDeVersion', () => {
  it('una versión sin aprobar lo dice — es lo que habilita el gate humano', () => {
    expect(procedenciaDeVersion({ author: 'claude', createdAt: haceDosHoras, approvedAt: null }, ahora))
      .toBe('Escrito por Claude · hace 2 h · sin aprobar')
  })

  it('una versión aprobada lo dice', () => {
    expect(procedenciaDeVersion({ author: 'claude', createdAt: haceDosHoras, approvedAt: ahora }, ahora))
      .toBe('Escrito por Claude · hace 2 h · aprobada')
  })

  it('nombra a quien escribió cuando no fue Claude', () => {
    expect(procedenciaDeVersion(
      { author: 'humano', authorLabel: 'Flor', createdAt: haceDosHoras, approvedAt: null }, ahora,
    )).toBe('Escrito por Flor · hace 2 h · sin aprobar')
  })

  it('sin approvedAt en la fila también cuenta como sin aprobar', () => {
    expect(procedenciaDeVersion({ author: 'claude', createdAt: haceDosHoras }, ahora))
      .toContain('sin aprobar')
  })
})
