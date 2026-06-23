/**
 * Notificaciones de matrícula (transaccionales). Se dispara al inscribir un
 * miembro en un grupo desde la UI (ruta de enrollments), NO en imports masivos.
 * Best-effort: si algo falla, se loguea y no rompe la inscripción.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSystemEmail } from '@/lib/email/system-templates'

const DAY_LABEL: Record<string, string> = { L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo' }

function fmtDate(iso: string | null): string {
  if (!iso) return 'por confirmar'
  try { return new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Costa_Rica' }) } catch { return iso }
}
function fullName(m: { first_name?: string | null; last_name?: string | null } | null): string {
  return m ? `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() : ''
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '—'
}

type GroupRow = {
  name: string | null
  schedule_days: string[] | null
  schedule_time: string | null
  location: string | null
  starts_at: string | null
  plan: { name: string | null } | null
  leader: { first_name: string | null; last_name: string | null; email: string | null } | null
  co_leader: { first_name: string | null; last_name: string | null; email: string | null } | null
  enrollments: Array<{ status: string; member: { first_name: string | null; last_name: string | null } | null }>
}

/** Envía matricula_estudiante (al alumno) y matricula_dirigente (a cada dirigente). */
export async function notifyEnrollment(groupId: string, memberId: string): Promise<void> {
  try {
    const supabase = createAdminClient()
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from('study_groups')
        .select(`
          name, schedule_days, schedule_time, location, starts_at,
          plan:study_plans!study_groups_plan_id_fkey(name),
          leader:members!study_groups_leader_id_fkey(first_name, last_name, email),
          co_leader:members!study_groups_co_leader_id_fkey(first_name, last_name, email),
          enrollments:study_enrollments!study_enrollments_group_id_fkey(status, member:members(first_name, last_name))
        `)
        .eq('id', groupId).maybeSingle(),
      supabase.from('members').select('first_name, last_name, email').eq('id', memberId).maybeSingle(),
    ])
    if (!g || !m) return
    const group = g as unknown as GroupRow
    const member = m as { first_name: string | null; last_name: string | null; email: string | null }

    const capacitacion = group.plan?.name || group.name || 'la capacitación'
    const dias = (group.schedule_days ?? []).map(d => DAY_LABEL[d] ?? d).join(', ') || 'por confirmar'
    const hora = group.schedule_time || 'por confirmar'
    const lugar = group.location || 'por confirmar'
    const fechaInicio = fmtDate(group.starts_at)
    const leaders = [group.leader, group.co_leader].filter(Boolean) as Array<NonNullable<GroupRow['leader']>>
    const dirigentes = leaders.map(l => fullName(l)).filter(Boolean).join(', ') || 'tu dirigente'
    const estudianteNombre = fullName(member)

    const base = { nombre_capacitacion: capacitacion, fecha_inicio: fechaInicio, dias, hora, lugar }

    // 1) Al estudiante.
    if (member.email) {
      await sendSystemEmail({
        systemKey: 'matricula_estudiante',
        to: { email: member.email, name: estudianteNombre },
        data: { ...base, nombre: estudianteNombre, dirigentes },
      })
    }

    // 2) A cada dirigente (lista de estudiantes activos del grupo).
    const activos = (group.enrollments ?? [])
      .filter(e => e.status !== 'withdrawn')
      .map(e => fullName(e.member))
      .filter(Boolean)
    const estudiantes = activos.map(n => ({ nombre_completo: n, iniciales: initials(n) }))
    for (const l of leaders) {
      if (!l.email) continue
      await sendSystemEmail({
        systemKey: 'matricula_dirigente',
        to: { email: l.email, name: fullName(l) },
        data: {
          ...base,
          nombre_dirigente: fullName(l),
          nombre_estudiante: estudianteNombre,
          total_estudiantes: estudiantes.length,
          estudiantes,
        },
      })
    }
  } catch (e) {
    console.warn('notifyEnrollment:', e)
  }
}
