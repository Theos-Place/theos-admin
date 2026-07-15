import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { approveApplications, rejectApplications } from '@/lib/supabase/queries/servers'

// POST: acción masiva sobre aplicaciones. Body: { action: 'approve'|'reject', ids: string[] }
//  - approve (5b): aprueba y activa al aplicante como servidor (transaccional, sin correo).
//  - reject: marca como no seleccionada.
export async function POST(req: NextRequest) {
  const auth = await requireRoles('encargado_staff', 'coordinador_servidores', 'direccion', 'lider_comite', 'admin')
  if (auth.res) return auth.res
  try {
    const { action, ids } = (await req.json()) as { action?: 'approve' | 'reject'; ids?: string[] }
    const list = Array.isArray(ids) ? ids.filter(Boolean) : []
    if (list.length === 0) return NextResponse.json({ error: 'No hay aplicaciones seleccionadas.' }, { status: 400 })

    if (action === 'approve') {
      const { activated } = await approveApplications(list, auth.ctx.userId)
      return NextResponse.json({ ok: true, approved: list.length, activated })
    }
    if (action === 'reject') {
      await rejectApplications(list) // un solo UPDATE .in() — antes era 1 query por id
      return NextResponse.json({ ok: true, rejected: list.length })
    }
    return NextResponse.json({ error: 'Acción inválida.' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/servers/applications/bulk:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
