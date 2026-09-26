import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import {
  construirExcelDeSolicitudes, ENCABEZADOS, filaDeSolicitud,
  type SolicitudParaExportar,
} from './export-de-solicitudes'

const base: SolicitudParaExportar = {
  id: 'v1', comite: 'Comité de Alabanza', encargados: ['Ana Rojas'],
  puesto: 'Vocalista', cupos: 3, estado: 'creado', solicitada: '2026-09-26T10:00:00Z',
  descripcion: 'Canta en el equipo.', funciones: 'Ensayar\nServir el domingo',
  perfil: 'Compromiso', habilidades: 'Afinación', estudio_requerido: 'Nivel 2',
  ubicacion: 'Sede Escazú',
}
const s = (p: Partial<SolicitudParaExportar>): SolicitudParaExportar => ({ ...base, ...p })

async function abrir(filas: SolicitudParaExportar[]) {
  const buf = await construirExcelDeSolicitudes(filas, new Date('2026-10-02T12:00:00Z'))
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const hoja = wb.getWorksheet('Solicitudes')!
  const out: string[][] = []
  hoja.eachRow(r => out.push((r.values as unknown[]).slice(1).map(v => String(v ?? ''))))
  return { hoja, filas: out }
}

describe('el Excel de solicitudes', () => {
  it('lleva las definiciones del puesto, no solo nombre y cantidad', () => {
    // Quien publica necesita leer la descripción y las funciones para decidir
    // si el puesto está listo para salir; sin eso habría que abrir el catálogo
    // puesto por puesto.
    for (const col of ['Descripción', 'Funciones', 'Perfil', 'Estudio requerido']) {
      expect(ENCABEZADOS).toContain(col)
    }
  })

  it('la fila calza con el encabezado', () => {
    expect(filaDeSolicitud(base)).toHaveLength(ENCABEZADOS.length)
  })

  it('nombra a TODOS los encargados: un comité puede tener varios', () => {
    // Matrimonios tiene 4. Con uno solo, la fila señalaría a quien no fue.
    const fila = filaDeSolicitud(s({ encargados: ['Ana Rojas', 'Beto Mora'] }))
    expect(fila[ENCABEZADOS.indexOf('Encargado(s)')]).toBe('Ana Rojas, Beto Mora')
  })

  it('sin encargado deja la celda VACÍA, no un guion', () => {
    // Una celda vacía se filtra y se cuenta; un guion es texto que hay que
    // acordarse de ignorar.
    expect(filaDeSolicitud(s({ encargados: [] }))[1]).toBe('')
  })

  it('se ordena por comité y dentro por puesto', async () => {
    const { filas } = await abrir([
      s({ comite: 'Zeta', puesto: 'B' }),
      s({ comite: 'Alfa', puesto: 'Z' }),
      s({ comite: 'Alfa', puesto: 'A' }),
    ])
    expect(filas.slice(1, 4).map(f => `${f[0]}/${f[2]}`))
      .toEqual(['Alfa/A', 'Alfa/Z', 'Zeta/B'])
  })

  it('cierra con el TOTAL de cupos', async () => {
    // «Cuántos cupos salen» es la pregunta del mes, y sumarla a mano sobre 40
    // filas es la clase de cuenta que sale mal una vez al año.
    const { filas } = await abrir([s({ cupos: 3 }), s({ cupos: 4, puesto: 'Otro' })])
    const ultima = filas[filas.length - 1]
    expect(ultima[0]).toBe('TOTAL')
    expect(ultima[3]).toBe('7')
  })

  it('sin solicitudes: encabezado y ni siquiera un total falso', async () => {
    const { filas } = await abrir([])
    expect(filas).toHaveLength(1)
  })

  it('trae filtro y congela los títulos', async () => {
    const { hoja } = await abrir([base])
    expect(hoja.autoFilter).toBeTruthy()
    expect(hoja.views?.[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
  })
})
