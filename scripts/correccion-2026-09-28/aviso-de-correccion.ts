/**
 * EML-1b · La disculpa por el aviso de inicio que salió de más.
 *
 * QUÉ PASÓ. Entre el 25 y el 28 de setiembre, «¡Tu capacitación está por
 * comenzar!» le llegó a 16 personas que ya no estaban en ese grupo: el filtro
 * excluía un estado (`withdrawn`) que no existe en esta base, así que no
 * excluía a nadie. El envío ya está arreglado; esto le avisa a quien lo
 * recibió.
 *
 * SE AGRUPA POR PERSONA, no por correo enviado. Dos personas recibieron el
 * aviso por DOS estudios distintos, y mandarles dos disculpas sería repetir el
 * problema que estamos pidiendo perdón por causar.
 *
 * EL CASO TRANSFERIDO ES DISTINTO Y POR ESO SE DICE APARTE. A esas cinco
 * personas les llegaron DOS correos: el de su grupo NUEVO, que es correcto y
 * tienen que atender, y el del viejo, que sobraba. Un «ignorá el correo
 * anterior» a secas haría que ignoren el bueno y se pierdan el inicio de su
 * estudio — el remedio sería peor.
 *
 * Uso (la condición react-server hace falta porque los módulos de queries y de
 * correo hacen `import 'server-only'`, que en tsx revienta sin ella):
 *
 *   NODE_OPTIONS="--conditions=react-server" \
 *     npx tsx scripts/correccion-2026-09-28/aviso-de-correccion.ts            (dry run)
 *   NODE_OPTIONS="--conditions=react-server" \
 *     npx tsx scripts/correccion-2026-09-28/aviso-de-correccion.ts --enviar
 */
import { readFileSync } from 'node:fs'
import { formatDayMonth } from '../../src/lib/format'
for (const f of ['.env', '.env.local']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* el archivo puede no existir */ }
}

/** Los módulos del proyecto se cargan DESPUÉS de tener el .env en
 *  `process.env`: `src/lib/env.ts` valida al importarse y tumba el script si
 *  las variables todavía no están. */
type Admin = Awaited<ReturnType<typeof modulos>>
async function modulos() {
  const [{ createAdminClient }, { renderEmail }, { sendEmail }, { isEmailSilentMode }] =
    await Promise.all([
      import('@/lib/supabase/admin'), import('@/lib/email/baseLayout'),
      import('@/lib/email/provider'), import('@/lib/email/silent-mode'),
    ])
  return { createAdminClient, renderEmail, sendEmail, isEmailSilentMode }
}

const ASUNTO_ORIGINAL = '¡Tu capacitación está por comenzar!'
const ASUNTO = 'Te escribimos por error — disculpanos'
/** Los estados de quien YA NO está en el grupo (ver estados-de-inscripcion). */
const NO_DEBIAN = ['dropped', 'cancelada', 'transferred'] as const

const MOTIVO: Record<string, string> = {
  dropped: 'te habías retirado de ese estudio',
  cancelada: 'tu matrícula a ese estudio estaba cancelada',
  transferred: 'te habías pasado a otro grupo',
}

type Fila = {
  member_id: string; persona: string; email: string
  estado: string; plan: string; grupo: string
  grupo_nuevo: string | null
  /** dd de mes del grupo destino. Hace falta para distinguirlo: hay grupos
   *  DISTINTOS con el mismo nombre —Pamela se pasó de un «SCJ — Este SJ» a
   *  otro «SCJ — Este SJ»— y sin la fecha el correo dice un absurdo. */
  inicio_nuevo: string | null
}

/**
 * El día y el mes del inicio, con `formatDayMonth` del repo y NO con
 * `new Date(...)`.
 *
 * Es el bug de zona horaria de siempre, y acá ya había picado: `starts_at`
 * llega como fecha sin hora, `new Date('2026-09-28')` es medianoche UTC —o sea
 * las 6 p.m. del 27 en Costa Rica— y el correo le decía a tres personas que su
 * estudio arrancaba un día antes. `parseFlexibleDate`, que es lo que
 * `formatDayMonth` usa por dentro, existe justamente para esto.
 */
