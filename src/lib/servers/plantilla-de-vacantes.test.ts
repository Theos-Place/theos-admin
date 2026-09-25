import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { construirPlantillaDeVacantes, MAX_ROWS } from './plantilla-de-vacantes'

const DATOS = {
  areas: [{ id: 'a1', name: 'Conexión' }, { id: 'a2', name: 'Alabanza y Adoración' }],
  committees: [
    { id: 'c1', name: 'Bienvenida', parent_id: 'a1' },
    { id: 'c2', name: 'Sonido', parent_id: 'a2' },
  ],
  positions: [
    { id: 'p1', title: 'Anfitrión', area_id: 'c1' },
    { id: 'p2', title: 'Operador de consola', area_id: 'c2' },
  ],
  sedes: ['Sede Alajuela', 'Sede Cartago', 'Sede Pedregal Jueves'],
}

/** Se genera el archivo DE VERDAD y se abre: de un .xlsx, que el código
 *  compile no dice absolutamente nada. */
async function abrirPlantilla(datos = DATOS) {
  const buf = await construirPlantillaDeVacantes(datos)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as ArrayBuffer)
  return wb
}

describe('la plantilla de vacantes', () => {
  it('tiene las columnas esperadas, con la ubicación en la E', () => {
    // La letra importa: las validaciones se ponen por celda.
    return abrirPlantilla().then(wb => {
      const fila = wb.getWorksheet('Vacantes')!.getRow(1)
      expect(fila.getCell('A').value).toBe('Área')
      expect(fila.getCell('B').value).toBe('Comité')
      expect(fila.getCell('C').value).toBe('Puesto')
      expect(fila.getCell('E').value).toBe('Ubicación / Sede')
    })
  })

  it('ofrece las sedes en un desplegable', async () => {
    const ws = (await abrirPlantilla()).getWorksheet('Vacantes')!
    const dv = ws.getCell('E2').dataValidation
    expect(dv?.type).toBe('list')
    expect(dv?.formulae).toEqual(['=SEDES_LIST'])
  })

  it('y el rango con las sedes existe de verdad en el archivo', async () => {
    // Sin el rango nombrado, `=SEDES_LIST` es una referencia rota y Excel
    // muestra un desplegable vacío — que se ve igual de bien en el código.
    const buf = await construirPlantillaDeVacantes(DATOS)
    const zip = await JSZip.loadAsync(buf as ArrayBuffer)
    const wbXml = await zip.file('xl/workbook.xml')!.async('string')
    expect(wbXml).toContain('SEDES_LIST')
  })

  it('NINGUNA validación rechaza lo que se escriba — tampoco las otras', async () => {
    /**
     * Lo verifiqué abriendo el .xlsx y leyendo el XML, y me corrigió: yo creía
     * que Área, Comité y Puesto eran estrictos. No lo son. ExcelJS escribe
     * solo `type`, `allowBlank` y `sqref`; `showErrorMessage` NO lo escribe
     * nunca, y sin ese atributo Excel toma el valor por defecto —falso— y deja
     * escribir cualquier cosa.
     *
     * Para la ubicación eso es justo lo que se quiere. Para las otras tres es
     * un dato a tener presente: lo que impide importar un comité inexistente
     * NO es la plantilla, es la validación del importador.
     */
    const buf = await construirPlantillaDeVacantes(DATOS)
    const zip = await JSZip.loadAsync(buf as ArrayBuffer)
    const xml = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    expect(xml).toContain('<dataValidation')
    expect(xml).not.toContain('showErrorMessage')
  })

  it('el comité y el puesto siguen dependiendo de lo de al lado', async () => {
    const ws = (await abrirPlantilla()).getWorksheet('Vacantes')!
    expect(String(ws.getCell('B5').dataValidation?.formulae?.[0])).toContain('$A5')
    expect(String(ws.getCell('C5').dataValidation?.formulae?.[0])).toContain('$B5')
  })

  it('las sedes van completas en la hoja de listas', async () => {
    const listas = (await abrirPlantilla()).getWorksheet('_listas')!
    const encabezados: string[] = []
    listas.getRow(1).eachCell(c => encabezados.push(String(c.value)))
    const col = encabezados.indexOf('SEDES') + 1
    expect(col).toBeGreaterThan(0)
    const leidas = DATOS.sedes.map((_, i) => listas.getRow(i + 2).getCell(col).value)
    expect(leidas).toEqual(DATOS.sedes)
  })

  it('la validación llega hasta la última fila, no solo a la primera', async () => {
    const ws = (await abrirPlantilla()).getWorksheet('Vacantes')!
    expect(ws.getCell(`E${MAX_ROWS}`).dataValidation?.type).toBe('list')
  })

  it('sin sedes no pone una lista vacía', async () => {
    // Un desplegable sin opciones no ayuda: bloquea la celda y no ofrece nada.
    const ws = (await abrirPlantilla({ ...DATOS, sedes: [] })).getWorksheet('Vacantes')!
    expect(ws.getCell('E2').dataValidation).toBeUndefined()
  })

  it('la hoja de listas va oculta', async () => {
    expect((await abrirPlantilla()).getWorksheet('_listas')!.state).toBe('veryHidden')
  })
})
