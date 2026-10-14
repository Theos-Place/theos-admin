import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  kmDelTramo, kmTotales, montoAReconocer, revisarBitacora, avisosDeBitacora,
  faltaAprobacionDelJefe, TARIFA_POR_KM, type Tramo,
} from './kilometraje'

const tramo = (over: Partial<Tramo> = {}): Tramo => ({
  fecha: '2026-11-03', origen: 'Theos Central', destino: 'Sede Liberia',
  km_inicial: 10000, km_final: 10220, ...over,
})

describe('FIN-11 · los kilómetros salen del odómetro', () => {
  it('final menos inicial', () => {
    expect(kmDelTramo(tramo())).toBe(220)
  })

  it('suma los tramos', () => {
    expect(kmTotales([tramo(), tramo({ km_inicial: 10220, km_final: 10450 })])).toBe(450)
  })

  it('un tramo al revés no RESTA del total', () => {
    // Lo atrapa `revisarBitacora`, pero si igual llegara acá, restar
    // kilómetros del total sería peor que ignorarlo.
    expect(kmDelTramo({ km_inicial: 500, km_final: 100 })).toBe(0)
  })

  it('sin tramos, cero', () => {
    expect(kmTotales([])).toBe(0)
  })
})

describe('FIN-11 · el monto a reconocer', () => {
  it('kilómetros por tarifa', () => {
    expect(montoAReconocer(220, 250)).toBe(55000)
  })

  it('LA TARIFA SE PASA, no se lee de la constante', () => {
    // Un expediente viejo tiene que seguir valiendo lo que valía cuando se
    // liquidó, aunque la tarifa suba después.
    expect(montoAReconocer(100, 200)).toBe(20000)
    expect(montoAReconocer(100, 300)).toBe(30000)
  })

  it('la tarifa de hoy está en CERO a propósito', () => {
    // Inventar «₡250, que suena razonable» haría que las primeras bitácoras
    // se liquiden con una tarifa que nadie autorizó, y eso se descubre
    // cuando ya se pagó. Con cero, el monto sale en cero y se nota.
    expect(TARIFA_POR_KM.monto).toBe(0)
    expect(TARIFA_POR_KM.moneda).toBe('CRC')
  })

  it('no arrastra basura de flotante', () => {
    expect(montoAReconocer(3, 0.1)).toBe(0.3)
  })
})

describe('FIN-11 · qué impide enviar la bitácora', () => {
  it('una bitácora bien, pasa', () => {
    expect(revisarBitacora([tramo()])).toEqual([])
  })

  it('vacía, no', () => {
    expect(revisarBitacora([])[0].mensaje).toContain('no puede ir vacía')
  })

  it('el odómetro final menor que el inicial', () => {
    const p = revisarBitacora([tramo({ km_inicial: 10220, km_final: 10000 })])
    expect(p.some(x => x.mensaje.includes('no puede ser menor'))).toBe(true)
  })

  it('un tramo sin kilómetros no es un tramo', () => {
    const p = revisarBitacora([tramo({ km_inicial: 10000, km_final: 10000 })])
    expect(p.some(x => x.mensaje.includes('no tiene kilómetros'))).toBe(true)
  })

  it('falta origen, destino o fecha', () => {
    expect(revisarBitacora([tramo({ origen: '  ' })]).some(x => x.mensaje.includes('origen'))).toBe(true)
    expect(revisarBitacora([tramo({ fecha: '' })]).some(x => x.mensaje.includes('fecha'))).toBe(true)
  })

  it('lecturas que no son números', () => {
    const p = revisarBitacora([tramo({ km_final: NaN })])
    expect(p[0].mensaje).toContain('tienen que ser números')
  })

  it('dice en cuál tramo está el problema', () => {
    const p = revisarBitacora([tramo(), tramo({ km_final: 0 })])
    expect(p.every(x => x.indice === 1)).toBe(true)
  })
})

describe('FIN-11 · los avisos: no frenan, pero se ven', () => {
  it('tramos encadenados no avisan nada', () => {
    const t = [tramo({ km_inicial: 10000, km_final: 10220 }), tramo({ km_inicial: 10220, km_final: 10450 })]
    expect(avisosDeBitacora(t)).toEqual([])
  })

  it('UN HUECO avisa, porque puede ser legítimo', () => {
    // El carro se usó para otra cosa en el medio. Se dice y lo juzga quien
    // revisa; frenar acá sería negar un caso normal.
    const t = [tramo({ km_inicial: 10000, km_final: 10220 }), tramo({ km_inicial: 10300, km_final: 10450 })]
    expect(avisosDeBitacora(t)[0].mensaje).toContain('80 km sin registrar')
  })

  it('QUE RETROCEDA no tiene lectura inocente', () => {
    const t = [tramo({ km_inicial: 10000, km_final: 10220 }), tramo({ km_inicial: 10100, km_final: 10450 })]
    expect(avisosDeBitacora(t)[0].mensaje).toContain('retrocede')
  })

  it('tramos en desorden de fecha también avisan', () => {
    const t = [
      tramo({ fecha: '2026-11-05', km_inicial: 10000, km_final: 10220 }),
      tramo({ fecha: '2026-11-03', km_inicial: 10220, km_final: 10450 }),
    ]
    expect(avisosDeBitacora(t).some(a => a.mensaje.includes('anterior al que está arriba'))).toBe(true)
  })

  it('un solo tramo no tiene con qué compararse', () => {
    expect(avisosDeBitacora([tramo()])).toEqual([])
  })
})

describe('FIN-11 · la aprobación del jefe es REQUISITO', () => {
  it('sin archivo, falta', () => {
    // Lo pidió la minuta del 2026-09-29 con esas palabras.
    expect(faltaAprobacionDelJefe(null)).toBe(true)
    expect(faltaAprobacionDelJefe('   ')).toBe(true)
  })

  it('con archivo, no', () => {
    expect(faltaAprobacionDelJefe('viajes/x/jefe.pdf')).toBe(false)
  })

  it('NO la reemplaza la declaración jurada', () => {
    // Son dos firmas distintas: una la pone quien viajó y la otra quien lo
    // autorizó. El guard vive aparte justamente para que no se confundan.
    const src = readFileSync('src/lib/travel/kilometraje.ts', 'utf8')
    expect(src).toContain('faltaAprobacionDelJefe')
    expect(src).not.toContain('declaracion_jurada')
  })
})