function diaMes(iso: string | null | undefined): string | null {
  const t = formatDayMonth(iso)
  return t === '—' ? null : t
}

async function traerAfectados(M: Admin): Promise<Map<string, { persona: string; email: string; filas: Fila[] }>> {
  const supabase = M.createAdminClient()
  const { data: grupos } = await supabase
    .from('study_groups')
    .select('id, name, plan:study_plans!study_groups_plan_id_fkey(name)')
    .gte('start_notified_at', new Date(Date.now() - 10 * 864e5).toISOString())
  const ids = (grupos ?? []).map(g => g.id)
  if (ids.length === 0) return new Map()

  const { data: insc } = await supabase
    .from('study_enrollments')
    .select('member_id, group_id, status, transferred_to, member:members!study_enrollments_member_id_fkey(first_name, last_name, email)')
    .in('group_id', ids)
    .in('status', NO_DEBIAN as unknown as string[])

  const { data: logs } = await supabase
    .from('message_logs').select('recipient')
    .eq('subject', ASUNTO_ORIGINAL)
    .gte('created_at', new Date(Date.now() - 10 * 864e5).toISOString())
  const recibieron = new Set((logs ?? []).map(l => String(l.recipient).toLowerCase()))

  const nombreDeGrupo = new Map(
    (grupos ?? []).map(g => [g.id, { name: g.name as string,
      plan: (Array.isArray(g.plan) ? g.plan[0] : g.plan)?.name ?? g.name }]),
  )
  const { data: todos } = await supabase.from('study_groups').select('id, name, starts_at')
  const nombreSimple = new Map((todos ?? []).map(g =>
    [g.id, { name: g.name as string, starts_at: g.starts_at as string | null }]))

  const out = new Map<string, { persona: string; email: string; filas: Fila[] }>()
  for (const e of (insc ?? []) as unknown as Array<Record<string, unknown>>) {
    const m = e.member as { first_name: string; last_name: string; email: string | null } | null
    const email = (m?.email ?? '').trim()
    if (!email || !recibieron.has(email.toLowerCase())) continue
    const g = nombreDeGrupo.get(String(e.group_id))
    const fila: Fila = {
      member_id: String(e.member_id),
      persona: `${m!.first_name} ${m!.last_name}`.trim(),
      email,
      estado: String(e.status),
      plan: g?.plan ?? '—',
      grupo: g?.name ?? '—',
      grupo_nuevo: e.transferred_to ? nombreSimple.get(String(e.transferred_to))?.name ?? null : null,
      inicio_nuevo: e.transferred_to
        ? diaMes(nombreSimple.get(String(e.transferred_to))?.starts_at) : null,
    }
    const k = email.toLowerCase()
    if (!out.has(k)) out.set(k, { persona: fila.persona, email, filas: [] })
    out.get(k)!.filas.push(fila)
  }
  return out
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function cuerpo(persona: string, filas: readonly Fila[]): string {
  const nombre = esc(persona.split(' ')[0] || persona)
  const items = filas.map(f =>
    `<li><strong>${esc(f.plan)}</strong> (${esc(f.grupo)}) — ${esc(MOTIVO[f.estado] ?? 'ya no estabas en ese grupo')}.</li>`,
  ).join('')
  const transferida = filas.find(f => f.estado === 'transferred' && f.grupo_nuevo)
  // La fecha va SIEMPRE, no solo cuando los nombres chocan: es lo que
  // convierte «tu grupo actual» en algo que la persona puede verificar.
  const cuando = transferida?.inicio_nuevo ? ` que arranca el ${esc(transferida.inicio_nuevo)}` : ''
  const aclaracion = transferida
    ? `<p><strong>Ojo con esto:</strong> ese día te llegaron dos correos. El de `
      + `<strong>${esc(transferida.grupo_nuevo!)}</strong>${cuando}, que es tu grupo `
      + `actual, <strong>sí vale</strong> — ese estudio va y te esperamos. El que `
      + `sobró es el del grupo del que ya te habías pasado.</p>`
    : `<p>No tenés que hacer nada. Si no estabas esperando ese estudio, podés ignorar
       aquel correo tranquilamente.</p>`
  return `
    <p>Hola ${nombre},</p>
    <p>El fin de semana te llegó un correo nuestro que decía que una capacitación
       estaba por comenzar. <strong>Te lo mandamos por error</strong> y queremos
       aclararlo.</p>
    <p>El aviso salió de ${filas.length === 1 ? 'un estudio en el que' : 'estudios en los que'}
       ya no estabas inscrito:</p>
    <ul>${items}</ul>
    ${aclaracion}
    <p>Fue una falla nuestra en el sistema, no un cambio en tu matrícula: nada de lo
       tuyo se modificó. Ya lo corregimos para que no se repita.</p>
    <p>Perdón por la confusión, y gracias por la paciencia.</p>
    <p>Con cariño,<br>Equipo Theos Place</p>`
}

async function main() {
  const enviar = process.argv.includes('--enviar')
  const iP = process.argv.indexOf('--prueba')
  const prueba = iP >= 0 ? process.argv[iP + 1] : null
  if (iP >= 0 && !prueba) { console.error('✗ --prueba necesita un correo'); process.exit(1) }
  const M = await modulos()
  const afectados = await traerAfectados(M)

  if (prueba) {
    if (M.isEmailSilentMode()) {
      console.error('✗ EMAIL_SILENT_MODE está encendido: no saldría nada. Abortado.')
      process.exit(1)
    }
    // Una de cada variante, con datos REALES: así se revisa lo que de verdad
    // va a salir y no una maqueta.
    const comun = [...afectados.values()].find(a => !a.filas.some(f => f.estado === 'transferred'))
    const trans = [...afectados.values()].find(a => a.filas.some(f => f.estado === 'transferred'))
    for (const [etiqueta, a] of [['común', comun], ['transferida', trans]] as const) {
      if (!a) { console.log(`· no hay caso ${etiqueta}`); continue }
      const r = await M.sendEmail({
        to: { email: prueba, name: 'Prueba' }, subject: ASUNTO,
        html: M.renderEmail(cuerpo(a.persona, a.filas)), kind: 'transactional',
      })
      console.log(`${r.enviado ? '✓' : '·'} variante ${etiqueta} (datos de ${a.persona}) → ${prueba} ${r.motivo ?? ''}`)
    }
    console.log('\nNADIE más recibió nada. Para el envío real: --enviar')
    return
  }
  console.log(`\n${afectados.size} personas · ${[...afectados.values()].reduce((n, a) => n + a.filas.length, 0)} avisos erróneos\n`)
  if (enviar && M.isEmailSilentMode()) {
    console.error('✗ EMAIL_SILENT_MODE está encendido: no saldría nada. Abortado.')
    process.exit(1)
  }
  let n = 0
  for (const a of afectados.values()) {
    const html = M.renderEmail(cuerpo(a.persona, a.filas))
    if (!enviar) {
      console.log(`── ${a.persona} <${a.email}>`)
      console.log(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
        .split('Hola')[1]?.slice(0, 600).trim() ?? '')
      console.log()
      continue
    }
    const r = await M.sendEmail({ to: { email: a.email, name: a.persona }, subject: ASUNTO, html, kind: 'transactional' })
    console.log(`${r.enviado ? '✓' : '·'} ${a.email} ${r.motivo ?? ''}`)
    if (r.enviado) n++
  }
  console.log(enviar ? `\nenviados: ${n}` : '\n(dry run — nada se envió; correr con --enviar)')
}

main().catch(e => { console.error(e); process.exit(1) })
