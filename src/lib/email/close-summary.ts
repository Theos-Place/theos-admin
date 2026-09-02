/**
 * El resumen que recibe el dirigente cuando cierra su grupo.
 *
 * Antes del 2026-09-02 al cerrar no le llegaba nada: solo se programaba la
 * encuesta de retroalimentación, a las 24 horas. El dirigente terminaba de
 * evaluar a su gente y no le quedaba constancia de lo que había registrado —
 * ni de qué pasó después con los que aprobaron.
 *
 * El correo cierra ese hueco: qué quedó registrado, quién avanzó y a dónde.
 * Es un acuse de recibo, no una tarea: no pide nada de vuelta.
 *
 * Módulo puro — recibe los datos ya leídos y devuelve texto. Los tests
 * verifican el contenido sin tocar la base ni mandar nada.
 */
import { formatDateLong } from '@/lib/format'
import type { ConteoCierre } from '@/lib/studies/close-result-read'

const BASE = 'https://admin.theosplace.org'

export type ResumenCierre = {
  grupoId: string
  grupoNombre: string
  nivel: string | null
  dirigenteNombre: string
  conteo: ConteoCierre
  /** Nombre del grupo siguiente y cuántos pasaron, si el cierre lo generó. */
  sucesor: { nombre: string; nivel: string | null; matriculados: number } | null
  /** Cuándo arranca el grupo siguiente (YYYY-MM-DD). */
  sucesorArranca: string | null
}

export function asuntoCierre(r: ResumenCierre): string {
  return `Cerraste ${r.nivel ?? 'tu grupo'}: ${r.conteo.aprobados} aprobados`
}

function fila(label: string, valor: string): string {
  return `<tr>
    <td style="padding:6px 12px 6px 0; font-size:13px; color:#777; white-space:nowrap; vertical-align:top;">${label}</td>
    <td style="padding:6px 0; font-size:14px; color:#161440; vertical-align:top;"><strong>${valor}</strong></td>
  </tr>`
}

function personas(n: number): string {
  return `${n} ${n === 1 ? 'persona' : 'personas'}`
}

export function cuerpoCierre(r: ResumenCierre): string {
  const c = r.conteo
  const primerNombre = r.dirigenteNombre.split(/\s+/)[0] || r.dirigenteNombre

  const sucesorBloque = r.sucesor
    ? `<div class="info-box">
  <p class="info-title">Qué pasó con los que aprobaron</p>
  <p style="font-size:14px; color:#555; line-height:1.9; margin:0 0 8px;">
    ${personas(r.sucesor.matriculados)} ${r.sucesor.matriculados === 1 ? 'quedó' : 'quedaron'}
    matriculada${r.sucesor.matriculados === 1 ? '' : 's'} automáticamente en
    <strong>${r.sucesor.nombre}</strong>${r.sucesorArranca ? `, que arranca el ${formatDateLong(r.sucesorArranca)}` : ''}.
  </p>
  <p style="font-size:13px; color:#777; line-height:1.7; margin:0;">
    Los folletos del grupo nuevo ya se pidieron: no tenés que hacer nada.
  </p>
</div>`
    : `<p style="font-size:13px; color:#777; line-height:1.7;">
  Este estudio no encadena con un nivel siguiente, así que no se generó un grupo nuevo.
</p>`

  // Solo se listan los renglones que tienen gente: un "0 retirados" ocupa
  // espacio y no dice nada.
  const detalle = [
    fila('Aprobaron', personas(c.aprobados)),
    c.reprobados > 0 ? fila('Reprobaron', personas(c.reprobados)) : '',
    c.retirados > 0 ? fila('Se retiraron', personas(c.retirados)) : '',
    c.sin_evaluar > 0 ? fila('Quedaron sin evaluar', `${personas(c.sin_evaluar)} — conviene revisarlo`) : '',
    c.historicos > 0 ? fila('Ya tenían el nivel', `${personas(c.historicos)}, de datos viejos importados`) : '',
  ].filter(Boolean).join('\n    ')

  return `<p class="greeting">Gracias, ${primerNombre}</p>

<p>Cerraste <strong>${r.grupoNombre}</strong>. Esto es lo que quedó registrado, para que
lo tengás a mano.</p>

<div class="info-box">
  <p class="info-title">Cómo terminó el grupo</p>
  <table cellpadding="0" cellspacing="0" style="margin:0;">
    ${detalle}
  </table>
</div>

${sucesorBloque}

<p style="text-align:center; margin:28px 0;">
  <a class="btn" href="${BASE}/estudios/grupos/${r.grupoId}/resumen-cierre">Ver el detalle del cierre</a>
</p>

<p style="font-size:13px; color:#777; line-height:1.7;">
  Ahí queda el resultado de cada persona con su motivo, tal como lo registraste.
  Si algo quedó mal, escribinos a
  <a href="mailto:estudios@theosplace.org" style="color:#3B7579;">estudios@theosplace.org</a>
  — el cierre no se puede deshacer solo.
</p>`
}

