import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  faltantesDeCompromiso, justificacion, repartirRevision, asistenciaCreible, razonesVisibles,
  type DirigenteParaRevision,
} from './revision-por-compromiso'
import { RAZONES_DE_REVISION_MANUALES } from './estado-del-dirigente'
import { sinNotasNiBanderita } from './notas-confidenciales'
import { jerarquiaDeDirigentes } from '@/lib/reports/jerarquia-de-dirigentes'

const dir = (o: Partial<DirigenteParaRevision> = {}): DirigenteParaRevision => ({
  memberId: 'm1', nombre: 'Ana Pérez', activo: true, donante: true, asistencia: true, faltanAhora: [], ...o,
})

describe('DIR-14 · qué le falta y cómo se dice', () => {
  it('no dona → «No cumple: donación»', () => {
    const f = faltantesDeCompromiso({ donante: false, asistencia: true })
    expect(f).toEqual(['donacion'])
    expect(justificacion(f)).toBe('No cumple: donación')
  })

  it('las dos razones se listan juntas', () => {
    const f = faltantesDeCompromiso({ donante: false, asistencia: false })
    expect(justificacion(f)).toBe('No cumple: donación y asistencia')
  })

  it('cumple todo → nada que decir', () => {
    expect(justificacion(faltantesDeCompromiso({ donante: true, asistencia: true }))).toBe('')
  })
})

describe('DIR-14 · cuándo se pone y cuándo se quita', () => {
  it('no dona → se le PONE', () => {
    const r = repartirRevision([dir({ donante: false })])
    expect(r.poner).toEqual([{ memberId: 'm1', nombre: 'Ana Pérez', de: [], a: ['donacion'] }])
  })

  it('vuelve a donar → se le QUITA sola', () => {
    const r = repartirRevision([dir({ faltanAhora: ['donacion'] })])
    expect(r.quitar).toHaveLength(1)
    expect(r.quitar[0].a).toEqual([])
  })

  it('donó pero sigue sin asistir → se ACTUALIZA, no se quita ni se duplica', () => {
    const r = repartirRevision([dir({ asistencia: false, faltanAhora: ['donacion', 'asistencia'] })])
    expect(r.actualizar).toEqual([{ memberId: 'm1', nombre: 'Ana Pérez', de: ['donacion', 'asistencia'], a: ['asistencia'] }])
    expect(r.poner).toHaveLength(0)
  })

  it('es IDEMPOTENTE: aplicado lo que dijo, la segunda corrida no cambia nada', () => {
    const hoy = [dir({ memberId: 'a', donante: false }), dir({ memberId: 'b', faltanAhora: ['asistencia'] }), dir({ memberId: 'c' })]
    const r1 = repartirRevision(hoy)
    const despues = hoy.map(d => {
      const c = [...r1.poner, ...r1.actualizar, ...r1.quitar].find(x => x.memberId === d.memberId)
      return c ? { ...d, faltanAhora: c.a } : d
    })
    const r2 = repartirRevision(despues)
    expect(r2.sinCambio).toBe(3)
    expect([...r2.poner, ...r2.actualizar, ...r2.quitar]).toEqual([])
  })

  it('el orden de lo guardado no cuenta como cambio', () => {
    const r = repartirRevision([dir({ donante: false, asistencia: false, faltanAhora: ['asistencia', 'donacion'] })])
    expect(r.sinCambio).toBe(1)
  })

  it('un INACTIVO no lleva banderita automática: se le quita la que tenía', () => {
    const r = repartirRevision([dir({ activo: false, donante: false, faltanAhora: ['donacion'] })])
    expect(r.quitar).toHaveLength(1)
    expect(repartirRevision([dir({ activo: false, donante: false })]).sinCambio).toBe(1)
  })
})

describe('DIR-14 · el freno de la asistencia', () => {
  it('con CERO personas cumpliendo no se escribe: es una falla, no un dato', () => {
    expect(asistenciaCreible([])).toBe(false)
    expect(asistenciaCreible(['m1'])).toBe(true)
  })

  it('el cron consulta el freno ANTES de escribir', () => {
    const cron = readFileSync('src/app/api/cron/dirigentes-compromisos/route.ts', 'utf8')
    const freno = cron.indexOf('if (!asistenciaCreible(asistencia))')
    expect(freno).toBeGreaterThan(-1)
    expect(freno).toBeLessThan(cron.indexOf(".from('study_leaders')\n          .update("))
  })
})

