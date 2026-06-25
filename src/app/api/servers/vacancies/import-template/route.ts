import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireRoles } from '@/lib/auth/guard'
import { STAFF_IMPORT_ROLES } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'

// GET: plantilla .xlsx para importar vacantes, con los datos EN VIVO (áreas,
// comités y puestos del momento) y dropdowns dependientes en cascada
// Área → Comité → Puesto (validación de datos + rangos nombrados + INDIRECT).
// Solo admin + coordinación de staff (mismo permiso que importar — punto 6).

const MAX_ROWS = 1000

/** Nombre válido para rango nombrado de Excel: letras (con tildes), números y "_".
 *  En la fórmula INDIRECT se reproduce con SUBSTITUTE de espacio y punto, que son
 *  los únicos separadores presentes en los nombres de áreas/comités de Theos. */
const sanitize = (s: string) =>
  (s ?? '').normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '')

export async function GET() {
  const auth = await requireRoles(...STAFF_IMPORT_ROLES)
  if (auth.res) return auth.res
  try {
    const supabase = createAdminClient()
    const [{ data: areasData }, { data: commData }, { data: posData }] = await Promise.all([
      supabase.from('areas').select('id, name').eq('area_type', 'area').eq('is_active', true).order('name'),
      supabase.from('areas').select('id, name, parent_id').eq('area_type', 'committee').eq('is_active', true).order('name'),
      supabase.from('service_positions').select('id, title, area_id').eq('is_active', true).order('title'),
    ])

    const areas = (areasData ?? []) as Array<{ id: string; name: string }>
    const committees = (commData ?? []) as Array<{ id: string; name: string; parent_id: string | null }>
    const positions = (posData ?? []) as Array<{ id: string; title: string; area_id: string }>

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
      ws.getCell(`I${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: ['"Sí,No"'],
      }
    }

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="plantilla-vacantes.xlsx"',
      },
    })
  } catch (error) {
    console.error('GET /api/servers/vacancies/import-template:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
