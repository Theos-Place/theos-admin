// Procesa la cola diaria de emails. Programar en Supabase:
// Dashboard → Edge Functions → process-email-queue → Cron: "0 14 * * *"
// (14:00 UTC = 8:00 am Costa Rica). Requiere secrets:
//   NEXT_PUBLIC_SITE_URL (ej. https://admin.theosplace.org) y CRON_SECRET
// (el mismo CRON_SECRET que en Vercel).
import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async () => {
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

  if (!pendingLogs?.length) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
  }

  const broadcastIds = [...new Set(pendingLogs.map((l: { broadcast_id: string }) => l.broadcast_id))]

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

  return new Response(JSON.stringify({ processed: totalSent, failed: totalFailed }), { status: 200 })
})
