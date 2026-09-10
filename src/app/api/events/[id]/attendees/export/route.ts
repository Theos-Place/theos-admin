import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireEventAccess } from '@/lib/auth/event-guard'
import { getEventById } from '@/lib/supabase/queries/events'
import { createAdminClient } from '@/lib/supabase/admin'
import { filasDeAsistentes, resumenDeCocina, type PersonaDelEvento } from '@/lib/events/export-asistentes'
import { xlsxFileName } from '@/lib/forms/xlsx-export'

// EVE-9 · GET: los asistentes del evento en .xlsx, para cocina y logística.
//
// Va como ruta y no en el cliente por lo mismo que el export de formularios:
// ExcelJS no cabe en el bundle de una pantalla.
//
// GATE: requireEventAccess — administra eventos o es encargado DE ESTE evento.
// La hoja lleva alergias, que son datos de salud: no sale con una sesión
// cualquiera, aunque la información general del evento sí sea pública adentro.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const acceso = await requireEventAccess(id)
    if (acceso.res) return acceso.res

    const event = await getEventById(id)
    if (!event) return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })

    const inscripciones = (event.registrations ?? []).map(r => ({
      member_id: r.member_id,
      payment_status: r.payment_status ?? null,
      registered_at: r.registered_at ?? null,
    }))
    const checkins = (event.checkins ?? []).map(c => ({
      id: c.id,
      member_id: c.member_id ?? null,
      guest_name: (c as { guest_name?: string | null }).guest_name ?? null,
      checked_in_at: c.checked_in_at ?? null,
      checked_in_as: (c as { checked_in_as?: string | null }).checked_in_as ?? null,
      sub_event_id: c.sub_event_id ?? null,
    }))

    // Las fichas se traen acá y no en el SELECT del evento: alergias y
    // restricción alimenticia son datos de salud, y no tienen por qué viajar en
    // cada GET del evento solo para que existan cuando alguien exporte.
    const ids = [...new Set(
      [...inscripciones, ...checkins].map(x => x.member_id).filter((v): v is string => !!v),
    )]
    const personas: PersonaDelEvento[] = []
    const supabase = createAdminClient()
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name, cedula, phone, email, allergies, dietary_restrictions')
        .in('id', ids.slice(i, i + 200))
      if (error) throw error
      for (const m of (data ?? []) as Record<string, unknown>[]) {
        personas.push({
          member_id: m.id as string,
          first_name: (m.first_name as string) ?? null,
          last_name: (m.last_name as string) ?? null,
          cedula: (m.cedula as string) ?? null,
          phone: (m.phone as string) ?? null,
          email: (m.email as string) ?? null,
          allergies: (m.allergies as string) ?? null,
          dietary_restrictions: (m.dietary_restrictions as string[]) ?? null,
        })
      }
    }

    const subEventos = new Map(
      (event.sub_events ?? []).map(s => [s.id, s.name] as [string, string]),
    )
    const filas = filasDeAsistentes({
      personas, inscripciones, checkins, subEventos,
      usaInscripcion: !!event.requires_registration,
    })
    const cocina = resumenDeCocina(filas)

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Theos Admin'
    const ws = wb.addWorksheet('Asistentes')

    const COLUMNAS: Array<{ header: string; width: number; key: keyof (typeof filas)[number] }> = [
      { header: 'Nombre', width: 30, key: 'nombre' },
      { header: 'Cédula', width: 14, key: 'cedula' },
      { header: 'Teléfono', width: 14, key: 'telefono' },
      { header: 'Correo', width: 30, key: 'correo' },
      { header: 'Estado', width: 18, key: 'estado' },
      { header: 'Participante o servidor', width: 20, key: 'participante_o_servidor' },
      { header: 'Sub-evento', width: 22, key: 'sub_evento' },
      { header: 'Hora de llegada', width: 18, key: 'hora_de_llegada' },
      { header: 'Pago', width: 14, key: 'pago' },
      { header: 'Alergias', width: 34, key: 'alergias' },
      { header: 'Restricción alimenticia', width: 30, key: 'restriccion_alimenticia' },
    ]
    ws.columns = COLUMNAS.map(c => ({ header: c.header, width: c.width }))

    const head = ws.getRow(1)
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161440' } }
    head.alignment = { vertical: 'middle', wrapText: true }
    head.height = 30
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNAS.length } }

    // Cédula y teléfono como TEXTO: si no, Excel se come el cero de adelante y
    // convierte la cédula en un número.
    ws.getColumn(2).numFmt = '@'
    ws.getColumn(3).numFmt = '@'
    ws.getColumn(8).numFmt = 'dd/mm/yyyy hh:mm'

    for (const f of filas) ws.addRow(COLUMNAS.map(c => f[c.key]))

    // Las dos columnas de cocina, resaltadas donde HAY algo que atender: la
    // lista se imprime y se lee de un vistazo, no se filtra en Excel.
    filas.forEach((f, i) => {
      const fila = ws.getRow(i + 2)
      for (const col of [10, 11]) {
        const celda = fila.getCell(col)
        if (celda.value !== '—') {
          celda.font = { bold: true, color: { argb: 'FFB4453C' } }
        }
      }
    })

    // Resumen al final: cuántas personas necesitan algo distinto.
    ws.addRow([])
    ws.addRow([`${filas.length} personas · ${cocina.conAlergia} con alergia · ${cocina.conRestriccion} con restricción alimenticia`])
      .font = { italic: true }

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${xlsxFileName(`Asistentes ${event.title ?? 'evento'}`)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/events/[id]/attendees/export:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
