import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { ACCESS_EMAIL_ROLES, errorDeCorreoDeAcceso, normalizarCorreo } from '@/lib/auth/access-email'
import { planDeCambioDeCorreo } from '@/lib/auth/access-email-plan'
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

    // Cuenta de Auth con ese correo. Va por una función de base
    // (buscar_cuenta_por_correo) y no por auth.admin.listUsers: ese mira MIL de
    // las 18.415 cuentas, así que el guard fallaba para el 95% del padrón y el
    // cambio reventaba después con un 500 de Supabase.
    const { data: encontrada } = await supabase.rpc('buscar_cuenta_por_correo' as never, { p_email: email } as never)
    const otra = ((encontrada ?? []) as Array<{ id: string; ha_entrado: boolean; fichas: number }>)[0] ?? null

    const { data: mia } = await supabase.rpc('buscar_cuenta_por_correo' as never, { p_email: m.email ?? '' } as never)
    const actualInfo = ((mia ?? []) as Array<{ id: string; ha_entrado: boolean; fichas: number }>)
      .find(u => u.id === m.auth_user_id)

    const plan = planDeCambioDeCorreo({
      actual: { id: m.auth_user_id, haEntrado: !!actualInfo?.ha_entrado, fichas: Number(actualInfo?.fichas ?? 1) },
      conEseCorreo: otra ? { id: otra.id, haEntrado: !!otra.ha_entrado, fichas: Number(otra.fichas) } : null,
    })
    if (plan.accion === 'bloquear') {
      return NextResponse.json({ error: plan.motivo, code: 'cuenta_duplicada' }, { status: 409 })
    }

    // RELIGAR: la persona ya se creó una cuenta con el correo bueno y la de su
    // ficha nunca se usó. Se mueve la ficha a la que usa y se borra la muerta;
    // renombrar sería imposible igual (el correo está tomado). Antes esto
    // devolvía "hay que resolver el duplicado" y no había con qué resolverlo.
    if (plan.accion === 'religar') {
      const { error: relErr } = await supabase.from('members')
        .update({ auth_user_id: plan.cuentaNueva, email }).eq('id', id)
      if (relErr) {
        console.error('access-email religar:', relErr.message)
        return NextResponse.json({ error: 'No se pudo reconectar la cuenta.' }, { status: 500 })
      }
      const { error: delErr } = await supabase.auth.admin.deleteUser(plan.cuentaAbandonada)
      // Si no se pudo borrar, la persona YA quedó bien: solo sobra una cuenta
      // sin dueño. No se revierte por eso.
      if (delErr) console.warn('access-email borrar cuenta vieja:', delErr.message)
      await logAudit({
        actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'members', entityId: id,
        oldData: { email: m.email, auth_user_id: m.auth_user_id },
        newData: { email, auth_user_id: plan.cuentaNueva, via: 'access-email:religar' },
      })
      return NextResponse.json({ ok: true, email, religada: true })
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
