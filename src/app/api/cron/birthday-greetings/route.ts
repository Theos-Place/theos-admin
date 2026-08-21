import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSystemEmail } from '@/lib/email/system-templates'
import { filterByNotifPref } from '@/lib/notifications/dispatch'
import { todayCR } from '@/lib/format'
import {
  birthdayMatchDays, greetingSkipReason, isMonthlyDigestDay, monthOf,
  MAX_GREETINGS_PER_RUN, type SkipReason,
} from '@/lib/notifications/birthday-rules'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Autorizado con el CRON_SECRET o sesión de dirección/comunicaciones. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('direccion', 'comunicaciones', 'admin')
  return auth.res ?? null
}

type Candidato = {
  member_id: string
  first_name: string
  last_name: string
  email: string | null
  birth_date: string | null
  email_bounced: boolean | null
  email_complained: boolean | null
}

/**
 * La audiencia NO es todo el padrón: solo miembros activos que además sirven
 * (voluntariado activo) o son dirigentes activos. Un miembro puede tener varias
 * filas en volunteers (una por puesto), así que se deduplica por member_id.
 */
async function audiencia(supabase: SupabaseClient): Promise<Set<string>> {
  const [{ data: leaders }, { data: vols }] = await Promise.all([
    supabase.from('study_leaders').select('member_id').neq('is_active', false),
    supabase.from('volunteers').select('member_id').eq('status', 'active'),
  ])
  const ids = new Set<string>()
  for (const r of (leaders ?? []) as Array<{ member_id: string | null }>) if (r.member_id) ids.add(r.member_id)
  for (const r of (vols ?? []) as Array<{ member_id: string | null }>) if (r.member_id) ids.add(r.member_id)
  return ids
}

/** Los de la audiencia que cumplen en alguno de esos MM-DD. */
async function cumplenHoy(
  supabase: SupabaseClient, ids: string[], dias: string[],
): Promise<Candidato[]> {
  const out: Candidato[] = []
  // Chunk por el tope de la cláusula IN (mismo criterio que el resto del repo).
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase
      .from('members')
      .select('id, first_name, last_name, email, birth_date, email_bounced, email_complained')
      .in('id', ids.slice(i, i + 300))
      .eq('is_active', true)
      .not('birth_date', 'is', null)
    for (const m of (data ?? []) as Array<Record<string, unknown>>) {
      const bd = m.birth_date as string
      if (!dias.includes(bd.slice(5))) continue
      out.push({
        member_id: m.id as string,
        first_name: (m.first_name as string) ?? '',
        last_name: (m.last_name as string) ?? '',
        email: (m.email as string | null) ?? null,
        birth_date: bd,
        email_bounced: (m.email_bounced as boolean | null) ?? false,
        email_complained: (m.email_complained as boolean | null) ?? false,
      })
    }
  }
  return out
}

/** BONUS: el día 1, la lista de dirigentes que cumplen este mes, al coordinador. */
async function resumenMensual(supabase: SupabaseClient, hoy: string): Promise<number> {
  const mes = monthOf(hoy)
  const { data: leaders } = await supabase
    .from('study_leaders').select('member_id').neq('is_active', false)
  const ids = [...new Set(((leaders ?? []) as Array<{ member_id: string | null }>)
    .map(r => r.member_id).filter(Boolean) as string[])]
  if (ids.length === 0) return 0

  const cumplen: Array<{ nombre: string; dia: string }> = []
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase
      .from('members').select('first_name, last_name, birth_date')
      .in('id', ids.slice(i, i + 300)).eq('is_active', true).not('birth_date', 'is', null)
    for (const m of (data ?? []) as Array<{ first_name: string; last_name: string; birth_date: string }>) {
      if (m.birth_date.slice(5, 7) !== mes) continue
      cumplen.push({ nombre: `${m.first_name} ${m.last_name}`.trim(), dia: m.birth_date.slice(8, 10) })
    }
  }
  if (cumplen.length === 0) return 0
  cumplen.sort((a, b) => a.dia.localeCompare(b.dia))

  const { data: roleRows } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(is_active)')
    .in('role', ['coordinador_dirigentes', 'coordinador_estudios'])
    .eq('is_active', true)
  // El embed puede venir como objeto o como array según el planificador.
  const dest = [...new Set(((roleRows ?? []) as unknown as Array<{
    member_id: string; member: { is_active: boolean } | { is_active: boolean }[] | null
  }>)
    .filter(r => {
      const m = Array.isArray(r.member) ? r.member[0] : r.member
      return m?.is_active === true
    })
    .map(r => r.member_id))]
  if (dest.length === 0) return 0

  const cuerpo = cumplen.map(c => `${c.dia} — ${c.nombre}`).join('\n')
  const rows = dest.map(memberId => ({
    recipient_member_id: memberId,
    type: 'birthday_digest',
    title: `${cumplen.length} dirigente${cumplen.length === 1 ? '' : 's'} cumple${cumplen.length === 1 ? '' : 'n'} años este mes`,
    body: cuerpo,
    link: '/estudios/dirigentes',
  }))
  const { error } = await supabase.from('internal_notifications').insert(rows)
  if (error) { console.warn('resumen mensual de cumpleaños:', error.message); return 0 }
  return rows.length
}

