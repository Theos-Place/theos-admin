import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireRoles } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'

// GET: plantilla .xlsx para importar grupos de estudio (EST-2), con dropdowns
// de planes (códigos vivos) y zonas del catálogo. Mismo guard que importar.

const MAX_ROWS = 500
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export async function GET() {
  const auth = await requireRoles(...STUDY_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const supabase = createAdminClient()
    const [{ data: plansData }, { data: sedesData }] = await Promise.all([
      supabase.from('study_plans').select('code').eq('is_active', true).not('code', 'is', null).order('code'),
      supabase.from('sedes').select('name').eq('is_active', true).order('name'),
    ])
    const planCodes = ((plansData ?? []) as Array<{ code: string }>).map(p => p.code)
    const zonas = ((sedesData ?? []) as Array<{ name: string | null }>).map(s => s.name).filter((n): n is string => !!n)

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Theos Admin'
    const ws = wb.addWorksheet('Grupos')
    ws.columns = [
      { header: 'Plan (código)', key: 'plan', width: 14 },
      { header: 'Zona / Sede', key: 'zona', width: 22 },
      { header: 'Día', key: 'dia', width: 14 },
      { header: 'Horario', key: 'horario', width: 12 },
      { header: 'Fecha inicio', key: 'fecha_inicio', width: 14 },
      { header: 'Fecha fin', key: 'fecha_fin', width: 14 },
      { header: 'Cupo', key: 'cupo', width: 8 },
      { header: 'Cédula del dirigente', key: 'cedula_dirigente', width: 20 },
      { header: 'Inicio de matrícula', key: 'inicio_matricula', width: 17 },
      { header: 'Fin de matrícula', key: 'fin_matricula', width: 16 },
    ]
    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161440' } }
    headerRow.alignment = { vertical: 'middle' }
    headerRow.height = 22
    ws.views = [{ state: 'frozen', ySplit: 1 }]

    // Hoja oculta de listas para los dropdowns.
    const lists = wb.addWorksheet('_listas', { state: 'veryHidden' })
    const fillCol = (colNum: number, header: string, items: string[]) => {
      lists.getRow(1).getCell(colNum).value = header
      const used = items.length ? items : ['']
      used.forEach((v, i) => { lists.getRow(i + 2).getCell(colNum).value = v })
      const letter = lists.getColumn(colNum).letter
      return `_listas!$${letter}$2:$${letter}$${1 + used.length}`
    }
    const planRange = fillCol(1, 'PLANES', planCodes)
    const zonaRange = fillCol(2, 'ZONAS', zonas)

    for (let r = 2; r <= MAX_ROWS; r++) {
      ws.getCell(`A${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`=${planRange}`] }
      ws.getCell(`B${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`=${zonaRange}`] }
      ws.getCell(`C${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${DIAS.join(',')}"`] }
    }

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="plantilla-grupos.xlsx"',
      },
    })
  } catch (error) {
    console.error('GET /api/studies/groups/import-template:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
