import { describe, it, expect } from 'vitest'
import {
  estadoDeLaFila, esProblema, estadosDelFiltro, textoVacio,
  ETIQUETA_ESTADO, BADGE_ESTADO, AYUDA_ESTADO, FILTROS_CORREO,
  type EstadoCorreo,
} from './correos-del-sistema'

describe('estadoDeLaFila', () => {
  it('reconoce los cuatro que usa la BD hoy', () => {
    expect(estadoDeLaFila('delivered')).toBe('delivered')
    expect(estadoDeLaFila('bounced')).toBe('bounced')
    expect(estadoDeLaFila('failed')).toBe('failed')
    expect(estadoDeLaFila('pending')).toBe('pending')
  })
  it('no le importa el case', () => {
    expect(estadoDeLaFila('DELIVERED')).toBe('delivered')
  })
  it('un estado desconocido cae en "sent", no desaparece', () => {
    // Preferimos una etiqueta imprecisa a una fila que no se ve.
    expect(estadoDeLaFila('lo_que_venga')).toBe('sent')
    expect(estadoDeLaFila(null)).toBe('sent')
    expect(estadoDeLaFila(undefined)).toBe('sent')
  })
})

describe('esProblema', () => {
  it('rebote, fallo y silenciado piden acción', () => {
    expect(esProblema('bounced')).toBe(true)
    expect(esProblema('failed')).toBe(true)
    expect(esProblema('silenciado')).toBe(true)
  })
  it('entregado, enviado y en cola no', () => {
    expect(esProblema('delivered')).toBe(false)
    expect(esProblema('sent')).toBe(false)
    expect(esProblema('pending')).toBe(false)
  })
})

describe('estadosDelFiltro', () => {
  it('"todos" no pone condición', () => {
    expect(estadosDelFiltro('todos')).toEqual([])
  })
  it('"con problema" pide los dos que están en message_logs', () => {
    // El silenciado no está ahí: vive en otra tabla y tiene su propio filtro.
    expect(estadosDelFiltro('problemas')).toEqual(['bounced', 'failed'])
  })
  it('"no salieron" no consulta message_logs', () => {
    expect(estadosDelFiltro('silenciado')).toBeNull()
  })
  it('un estado suelto se pide tal cual', () => {
    expect(estadosDelFiltro('delivered')).toEqual(['delivered'])
  })
})

describe('textos', () => {
  it('el vacío por búsqueda no culpa al filtro', () => {
    expect(textoVacio('problemas', true)).toContain('búsqueda')
  })
  it('cada filtro tiene su propio vacío', () => {
    expect(textoVacio('problemas', false)).toContain('falló')
    expect(textoVacio('silenciado', false)).toContain('silencioso')
    expect(textoVacio('todos', false)).toContain('Todavía no hay')
  })
  it('todos los estados tienen etiqueta, badge y ayuda', () => {
    const estados: EstadoCorreo[] = ['delivered', 'sent', 'bounced', 'failed', 'pending', 'silenciado']
    for (const e of estados) {
      expect(ETIQUETA_ESTADO[e]).toBeTruthy()
      expect(BADGE_ESTADO[e]).toBeTruthy()
      expect(AYUDA_ESTADO[e]).toBeTruthy()
    }
  })
  it('la ayuda distingue enviado de entregado, que es la duda de siempre', () => {
    expect(AYUDA_ESTADO.sent).not.toBe(AYUDA_ESTADO.delivered)
    expect(AYUDA_ESTADO.sent).toContain('todavía no llegó')
  })
  it('el filtro de problemas va segundo: es a lo que uno entra', () => {
    expect(FILTROS_CORREO[1].id).toBe('problemas')
  })
})
