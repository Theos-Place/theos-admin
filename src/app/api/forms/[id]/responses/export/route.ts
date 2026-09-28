import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getAuthContext } from '@/lib/auth/guard'
import { formViewerScope } from '@/lib/auth/forms-scope'
import { bloqueoPorReserva } from '@/lib/forms/formularios-reservados'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getFormResponses, getFormById, hasFormAccessGrant, getFichasPersonalesParaExport,
} from '@/lib/supabase/queries/forms'
import { puedeExportarDatosPersonales } from '@/lib/auth/datos-personales-en-export'
import { COLUMNAS_PERSONALES, celdasPersonales } from '@/lib/forms/datos-personales-del-export'
import { isManagerOfFormEvent } from '@/lib/supabase/queries/events'
import { encabezadoDeCampo } from '@/lib/forms/computed-fields'
import { formatPhoneCR } from '@/lib/phone'
import {
  excelCellKind, excelNumFmt, isDataField, columnWidthFor, answerToCell, xlsxFileName,
} from '@/lib/forms/xlsx-export'
import { reportarError } from '@/lib/observabilidad'

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

    // RET-1 · La misma reserva que el CSV: cerrar la tabla y dejar el Excel
    // abierto es no cerrar nada. Este endpoint tenía el gate idéntico y se
    // encontró censando TODAS las rutas que devuelven respuestas, que es lo que
    // el pedido exigía — de las cuatro, dos había que tocar.
    const { data: formTitulo } = await createAdminClient()
      .from('forms').select('title').eq('id', id).maybeSingle()
    const bloqueo = bloqueoPorReserva((formTitulo as { title: string } | null)?.title, ctx.roles)
    if (bloqueo) return NextResponse.json({ error: bloqueo }, { status: 403 })

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

    /**
     * FRM-6 · ?personales=1 suma las columnas de la FICHA de cada persona.
     *
     * El gate es aparte del de ver respuestas y es el del padrón: acá salen
     * cédulas, fechas de nacimiento y alergias —datos de salud— de todo el que
     * haya respondido. Quien tiene el formulario compartido por
     * `form_access_grants`, o es encargado del evento, puede leer las
     * respuestas sin tener nada que ver con el padrón.
     *
     * Se RECHAZA con 403 en vez de devolver el Excel sin las columnas: si
     * alguien pidió los datos personales, el archivo sin ellos parece el
     * archivo con ellos y se manda a imprimir creyendo que está completo.
     */
    const pidePersonales = new URL(req.url).searchParams.get('personales') === '1'
    if (pidePersonales && !puedeExportarDatosPersonales(ctx.roles)) {
      return NextResponse.json(
        { error: 'No tenés permiso para exportar datos personales del padrón.' },
        { status: 403 },
      )
    }
    const fichas = pidePersonales
      ? await getFichasPersonalesParaExport(
          // `member_id` de la respuesta y no `member.id`: el join solo trae
          // nombre y teléfono, y agregarle el id ahí lo pagaría cada GET de
          // respuestas para algo que solo usa este export.
          responses.map(r => r.member_id).filter((x): x is string => !!x))
      : null

    const campos = (form.fields ?? []).filter(f => isDataField(f.field_type))

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Theos Admin'
    const ws = wb.addWorksheet('Respuestas')

    // Contexto primero, respuestas después: es el orden en que uno lee una fila.
    const CONTEXTO = [
      { header: 'Quién respondió', width: 28 },
      // Del PERFIL, no de una pregunta: los encargados llaman a la gente y no
      // todos los formularios piden teléfono. Va pegado al nombre, que es como
      // se usa. Se titula "(perfil)" para que no se confunda con la columna de
      // una pregunta de teléfono, si el formulario tiene una.
      { header: 'Teléfono (perfil)', width: 16 },
      // FRM-4: vacío en el caso normal. Con valor = la digitó el staff, no la
      // propia persona. Va junto al nombre para que nadie las confunda.
      { header: 'Registrada por', width: 24 },
      { header: 'Fecha', width: 14 },
    ]
    ws.columns = [
      ...CONTEXTO.map(c => ({ header: c.header, width: c.width })),
      // encabezadoDeCampo y no f.label: los campos ocultos no exigen título,
      // pero su columna necesita nombre igual.
      ...campos.map(f => {
        const h = encabezadoDeCampo(f.field_type, f.label)
        return { header: h, width: columnWidthFor(h) }
      }),
      // Al FINAL y no junto al nombre: las preguntas del formulario son lo que
      // alguien vino a leer, y meterle diez columnas de padrón en el medio
      // empuja la primera pregunta fuera de la pantalla.
      ...(fichas ? COLUMNAS_PERSONALES.map(c => ({ header: c.header, width: c.width })) : []),
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
    ws.getColumn(2).numFmt = '@'          // el teléfono, texto (si no, Excel se lo come)
    ws.getColumn(3).numFmt = '@'          // quién la registró, texto
    ws.getColumn(4).numFmt = 'dd/mm/yyyy' // la fecha, fecha real
    if (fichas) {
      // Mismo cuidado que con las respuestas: la cédula va como TEXTO o Excel
      // le come el cero de adelante, y el nacimiento como fecha real para que
      // se pueda ordenar y filtrar por rango.
      const base = CONTEXTO.length + campos.length
      COLUMNAS_PERSONALES.forEach((c, i) => {
        ws.getColumn(base + 1 + i).numFmt = c.kind === 'date' ? 'dd/mm/yyyy' : '@'
      })
    }

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
        formatPhoneCR(r.member?.phone) || null,
        digitador || null,
        r.submitted_at ? new Date(r.submitted_at) : null,
        ...campos.map(f => answerToCell(porCampo.get(f.id), excelCellKind(f.field_type), origin)),
      ]
      if (fichas) {
        // Sin ficha —anónima, o sin miembro resoluble— las celdas van vacías y
        // la fila NO se omite: sus respuestas siguen valiendo.
        const ficha = r.member_id ? fichas.get(r.member_id) : null
        fila.push(...celdasPersonales(ficha, ficha?.conyuge ?? ''))
      }
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
    reportarError('GET /api/forms/[id]/responses/export:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
