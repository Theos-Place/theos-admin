import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { construirExcelDeDirigentes, type DirigenteParaExcel } from './export-de-dirigentes'

const d = (o: Partial<DirigenteParaExcel> & { nombre: string }): DirigenteParaExcel => ({
  sede: 'Sede Liberia', estadoBase: 'activo', disponibilidad: 'disponible',
  razonNoDisponible: null, razonInactivo: null, dirigiendo: false,
  detalleNoEjerce: null, formacion: [], ...o,
})

/** Lee el .xlsx de vuelta: probar el buffer a ojo no prueba nada. */
async function leer(buf: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const hoja = wb.getWorksheet('Dirigentes')!
  const filas: string[][] = []
  hoja.eachRow(r => filas.push(
    (r.values as unknown[]).slice(1).map(v => (v == null ? '' : String(v)))))
  return filas
}

describe('export de dirigentes', () => {
  it('escribe las razones con su etiqueta, no con el código', () => {
    // El archivo lo abre quien reparte grupos, no quien escribió el enum.
    return construirExcelDeDirigentes([
      d({ nombre: 'Ana', disponibilidad: 'no_disponible', razonNoDisponible: 'pasantia' }),
    ]).then(async buf => {
      const [, ana] = await leer(buf)
      expect(ana).toContain('En pasantía')
      expect(ana).not.toContain('pasantia')
    })
  })

  it('marca «dirigiendo» aunque la ficha diga disponible', async () => {
    const buf = await construirExcelDeDirigentes([d({ nombre: 'Ana', dirigiendo: true })])
    const [cab, ana] = await leer(buf)
    expect(ana[cab.indexOf('Dirigiendo ahora')]).toBe('Sí')
  })

  it('los que se pueden asignar van primero', async () => {
    // El archivo se abre para buscar a quién darle un grupo.
    const buf = await construirExcelDeDirigentes([
      d({ nombre: 'Zulema', estadoBase: 'inactivo', disponibilidad: null }),
      d({ nombre: 'Berta', dirigiendo: true }),
      d({ nombre: 'Ana' }),
    ])
    const filas = await leer(buf)
    expect(filas.slice(1).map(f => f[0])).toEqual(['Ana', 'Berta', 'Zulema'])
  })

  it('sin sede deja la celda vacía y no inventa una etiqueta', async () => {
    // «Sin sede» se ordenaría entre las sedes reales y el filtro de vacíos
    // de Excel ya existe.
    const buf = await construirExcelDeDirigentes([d({ nombre: 'Ana', sede: null })])
    const [cab, ana] = await leer(buf)
    expect(ana[cab.indexOf('Sede')]).toBe('')
  })

  it('la formación va ordenada, para poder comparar dos filas a ojo', async () => {
    const buf = await construirExcelDeDirigentes([
      d({ nombre: 'Ana', formacion: ['SCJ', 'N1', 'PAN'] }),
    ])
    const [cab, ana] = await leer(buf)
    expect(ana[cab.indexOf('Formación')]).toBe('N1, PAN, SCJ')
  })
})
