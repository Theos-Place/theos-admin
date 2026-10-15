/**
 * Los reportes de finanzas se ven igual en sus tres pestañas (2026-10-14).
 * Si alguien vuelve a escribir a mano una clase de celda, una fila cebra o un
 * gris rgba, este test lo ataja.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const ARCHIVOS = ['src/app/(admin)/finanzas/reportes/page.tsx', 'src/components/finance/DonacionesPanel.tsx']
const fuente = (f: string) => readFileSync(f, 'utf8')

describe('reportes de finanzas · un solo molde', () => {
  for (const f of ARCHIVOS) {
    it(`${f.split('/').slice(-2).join('/')} usa reporte-ui`, () => {
      const s = fuente(f)
      expect(s).toContain("from '@/components/finance/reporte-ui'")
      expect(s).toContain('className={BARRA}')
      expect(s).toContain('className={TH}')
      expect(s).toContain('className={FILA}')
    })

    it(`${f.split('/').slice(-2).join('/')} no trae filas cebra, grises rgba ni th a mano`, () => {
      const s = fuente(f)
      expect(s).not.toMatch(/i % 2 === 0/)
      expect(s).not.toContain('text-[rgba(22,20,64')
      expect(s).not.toMatch(/<th[^>]*className="/)
      expect(s).not.toContain('hover:bg-gray-50')
    })
  }

  it('Donantes y montos va a la derecha, antes de Mostrar montos', () => {
    const s = fuente('src/components/finance/DonacionesPanel.tsx')
    const der = s.slice(s.indexOf('<div className={BARRA_DER}>'))
    expect(der.indexOf('Donantes y montos')).toBeGreaterThan(-1)
    expect(der.indexOf('Donantes y montos')).toBeLessThan(der.indexOf('<BotonMostrarMontos'))
  })
})
