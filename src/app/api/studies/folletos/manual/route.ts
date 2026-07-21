import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { ymdCR } from '@/lib/format'
import { createManualFolletoRequest, notifyFolletoRecipients } from '@/lib/supabase/queries/folletos'
import { STUDY_CATALOG } from '@/data/study-catalog'

const VALID_CODES = new Set(STUDY_CATALOG.map(s => s.code))

// POST: solicitud de folletos MANUAL (caso especial). Disponible para permiso
// folletos (rol folletos/admin) y coordinadores de estudios. Entra a la misma
// cola (tipo 'manual', estado 'creada') y dispara la misma notificación.
export async function POST(req: NextRequest) {
  const auth = await requireRoles('folletos', 'admin', 'coordinador_estudios', 'coordinador_dirigentes', 'direccion')
  if (auth.res) return auth.res
  try {
    const body = await req.json()
    const levelCode = typeof body?.target_level_code === 'string' ? body.target_level_code.trim() : ''
    const quantity = Number(body?.quantity)
    const sede = typeof body?.sede === 'string' ? body.sede.trim() : ''
    // Dirigente: nombre libre (autofill) — obligatorio; el id solo si coincide
    // con un dirigente registrado (opcional, para linkear). "Otro" = solo nombre.
    const targetLeaderId = typeof body?.target_leader_id === 'string' && body.target_leader_id ? body.target_leader_id : null
    const targetLeaderName = typeof body?.target_leader_name === 'string' ? body.target_leader_name.trim().slice(0, 200) : ''
    const note = typeof body?.note === 'string' ? (body.note.trim().slice(0, 1000) || null) : null

    if (!levelCode || !VALID_CODES.has(levelCode)) {
      return NextResponse.json({ error: 'Seleccioná un folleto/nivel válido.' }, { status: 400 })
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'La cantidad debe ser un número mayor a 0.' }, { status: 400 })
    }
    if (!sede) return NextResponse.json({ error: 'Indicá la sede de entrega.' }, { status: 400 })
    if (!targetLeaderName) return NextResponse.json({ error: 'Indicá el dirigente a quien se entrega.' }, { status: 400 })

    const created = await createManualFolletoRequest({
      target_level_code: levelCode,
      quantity,
      sede,
      target_leader_id: targetLeaderId,
      target_leader_name: targetLeaderName,
      note,
      today: ymdCR(),
      confirmed_by: auth.ctx.memberId,
    })

    // Misma notificación interna + email que el flujo automático.
    const levelName = STUDY_CATALOG.find(s => s.code === levelCode)?.name ?? levelCode
    try {
      await notifyFolletoRecipients({
        title: 'Nueva solicitud de folletos (manual)',
        body: `Solicitud manual: ${quantity} folleto(s) de ${levelName} para ${sede}.`,
        subject: 'Nueva solicitud de folletos (caso especial)',
        html: `<p>Entró una <strong>solicitud de folletos manual</strong> (caso especial).</p>
          <p><strong>Folleto/nivel:</strong> ${levelName}<br>
          <strong>Cantidad:</strong> ${quantity}<br>
          <strong>Sede:</strong> ${sede}${note ? `<br><strong>Nota:</strong> ${note}` : ''}</p>
          <p>Revisala en la cola de folletos.</p>`,
      })
    } catch (e) {
      console.warn('POST folletos/manual: notificación falló:', e)
    }

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/folletos/manual:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
