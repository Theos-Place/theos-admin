/**
 * DON-4 (2026-10-14) · La pantalla /finanzas/donaciones se unificó con la
 * primera pestaña del reporte de finanzas, «sin perder ninguna funcionalidad».
 * Este test fija lo que un render test no puede: que la ruta vieja siga
 * llevando a algún lado, que el panel tenga TODO lo que tenía la pantalla, y
 * que el listado de pagos del reporte ya no se corte en 15.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
const sin = (r: string) => readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('DON-4 · donaciones dentro del reporte', () => {
  it('la ruta vieja redirige al reporte (enlaces, marcadores y notificaciones siguen vivos)', () => {
    expect(sin('src/app/(admin)/finanzas/donaciones/page.tsx')).toContain("redirect('/finanzas/reportes')")
  })

  it('el reporte monta el panel en la pestaña de donaciones', () => {
    const r = sin('src/app/(admin)/finanzas/reportes/page.tsx')
    expect(r).toContain("{activeTab === 'donations' && <DonacionesPanel />}")
  })

  it('el panel conserva cada función de la pantalla vieja', () => {
    const p = sin('src/components/finance/DonacionesPanel.tsx')
    for (const pieza of [
      'useDonations(params)',            // lista paginada server-side, de 50 en 50
      'Cargar 50 más',
      'AgregarDonacionModal',            // alta manual
      '/finanzas/donaciones/importar',   // importar lotes
      '/finanzas/donaciones/reporte',    // donantes y montos
      'Resolver manualmente',            // identificar las sin identificar
      'MemberCombobox',
      "urlDeDonaciones(params, { all: true })", // CSV del filtrado COMPLETO, no de lo cargado
      'Total filtrado',
      'revealAll',                       // mostrar/ocultar montos
    ]) expect(p, pieza).toContain(pieza)
  })

  it('el menú ya no tiene la entrada; el dashboard lleva al reporte', () => {
    expect(sin('src/components/layout/Sidebar.tsx')).not.toContain("'/finanzas/donaciones'")
    expect(sin('src/app/(admin)/dashboard/page.tsx')).not.toContain('href="/finanzas/donaciones"')
  })

  it('los pagos del reporte se listan todos, de 50 en 50 (no 15)', () => {
    const r = sin('src/app/(admin)/finanzas/reportes/page.tsx')
    expect(r).not.toContain('slice(0, 15)')
    expect(r).toContain('const PAGINA = 50')
    expect(r).toContain('Mostrar 50 más')
    // y el tope vuelve a 50 al cambiar un filtro
    expect(r).toContain('() => setVisibles(PAGINA))')
  })

  it('la pestaña de pagos tapa los montos y los destapa con un botón, como Donaciones', () => {
    const r = sin('src/app/(admin)/finanzas/reportes/page.tsx')
    const pagos = r.slice(r.indexOf("activeTab === 'payments'"), r.indexOf("activeTab === 'transparency'"))
    expect(pagos).toContain('Mostrar montos')
    expect((pagos.match(/revealed=\{revelarPagos\}/g) ?? []).length).toBeGreaterThanOrEqual(5)
    expect(pagos).not.toContain('defaultHidden={false}')
  })
})
