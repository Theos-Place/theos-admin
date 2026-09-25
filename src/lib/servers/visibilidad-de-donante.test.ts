import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { puedeVerDonante, recortarDonante } from './visibilidad-de-donante'
import { leFaltaAlgo, faltantes, type Compromisos } from './compromisos'

const c = (over: Partial<Compromisos>): Compromisos => ({
  asistencia: true, llevandoEstudio: true, dandoEstudio: false, ultimoCheckin: null, ...over,
})

/**
 * SRV-10 · Orden de dirección del 2026-09-24: el líder de comité no ve el dato
 * de donante mientras definen cómo se usa.
 */
describe('quién ve el dato de donante', () => {
  it('los roles amplios sí', () => {
    for (const r of ['encargado_staff', 'coordinador_servidores', 'direccion', 'admin']) {
      expect(puedeVerDonante([r]), r).toBe(true)
    }
  })

  it('el líder de comité no', () => {
    expect(puedeVerDonante(['lider_comite'])).toBe(false)
    expect(puedeVerDonante(['miembro', 'lider_comite', 'dirigente'])).toBe(false)
  })

  it('sin roles, tampoco: se falla hacia esconder', () => {
    expect(puedeVerDonante([])).toBe(false)
    expect(puedeVerDonante(null)).toBe(false)
    expect(puedeVerDonante(undefined)).toBe(false)
  })
})

describe('el recorte borra la propiedad, no la pone en false', () => {
  const filas = [{ nombre: 'A', donante: true }, { nombre: 'B', donante: false }]

  it('al líder no le llega el campo', () => {
    const out = recortarDonante(filas, false)
    // `in` y no `=== undefined`: un `donante: false` diría «no es donante», que
    // es justo el dato que no debe salir, y además contaría como falta.
    expect(out.every(f => !('donante' in f))).toBe(true)
    expect(JSON.stringify(out)).not.toContain('donante')
  })

  it('al rol amplio le llega igual que antes', () => {
    expect(recortarDonante(filas, true)).toEqual(filas)
  })

  it('no muta la lista original', () => {
    recortarDonante(filas, false)
    expect(filas[0].donante).toBe(true)
  })
})

/**
 * La mitad del recorte. Esconder la columna y dejar «Le falta: donación» delata
 * exactamente lo mismo, y encima con una lista lista para filtrar.
 */
describe('«le falta» no delata lo que el recorte esconde', () => {
  it('sin el dato, la donación NO cuenta como falta', () => {
    expect(leFaltaAlgo(c({}))).toBe(false)
    expect(faltantes(c({}))).toEqual([])
  })

  it('con el dato en false, sí cuenta — para quien puede verlo', () => {
    expect(leFaltaAlgo(c({ donante: false }))).toBe(true)
    expect(faltantes(c({ donante: false }))).toContain('donación')
  })

  it('con el dato en true, no falta nada', () => {
    expect(leFaltaAlgo(c({ donante: true }))).toBe(false)
  })

  it('las otras faltas siguen igual sin el dato de donante', () => {
    expect(faltantes(c({ asistencia: false }))).toEqual(['asistencia'])
    expect(faltantes(c({ llevandoEstudio: false }))).toEqual(['estudio'])
  })
})

describe('el recorte vive en el SERVIDOR, no en la pantalla', () => {
  it('el endpoint de Mi comité recorta antes de responder', () => {
    // Si esto se cae, el campo volvió a viajar: esconder una columna deja el
    // dato en el JSON, a un clic de la pestaña de red.
    const s = readFileSync('src/app/api/servers/mi-comite/route.ts', 'utf8')
    expect(s).toContain('recortarDonante(filas, verDonante)')
    expect(s).toContain('puedeVerDonante(auth.ctx.roles)')
  })

  it('el reporte de servidores ya está cerrado a roles amplios', () => {
    // Por eso ahí no hace falta recortar nada: el líder no llega al endpoint.
    const s = readFileSync('src/app/api/reports/servidores/route.ts', 'utf8')
    expect(s).toContain('requireRoles(...SERVICE_ADMIN_ROLES)')
  })

  it('la pantalla se cree al servidor y no al rol del navegador', () => {
    const s = readFileSync('src/app/(admin)/servidores/mi-comite/page.tsx', 'utf8')
    expect(s).toContain('datos?.verDonante === true')
  })
})
