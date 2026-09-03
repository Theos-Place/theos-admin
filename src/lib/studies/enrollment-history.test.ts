import { describe, it, expect } from 'vitest'
import { apareceEnHistorial, etiquetaHistorial, ESTADO_HISTORIAL } from './enrollment-history'

describe('apareceEnHistorial', () => {
  it('una matrícula cancelada NO se muestra: nunca ocurrió', () => {
    expect(apareceEnHistorial('cancelada')).toBe(false)
  })

  it('una matrícula vencida tampoco', () => {
    expect(apareceEnHistorial('expirada')).toBe(false)
  })

  it('una que todavía está pagándose tampoco: aún no es historia', () => {
    expect(apareceEnHistorial('pendiente_de_pago')).toBe(false)
  })

  it('lo que SÍ ocurrió se muestra', () => {
    for (const s of ['completed', 'reprobado', 'dropped', 'enrolled', 'transferred', 'waitlist', 'en_revision']) {
      expect(apareceEnHistorial(s)).toBe(true)
    }
  })

  it('un estado vacío no se muestra', () => {
    expect(apareceEnHistorial(null)).toBe(false)
    expect(apareceEnHistorial('')).toBe(false)
  })
})

describe('etiquetaHistorial', () => {
  it('un retiro NO dice "Reprobó"', () => {
    // Era `dropped: 'Reprobó'`. Quien se sale por un cambio de horario no
    // perdió nada, y ponerle eso en el expediente lo acusa de algo que no pasó.
    expect(etiquetaHistorial('dropped')).toBe('Se retiró')
    expect(etiquetaHistorial('dropped')).not.toContain('Reprob')
  })

  it('solo la reprobación registrada dice "Reprobó"', () => {
    expect(etiquetaHistorial('reprobado')).toBe('Reprobó')
    const conReprobo = Object.entries(ESTADO_HISTORIAL).filter(([, v]) => v.includes('Reprob'))
    expect(conReprobo).toEqual([['reprobado', 'Reprobó']])
  })

  it('aprobado, en curso y transferido se leen igual que antes', () => {
    expect(etiquetaHistorial('completed')).toBe('Aprobado')
    expect(etiquetaHistorial('enrolled')).toBe('En curso')
    expect(etiquetaHistorial('transferred')).toBe('Transferido')
  })

  it('cancelada y vencida tienen su nombre, por si se muestran en otro lado', () => {
    expect(etiquetaHistorial('cancelada')).toBe('Matrícula cancelada')
    expect(etiquetaHistorial('expirada')).toBe('Matrícula vencida')
  })

  it('un estado desconocido se muestra tal cual, sin romper', () => {
    expect(etiquetaHistorial('algo_nuevo')).toBe('algo_nuevo')
  })
})
