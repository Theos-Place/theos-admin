import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getAuthContext } from '@/lib/auth/guard'
import { formViewerScope } from '@/lib/auth/forms-scope'
import { bloqueoPorReserva } from '@/lib/forms/formularios-reservados'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getFormResponses, getFormById, hasFormAccessGrant, getFichasPersonalesParaExport,
} from '@/lib/supabase/queries/forms'
import { isManagerOfFormEvent } from '@/lib/supabase/queries/events'
import { excelNumFmt, xlsxFileName } from '@/lib/forms/xlsx-export'
import { puedeExportarDatosPersonales } from '@/lib/auth/datos-personales-en-export'
import {
  columnasDelExport, filaDeRespuesta, celdaComoTexto, camposConDatos, hayGrupo,
  type RespuestaParaExport,
} from '@/lib/forms/filas-del-export'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'

/**
 * FRM-3 · GET: las respuestas del formulario, en .xlsx o en .csv.
 *
 * LOS DOS FORMATOS SALEN DE ACÁ (FRM-6b). El CSV se armaba en la pantalla y el
 * XLSX en esta ruta, y se separaron tres veces —columnas de más, el path del
 * adjunto en vez del link, y las columnas de la ficha de FRM-6 que el CSV
 * nunca recibió—. Ahora los dos piden las mismas columnas y las mismas filas a
 * `lib/forms/filas-del-export`, y lo único que cambia es cómo se escribe la
 * celda.
 *
 * Va como ruta y no en el cliente porque ExcelJS no cabe en el bundle de una
 * pantalla; el CSV se viene con él para que no haya dos caminos.
 *
 * GATE: `formViewerScope` (módulo formularios, acceso puntual por
 * `form_access_grants`, o encargado del evento del formulario).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // El origen real de la request: el link del adjunto tiene que apuntar a
    // este mismo despliegue (Preview y producción son dominios distintos).
    const url = new URL(req.url)
    const origin = url.origin
    const { id } = await params
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // RET-1 · La misma reserva que tenía el CSV: cerrar la tabla y dejar el
    // archivo abierto es no cerrar nada.
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
     * ?personales=1 suma las columnas de la FICHA de cada persona (FRM-6).
     *
     * El gate es aparte del de ver respuestas: acá salen cédulas, fechas de
     * nacimiento y alergias —datos de salud—. Desde el 2026-10-07 entra, además
     * del camino del padrón, quien tiene derecho a bajar las respuestas de ESTE
     * formulario; las fichas que salen son las de quienes lo respondieron y de
     * nadie más. El detalle está en `datos-personales-en-export`.
     *
     * Se RECHAZA con 403 en vez de devolver el archivo sin las columnas: si
     * alguien pidió los datos personales, el archivo sin ellos se parece al
     * archivo con ellos y se manda a imprimir creyendo que está completo.
     */
    const pidePersonales = url.searchParams.get('personales') === '1'
    if (pidePersonales && !puedeExportarDatosPersonales({ roles: ctx.roles, scope })) {
      return NextResponse.json(
        { error: 'No tenés permiso para exportar datos personales.' },
        { status: 403 },
      )
    }
    const fichas = pidePersonales
      ? await getFichasPersonalesParaExport(
          responses.map(r => r.member_id).filter((x): x is string => !!x))
      : null

    /**
     * BAJAR DATOS PERSONALES QUEDA ESCRITO. Es lo que vuelve defendible haber
     * ampliado quién puede: ahora alcanza con tener un formulario compartido,
     * así que «¿quién se llevó las cédulas y las alergias de los del campa?»
     * tiene que poder contestarse. El export normal no se audita — ese no
     * lleva datos de salud.
     */
    if (fichas) {
      await logAudit({
        actorUserId: ctx.userId,
        action: 'EXPORT',
        entityType: 'form_personal_data',
        entityId: id,
        newData: {
          formulario: form.title,
          personas: fichas.size,
          alcance: scope,
          formato: url.searchParams.get('formato') === 'csv' ? 'csv' : 'xlsx',
        },
      })
    }

    const campos = camposConDatos((form.fields ?? []).map(f => ({
      id: f.id, field_type: f.field_type, label: f.label,
    })))
    const filas: RespuestaParaExport[] = responses.map(r => {
      const porCampo: Record<string, unknown> = {}
      for (const v of r.values ?? []) porCampo[v.field_id] = v.value_text ?? v.value_json ?? null
      return {
        member_id: r.member_id ?? null,
        member_name: r.member
          ? `${r.member.first_name ?? ''} ${r.member.last_name ?? ''}`.trim()
          : (r.guest_name ?? ''),
        member_phone: r.member?.phone ?? null,
        recorded_by_name: r.recorder
          ? `${r.recorder.first_name ?? ''} ${r.recorder.last_name ?? ''}`.trim()
          : '',
        submitted_at: r.submitted_at ?? null,
        grupo: r.grupo ?? null,
        dirigente: r.dirigente ?? null,
        answers: porCampo,
      }
    })

    const conGrupo = hayGrupo(filas)
    const columnas = columnasDelExport(campos, { conGrupo, conPersonales: !!fichas })
    const valores = filas.map(r => filaDeRespuesta(r, campos, {
      conGrupo,
      ficha: fichas ? (r.member_id ? fichas.get(r.member_id) ?? null : null) : undefined,
      origin,
    }))

    const base = xlsxFileName(form.title).replace(/\.xlsx$/, '')

    // ── CSV ───────────────────────────────────────────────────────────────
    if (url.searchParams.get('formato') === 'csv') {
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
      const texto = [
        columnas.map(c => esc(c.header)).join(','),
        ...valores.map(v => v.map(x => esc(celdaComoTexto(x))).join(',')),
      ].join('\n')
      // BOM: sin él, Excel abre el CSV en Latin-1 y las tildes salen rotas.
      return new NextResponse('\uFEFF' + texto, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${base}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    // ── XLSX ──────────────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Theos Admin'
    const ws = wb.addWorksheet('Respuestas')
    ws.columns = columnas.map(c => ({ header: c.header, width: c.width }))

    const head = ws.getRow(1)
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161440' } }
    head.alignment = { vertical: 'middle', wrapText: true }
    head.height = 30
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } }

    // El formato se declara ANTES de escribir: es lo que evita que Excel
    // reinterprete una cédula o un teléfono (ver xlsx-export.ts).
    columnas.forEach((c, i) => {
      const fmt = excelNumFmt(c.kind)
      if (fmt) ws.getColumn(i + 1).numFmt = fmt
    })
    for (const v of valores) ws.addRow(v)

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${base}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    reportarError('GET /api/forms/[id]/responses/export:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
