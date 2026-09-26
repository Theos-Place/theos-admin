import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportarError } from '@/lib/observabilidad'

const bodySchema = z.object({
  member_id: z.string().uuid(),
  detalle: z.string().trim().min(10).max(500),
}).strict()

/**
 * SRV-9 · «Esto no es correcto»: el dirigente avisa que su formación está mal.
 *
 * POR QUÉ NO SE LIMPIA SOLO. La formación migrada de CCB trae sobras: grupos
 * que se abrieron y nunca se dieron —el caso «Amor Sin Fronteras» de Ariana—.
 * Borrar automático lo que parece sobra borraría también formación real que se
 * registró raro, y desformar a alguien por error es peor que dejarle una línea
 * de más. Lo que sí se puede es abrir la conversación.
 *
 * VA POR CAMPANITA Y NO POR CORREO: es trabajo interno para la coordinación, y
 * un correo más a una bandeja llena se archiva. El aviso NO toca la formación:
 * la cambia una persona, a mano, en la pantalla de dirigentes.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res

    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const { member_id, detalle } = parsed.data

    // Solo sobre la PROPIA formación. Reportar la de otro no es un caso real y
    // abriría la puerta a llenarle la campanita a la coordinación a nombre
    // ajeno.
    if (auth.ctx.memberId !== member_id) {
      return NextResponse.json(
        { error: 'Solo podés reportar tu propia formación.' }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { data: quien } = await supabase
      .from('members').select('first_name, last_name').eq('id', member_id).maybeSingle()
    const nombre = quien
      ? `${(quien as { first_name: string; last_name: string }).first_name} ${(quien as { first_name: string; last_name: string }).last_name}`.trim()
      : 'Un dirigente'

    const { data: roleRows } = await supabase
      .from('member_roles')
      .select('member_id, member:members!member_roles_member_id_fkey(is_active)')
      .eq('role', 'coordinador_dirigentes')
      .eq('is_active', true)
    const dest = [...new Set(((roleRows ?? []) as unknown as Array<{
      member_id: string; member: { is_active: boolean } | { is_active: boolean }[] | null
    }>)
      .filter(r => (Array.isArray(r.member) ? r.member[0] : r.member)?.is_active === true)
      .map(r => r.member_id))]
    if (dest.length === 0) {
      // Sin nadie a quien avisar, el reporte se perdería en silencio y la
      // persona creería que alguien lo va a ver.
      return NextResponse.json(
        { error: 'No hay coordinación de dirigentes activa a quién avisarle. Escribile directamente.', code: 'sin_destinatario' },
        { status: 409 },
      )
    }

    const { error } = await supabase.from('internal_notifications').insert(dest.map(id => ({
      recipient_member_id: id,
      type: 'leader_formation_report',
      title: `${nombre} dice que su formación está mal`,
      body: detalle,
      link: `/estudios/dirigentes/${member_id}`,
    })))
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('POST /api/studies/dirigentes/formacion-reporte:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
