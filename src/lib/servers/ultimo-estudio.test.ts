import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ultimoEstudioDe, cuentaComoEstudio, nombreConEstado, ESTADOS_QUE_NO_CUENTAN,
  type EstudioDeLaPersona,
} from './ultimo-estudio'

/** El caso real de Karen Angamarca, que lo destapó. */
const KAREN: EstudioDeLaPersona[] = [
  { nombre: 'Transformados', status: 'completed', fecha: '2025-07-27',
    dirigente: 'Alexandra Forero', telefonoDirigente: '88250013' },
  { nombre: 'Nivel 4', status: 'enrolled', fecha: '2026-09-16',
    dirigente: 'Alexandra Forero', telefonoDirigente: '88250013' },
]

describe('el último estudio', () => {
  it('EL CASO DE KAREN: el que está llevando gana al que terminó en 2025', () => {
    /**
     * La ficha decía «Transformados» —junio de 2025— porque la consulta solo
     * miraba los `completed`. El estudio en curso ni entraba en la lista.
     */
    expect(ultimoEstudioDe(KAREN)!.nombre).toBe('Nivel 4 (en curso)')
  })

  it('y dice que está EN CURSO: «Nivel 4» a secas afirmaría que lo terminó', () => {
    expect(nombreConEstado('Nivel 4', 'enrolled')).toBe('Nivel 4 (en curso)')
    expect(nombreConEstado('Nivel 4', 'en_revision')).toBe('Nivel 4 (sin cerrar)')
    expect(nombreConEstado('Nivel 4', 'reprobado')).toBe('Nivel 4 (no aprobado)')
    // Un estudio terminado va sin paréntesis: es el caso normal.
    expect(nombreConEstado('Nivel 4', 'completed')).toBe('Nivel 4')
  })

  it('trae el dirigente DE ESE estudio, que es a quien hay que llamar', () => {
    // Es el punto de la ficha entera. Con el estudio viejo se llamaría al
    // dirigente de hace año y medio.
    const u = ultimoEstudioDe([
      { nombre: 'Transformados', status: 'completed', fecha: '2025-07-27',
        dirigente: 'Vieja Dirigente', telefonoDirigente: '111' },
      { nombre: 'Nivel 4', status: 'enrolled', fecha: '2026-09-16',
        dirigente: 'Nueva Dirigente', telefonoDirigente: '222' },
    ])!
    expect(u.dirigente).toBe('Nueva Dirigente')
    expect(u.telefonoDirigente).toBe('222')
  })

  it('de los que se salió NO cuentan: su dirigente no tiene nada que contar', () => {
    for (const s of ESTADOS_QUE_NO_CUENTAN) {
      expect(cuentaComoEstudio(s), s).toBe(false)
      const u = ultimoEstudioDe([
        { nombre: 'Transformados', status: 'completed', fecha: '2025-07-27', dirigente: 'A', telefonoDirigente: '1' },
        { nombre: 'Nivel 4', status: s, fecha: '2026-09-16', dirigente: 'B', telefonoDirigente: '2' },
      ])!
      expect(u.nombre, s).toBe('Transformados')
    }
  })

  it('un estudio SIN fecha queda de último, no de primero', () => {
    /**
     * Sin fecha no se puede afirmar que sea el más reciente. Ponerlo primero
     * es adivinar, y adivinar acá es justo lo que metió un estudio de 2025 en
     * la ficha de alguien que está en Nivel 4.
     */
    const u = ultimoEstudioDe([
      { nombre: 'Sin fecha', status: 'completed', fecha: '', dirigente: null, telefonoDirigente: null },
      { nombre: 'Nivel 4', status: 'completed', fecha: '2026-09-16', dirigente: null, telefonoDirigente: null },
    ])!
    expect(u.nombre).toBe('Nivel 4')
  })

  it('si TODOS están sin fecha igual devuelve uno, no null', () => {
    const u = ultimoEstudioDe([
      { nombre: 'A', status: 'completed', fecha: '', dirigente: null, telefonoDirigente: null },
    ])
    expect(u?.nombre).toBe('A')
  })

  it('sin estudios, o solo con los que no cuentan, devuelve null', () => {
    expect(ultimoEstudioDe([])).toBeNull()
    expect(ultimoEstudioDe([
      { nombre: 'X', status: 'dropped', fecha: '2026-01-01', dirigente: null, telefonoDirigente: null },
    ])).toBeNull()
  })

  it('una fila sin nombre no se elige aunque sea la más nueva', () => {
    // Saldría «null (en curso)» en la hoja.
    const u = ultimoEstudioDe([
      { nombre: null, status: 'enrolled', fecha: '2026-12-01', dirigente: null, telefonoDirigente: null },
      { nombre: 'Nivel 4', status: 'completed', fecha: '2026-09-16', dirigente: null, telefonoDirigente: null },
    ])!
    expect(u.nombre).toBe('Nivel 4')
  })

  it('«pendiente de pago» cuenta y se marca en curso: la persona está yendo', () => {
    const u = ultimoEstudioDe([
      { nombre: 'Nivel 2', status: 'pendiente_de_pago', fecha: '2026-09-16', dirigente: null, telefonoDirigente: null },
    ])!
    expect(u.nombre).toBe('Nivel 2 (en curso)')
  })
})

describe('el cableado con la consulta', () => {
  const src = readFileSync('src/lib/supabase/queries/servers.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  it('la consulta YA NO pide solo los completados', () => {
    // Era el bug entero: el estudio en curso no entraba en la lista.
    const fn = src.slice(src.indexOf('export async function getDetalleDeAplicante'))
    expect(fn.slice(0, 2500)).not.toContain("eq('status', 'completed')")
  })

  it('y excluye los que no cuentan con la MISMA lista del módulo', () => {
    // Escrita dos veces, una se queda atrás el día que se agregue un estado.
    expect(src).toContain('ESTADOS_QUE_NO_CUENTAN.join(')
  })

  it('el orden y el matiz los decide el módulo, no la consulta', () => {
    expect(src).toContain('ultimoEstudioDe(filas)')
    const fn = src.slice(src.indexOf('export async function getDetalleDeAplicante'))
    expect(fn.slice(0, 3000)).not.toContain('filas.sort(')
  })
})
