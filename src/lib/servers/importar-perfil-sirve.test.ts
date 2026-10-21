import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DONES, repartirDones, opcionDelCatalogo, HABILIDADES, PASIONES } from './perfil-sirve'

/**
 * SRV-20 (etapa 3) · Las reglas del import del formulario 128 de CCB.
 *
 * El mapeo vive en el script (no en lib) porque lee el CSV; acá se fija lo
 * que NO puede cambiar sin que alguien se entere: las posiciones de las tres
 * columnas sin encabezado, las reglas de cruce de AGENTS.md y que no se
 * importan datos personales.
 */
const SCRIPT = readFileSync('scripts/srv20/importar-perfil-sirve-ccb.ts', 'utf8')

describe('SRV-20 · import de CCB: las reglas de cruce', () => {
  it('resuelve el ID con member_por_external_id, nunca con members.external_id', () => {
    expect(SCRIPT).toContain('member_por_external_id(e)')
    expect(SCRIPT).not.toMatch(/external_id\s*=\s*\$/)
  })

  it('sin ID: solo con exactamente UNA ficha viva por correo; cero o dos se reportan', () => {
    expect(SCRIPT).toContain('ids.length === 1')
    expect(SCRIPT).toContain('where is_active and lower(email)')
    expect(SCRIPT).toContain('ambiguos')
  })

  it('gana la respuesta más reciente, no pisa lo editado en el sistema, y es idempotente', () => {
    expect(SCRIPT).toContain("fecha(f) > fecha(p)")
    expect(SCRIPT).toContain('where member_spiritual_data.editado_en_sistema_at is null')
    expect(SCRIPT).toContain('on conflict (member_id) do update')
  })

  it('NO importa datos personales ni comité/sede/dirigente (columnas 6–14 y 26–28)', () => {
    const cols = SCRIPT.slice(SCRIPT.indexOf('const C = {'), SCRIPT.indexOf('} as const'))
    for (const n of [6, 7, 9, 10, 11, 12, 13, 14, 26, 27, 28]) expect(cols, `columna ${n}`).not.toMatch(new RegExp(`:\\s*${n}\\b`))
    // El correo (8) solo para el match de quien no trae ID.
    expect(cols).toMatch(/email: 8/)
  })

  it('las tres columnas sin encabezado van por posición: 17 otros dones, 23 otras habilidades, 25 otras pasiones', () => {
    const cols = SCRIPT.slice(SCRIPT.indexOf('const C = {'), SCRIPT.indexOf('} as const'))
    expect(cols).toMatch(/otrosDones: 17/)
    expect(cols).toMatch(/otrasHabilidades: 23/)
    expect(cols).toMatch(/otrasPasiones: 25/)
  })

  it('respalda lo anterior en docs/correcciones y escribe en una transacción', () => {
    expect(SCRIPT).toContain("docs/correcciones/2026-10-20-perfil-sirve-ccb")
    expect(SCRIPT).toContain("db.query('begin')")
    expect(SCRIPT).toContain("db.query('rollback')")
  })
})

describe('SRV-20 · import de CCB: el mapeo de celdas', () => {
  it('una celda multiselección calza con el catálogo sin tildes («Jovenes»)', () => {
    expect(opcionDelCatalogo(PASIONES, 'Jovenes')).toBe('Jóvenes')
    expect(opcionDelCatalogo(HABILIDADES, 'Mercadeo / Comunicación')).toBe('Mercadeo / Comunicación')
  })

  it('el texto libre de «otros dones» reparte lo que sí es del catálogo', () => {
    const r = repartirDones('Si, don de profecía, misericordia y lenguas.')
    // Solo lo que calza EXACTO con el catálogo entra: «don de profecía» no es
    // «Profecía» y «misericordia» no es «Misericordia / Compasión». A propósito:
    // adivinar mete dones que la persona no dijo. Lo demás queda como texto.
    expect(r.catalogo).toEqual(['Lenguas'])
    expect(r.otros).toBe('Si, don de profecía, misericordia')
    expect(DONES).toContain('Lenguas')
  })
})
