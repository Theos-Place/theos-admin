import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { construirExportDeEstructura } from './export-de-estructura'

const DATOS = {
  areas: [
    { id: 'a1', name: 'Conexión', description: 'Recibir y acompañar', encargados: ['Ana Mora'], is_active: true, ideal_capacity: 40 },
    { id: 'a2', name: 'Alabanza', description: null, encargados: [], is_active: false, ideal_capacity: null },
  ],
  comites: [
    { id: 'c1', name: 'Bienvenida', area: 'Conexión', description: 'Primera cara', encargados: ['Luis Paz', 'Sara Ruiz'], is_active: true, ideal_capacity: 20 },
    { id: 'c2', name: 'Sonido', area: 'Alabanza', description: null, encargados: [], is_active: true, ideal_capacity: null },
  ],
  puestos: [
    { id: 'p1', title: 'Anfitrión', comite: 'Bienvenida', area: 'Conexión', description: 'Recibe en la puerta', functions: 'Abrir, saludar', profile: 'Sonriente', requirements: 'Puntualidad', skills: 'Trato', study_requirement: 'N1', location: 'Sede Alajuela', quantity: 4, max_volunteers: 6, is_active: true, is_featured: true, expires_at: '2026-12-31', sirviendo: 3 },
    { id: 'p2', title: 'Operador', comite: 'Sonido', area: 'Alabanza', description: null, functions: null, profile: null, requirements: null, skills: null, study_requirement: null, location: null, quantity: null, max_volunteers: null, is_active: false, is_featured: false, expires_at: null, sirviendo: 0 },
  ],
}

const abrir = async (d = DATOS) => {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await construirExportDeEstructura(d) as ArrayBuffer)
  return wb
}

describe('el export de la estructura de servicio', () => {
  it('trae las tres hojas, con Puestos primero', async () => {
    // Puestos es la que se abre a mirar; las otras dos son el contexto.
    const wb = await abrir()
    expect(wb.worksheets.map(w => w.name)).toEqual(['Puestos', 'Comités', 'Áreas'])
  })

  it('cada puesto dice su área Y su comité', async () => {
    // Sin las dos no se puede agrupar, y un puesto puede colgar del área
    // directamente sin comité de por medio.
    const ws = (await abrir()).getWorksheet('Puestos')!
    expect(ws.getRow(2).getCell(1).value).toBe('Conexión')
    expect(ws.getRow(2).getCell(2).value).toBe('Bienvenida')
    expect(ws.getRow(2).getCell(3).value).toBe('Anfitrión')
  })

  it('las descripciones largas van completas y envuelven', async () => {
    // Es lo que se pidió: poder LEER las descripciones. Sin wrapText la
    // columna muestra una línea y el archivo no sirve para eso.
    const ws = (await abrir()).getWorksheet('Puestos')!
    expect(ws.getRow(2).getCell(5).value).toBe('Abrir, saludar')
    // Por número y no por `key`: la clave de columna es de ExcelJS en memoria,
    // no viaja en el archivo, y al releerlo `getColumn('functions')` revienta.
    expect(ws.getColumn(5).alignment?.wrapText).toBe(true)
  })

  it('los booleanos salen en palabras, no en TRUE/FALSE', async () => {
    // Un TRUE en una celda no se filtra ni se lee en español.
    const ws = (await abrir()).getWorksheet('Puestos')!
    expect(ws.getRow(2).getCell('N').value).toBe('Sí')
    expect(ws.getRow(3).getCell('N').value).toBe('No')
  })

  it('los vacíos quedan vacíos, no como "null"', async () => {
    const ws = (await abrir()).getWorksheet('Puestos')!
    for (const col of [4, 5, 6, 10]) {
      expect(ws.getRow(3).getCell(col).value ?? '', `col ${col}`).toBe('')
    }
  })

  it('los comités cuentan sus puestos y su gente', async () => {
    const ws = (await abrir()).getWorksheet('Comités')!
    const bienvenida = ws.getRow(2)
    expect(bienvenida.getCell('B').value).toBe('Bienvenida')
    expect(bienvenida.getCell('E').value).toBe(1)   // puestos
    expect(bienvenida.getCell('F').value).toBe(3)   // sirviendo hoy
    expect(bienvenida.getCell('D').value).toBe('Luis Paz · Sara Ruiz')
  })

  it('las áreas suman lo de sus comités', async () => {
    const ws = (await abrir()).getWorksheet('Áreas')!
    const conexion = ws.getRow(2)
    expect(conexion.getCell('D').value).toBe(1)  // comités
    expect(conexion.getCell('E').value).toBe(1)  // puestos
    expect(conexion.getCell('F').value).toBe(3)  // sirviendo
  })

  it('trae también lo INACTIVO, y la columna lo dice', async () => {
    // Un puesto retirado es justo lo que alguien viene a buscar cuando revisa
    // el catálogo para limpiarlo. Filtrarlo obligaría a pedir otro archivo.
    const ws = (await abrir()).getWorksheet('Puestos')!
    expect(ws.rowCount).toBe(3)
    expect(ws.getRow(3).getCell('C').value).toBe('Operador')
    expect(ws.getRow(3).getCell('N').value).toBe('No')
  })

  it('las tres hojas se pueden filtrar y tienen el encabezado fijo', async () => {
    // Con 355 puestos, sin autofiltro y sin congelar la fila 1 hay que volver
    // arriba para saber qué columna se está leyendo.
    for (const hoja of ['Puestos', 'Comités', 'Áreas']) {
      const ws = (await abrir()).getWorksheet(hoja)!
      expect(ws.autoFilter, hoja).toBeTruthy()
      expect(ws.views?.[0]?.state, hoja).toBe('frozen')
    }
  })

  it('no se cae con la estructura vacía', async () => {
    const wb = await abrir({ areas: [], comites: [], puestos: [] })
    expect(wb.getWorksheet('Puestos')!.rowCount).toBe(1)
  })
})
