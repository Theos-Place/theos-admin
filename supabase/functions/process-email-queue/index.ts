// Procesa la cola diaria de emails. Programar en Supabase:
// Dashboard → Edge Functions → process-email-queue → Cron: "0 14 * * *"
// (14:00 UTC = 8:00 am Costa Rica), configurando el header
//   Authorization: Bearer <CRON_SECRET>
// en la invocación del cron. Requiere secrets:
//   NEXT_PUBLIC_SITE_URL (ej. https://admin.theosplace.org) y CRON_SECRET
// (el mismo CRON_SECRET que en Vercel).
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // Solo el cron (o quien tenga el CRON_SECRET) puede invocarla: sin esto,
  // cualquiera con la URL podía forzar/adelantar el envío de la cola.
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || bearer !== secret) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const today = new Date().toISOString().split('T')[0]

  // Broadcasts con emails pendientes para hoy (o atrasados).
  const { data: pendingLogs } = await supabase
    .from('message_logs')
    .select('broadcast_id')
    .eq('status', 'pending')
    .eq('channel', 'email')
    .lte('scheduled_date', today)

  // Sin early-return: aunque no haya emails pendientes, la verificación de
  // dirigentes inasistentes (abajo) corre todos los días.
  const broadcastIds = [...new Set((pendingLogs ?? []).map((l: { broadcast_id: string }) => l.broadcast_id))]

  let totalSent = 0
  let totalFailed = 0
  for (const broadcastId of broadcastIds) {
    try {
      const res = await fetch(
        `${Deno.env.get('NEXT_PUBLIC_SITE_URL')}/api/communications/messages/${broadcastId}/process`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('CRON_SECRET')}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
        },
      )
      const data = await res.json()
      totalSent += data.sent ?? 0
      totalFailed += data.failed ?? 0
    } catch (e) {
      console.error('process-email-queue:', broadcastId, e)
    }
  }

  // Verificación diaria: dirigentes con grupo activo sin asistir a charlas
  // (>4 semanas) → notificación interna a coordinadores de dirigentes.
  // La lógica vive en el app (/api/notifications/leader-absence-check) y se
  // protege con el mismo CRON_SECRET; el anti-duplicado (1/semana) está ahí.
  let absenceCheck: unknown = null
  try {
    const res = await fetch(
      `${Deno.env.get('NEXT_PUBLIC_SITE_URL')}/api/notifications/leader-absence-check`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${Deno.env.get('CRON_SECRET')}` },
      },
    )
    absenceCheck = await res.json()
  } catch (e) {
    console.error('leader-absence-check:', e)
  }

  return new Response(JSON.stringify({ processed: totalSent, failed: totalFailed, absenceCheck }), { status: 200 })
})
