// El artículo de datos de prueba lleva una CONTRASEÑA COMPARTIDA y el nombre de
// las cuentas de prueba: no puede ser público nunca. Lo genera un script
// (scripts/seed-datos-de-prueba.ts), así que este test vigila el archivo real —
// si una corrida futura le cambia el frontmatter, revienta acá y no en la web.
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { parseHelpDoc, canViewHelpDoc, visibleHelpDocs } from './visibility'
import type { RoleId } from '@/types/auth'

const RUTA = 'content/ayuda/datos-de-prueba.md'
const existe = existsSync(RUTA)

describe.skipIf(!existe)('artículo "Datos de prueba"', () => {
  const doc = parseHelpDoc('datos-de-prueba', readFileSync(RUTA, 'utf8'))

  it('NO es público: va por roles', () => {
    expect(doc.visibilidad).toBe('roles')
    expect(doc.roles.length).toBeGreaterThan(0)
  })

  it('sin sesión no se puede leer', () => {
    expect(canViewHelpDoc(doc, null)).toBe(false)
    expect(canViewHelpDoc(doc, [])).toBe(false)
  })

  it('sin sesión tampoco aparece en el índice', () => {
    const indice = visibleHelpDocs([doc], null)
    expect(indice).toHaveLength(0)
  })

  it('el rol miembro tampoco lo ve (es interno)', () => {
    expect(canViewHelpDoc(doc, ['miembro'])).toBe(false)
  })

  it('lo ven los roles de gestión que lo van a probar', () => {
    for (const r of ['admin', 'direccion', 'coordinador_estudios', 'coordinador_dirigentes',
      'finanzas', 'comunicaciones', 'encargado_staff'] as RoleId[]) {
      expect(canViewHelpDoc(doc, [r])).toBe(true)
    }
  })

  it('trae lo que el tester necesita: qué esperamos, dónde reportar y qué no tocar', () => {
    expect(doc.content).toContain('Qué esperamos de vos')
    expect(doc.content).toContain('[completar: canal de reporte]')
    expect(doc.content).toContain('Qué NO tocar')
    // La fecha de borrado, arriba de todo.
    expect(doc.content).toMatch(/se borran el \d{4}-\d{2}-\d{2}/i)
  })

  it('las cuentas del set no comparten correo', () => {
    // Cada fila de la tabla de personas trae su correo en la 3.ª columna.
    const correos = [...doc.content.matchAll(/\|\s*([a-z0-9.]+@prueba\.theosplace\.invalid)\s*\|/g)]
      .map(m => m[1].toLowerCase())
    expect(correos.length).toBeGreaterThan(20)
    expect(new Set(correos).size).toBe(correos.length)
  })
})
