import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { rutaPublicaDesdeModulo, rutaConCuenta, puedeResponderDeNuevo, mensajeDeEspera, DIAS_ENTRE_RESPUESTAS_POR_DEFECTO } from './reanswer'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

const ID = '3d60d1ff-a21b-4c6a-9911-860263db7a6f'

describe('FRM-7 · el mismo link sirve con o sin cuenta', () => {
  it('el link del módulo a UN formulario, con o sin /responder, tiene página pública', () => {
    expect(rutaPublicaDesdeModulo(`/formularios/${ID}/responder`)).toBe(`/formulario/${ID}`)
    expect(rutaPublicaDesdeModulo(`/formularios/${ID}`)).toBe(`/formulario/${ID}`)
    expect(rutaPublicaDesdeModulo(`/formularios/${ID.toUpperCase()}/`)).toBe(`/formulario/${ID}`)
  })

  it('el resto del módulo NO: respuestas, selección, listado, ids que no son uuid', () => {
    for (const p of ['/formularios', `/formularios/${ID}/respuestas`, `/formularios/${ID}/seleccion`, '/formularios/abc/responder', '/formularios/nuevo'])
      expect(rutaPublicaDesdeModulo(p), p).toBeNull()
  })

  it('el proxy traduce SIN sesión, antes de mandar al login', () => {
    const src = sinComentarios('src/proxy.ts')
    const i = src.indexOf('rutaPublicaDesdeModulo(pathname)')
    const j = src.indexOf('loginUrlWithDest(pathname')
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(j)
    expect(src).toContain('if (!user) {')
  })

  it('la página pública ofrece el login y vuelve al llenado con cuenta', () => {
    expect(rutaConCuenta(ID)).toBe(`/formularios/${ID}/responder`)
    expect(sinComentarios('src/app/(public)/formulario/[id]/page.tsx')).toContain('rutaConCuenta(id)')
  })
})

describe('FRM-7 · responder de nuevo en actividades recurrentes', () => {
  const t0 = new Date('2026-10-01T12:00:00Z')

  it('sin respuesta previa, siempre', () => {
    expect(puedeResponderDeNuevo({ permiteVarias: false, ultimaRespuesta: null })).toEqual({ ok: true })
  })

  it('sin «varias», una sola: como siempre', () => {
    expect(puedeResponderDeNuevo({ permiteVarias: false, ultimaRespuesta: t0, ahora: new Date('2027-01-01') }).ok).toBe(false)
  })

  it('con «varias» y default de 2 días: frena el doble envío, no la edición siguiente', () => {
    expect(DIAS_ENTRE_RESPUESTAS_POR_DEFECTO).toBe(2)
    const r = puedeResponderDeNuevo({ permiteVarias: true, ultimaRespuesta: t0, ahora: new Date('2026-10-02T12:00:00Z') })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.desde).toBe('2026-10-03T12:00:00.000Z')
    expect(puedeResponderDeNuevo({ permiteVarias: true, ultimaRespuesta: t0, ahora: new Date('2026-10-03T12:00:00Z') }).ok).toBe(true)
  })

  it('la ventana es configurable, y 0 = sin espera', () => {
    expect(puedeResponderDeNuevo({ permiteVarias: true, dias: 30, ultimaRespuesta: t0, ahora: new Date('2026-10-20') }).ok).toBe(false)
    expect(puedeResponderDeNuevo({ permiteVarias: true, dias: 0, ultimaRespuesta: t0, ahora: t0 }).ok).toBe(true)
  })

  it('el mensaje dice CUÁNDO, en hora de Costa Rica', () => {
    expect(mensajeDeEspera('2026-10-03T12:00:00.000Z')).toBe('Ya te inscribiste a esta actividad; podrás volver a inscribirte después del 3 de octubre de 2026.')
  })

  it('los DOS endpoints usan la regla y devuelven `puede_desde`; las DOS pantallas lo muestran', () => {
    for (const r of ['src/app/api/forms/[id]/responses/route.ts', 'src/app/api/public/forms/[id]/responder/route.ts']) {
      const src = sinComentarios(r)
      expect(src, r).toContain('puedeResponderDeNuevo({')
      expect(src, r).toContain('puede_desde: veredicto.desde')
      expect(src, r).toContain("select('allow_multiple_responses, reanswer_after_days')")
    }
    expect(sinComentarios('src/components/forms/FormFiller.tsx')).toContain('if (detail?.puede_desde) { setSubmitError(String(detail.error)); return }')
    expect(sinComentarios('src/components/forms/PublicFormFiller.tsx')).toContain("d?.puede_desde) { setError(String(d.error)); return }")
  })

  it('el builder guarda las dos cosas y la migración trae la columna con default 2', () => {
    const b = sinComentarios('src/app/(admin)/formularios/_components/FormBuilder.tsx')
    expect(b).toContain('allow_multiple_responses: permiteVarias')
    expect(b).toContain('reanswer_after_days: diasEntreRespuestas')
    const m = readFileSync('supabase/migrations/20261026120000_frm7_reanswer_after_days.sql', 'utf8')
    expect(m).toContain('reanswer_after_days integer not null default 2')
    const mapper = sinComentarios('src/lib/forms/form-mapper.ts')
    expect(mapper).toContain("if ('reanswer_after_days' in body)")
  })
})
