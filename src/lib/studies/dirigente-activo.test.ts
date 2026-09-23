import { describe, it, expect } from 'vitest'
import {
  esDirigenteActivo, limiteDeVigencia, repartirDirigentes, MESES_DE_VIGENCIA,
} from './dirigente-activo'

const HOY = '2026-09-23'

describe('¿está activo el dirigente?', () => {
  it('sí, si está dirigiendo ahora — sin importar cuándo cerró el anterior', () => {
    expect(esDirigenteActivo({ dirigeAhora: true, ultimoCierre: null }, HOY)).toBe(true)
    expect(esDirigenteActivo({ dirigeAhora: true, ultimoCierre: '2019-01-01' }, HOY)).toBe(true)
  })

  it('sí, si cerró hace 11 meses', () => {
    expect(esDirigenteActivo({ dirigeAhora: false, ultimoCierre: '2025-10-23' }, HOY)).toBe(true)
  })

  it('no, si cerró hace 13 meses', () => {
    expect(esDirigenteActivo({ dirigeAhora: false, ultimoCierre: '2025-08-23' }, HOY)).toBe(false)
  })

  it('no, si nunca dirigió', () => {
    expect(esDirigenteActivo({ dirigeAhora: false, ultimoCierre: null }, HOY)).toBe(false)
  })

  it('el borde de los 12 meses ENTRA', () => {
    // Justo 12 meses atrás todavía cuenta; un día antes, no. Escrito porque en
    // la primera corrida había gente a días del corte.
    expect(esDirigenteActivo({ dirigeAhora: false, ultimoCierre: '2025-09-23' }, HOY)).toBe(true)
    expect(esDirigenteActivo({ dirigeAhora: false, ultimoCierre: '2025-09-22' }, HOY)).toBe(false)
  })

  it('el límite cruza el año sin romperse', () => {
    expect(limiteDeVigencia('2026-09-23')).toBe('2025-09-23')
    expect(limiteDeVigencia('2026-01-15')).toBe('2025-01-15')
    expect(limiteDeVigencia('2027-03-01')).toBe('2026-03-01')
  })

  it('se compara por STRING, sin construir fechas del string', () => {
    // `new Date('2026-09-23')` es medianoche UTC y en Costa Rica sería el 22.
    // Comparar YYYY-MM-DD como texto no tiene zona horaria.
    expect(limiteDeVigencia('2026-03-01')).toBe('2025-03-01')
    expect(MESES_DE_VIGENCIA).toBe(12)
  })
})

describe('qué hacer con cada uno', () => {
  it('separa altas, bajas y los que no cambian', () => {
    const r = repartirDirigentes([
      { memberId: '1', nombre: 'Dirige ahora', activoHoy: false, situacion: { dirigeAhora: true, ultimoCierre: null } },
      { memberId: '2', nombre: 'Cerró hace años', activoHoy: true, situacion: { dirigeAhora: false, ultimoCierre: '2021-01-01' } },
      { memberId: '3', nombre: 'Ya estaba bien', activoHoy: true, situacion: { dirigeAhora: true, ultimoCierre: null } },
    ], HOY)
    expect(r.activar.map(x => x.nombre)).toEqual(['Dirige ahora'])
    expect(r.desactivar.map(x => x.nombre)).toEqual(['Cerró hace años'])
    expect(r.sinCambio).toBe(1)
  })

  it('LA REVISIÓN NO ENTRA EN EL CÁLCULO: es una etiqueta, no un estado', () => {
    // Corrección del usuario (2026-09-23): mi primera versión los saltaba.
    // Si está dando o dio dentro de los tres cuatrimestres, está activo — la
    // etiqueta se queda puesta al lado, y de conservarla se encarga
    // `setDirigenteActive`.
    const r = repartirDirigentes([
      { memberId: '1', nombre: 'En revisión, dirige', activoHoy: false, situacion: { dirigeAhora: true, ultimoCierre: null } },
      { memberId: '2', nombre: 'En revisión, viejo', activoHoy: true, situacion: { dirigeAhora: false, ultimoCierre: '2020-01-01' } },
    ], HOY)
    expect(r.activar.map(x => x.nombre)).toEqual(['En revisión, dirige'])
    expect(r.desactivar.map(x => x.nombre)).toEqual(['En revisión, viejo'])
  })

  it('es idempotente: con todo ya calculado no propone nada', () => {
    const gente = [
      { memberId: '1', nombre: 'A', activoHoy: true, situacion: { dirigeAhora: true, ultimoCierre: null } },
      { memberId: '2', nombre: 'B', activoHoy: false, situacion: { dirigeAhora: false, ultimoCierre: null } },
    ]
    const r = repartirDirigentes(gente, HOY)
    expect(r.activar).toEqual([]); expect(r.desactivar).toEqual([])
    expect(r.sinCambio).toBe(2)
  })
})
