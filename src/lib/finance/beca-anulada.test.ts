import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ETIQUETA_USO, ETIQUETA_ESTADO_BECA, FILTROS_USO } from '@/lib/finance/uso-de-beca'

describe('una beca revocada se llama ANULADA, no cancelada', () => {
  it('en las dos tablas de etiquetas', () => {
    /**
     * Pedido de Floriana el 2026-10-06, por lo mismo que en PAG-6: en
     * contabilidad «cancelar» es PAGAR, así que «beca cancelada» se podía
     * leer como «beca ya aplicada» — lo contrario de lo que pasó.
     */
    expect(ETIQUETA_USO.revocada).toBe('Anulada')
    expect(ETIQUETA_ESTADO_BECA.revoked).toBe('Anulada')
    expect(FILTROS_USO.find(f => f.id === 'revocada')?.label).toBe('Anuladas')
  })

  it('y en ninguna pantalla quedó la palabra vieja', () => {
    // Estaba escrita a mano en tres: la de becas, Mis pagos y el historial.
    for (const ruta of [
      'src/app/(admin)/finanzas/becas/page.tsx',
      'src/app/(admin)/mis-pagos/page.tsx',
      'src/lib/audit/historial.ts',
    ]) {
      const src = readFileSync(ruta, 'utf8')
      expect(src, ruta).not.toMatch(/revoked:\s*(\{\s*label:\s*)?'Cancelada'/)
      expect(src, ruta).not.toMatch(/used:\s*(\{\s*label:\s*)?'Usada'/)
    }
  })

  it('la pantalla de becas usa la tabla compartida, no una copia', () => {
    // Con tres copias, renombrar una etiqueta pedía acordarse de las tres.
    const src = readFileSync('src/app/(admin)/finanzas/becas/page.tsx', 'utf8')
    expect(src).toContain('ETIQUETA_ESTADO_BECA')
  })

  it('y una beca aplicada se llama APLICADA, no usada', () => {
    // Mismo pedido, mismo día: una beca no se gasta, se aplica a un cobro.
    expect(ETIQUETA_USO.usada).toBe('Aplicada')
    expect(ETIQUETA_ESTADO_BECA.used).toBe('Aplicada')
    expect(FILTROS_USO.find(f => f.id === 'usada')?.label).toBe('Aplicadas')
  })

  it('«sin usar» acompaña el cambio: «Sin aplicar»', () => {
    // No se pidió, pero «Sin usar» al lado de «Aplicada» son dos formas de
    // nombrar lo mismo y se leen como dos cosas distintas.
    expect(ETIQUETA_USO.sin_usar).toBe('Sin aplicar')
    expect(FILTROS_USO.find(f => f.id === 'sin_usar')?.label).toBe('Sin aplicar')
  })

  it('«activa» no se tocó', () => {
    expect(ETIQUETA_ESTADO_BECA.active).toBe('Activa')
  })
})
