/**
 * MIG-1 Etapa 0 · Qué correos NO envió el modo silencioso.
 *
 * Es el requisito para poder APAGARLO: si esta lista no está vacía y limpia, el
 * modo se queda encendido. Un correo acá es un correo que habría salido a un
 * miembro con datos que todavía no son oficiales.
 *
 *   npx tsx scripts/reporte-correos-silenciados.ts           # últimas 24 h
 *   npx tsx scripts/reporte-correos-silenciados.ts --horas 72
 *   npx tsx scripts/reporte-correos-silenciados.ts --todo
 *   npx tsx scripts/reporte-correos-silenciados.ts --purgar  # borra el registro
 *
 * `--purgar` se usa DESPUÉS de revisar y resolver: deja el registro en cero para
 * que la siguiente revisión empiece limpia. No apaga el modo silencioso — eso se
 * hace quitando EMAIL_SILENT_MODE del entorno, y es una decisión aparte.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

for (const f of ['.env', '.env.local']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* el archivo puede no existir */ }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

const args = process.argv.slice(2)
const purgar = args.includes('--purgar')
const todo = args.includes('--todo')
const horas = Number(args[args.indexOf('--horas') + 1]) || 24

type Fila = { recipient: string; subject: string; kind: string | null; attempted_at: string }

async function main() {
  const desde = new Date(Date.now() - horas * 3600_000).toISOString()
  let q = sb.from('silenced_emails').select('recipient, subject, kind, attempted_at')
    .order('attempted_at', { ascending: false })
  if (!todo) q = q.gte('attempted_at', desde)
  const { data, error } = await q
  if (error) { console.error('Error leyendo silenced_emails:', error.message); process.exit(1) }

  const filas = (data ?? []) as Fila[]
  const ventana = todo ? 'todo el registro' : `últimas ${horas} h`
  const modo = (process.env.EMAIL_SILENT_MODE ?? '').trim() || '(sin definir)'

  console.log(`\nCorreos silenciados — ${ventana}`)
  console.log(`EMAIL_SILENT_MODE = ${modo}\n`)

  if (filas.length === 0) {
    console.log('Ninguno. El sistema no intentó escribirle a nadie en esta ventana.')
    console.log('Si eso es lo esperado, se puede considerar apagar el modo silencioso.\n')
    return
  }

  // Por asunto: es lo que identifica QUÉ disparador se activó, que es la
  // pregunta real ("¿por qué el sistema quiso mandar esto?").
  const porAsunto = new Map<string, { n: number; ejemplo: string }>()
  for (const f of filas) {
    const acc = porAsunto.get(f.subject) ?? { n: 0, ejemplo: f.recipient }
    acc.n++
    porAsunto.set(f.subject, acc)
  }

  console.log(`${filas.length} correo(s) a ${new Set(filas.map(f => f.recipient)).size} destinatario(s) distintos:\n`)
  for (const [subject, { n, ejemplo }] of [...porAsunto.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`  ${String(n).padStart(5)}  ${subject}`)
    console.log(`         ej. ${ejemplo}`)
  }
  console.log(`\nMás reciente: ${filas[0].attempted_at}`)
  console.log('\nRevisá cada asunto antes de apagar el modo: al apagarlo, el disparador')
  console.log('que generó estos correos puede volver a activarse.\n')

  if (purgar) {
    const { error: e2 } = todo
      ? await sb.from('silenced_emails').delete().neq('recipient', '')
      : await sb.from('silenced_emails').delete().gte('attempted_at', desde)
    if (e2) console.error('No se pudo purgar:', e2.message)
    else console.log(`Registro purgado (${ventana}).\n`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
