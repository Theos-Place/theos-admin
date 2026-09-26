import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import {
  construirExcelDeDisponibilidad, encabezados, filaDeDirigente,
  type DirigenteParaExportar,
} from './export-de-disponibilidad'

const AHORA = new Date('2026-09-25T12:00:00Z')

const base: DirigenteParaExportar = {
  member_id: 'm1', nombre: 'Ana Rojas', correo: 'ana@x.cr', telefono: '8888',
  is_active: true, availability_status: 'available',
  formacion: ['N1', 'N2'], disponible: ['N1'], interesado: ['DIS1'],
  zonas: ['SCJ'], slots: ['L-mañana', 'X-noche'],
  presta_casa: true, suplente: false,
  desde: null, hasta: null, folletos: 'Sede Escazú',
  confirmado_at: '2026-09-01T00:00:00Z',
}
const persona = (p: Partial<DirigenteParaExportar>): DirigenteParaExportar => ({ ...base, ...p })

/** Abre el .xlsx de verdad: de un archivo generado, que el código compile no
 *  dice nada — es la lección de la plantilla de vacantes. */
async function abrir(gente: DirigenteParaExportar[]) {
  const buf = await construirExcelDeDisponibilidad(gente, AHORA)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const hoja = wb.getWorksheet('Disponibilidad')!
  const filas: string[][] = []
  hoja.eachRow(r => filas.push((r.values as unknown[]).slice(1).map(v => String(v ?? ''))))
  return { wb, hoja, filas }
}

describe('el encabezado', () => {
  it('trae una columna POR FRANJA, no una celda con todo junto', () => {
    // 21 columnas se ve ancho, pero es lo que hace que el archivo se pueda
    // FILTRAR: «¿quién puede los martes en la noche?» no se contesta leyendo
    // una celda que dice «L-mañana, X-noche, V-tarde».
    const h = encabezados()
    expect(h).toContain('Martes noche')
    expect(h).toContain('Domingo mañana')
    expect(h.filter(c => /mañana|tarde|noche/.test(c))).toHaveLength(21)
  })

  it('la fila calza con el encabezado, columna por columna', () => {
    expect(filaDeDirigente(base, AHORA)).toHaveLength(encabezados().length)
  })
})

describe('el archivo se abre y dice lo que tiene que decir', () => {
  it('marca solo las franjas que la persona eligió', async () => {
    const { filas } = await abrir([base])
    const h = encabezados()
    const fila = filas[1]
    expect(fila[h.indexOf('Lunes mañana')]).toBe('Sí')
    expect(fila[h.indexOf('Miércoles noche')]).toBe('Sí')
    expect(fila[h.indexOf('Lunes noche')]).toBe('')
  })

  it('separa «quiere dar» de «quiere aprender»', async () => {
    // Si se leyeran en la misma columna, alguien terminaría asignado a un
    // estudio para el que todavía no está capacitado.
    const { filas } = await abrir([base])
    const h = encabezados()
    expect(filas[1][h.indexOf('Quiere dar')]).toBe('N1')
    expect(filas[1][h.indexOf('Quiere aprender')]).toBe('DIS1')
    expect(filas[1][h.indexOf('Capacitado para')]).toBe('N1, N2')
  })

  it('los PENDIENTES van arriba: el archivo se abre para actuar', async () => {
    const { filas } = await abrir([
      persona({ nombre: 'Al día', confirmado_at: '2026-09-20T00:00:00Z' }),
      persona({ nombre: 'Nunca', confirmado_at: null }),
      persona({ nombre: 'Vieja', confirmado_at: '2026-01-01T00:00:00Z' }),
    ])
    expect(filas.slice(1).map(f => f[0])).toEqual(['Nunca', 'Vieja', 'Al día'])
  })

  it('la confirmación tiene TRES valores, no dos', async () => {
    const { filas } = await abrir([
      persona({ nombre: 'Nunca', confirmado_at: null }),
      persona({ nombre: 'Vieja', confirmado_at: '2026-01-01T00:00:00Z' }),
      persona({ nombre: 'Al día', confirmado_at: '2026-09-20T00:00:00Z' }),
    ])
    const col = encabezados().indexOf('Confirmación')
    expect(filas.slice(1).map(f => f[col]))
      .toEqual(['Nunca confirmó', 'Desactualizada', 'Al día'])
  })

  it('sin ventana declarada dice «Todo el año», no una celda vacía', async () => {
    const { filas } = await abrir([base])
    expect(filas[1][encabezados().indexOf('Ventana del año')]).toBe('Todo el año')
  })

  it('trae filtro y congela la fila de títulos y la primera columna', async () => {
    const { hoja } = await abrir([base])
    expect(hoja.autoFilter).toBeTruthy()
    // Con 36 columnas, al llegar al viernes ya no se sabe de quién es la fila.
    expect(hoja.views?.[0]).toMatchObject({ state: 'frozen', xSplit: 1, ySplit: 1 })
  })

  it('sin gente no revienta: encabezado y nada más', async () => {
    const { filas } = await abrir([])
    expect(filas).toHaveLength(1)
  })
})