// POST: saludo DIARIO de cumpleaños a servidores y dirigentes.
//
// El 29 de febrero se felicita el 28 en los años no bisiestos (birthdayMatchDays).
// Dedupe ANUAL por el UNIQUE (member_id, year) de birthday_greetings: se inserta
// ANTES de mandar, así dos corridas simultáneas no pueden duplicar el saludo.
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const supabase = createAdminClient() as unknown as SupabaseClient
    const hoy = todayCR()
    const year = Number(hoy.slice(0, 4))
    const dias = birthdayMatchDays(hoy)

    const ids = [...await audiencia(supabase)]
    const candidatos = await cumplenHoy(supabase, ids, dias)

    const skipped: Record<SkipReason, number> = { sin_correo: 0, rebotado: 0, queja: 0, sin_fecha: 0 }
    const enviables = candidatos.filter(c => {
      const r = greetingSkipReason(c)
      if (r) { skipped[r]++; return false }
      return true
    })

    // Un saludo es de lo más silenciable que hay: respeta 'mensajes_sistema'.
    const permitidos = new Set(await filterByNotifPref(supabase, enviables.map(c => c.member_id), 'mensajes_sistema'))
    const skipped_pref = enviables.length - enviables.filter(c => permitidos.has(c.member_id)).length

    let sent = 0
    let skipped_dup = 0
    let failed = 0
    let capped = 0
    for (const c of enviables) {
      if (!permitidos.has(c.member_id)) continue
      if (sent >= MAX_GREETINGS_PER_RUN) { capped++; continue }

      // Reservar ANTES de enviar: el UNIQUE es el dedupe. Si otra corrida ya lo
      // tomó, esto falla con 23505 y se salta — mejor no saludar que saludar dos veces.
      const { error: dupErr } = await supabase
        .from('birthday_greetings').insert({ member_id: c.member_id, year })
      if (dupErr) { skipped_dup++; continue }

      const ok = (await sendSystemEmail({
        systemKey: 'cumpleanos',
        to: { email: c.email as string, name: `${c.first_name} ${c.last_name}`.trim() },
        data: { nombre: c.first_name },
      })).ok
      if (ok) { sent++; continue }
      // Si el envío falló, se libera la reserva para reintentar mañana.
      failed++
      await supabase.from('birthday_greetings').delete().eq('member_id', c.member_id).eq('year', year)
    }

    const digest = isMonthlyDigestDay(hoy) ? await resumenMensual(supabase, hoy) : 0

    await pingHealthcheck('HEALTHCHECK_URL_BIRTHDAYS')
    return NextResponse.json({
      dia: hoy, dias_evaluados: dias, audiencia: ids.length,
      cumplen: candidatos.length, sent, failed, skipped_dup, skipped_pref, skipped, capped,
      digest_enviados: digest,
    })
  } catch (error) {
    console.error('POST /api/cron/birthday-greetings:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST
