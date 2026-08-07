// EST-13 · Manda el resumen de la encuesta al dirigente (y al co-dirigente).
//
// CUÁNDO (el plan pedía proponerlo): cuando la coordinación aprieta "Compartir
// con el dirigente" en la ficha del grupo. No hace falta inventar un borrador
// para que alguien lo revise antes — el paso de revisión YA existe desde hoy y
// hace exactamente eso: el comité lee las respuestas, oculta lo que no
// corresponde y recién ahí comparte. Compartir ES enviar.
//
// CONFIDENCIALIDAD: el correo lleva conteos y comentarios ANÓNIMOS. Los
// comentarios ocultados por la coordinación no viajan.
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSystemEmail } from '@/lib/email/system-templates'
import { perQuestionSummary, type RespuestaCerrada } from '@/lib/studies/study-survey'
import { tablesHtml, commentsHtml, shouldSendReport } from '@/lib/email/leader-feedback-report'
import type { SupabaseClient } from '@supabase/supabase-js'

type Campo = { id: string; label: string; field_type: string; options: unknown }

export async function sendLeaderFeedbackReport(groupId: string): Promise<{ sent: number; skipped?: string }> {
  const sb = createAdminClient() as unknown as SupabaseClient

  const { data: g } = await sb
    .from('study_groups')
    .select('id, name, leader_id, co_leader_id, plan:study_plans(name)')
    .eq('id', groupId).maybeSingle()
  const grupo = g as unknown as {
    id: string; name: string | null
    leader_id: string | null; co_leader_id: string | null
    plan: { name: string | null } | null
  } | null
  if (!grupo?.leader_id) return { sent: 0, skipped: 'grupo sin dirigente' }

  // Las evaluaciones del grupo, con su respuesta detallada. Los comentarios
  // ocultados por la coordinación se excluyen acá y no viajan al correo.
  const { data: evals } = await sb
    .from('leader_evaluations')
    .select('response_id, comments, hidden_at')
    .eq('group_id', groupId)
  const filas = (evals ?? []) as Array<{ response_id: string | null; comments: string | null; hidden_at: string | null }>
  if (!shouldSendReport(filas.length)) return { sent: 0, skipped: 'sin respuestas' }

  const responseIds = filas.map(f => f.response_id).filter((x): x is string => !!x)

  // Detalle por pregunta desde el formulario.
  let resumenPreguntas: ReturnType<typeof perQuestionSummary> = []
  const abiertosDirigente: string[] = []
  const abiertosFolleto: string[] = []

  if (responseIds.length > 0) {
    const { data: vals } = await sb
      .from('form_response_values')
      .select('response_id, value_text, field:form_fields(id, label, field_type, options)')
      .in('response_id', responseIds)
    const rows = (vals ?? []) as unknown as Array<{ response_id: string; value_text: string | null; field: Campo | null }>

    const porRespuesta = new Map<string, RespuestaCerrada[]>()
    for (const r of rows) {
      if (!r.field) continue
      if (r.field.field_type === 'radio') {
        const lista = porRespuesta.get(r.response_id) ?? []
        lista.push({
          fieldId: r.field.id,
          label: r.field.label,
          options: Array.isArray(r.field.options) ? (r.field.options as string[]) : [],
          answer: r.value_text,
        })
        porRespuesta.set(r.response_id, lista)
      } else if (r.field.field_type === 'textarea' && r.value_text?.trim()) {
        // El primer textarea es sobre el dirigente; el segundo, sobre el folleto.
        if (/folleto/i.test(r.field.label)) abiertosFolleto.push(r.value_text)
        else abiertosDirigente.push(r.value_text)
      }
    }
    resumenPreguntas = perQuestionSummary([...porRespuesta.values()])
  }

  // Evaluaciones viejas (nota suelta, sin formulario): su comentario también va.
  for (const f of filas) {
    if (!f.response_id && !f.hidden_at && f.comments?.trim()) abiertosDirigente.push(f.comments)
  }

  const tablas = tablesHtml(resumenPreguntas)
  const comentarios = commentsHtml({
    count: filas.length,
    sobreDirigente: abiertosDirigente,
    sobreFolleto: abiertosFolleto,
  })
  const nombreEstudio = grupo.plan?.name ?? grupo.name ?? 'tu grupo'

  // Al dirigente y al co-dirigente: los dos acompañaron al grupo y la
  // retroalimentación es de los dos (decisión confirmada con TI).
  const destinatarios = [grupo.leader_id, grupo.co_leader_id].filter((x): x is string => !!x)
  const { data: mems } = await sb
    .from('members').select('id, first_name, last_name, email')
    .in('id', destinatarios).not('email', 'is', null)

  let sent = 0
  for (const m of (mems ?? []) as Array<{ first_name: string; last_name: string; email: string }>) {
    const nombre = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
    const { ok } = await sendSystemEmail({
      systemKey: 'retro_dirigente_resumen',
      to: { email: m.email, name: nombre },
      data: {
        nombre,
        nombre_estudio: nombreEstudio,
        cantidad: String(filas.length),
        tablas,
        comentarios,
      },
    })
    if (ok) sent++
  }
  return { sent }
}
