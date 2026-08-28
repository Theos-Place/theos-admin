/**
 * Enlaza los comunicados YA programados con la lista de la que salieron.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/enlazar-programados.ts
 *   aplicar:  ... --aplicar
 *
 * Al programar un comunicado se guardaba solo la FOTO de los destinatarios, sin
 * anotar de qué lista salieron. Ahora el cron vuelve a resolver la lista antes
 * de enviar, pero estos seis se programaron antes y no tienen ese dato.
 *
 * CÓMO SE IDENTIFICA CADA UNO, sin adivinar. Dos señales que tienen que dar lo
 * mismo:
 *   · el asunto nombra el estudio de la lista;
 *   · la cantidad de destinatarios congelados calza EXACTO con la cantidad que
 *     esa lista tenía antes de reconstruirla.
 * Que 13 personas estén también dentro de "Invitación Capacitaciones" no dice
 * nada: esa lista tiene 634 y las contiene a casi todas. El conteo exacto sí.
 *
 * Cada fila va con sus dos guardas y si alguna falla, esa fila no se toca.
 */
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

/** asunto (prefijo) → lista, y cuántos tenía la lista cuando se programó. */
const ENLACES: Array<{ asunto: string; lista: string; congelados: number }> = [
  { asunto: '¡Te invitamos a Discípulos!', lista: 'Invitación Discípulos', congelados: 13 },
  { asunto: '¡Te invitamos a Panorama!', lista: 'Invitación Panorama', congelados: 22 },
  // FUERA, y no por falta de confirmación: NUNCA hay que enlazarlo.
  //
  // Su asunto es "Fuiste seleccionado para Cómo Interpretar la Biblia".
  // Hermenéutica se lleva por invitación: los 16 destinatarios no son el
  // resultado de un filtro sino una DECISIÓN del comité (EST-10, la pantalla de
  // selección). Recalcular la lista le diría a 19 personas que fueron
  // seleccionadas cuando nadie las seleccionó.
  //
  // Esto explica además el 46% de coincidencia que dejó a esta lista sin
  // decidir en la reconstrucción: los 16 congelados son un subconjunto elegido
  // a mano, no lo que devuelve el filtro. O sea que el chip reconstruido por
  // analogía no está necesariamente mal — la lista de 35 es "quién puede ser
  // invitado" y los 16 son "a quién invitaron". Las dos cosas son ciertas.
  //
  // La regla general vale para cualquier convocatoria, no solo para esta: si
  // los destinatarios son una selección, la lista no manda. El flujo lo respeta
  // solo: convokeSelection arma sus destinatarios de la selección del comité y
  // no toca scheduleBroadcast ni list_id, y en la pantalla de comunicaciones el
  // list_id se manda solo si nadie editó los destinatarios a mano.
  { asunto: '¡Te invitamos a los cursos de la Etapa Inicial!', lista: 'Invitación Iniciales', congelados: 75 },
  { asunto: '¡Te invitamos a Sirviendo como Jesús!', lista: 'Invitación SCJ', congelados: 194 },
  { asunto: '¡Te invitamos a los cursos de la Etapa Intermedia!', lista: 'Invitación Intermedias', congelados: 138 },
]

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const { getMemberLists } = await import('../../src/lib/supabase/queries/member-lists')
  const db = createAdminClient() as unknown as { from: (t: string) => never }
  const sel = (t: string) => db.from(t) as never as {
    select: (s: string) => { eq: (a: string, b: string) => Promise<{ data: Array<Record<string, never>> | null }> }
    update: (v: unknown) => { eq: (a: string, b: string) => { eq: (c: string, d: string) => Promise<{ error: { message: string } | null }> } }
  }

  const listas = await getMemberLists()
  const { data } = await sel('message_broadcasts')
    .select('id, subject, scheduled_at, recipient_filter').eq('status', 'scheduled')
  const bs = (data ?? []) as never as Array<{
    id: string; subject: string; scheduled_at: string
    recipient_filter: { recipients?: Array<{ member_id: string }>; list_id?: string } | null
  }>

  let abortar = false
  const plan: Array<{ id: string; asunto: string; listaId: string; lista: string; de: number; a: number; filtro: object }> = []
  for (const e of ENLACES) {
    const b = bs.find(x => x.subject.trim().startsWith(e.asunto))
    if (!b) { console.log(`✗ "${e.asunto}": no hay un programado con ese asunto`); abortar = true; continue }
    if (b.recipient_filter?.list_id) { console.log(`· "${e.asunto}": ya está enlazado`); continue }
    const n = (b.recipient_filter?.recipients ?? []).length
    if (n !== e.congelados) {
      console.log(`✗ "${e.asunto}": tiene ${n} destinatarios y se esperaban ${e.congelados}`); abortar = true; continue
    }
    const l = listas.find(x => x.name === e.lista)
    if (!l) { console.log(`✗ lista "${e.lista}" no existe`); abortar = true; continue }
    plan.push({ id: b.id, asunto: e.asunto, listaId: l.id, lista: l.name, de: n, a: l.member_count,
      filtro: { ...(b.recipient_filter ?? {}), list_id: l.id } })
  }

  console.log('══ PLAN ══')
  for (const p of plan) {
    console.log(`  ${p.asunto}`)
    console.log(`     ← ${p.lista} · al enviarse pasaría de ${p.de} a ${p.a} destinatarios (+${p.a - p.de})`)
  }
  const total = plan.reduce((n, p) => n + (p.a - p.de), 0)
  console.log(`\n  ${plan.length} comunicados · ${total} personas MÁS recibirían correo el 31 de agosto`)
  if (abortar) { console.log('\n✗ Alguna guarda falló. No se aplica nada.'); process.exit(1) }
  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }

  console.log('\n── aplicando ──')
  for (const p of plan) {
    const { error } = await sel('message_broadcasts')
      .update({ recipient_filter: p.filtro }).eq('id', p.id).eq('status', 'scheduled')
    if (error) { console.log(`  ✗ ${p.asunto}: ${error.message}`); continue }
    console.log(`  ✓ ${p.asunto} → ${p.lista}`)
  }
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
