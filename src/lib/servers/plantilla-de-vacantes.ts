import ExcelJS from 'exceljs'

/**
 * La PLANTILLA de importación de vacantes, armada aparte de la ruta.
 *
 * Vive acá y no dentro del handler por una razón práctica: así se puede generar
 * el archivo en un test y ABRIRLO para comprobar que las validaciones quedaron
 * donde tienen que quedar. Dentro de la ruta no se podía —`requireRoles` pide
 * contexto de request— y lo único verificable era que el código compilara, que
 * de un .xlsx no dice nada.
 *
 * Recibe los datos ya leídos; no habla con la base.
 */

export type DatosDeLaPlantilla = {
  areas: Array<{ id: string; name: string }>
  committees: Array<{ id: string; name: string; parent_id: string | null }>
  positions: Array<{ id: string; title: string; area_id: string }>
  /** Nombres de las sedes activas, para la columna de ubicación. */
  sedes: string[]
}

export const MAX_ROWS = 1000

/** Nombre válido para rango nombrado de Excel: letras (con tildes), números y "_".
 *  En la fórmula INDIRECT se reproduce con SUBSTITUTE de espacio y punto, que son
 *  los únicos separadores presentes en los nombres de áreas/comités de Theos. */
const sanitize = (s: string) =>
  (s ?? '').normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '')

export async function construirPlantillaDeVacantes(
  { areas, committees, positions, sedes }: DatosDeLaPlantilla,
): Promise<ArrayBuffer> {
  const commByArea = new Map<string, string[]>() // areaId → committee names
  for (const c of committees) {
    if (!c.parent_id) continue
    if (!commByArea.has(c.parent_id)) commByArea.set(c.parent_id, [])
    commByArea.get(c.parent_id)!.push(c.name)
  }
  const posByComm = new Map<string, string[]>() // committeeId → position titles
  for (const p of positions) {
    if (!posByComm.has(p.area_id)) posByComm.set(p.area_id, [])
    posByComm.get(p.area_id)!.push(p.title)
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Theos Admin'

  // ── Hoja de datos (entrada) ──────────────────────────────────────────────
  const ws = wb.addWorksheet('Vacantes')
  ws.columns = [
    { header: 'Área', key: 'area', width: 24 },
    { header: 'Comité', key: 'committee', width: 28 },
    { header: 'Puesto', key: 'position', width: 32 },
    { header: 'Cupos', key: 'slots', width: 10 },
    { header: 'Ubicación / Sede', key: 'location', width: 26 },
    { header: 'Horario', key: 'schedule', width: 24 },
    { header: 'Compromiso', key: 'commitment', width: 22 },
    { header: 'Fecha de expiración', key: 'expires_at', width: 18 },
    { header: 'Destacado', key: 'featured', width: 12 },
  ]
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161440' } }
  headerRow.alignment = { vertical: 'middle' }
  headerRow.height = 22
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // ── Hoja oculta de listas ────────────────────────────────────────────────
  // (Header en fila 1, datos desde la fila 2; escritura explícita por celda
  //  porque column.values es 1-based y desplazaría los datos.)
  const lists = wb.addWorksheet('_listas', { state: 'veryHidden' })
  const fillCol = (colNum: number, header: string, items: string[]) => {
    lists.getRow(1).getCell(colNum).value = header
    const used = items.length ? items : ['']
    used.forEach((v, i) => { lists.getRow(i + 2).getCell(colNum).value = v })
    const letter = lists.getColumn(colNum).letter
    return `_listas!$${letter}$2:$${letter}$${1 + used.length}`
  }

  // Col A: áreas.
  const areaRange = fillCol(1, 'AREAS', areas.map(a => a.name))
  if (areas.length > 0) wb.definedNames.add(areaRange, 'AREAS_LIST')

  let col = 2
  // Una columna por área con sus comités → rango nombrado AR_<área>.
  for (const a of areas) {
    const names = (commByArea.get(a.id) ?? []).slice().sort((x, y) => x.localeCompare(y))
    const range = fillCol(col, `AR_${a.name}`, names)
    wb.definedNames.add(range, `AR_${sanitize(a.name)}`)
    col++
  }
  // Una columna por comité con sus puestos → rango nombrado CO_<comité>.
  for (const c of committees) {
    const titles = (posByComm.get(c.id) ?? []).slice().sort((x, y) => x.localeCompare(y))
    const range = fillCol(col, `CO_${c.name}`, titles)
    wb.definedNames.add(range, `CO_${sanitize(c.name)}`)
    col++
  }
  // Las sedes, para la columna de ubicación. No dependen de nada, así que van
  // en una lista plana.
  const sedeRange = fillCol(col, 'SEDES', sedes)
  if (sedes.length > 0) wb.definedNames.add(sedeRange, 'SEDES_LIST')
  col++

  // ── Validaciones (dropdowns dependientes) en las filas 2..MAX_ROWS ────────
  for (let r = 2; r <= MAX_ROWS; r++) {
    ws.getCell(`A${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: ['=AREAS_LIST'],
    }
    ws.getCell(`B${r}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [`=INDIRECT("AR_"&SUBSTITUTE(SUBSTITUTE($A${r}," ","_"),".","_"))`],
    }
    ws.getCell(`C${r}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [`=INDIRECT("CO_"&SUBSTITUTE(SUBSTITUTE($B${r}," ","_"),".","_"))`],
    }
    /**
     * UBICACIÓN / SEDE · la lista SUGIERE, no obliga.
     *
     * El campo es texto libre —en el formulario de vacantes dice «Sede / lugar
     * (opcional)»—, así que además de una sede puede llevar un lugar puntual y
     * un desplegable cerrado ahí estorbaría.
     *
     * OJO, Y ESTO VALE PARA TODA LA PLANTILLA: **ninguna** de estas
     * validaciones es estricta hoy, tampoco las de Área, Comité y Puesto. Lo
     * comprobé abriendo el .xlsx generado y leyendo el XML (2026-09-25):
     * ExcelJS escribe solo `type`, `allowBlank` y `sqref`, y el atributo
     * `showErrorMessage` NO lo escribe nunca. Sin él, Excel toma el valor por
     * defecto —falso— y deja escribir cualquier cosa en las cinco columnas.
     *
     * O sea que este `showErrorMessage: false` no cambia el archivo. Queda
     * porque declara la intención, y porque si algún día ExcelJS empezara a
     * escribirlo, esta columna tiene que seguir siendo la libre. Lo que hoy
     * impide importar un comité que no existe NO es la plantilla: es la
     * validación del importador.
     */
    if (sedes.length > 0) {
      ws.getCell(`E${r}`).dataValidation = {
        type: 'list', allowBlank: true, showErrorMessage: false,
        formulae: ['=SEDES_LIST'],
      }
    }
    ws.getCell(`I${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: ['"Sí,No"'],
    }
  }

  return await wb.xlsx.writeBuffer() as ArrayBuffer
}