describe('DIR-14 · la manual y la automática no se pisan', () => {
  it('«por compromiso» ya no se marca a mano', () => {
    expect(RAZONES_DE_REVISION_MANUALES).not.toContain('compromiso')
    const ruta = readFileSync('src/app/api/studies/dirigentes/[id]/estado/route.ts', 'utf8')
    expect(ruta).toContain('z.enum(RAZONES_DE_REVISION_MANUALES)')
  })

  it('el cron no lee ni escribe la lista MANUAL', () => {
    const cron = readFileSync('src/app/api/cron/dirigentes-compromisos/route.ts', 'utf8')
    expect(cron).toContain(".select('member_id, estado_base, revision_auto_faltan')")
    expect(cron).not.toMatch(/\brevision:/)
  })

  it('se muestran juntas, sin duplicar', () => {
    expect(razonesVisibles(['testimonio'], ['donacion'])).toEqual(['testimonio', 'compromiso'])
    expect(razonesVisibles(['testimonio'], [])).toEqual(['testimonio'])
    expect(razonesVisibles(['compromiso'], ['donacion'])).toEqual(['compromiso'])
  })

  it('la ficha guarda solo las manuales', () => {
    const ficha = readFileSync('src/components/studies/EstadoDelDirigente.tsx', 'utf8')
    expect(ficha).toContain('revision: e.revision.filter(r => (RAZONES_DE_REVISION_MANUALES as readonly string[]).includes(r))')
  })
})

describe('DIR-14 · confidencial como la manual', () => {
  it('quien no ve la banderita tampoco recibe la automática', () => {
    const fila = { revision: [], revision_auto_faltan: ['donacion'], revision_auto_desde: '2026-10-19' }
    const limpio = sinNotasNiBanderita(fila, ['editor_dirigentes']) as Record<string, unknown>
    expect('revision_auto_faltan' in limpio).toBe(false)
    expect('revision_auto_desde' in limpio).toBe(false)
  })

  it('no manda correos ni notificaciones', () => {
    const cron = readFileSync('src/app/api/cron/dirigentes-compromisos/route.ts', 'utf8')
    const imports = cron.split('\n').filter(l => l.startsWith('import ')).join('\n')
    expect(imports).not.toMatch(/email|correo|notif|whatsapp|push/i)
  })
})

describe('DIR-14 · el reporte distingue automáticas de manuales', () => {
  const base = { estado_base: 'activo', disponibilidad: 'disponible', razon_no_disponible: null, razon_inactivo: null, dirigiendo: false }
  const filas = [
    { ...base, member_id: 'a', nombre: 'A', revision: [], revision_auto_faltan: ['donacion'] },
    { ...base, member_id: 'b', nombre: 'B', revision: ['testimonio'], revision_auto_faltan: [] },
    { ...base, member_id: 'c', nombre: 'C', revision: ['testimonio'], revision_auto_faltan: ['asistencia'] },
    { ...base, member_id: 'd', nombre: 'D', revision: [], revision_auto_faltan: [] },
  ]
  const j = jerarquiaDeDirigentes(filas, { verBanderitas: true })

  it('cuenta a las tres con banderita, venga de donde venga', () => {
    expect(j.enRevision?.total).toBe(3)
  })

  it('y separa el origen', () => {
    expect(j.revisionAutomaticas?.total).toBe(2)
    expect(j.revisionManuales?.total).toBe(2)
    expect(j.porRazonDeRevision.find(c => c.clave === 'revision:compromiso')?.total).toBe(2)
  })

  it('sin permiso, null y no cero', () => {
    const sin = jerarquiaDeDirigentes(filas, { verBanderitas: false })
    expect(sin.revisionAutomaticas).toBeNull()
    expect(sin.revisionManuales).toBeNull()
  })
})
