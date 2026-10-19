import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { cobrosQueNoCorresponden, montoDeMatricula, type CobroDeMatricula } from './corte-de-bloque'

const COSTOS = { N1: 0, N2: 5000, N3: 5000, N4: 5000, SCJ: 15000 }
let n = 0
const cobro = (o: Partial<CobroDeMatricula> = {}): CobroDeMatricula => ({
  id: `p${++n}`, amount: 5000, status: 'pending', concept: 'matricula', paid_at: null, receipt_path: null, review_status: null, ...o,
})

describe('cuánto cobra una matrícula según la modalidad', () => {
  it('legacy: el costo del plan (N1 = 0)', () => {
    expect(montoDeMatricula('N1', 'legacy', COSTOS)).toBe(0)
    expect(montoDeMatricula('N2', 'legacy', COSTOS)).toBe(5000)
  })
  it('bloques: el par al entrar, 0 en la segunda mitad', () => {
    expect(montoDeMatricula('N1', 'bloques', COSTOS)).toBe(5000)
    expect(montoDeMatricula('N2', 'bloques', COSTOS)).toBe(0)
  })
  it('lo que no es de un bloque cobra su costo en las dos', () => {
    expect(montoDeMatricula('SCJ', 'bloques', COSTOS)).toBe(15000)
  })
})

describe('cobros que no corresponden al pasar al esquema viejo', () => {
  it('el caso de Guido: N1 a legacy → los ₡5.000 pendientes sobran', () => {
    const c = [cobro(), cobro()]
    expect(cobrosQueNoCorresponden(c, 'N1', 'legacy', COSTOS)).toHaveLength(2)
  })

  it('un nivel que en legacy SÍ se cobra no se toca', () => {
    expect(cobrosQueNoCorresponden([cobro()], 'N2', 'legacy', COSTOS)).toEqual([])
  })

  it('hacia bloques nunca: un grupo mixto tiene gente que sí paga su nivel', () => {
    expect(cobrosQueNoCorresponden([cobro()], 'N2', 'bloques', COSTOS)).toEqual([])
  })

  it('nada con plata o trámite encima', () => {
    const c = [
      cobro({ status: 'paid', paid_at: '2026-10-12' }),
      cobro({ receipt_path: 'x.jpg' }),
      cobro({ review_status: 'en_revision' }),
      cobro({ status: 'cancelado' }),
      cobro({ concept: 'folletos' }),
      cobro({ amount: 0 }),
    ]
    expect(cobrosQueNoCorresponden(c, 'N1', 'legacy', COSTOS)).toEqual([])
  })
})

describe('el cableado', () => {
  const ruta = readFileSync('src/app/api/studies/groups/[id]/stale-charges/route.ts', 'utf8')
  const ui = readFileSync('src/components/studies/ModalidadDelGrupo.tsx', 'utf8')

  it('borrar usa la modalidad GUARDADA, no la que dice el navegador', () => {
    const del = ruta.slice(ruta.indexOf('export async function DELETE'))
    expect(del).toContain('const r = await calcular(id)')
  })

  it('el DELETE vuelve a exigir sin pago, sin comprobante y sin revisión', () => {
    expect(ruta).toContain(".eq('status', 'pending').is('paid_at', null).is('receipt_path', null).is('review_status', null)")
  })

  it('deja la fila completa en la auditoría', () => {
    expect(ruta).toContain("action: 'DELETE', entity_type: 'payments'")
    expect(ruta).toContain('old_data: f as Json')
  })

  it('el aviso aparece al confirmar el cambio y borra después de guardar', () => {
    expect(ui).toContain('/stale-charges?modalidad=legacy')
    expect(ui.indexOf("method: 'PUT'")).toBeLessThan(ui.indexOf("{ method: 'DELETE' }"))
  })
})
