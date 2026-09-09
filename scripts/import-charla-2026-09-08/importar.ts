/**
 * Alta y check-in retroactivo de los asistentes nuevos de la Charla Meridiano
 * Martes del 8-sep-2026, transcritos a mano de las hojas de la sede.
 *
 * SOBRE LOS CORREOS. El pedido decía "EMAIL_SILENT_MODE activo, que no dispare
 * ningún correo". El modo silencioso NO habría alcanzado: la invitación para
 * definir contraseña va marcada `authCritical: true`, que es justamente la única
 * excepción que lo atraviesa (ver src/lib/email/silent-mode.ts). Además la
 * variable ni siquiera está definida en .env.local, o sea que está apagada.
 * La garantía acá es otra y no depende de ninguna bandera: este script NO llama
 * a sendPasswordLink. createMember solo hace INSERT — no crea cuenta de acceso
 * ni manda nada.
 *
 * "Nuevo en la charla" no es "nuevo en el padrón": antes de crear a nadie se
 * busca por correo, teléfono normalizado y cédula. A quien ya exista se le
 * completan los huecos SIN pisar lo que ya tenga.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/import-charla-2026-09-08/importar.ts
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/import-charla-2026-09-08/importar.ts --aplicar
 */
import { readFileSync } from 'fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const CSV = 'data-import/nuevos-charla-meridiano-2026-09-08.csv'
const EVENTO_TITULO = 'Charla Meridiano Martes'
const EVENTO_FECHA = '2026-09-08'
/** 19:30 hora CR del 8-sep, la hora de inicio de esa charla. CR es UTC-6 fijo. */
const CHECKIN_AT = '2026-09-09T01:30:00Z'

const aplicar = process.argv.includes('--aplicar')

