import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getAuthContext } from '@/lib/auth/guard'
import { formViewerScope } from '@/lib/auth/forms-scope'
import {
  getFormResponses, getFormById, hasFormAccessGrant,
} from '@/lib/supabase/queries/forms'
import { isManagerOfFormEvent } from '@/lib/supabase/queries/events'
import {
  excelCellKind, excelNumFmt, isDataField, columnWidthFor, answerToCell, xlsxFileName,
} from '@/lib/forms/xlsx-export'

// FRM-3 · GET: las respuestas del formulario en .xlsx.
//
// Va como ruta y no en el cliente como el CSV porque ExcelJS pesa demasiado para
// meterlo en el bundle de una pantalla. El GATE es el MISMO del CSV: formViewerScope
// (módulo formularios, acceso puntual por form_access_grants, o encargado del
// evento del formulario) — el CSV se genera sobre datos que ya pasaron por ahí,
// así que acá se repite el chequeo en vez de heredarlo.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // El origen real de la request: el link del adjunto tiene que apuntar a
    // este mismo despliegue y no a una constante (Preview y producción son
    // dominios distintos).
    const origin = new URL(req.url).origin
    const { id } = await params
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const scope = formViewerScope({
      roles: ctx.roles,
      memberId: ctx.memberId,
      form: { id },
      hasGrant: await hasFormAccessGrant(id, ctx.memberId),
      isEventManager: await isManagerOfFormEvent(id, ctx.memberId),
    })
    if (scope === 'none') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const [form, responses] = await Promise.all([getFormById(id), getFormResponses(id)])
    if (!form) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })

    const campos = (form.fields ?? []).filter(f => isDataField(f.field_type))

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Theos Admin'
    const ws = wb.addWorksheet('Respuestas')

    // Contexto primero, respuestas después: es el orden en que uno lee una fila.
    const CONTEXTO = [
      { header: 'Quién respondió', width: 28 },
      // FRM-4: vacío en el caso normal. Con valor = la digitó el staff, no la
      // propia persona. Va junto al nombre para que nadie las confunda.
      { header: 'Registrada por', width: 24 },
      { header: 'Fecha', width: 14 },
    ]
    ws.columns = [
      ...CONTEXTO.map(c => ({ header: c.header, width: c.width })),
      ...campos.map(f => ({ header: f.label, width: columnWidthFor(f.label) })),
    ]

    // Encabezado: negrita sobre el navy de la marca, congelado y con autofiltro.
    const head = ws.getRow(1)
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161440' } }
    head.alignment = { vertical: 'middle', wrapText: true }
    head.height = 30
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } }

    // El formato de columna se declara ANTES de escribir: es lo que evita que
    // Excel reinterprete una cédula o un teléfono (ver xlsx-export.ts).
    campos.forEach((f, i) => {
      const fmt = excelNumFmt(excelCellKind(f.field_type))
      if (fmt) ws.getColumn(CONTEXTO.length + 1 + i).numFmt = fmt
    })
    ws.getColumn(1).numFmt = '@'          // el nombre, texto
    ws.getColumn(2).numFmt = '@'          // quién la registró, texto
    ws.getColumn(3).numFmt = 'dd/mm/yyyy' // la fecha, fecha real

    for (const r of responses) {
      // Las respuestas vienen como lista de valores, no como objeto por campo.
      const porCampo = new Map<string, unknown>()
      for (const v of r.values ?? []) {
        porCampo.set(v.field_id, v.value_text ?? v.value_json ?? null)
      }
      const nombre = r.member
        ? `${r.member.first_name ?? ''} ${r.member.last_name ?? ''}`.trim()
        : (r.guest_name ?? '')
      const digitador = r.recorder
        ? `${r.recorder.first_name ?? ''} ${r.recorder.last_name ?? ''}`.trim()
        : ''
      const fila: Array<string | number | Date | null> = [
        // Un formulario anónimo no trae nombre: se dice, no se deja en blanco.
        nombre || 'Anónimo',
        digitador || null,
        r.submitted_at ? new Date(r.submitted_at) : null,
        ...campos.map(f => answerToCell(porCampo.get(f.id), excelCellKind(f.field_type), origin)),
      ]
      ws.addRow(fila)
    }

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${xlsxFileName(form.title)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/forms/[id]/responses/export:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
