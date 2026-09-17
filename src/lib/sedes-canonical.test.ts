import { describe, it, expect } from 'vitest'
import { canonicalCharlaTitle, normalizeSedeKey } from './sedes-canonical'
import { sedeFromTitle } from './reports/charla-attendance'

describe('normalizeSedeKey', () => {
  it('quita el prefijo "Charla", las tildes y las mayúsculas', () => {
    expect(normalizeSedeKey('Charla Pérez Zeledón Miércoles')).toBe('perez zeledon miercoles')
  })
})

describe('youth: el sub-evento no parte la serie en dos', () => {
  // Hasta la semana 36 de 2026 cada youth era un EVENTO propio ("Cartago
  // Youth"). Desde la 37 pasó a ser un SUB-EVENTO llamado "Youth" dentro de la
  // charla de su sede, y el reporte etiqueta "<evento> Youth" (migración
  // 20260917120000). Estos alias hacen que la etiqueta nueva caiga en el MISMO
  // canónico que el nombre viejo.
  it('el nombre nuevo y el viejo llegan al mismo canónico', () => {
    for (const [viejo, nuevo] of [
      ['Cartago Youth', 'Charla Cartago Miércoles Youth'],
      ['Heredia Youth', 'Charla Pedregal Miércoles Youth'],
      ['United Youth', 'Charla Pedregal Domingo Youth'],
    ]) {
      expect(canonicalCharlaTitle(nuevo), nuevo).toBe(canonicalCharlaTitle(viejo))
      expect(canonicalCharlaTitle(nuevo), nuevo).not.toBeNull()
    }
  })

  it('cada youth sigue siendo una sede DISTINTA', () => {
    // El bug era justamente que los tres colapsaban en una sola barra.
    const canones = [
      'Charla Cartago Miércoles Youth',
      'Charla Pedregal Miércoles Youth',
      'Charla Pedregal Domingo Youth',
    ].map(t => canonicalCharlaTitle(t))
    expect(new Set(canones).size).toBe(3)
  })

  it('el youth NO se confunde con la charla de adultos de su misma sede', () => {
    expect(sedeFromTitle('Charla Cartago Miércoles Youth')).not.toBe(sedeFromTitle('Charla Cartago Miércoles'))
    expect(sedeFromTitle('Charla Cartago Miércoles Youth')).toBe('Cartago Youth')
    expect(sedeFromTitle('Charla Cartago Miércoles')).toBe('Cartago Miércoles')
  })

  it('"Youth" a secas ya no puede aparecer como sede', () => {
    // Era la etiqueta que producía el RPC viejo con `coalesce(se.name, ...)` y
    // la que mezclaba las tres sedes. No está en el diccionario: si vuelve a
    // aparecer, es que el RPC volvió a etiquetar solo con el sub-evento.
    expect(canonicalCharlaTitle('Youth')).toBeNull()
  })
})