/** El día siguiente en formato YYYY-MM-DD, para cerrar la ventana UTC. */
function siguienteDia(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

type Fila = {
  first_name: string; last_name: string; phone: string; email: string
  birth_date: string; cedula: string; nota: string
}

/** Parser mínimo: el archivo no tiene comillas ni comas dentro de los campos —
 *  se verifica, en vez de asumirlo y partir un apellido por la mitad. */
function leerCsv(texto: string): Fila[] {
  const lineas = texto.trim().split('\n')
  const cab = lineas[0].split(',').map(h => h.trim())
  return lineas.slice(1).map((l, i) => {
    const celdas = l.split(',')
    if (celdas.length !== cab.length) {
      throw new Error(`Fila ${i + 2}: ${celdas.length} columnas y se esperaban ${cab.length}. ¿Una coma dentro de un campo?`)
    }
    return Object.fromEntries(cab.map((h, j) => [h, celdas[j].trim()])) as Fila
  })
}

async function main() {
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const { createMember, updateMember, normalizeEmail } = await import('../../src/lib/supabase/queries/members')
  const { normalizePhoneOrNull } = await import('../../src/lib/phone')
  const { edadEnAnios } = await import('../../src/lib/members/alta-persona')
  const sb = createAdminClient()

  const filas = leerCsv(readFileSync(CSV, 'utf8'))
  console.log(`${filas.length} personas en el archivo\n`)

  // ── El evento tiene que existir. No se crea desde acá. ────────────────────
  // La ventana se abre en UTC pero la fecha que se busca es la CIVIL DE COSTA
  // RICA. Una charla de las 7:30pm CR se guarda como el día SIGUIENTE en UTC, así
  // que filtrar por el día UTC no la encuentra — me pasó en la primera corrida y
  // el script reportó "no existe" un evento que sí existe. Se pide un rango
  // amplio y se filtra por el día CR de verdad.
  const { diaCR } = await import('../../src/lib/events/personas-nuevas')
  const { data: eventos } = await sb
    .from('events').select('id, title, starts_at')
    .eq('title', EVENTO_TITULO)
    .gte('starts_at', `${EVENTO_FECHA}T00:00:00Z`)
    .lte('starts_at', `${EVENTO_FECHA}T23:59:59Z`.replace(EVENTO_FECHA, siguienteDia(EVENTO_FECHA)))
  const evento = (eventos ?? [])
    .find(e => diaCR((e as { starts_at: string }).starts_at) === EVENTO_FECHA) as
      { id: string; title: string; starts_at: string } | undefined
  if (!evento) {
    console.log(`NO EXISTE la ocurrencia de «${EVENTO_TITULO}» del ${EVENTO_FECHA}.`)
    console.log('No se crea el evento desde acá. Reportado y se aborta.')
    return
  }
  console.log(`Evento: ${evento.title} — ${new Date(evento.starts_at).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' })}`)
  console.log(`  id ${evento.id}\n`)

  const existentes: string[] = []
  const nuevos: string[] = []
  const choques: string[] = []
  const idsParaCheckin: Array<{ id: string; nombre: string }> = []

  for (const f of filas) {
    const nombre = `${f.first_name} ${f.last_name}`
    const email = normalizeEmail(f.email)
    const tel = normalizePhoneOrNull(f.phone)
    const ced = f.cedula.trim().toUpperCase() || null
    const edad = f.birth_date ? edadEnAnios(f.birth_date) : null

    // ── Búsqueda por los tres identificadores, por separado ────────────────
    const hallados = new Map<string, { id: string; first_name: string; last_name: string; por: string[] }>()
    const sumar = (rows: unknown[], por: string) => {
      for (const r of rows as Array<{ id: string; first_name: string; last_name: string }>) {
        const y = hallados.get(r.id)
        if (y) y.por.push(por)
        else hallados.set(r.id, { ...r, por: [por] })
      }
    }
    if (email) {
      // Correo EXACTO: el `_` de un correo es comodín en ilike y encontraría a
      // otra persona (bug de las dos Paolas, 2026-09-09).
      const { patronDeCorreo } = await import('../../src/lib/email/correo-exacto')
      const { data } = await sb.from('members').select('id, first_name, last_name').ilike('email', patronDeCorreo(email))
      sumar(data ?? [], 'correo')
    }
    if (tel) {
      const { data } = await sb.from('members').select('id, first_name, last_name').eq('phone', tel)
      sumar(data ?? [], 'teléfono')
    }
    if (ced) {
      const { data } = await sb.from('members').select('id, first_name, last_name').eq('cedula', ced)
      sumar(data ?? [], 'cédula')
    }

    if (hallados.size > 1) {
      choques.push(`${nombre}: sus datos apuntan a ${hallados.size} fichas distintas — ${[...hallados.values()].map(h => `${h.first_name} ${h.last_name} (${h.por.join('+')})`).join(' / ')}. NO se toca.`)
      continue
    }

    if (hallados.size === 1) {
      const m = [...hallados.values()][0]
      // Completar SIN pisar: se pide la ficha y solo se llenan los huecos.
      const { data: actual } = await sb.from('members')
        .select('phone, email, birth_date, cedula').eq('id', m.id).maybeSingle()
      // El nombre de la ficha puede no ser el del papel. No se pisa —corregirlo
      // es decisión de una persona, no de un import— pero SE REPORTA: un
      // apellido distinto con el mismo teléfono puede ser un typo de la
      // transcripción o dos personas que comparten el celular.
      const nombreDistinto = `${m.first_name} ${m.last_name}`.trim().toLowerCase() !== nombre.trim().toLowerCase()
      const a = actual as { phone: string | null; email: string | null; birth_date: string | null; cedula: string | null } | null
      const parche: Record<string, unknown> = {}
      if (!a?.phone && tel) parche.phone = tel
      if (!a?.email && email) parche.email = email
      if (!a?.birth_date && f.birth_date) parche.birth_date = f.birth_date
      if (!a?.cedula && ced) { parche.cedula = ced; parche.document_type = 'cedula' }
      const completa = Object.keys(parche)
      const tiene = [
        a?.phone ? 'teléfono' : null, a?.email ? 'correo' : null,
        a?.birth_date ? 'fecha nac.' : null, a?.cedula ? 'cédula' : null,
      ].filter(Boolean)
      existentes.push(
        `${nombre} → YA EXISTE como «${m.first_name} ${m.last_name}» (matcheó por ${m.por.join(', ')})`
        + (nombreDistinto ? '  ⚠️ EL NOMBRE NO COINCIDE' : '')
        + `\n      ya tiene: ${tiene.join(', ') || '(nada)'}`
        + (completa.length ? `\n      se le completa: ${completa.join(', ')}` : '\n      no le falta nada de lo del papel'),
      )
      if (aplicar && completa.length) await updateMember(m.id, parche as Parameters<typeof updateMember>[1])
      idsParaCheckin.push({ id: m.id, nombre: `${m.first_name} ${m.last_name}` })
      continue
    }

    // ── Nueva ──────────────────────────────────────────────────────────────
    const etiquetaEdad = edad === null ? 'sin edad' : `${edad} años${edad < 18 ? ' · MENOR' : ''}`
    if (!aplicar) {
      nuevos.push(`${nombre} (${etiquetaEdad})${f.nota ? ` — nota: ${f.nota}` : ''}`)
      idsParaCheckin.push({ id: 'pendiente', nombre })
      continue
    }
    const creada = await createMember({
      first_name: f.first_name,
      last_name: f.last_name,
      phone: tel,
      email,
      birth_date: f.birth_date || null,
      cedula: ced,
      document_type: 'cedula',
      is_active: true,
    } as Parameters<typeof createMember>[0])
    nuevos.push(`${nombre} (${etiquetaEdad}) → creada ${creada.id}`)
    idsParaCheckin.push({ id: creada.id, nombre })
  }

  // ── Check-in retroactivo ──────────────────────────────────────────────────
  let hechos = 0, yaEstaban = 0
  if (aplicar) {
    for (const p of idsParaCheckin) {
      const { data: ya } = await sb.from('event_checkins')
        .select('id').eq('event_id', evento.id).eq('member_id', p.id).maybeSingle()
      if (ya) { yaEstaban++; continue }
      const { error } = await sb.from('event_checkins')
        .insert({ event_id: evento.id, member_id: p.id, method: 'manual', checked_in_at: CHECKIN_AT })
      if (error) throw error
      hechos++
    }
  }

  // ── Reporte ───────────────────────────────────────────────────────────────
  const t = (s: string) => `\n${s}\n${'─'.repeat(s.length)}`
  console.log(t(`YA EXISTÍAN (${existentes.length})`))
  existentes.forEach(l => console.log(`  · ${l}`))
  console.log(t(`${aplicar ? 'CREADAS' : 'SE CREARÍAN'} (${nuevos.length})`))
  nuevos.forEach(l => console.log(`  · ${l}`))
  if (choques.length) {
    console.log(t(`CHOQUES DE DEDUP (${choques.length})`))
    choques.forEach(l => console.log(`  ⚠️  ${l}`))
  }
  console.log(t('CHECK-IN'))
  if (aplicar) console.log(`  ${hechos} registrados · ${yaEstaban} ya estaban`)
  else console.log(`  se registrarían ${idsParaCheckin.length} personas en ${evento.title}`)

  console.log(t('CORREOS'))
  console.log('  0 enviados: el script no llama a sendPasswordLink. Nadie recibe nada.')

  if (!aplicar) console.log('\nSIMULACRO. Nada se escribió. Volvé a correrlo con --aplicar.')
}

main().catch(e => { console.error(e); process.exit(1) })
