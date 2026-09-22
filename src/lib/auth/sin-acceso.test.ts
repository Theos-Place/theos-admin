import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { esFaltaDeAcceso } from '@/components/shared/SinAcceso'
import { alcanceVeATodos } from '@/lib/auth/mando-de-comite'

describe('esFaltaDeAcceso', () => {
  it('reconoce lo que contestan los endpoints', () => {
    // La convención de AGENTS.md: { error: 'No autorizado' } / 'No autenticado'.
    expect(esFaltaDeAcceso('No autorizado')).toBe(true)
    expect(esFaltaDeAcceso('No autenticado')).toBe(true)
    expect(esFaltaDeAcceso('no autorizado')).toBe(true)
  })

  it('NO se traga cualquier error', () => {
    // Un fallo de red o un 500 tienen que seguir viéndose como fallos: pintarlos
    // como "no tenés acceso" mandaría a la persona a pedir un permiso que ya
    // tiene.
    expect(esFaltaDeAcceso('Error interno')).toBe(false)
    expect(esFaltaDeAcceso('No se pudo cargar el comité.')).toBe(false)
    expect(esFaltaDeAcceso(null)).toBe(false)
    expect(esFaltaDeAcceso('')).toBe(false)
  })
})

describe('alcanceVeATodos', () => {
  it('solo el alcance all ve a cualquiera', () => {
    expect(alcanceVeATodos('all')).toBe(true)
    expect(alcanceVeATodos('committee')).toBe(false)
    expect(alcanceVeATodos('own')).toBe(false)
    expect(alcanceVeATodos(null)).toBe(false)
  })
})

describe('el cliente no vuelve a preguntar el alcance a mano', () => {
  // El buscador global del encabezado preguntaba `scope !== 'own'`, así que le
  // salía al líder de comité después de cerrarle el padrón: buscaba,
  // encontraba, y al abrir la ficha recibía un 403. Cliente y servidor tienen
  // que responder lo mismo, y para eso hay UNA función.
  const FUENTES = [
    'src/components/layout/Topbar.tsx',
    'src/app/(admin)/dashboard/page.tsx',
  ]
  /** Sin comentarios: el porqué del cambio SÍ menciona `!== 'own'`. */
  const soloCodigo = (src: string) => src
    .split('\n')
    .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n')

  it('las pantallas que gatean por alcance usan alcanceVeATodos', () => {
    for (const f of FUENTES) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).toContain('alcanceVeATodos(')
      expect(soloCodigo(src), `${f}: quedó un chequeo a mano`).not.toContain("!== 'own'")
    }
  })
})