/**
 * Lee los datos y le manda el resumen al dirigente (y al co-dirigente si hay).
 *
 * Best-effort a propósito: el cierre es irreversible y ya está hecho cuando
 * esto corre. Si el correo falla, se loguea y se sigue — perder el aviso es
 * malo, dejar el cierre a medias es peor.
 */
export async function sendCloseSummary(input: {
  groupId: string
  successorGroupId: string | null
}): Promise<{ sent: number }> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { getCierreDetalle } = await import('@/lib/supabase/queries/studies')
  const { renderEmail } = await import('@/lib/email/baseLayout')
  const { sendEmail } = await import('@/lib/email/provider')
  const sb = createAdminClient()

  const detalle = await getCierreDetalle(input.groupId)
  if (!detalle) return { sent: 0 }

  let sucesor: ResumenCierre['sucesor'] = null
  let sucesorArranca: string | null = null
  if (input.successorGroupId) {
    const { data } = await sb.from('study_groups')
      .select('name, starts_at, plan:study_plans!study_groups_plan_id_fkey(name)')
      .eq('id', input.successorGroupId).maybeSingle()
    const g = data as { name: string | null; starts_at: string | null; plan: { name: string | null } | { name: string | null }[] | null } | null
    if (g) {
      const { count } = await sb.from('study_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', input.successorGroupId)
        .in('status', ['enrolled', 'pendiente_de_pago'])
      const plan = Array.isArray(g.plan) ? g.plan[0] : g.plan
      sucesor = { nombre: g.name ?? 'el grupo siguiente', nivel: plan?.name ?? null, matriculados: count ?? 0 }
      sucesorArranca = g.starts_at
    }
  }

  // Al dirigente y al co-dirigente: los dos cierran y los dos necesitan la
  // constancia. Se leen del grupo, no de quien apretó el botón — a veces
  // cierra una coordinación.
  const { data: grupo } = await sb.from('study_groups')
    .select('leader_id, co_leader_id').eq('id', input.groupId).maybeSingle()
  const g = grupo as { leader_id: string | null; co_leader_id: string | null } | null
  const ids = [g?.leader_id, g?.co_leader_id].filter((x): x is string => !!x)
  if (ids.length === 0) return { sent: 0 }

  const { data: gente } = await sb.from('members')
    .select('id, first_name, last_name, email, email_bounced').in('id', ids)
  let sent = 0
  for (const m of (gente ?? []) as Array<{
    id: string; first_name: string; last_name: string; email: string | null; email_bounced: boolean | null
  }>) {
    if (!m.email || m.email_bounced) continue
    const nombre = `${m.first_name} ${m.last_name}`.trim()
    const resumen: ResumenCierre = {
      grupoId: input.groupId,
      grupoNombre: detalle.grupo.name ?? 'tu grupo',
      nivel: detalle.grupo.nivel,
      dirigenteNombre: nombre,
      conteo: detalle.conteo,
      sucesor,
      sucesorArranca,
    }
    try {
      await sendEmail({
        to: { email: m.email, name: nombre },
        subject: asuntoCierre(resumen),
        html: renderEmail(cuerpoCierre(resumen)),
        kind: 'transactional',
      })
      sent++
    } catch (e) {
      console.warn(`resumen de cierre a ${m.email} falló:`, e instanceof Error ? e.message : e)
    }
  }
  return { sent }
}
