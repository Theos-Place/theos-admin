import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { ACCESS_EMAIL_ROLES, errorDeCorreoDeAcceso, normalizarCorreo } from '@/lib/auth/access-email'
import { isUuid } from '@/lib/validate'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

// PATCH { email } → cambia el correo con el que la persona ENTRA al sistema
// (auth.users) y, de paso, el de su ficha, para que no vuelvan a separarse.
//
// Permiso propio (ACCESS_EMAIL_ROLES), no STUDY_ADMIN_ROLES: quien cambia esto
// decide con qué dirección se entra a una cuenta. El porqué completo está en
// src/lib/auth/access-email.ts.
const schema = z.object({ email: z.string().min(3).max(254) })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(...ACCESS_EMAIL_ROLES)
  if (auth.res) return auth.res
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const email = normalizarCorreo(parsed.data.email)
    const malo = errorDeCorreoDeAcceso(email)
    if (malo) return NextResponse.json({ error: malo }, { status: 400 })

    const supabase = createAdminClient()
    const { data: member } = await supabase
      .from('members').select('auth_user_id, email, first_name, last_name').eq('id', id).maybeSingle()
    const m = member as { auth_user_id: string | null; email: string | null } | null
    if (!m) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    if (!m.auth_user_id) {
      return NextResponse.json(
        { error: 'Esta persona todavía no tiene cuenta de acceso. Creala primero.', code: 'sin_cuenta' },
        { status: 409 },
      )
    }

    // Colisión en members: la base NO tiene UNIQUE en email (el dedupe es de
    // app), así que se mira acá o se crean dos fichas con el mismo correo.
    const { data: choque } = await supabase.from('members').select('id, first_name, last_name').ilike('email', email)
    const otro = ((choque ?? []) as Array<{ id: string; first_name: string; last_name: string }>).find(x => x.id !== id)
    if (otro) {
      return NextResponse.json(
        { error: `Ese correo ya es de ${otro.first_name} ${otro.last_name}.`, code: 'correo_ocupado' },
        { status: 409 },
      )
    }

    // Cuenta de Auth con ese correo. Se chequea ANTES porque el admin API
    // responde 500 —no 409— cuando el correo ya existe, y ese error no le dice
    // nada a nadie. Verificado el 2026-08-31 con un caso real.
    const { data: lista } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const ocupada = (lista?.users ?? []).find(u => normalizarCorreo(u.email) === email && u.id !== m.auth_user_id)
    if (ocupada) {
      return NextResponse.json(
        {
          error: 'Ya existe otra cuenta de acceso con ese correo. Hay que resolver el duplicado antes de reasignarlo.',
          code: 'cuenta_duplicada',
        },
        { status: 409 },
      )
    }

    // email_confirm: la dirección la pone el staff, no se le pide a la persona
    // que confirme un correo para poder entrar — que es justo lo que no le
    // funciona a quien llega hasta acá.
    const { error: authErr } = await supabase.auth.admin.updateUserById(m.auth_user_id, { email, email_confirm: true })
    if (authErr) {
      console.error('access-email updateUserById:', authErr.message)
      return NextResponse.json({ error: 'No se pudo cambiar el correo de la cuenta.' }, { status: 500 })
    }

    // La ficha se alinea sola: dejarlas distintas es reponer el problema que
    // esta pantalla vino a arreglar.
    //
    // Y se limpian rebote y queja SI el correo cambió de verdad: esas marcas
    // eran de la dirección VIEJA. Sin esto, corregirle a alguien un correo mal
    // escrito lo deja igual de excluido —las campañas saltan a quien tiene
    // email_bounced— y no se entiende por qué. Caso real: Douglas García, con
    // el correo sin una letra, rebotado en duro desde el 4 de agosto.
    //
    // Si el correo NO cambió (se reescribió el mismo), las marcas se quedan:
    // ahí siguen siendo ciertas.
    const cambio = normalizarCorreo(m.email) !== email
    const patch = cambio
      ? { email, email_bounced: false, email_bounced_at: null, email_complained: false, email_complained_at: null }
      : { email }
    const { error: memErr } = await supabase.from('members').update(patch).eq('id', id)
    if (memErr) console.warn('access-email ficha:', memErr.message)

    await logAudit({
      actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'members', entityId: id,
      oldData: { email: m.email }, newData: { email, via: 'access-email', rebote_limpiado: cambio },
    })
    return NextResponse.json({ ok: true, email })
  } catch (error) {
    console.error('PATCH /api/members/[id]/access-email:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
