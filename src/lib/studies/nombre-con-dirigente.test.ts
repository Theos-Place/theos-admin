import { describe, it, expect } from 'vitest'
import { nombreConDirigente } from './folletos'

describe('el título del tiquete dice de quién es el grupo (2026-10-19)', () => {
  it('un grupo del sistema («N2 — Escazú») suma el dirigente', () => {
    expect(nombreConDirigente('N2 — Escazú', 'Guido Chavarria Rojas')).toBe('N2 — Escazú · Guido Chavarria Rojas')
  })
  it('si el nombre ya lo dice, no se repite (aunque la ficha traiga el segundo apellido)', () => {
    expect(nombreConDirigente('Nivel 3. Mirtha Cruz. Setiembre 2026', 'Mirtha Cruz Graña')).toBe('Nivel 3. Mirtha Cruz. Setiembre 2026')
  })
  it('sin tildes ni mayúsculas de por medio', () => {
    expect(nombreConDirigente('Nivel 2. Guido Chavarría', 'guido chavarria rojas')).toBe('Nivel 2. Guido Chavarría')
  })
  it('sin dirigente queda el nombre; sin nada, la raya', () => {
    expect(nombreConDirigente('N2 — Escazú', null)).toBe('N2 — Escazú')
    expect(nombreConDirigente(null, null)).toBe('—')
  })
})
