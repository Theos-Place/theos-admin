import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  columnasDelExport, filaDeRespuesta, celdaComoTexto, camposConDatos, hayGrupo,
  type CampoDelExport, type RespuestaParaExport,
} from './filas-del-export'
import { COLUMNAS_PERSONALES } from './datos-personales-del-export'

const sinComentarios = (r: string) =>
  readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

const campos: CampoDelExport[] = [
  { id: 'f1', field_type: 'text', label: '¿Cómo te enteraste?' },
  { id: 'f2', field_type: 'number', label: 'Edad' },
]
const r = (p: Partial<RespuestaParaExport> = {}): RespuestaParaExport => ({
  member_id: 'm1', member_name: 'Ana Solís', member_phone: '88887777',
  recorded_by_name: '', submitted_at: '2026-09-28T15:00:00Z',
  answers: { f1: 'Amigos', f2: '30' }, ...p,
})

describe('FRM-6b · CSV y XLSX salen de las MISMAS columnas', () => {
  it('sin datos personales son las de contexto más las preguntas', () => {
    const c = columnasDelExport(campos, { conGrupo: false, conPersonales: false })
    expect(c.map(x => x.header)).toEqual([
      'Quién respondió', 'Teléfono (perfil)', 'Registrada por', 'Fecha',
      '¿Cómo te enteraste?', 'Edad',
    ])
  })

  it('con datos personales se agregan al FINAL, después de las preguntas', () => {
    const n = COLUMNAS_PERSONALES.length
    const c = columnasDelExport(campos, { conGrupo: false, conPersonales: true })
    expect(c.slice(-n).map(x => x.header)).toEqual(COLUMNAS_PERSONALES.map(x => x.header))
    // Las preguntas quedan antes: son lo que alguien vino a leer.
    expect(c[c.length - n - 1].header).toBe('Edad')
  })

  it('el bloque personal NO repite el nombre ni el teléfono del contexto', () => {
    // Salían dos columnas de teléfono y dos de nombre, todas de la misma
    // ficha (reportado el 2026-09-28).
    const c = columnasDelExport(campos, { conGrupo: false, conPersonales: true })
      .map(x => x.header)
    for (const h of c) expect(c.filter(x => x === h), h).toHaveLength(1)
    expect(c.filter(h => /tel/i.test(h))).toEqual(['Teléfono (perfil)'])
    expect(c.filter(h => /nombre|qui[eé]n/i.test(h))).toEqual(['Quién respondió'])
  })

  it('«Grupo» y «Dirigente» solo cuando los datos los traen', () => {
    // RET-1: agregarlas siempre metería dos columnas vacías en el export de
    // todos los formularios, y un archivo así se lee como un error.
    expect(hayGrupo([r()])).toBe(false)
    expect(hayGrupo([r(), r({ grupo: 'N1 Lunes' })])).toBe(true)
    const c = columnasDelExport(campos, { conGrupo: true, conPersonales: false })
    expect(c.slice(0, 3).map(x => x.header)).toEqual(['Quién respondió', 'Grupo', 'Dirigente'])
  })

  it('la fila tiene EXACTAMENTE tantos valores como columnas', () => {
    // Si se desalinean, el archivo sale corrido y nadie lo nota hasta que
    // alguien lee una alergia en la columna del teléfono.
    for (const [conGrupo, conPersonales] of [[false,false],[true,false],[false,true],[true,true]] as const) {
      const c = columnasDelExport(campos, { conGrupo, conPersonales })
      const v = filaDeRespuesta(r({ grupo: 'N1', dirigente: 'Ana' }), campos, {
        conGrupo, ficha: conPersonales ? null : undefined,
      })
      expect(v.length, `grupo=${conGrupo} personales=${conPersonales}`).toBe(c.length)
    }
  })

  it('una respuesta anónima se dice, no se deja en blanco', () => {
    expect(filaDeRespuesta(r({ member_name: '' }), campos, { conGrupo: false })[0]).toBe('Anónimo')
  })

  it('los campos que escriben en la ficha no generan columna', () => {
    // `personal_data` y `leader_availability` parecen campos pero nunca
    // guardan respuesta: su columna saldría siempre vacía.
    const todos = [...campos,
      { id: 'x', field_type: 'personal_data', label: 'Datos' },
      { id: 'y', field_type: 'leader_availability', label: 'Disponibilidad' },
      { id: 'z', field_type: 'section', label: 'Sección' }]
    expect(camposConDatos(todos).map(f => f.id)).toEqual(['f1', 'f2'])
  })
})

describe('FRM-6b · la celda del CSV', () => {
  it('la fecha va en formato de Costa Rica, no ISO', () => {
    // El CSV se abre en Excel y el ISO se lee como texto.
    const v = celdaComoTexto(new Date(Date.UTC(2026, 8, 28, 18)))
    expect(v).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
    expect(v).not.toContain('T')
  })

  it('vacío es cadena vacía, no «null»', () => {
    expect(celdaComoTexto(null)).toBe('')
  })

  it('un número se escribe tal cual', () => {
    expect(celdaComoTexto(30)).toBe('30')
  })
})

describe('FRM-6b · cableado', () => {
  const RUTA = sinComentarios('src/app/api/forms/[id]/responses/export/route.ts')
  const PANTALLA = sinComentarios('src/app/(admin)/formularios/[id]/respuestas/page.tsx')

  it('los DOS formatos salen de la misma ruta', () => {
    expect(RUTA).toContain("=== 'csv'")
    expect(RUTA).toContain('ExcelJS')
  })

  it('y los dos arman las columnas con la misma función', () => {
    // Una sola llamada a columnasDelExport y una sola a filaDeRespuesta: si
    // hubiera una por formato, volverían a separarse.
    expect(RUTA.match(/columnasDelExport\(/g)?.length).toBe(1)
    expect(RUTA.match(/filaDeRespuesta\(/g)?.length).toBe(1)
  })

  it('la pantalla ya NO arma el CSV: los dos botones van a la ruta', () => {
    // Es la falla que se repitió tres veces. El CSV en el cliente y el XLSX en
    // el servidor no comparten nada, y el comentario «mismas columnas que el
    // otro» no impidió ninguna de las tres.
    expect(PANTALLA).not.toContain('exportToCSV')
    expect(PANTALLA).not.toContain('generateCSV')
    expect(PANTALLA).toContain('formato=csv')
  })

  it('el CSV respeta el checkbox de datos personales', () => {
    // Era el reporte: el Excel los traía y el CSV no.
    const i = PANTALLA.indexOf('formato=csv')
    expect(PANTALLA.slice(i, i + 120)).toContain('personales=1')
  })

  it('el CSV lleva BOM, o Excel rompe las tildes', () => {
    expect(RUTA).toContain("'\\uFEFF'")
  })
})
