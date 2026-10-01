/**
 * EST-14 · Grupos de prueba para ver el corte entre bloques.
 *
 * Crea CUATRO grupos que cubren los cuatro momentos del nuevo flujo, cada uno
 * con estudiantes propios:
 *
 *   1. N1 en curso          — el cobro de ₡5.000 cubre N1+N2 y los folletos
 *                             de 1 y 2 van juntos desde el inicio.
 *   2. N2 LISTO PARA CERRAR — acá está el corte: al cerrarlo el dirigente
 *                             responde «¿el grupo continúa a nivel 3-4?».
 *   3. N3 en curso          — el otro par: ₡10.000 y folletos de 3 y 4.
 *   4. N4 LISTO PARA CERRAR — fin de la cadena: al cerrarlo NO hay corte ni
 *                             grupo sucesor, y conviene verlo al lado del de
 *                             N2 para que la diferencia quede clara.
 *
 * Sirven también de ejemplo para el centro de ayuda (EST-20): son escenarios
 * estables, siempre en el mismo estado, que se pueden mostrar en una captura
 * sin exponer a nadie real.
 *
 * MARCADO igual que el resto del set de prueba, para que el limpiador de
 * siempre se los lleve sin tocar nada más:
 *   · el nombre empieza con «[prueba] »
 *   · members.external_id = «PRUEBA-EST14-xx», que es la llave del borrado
 *   · los correos viven en @prueba.theosplace.invalid (TLD reservado por la
 *     RFC 2606: no resuelve, así que un envío por error no le llega a nadie)
 *
 * NO crea cuentas de acceso: estos grupos son para mirar pantallas de
 * administración, no para que alguien entre.
 *
 * Uso (dry-run por defecto, no escribe nada):
 *   ENV_FILE=.env.staging.local npx tsx scripts/est14/sembrar-cortes.ts
 *   ENV_FILE=.env.staging.local npx tsx scripts/est14/sembrar-cortes.ts --aplicar
 *
 * Es idempotente por nombre de grupo y por external_id: re-correrlo no
 * duplica. Para borrarlo: scripts/limpiar-datos-de-prueba.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { entornoDeSupabase, NOMBRE_DE_ENTORNO } from '../../src/lib/entorno/base-de-datos'

const APLICAR = process.argv.includes('--aplicar')
const ARCHIVO_ENV = process.env.ENV_FILE || '.env.local'

const env = Object.fromEntries(
  readFileSync(ARCHIVO_ENV, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trimStart().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
)

/**
 * GUARD. La pregunta no es «¿puso la variable?» sino A QUÉ BASE APUNTA, que
 * el programa sabe solo. Sembrar 18 estudiantes falsos en el padrón real
 * ensucia reportes y conteos de folletos que alguien va a leer en serio.
 */
const entorno = entornoDeSupabase(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_STAGING_REF)
if (entorno === 'produccion') {
  console.error(`✋ ${ARCHIVO_ENV} apunta a PRODUCCIÓN. Este seed es solo para staging o local.`)
  console.error('   Usá: ENV_FILE=.env.staging.local npx tsx scripts/est14/sembrar-cortes.ts')
  process.exit(1)
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const MARCA = '[prueba]'
const DOMINIO = 'prueba.theosplace.invalid'
const PREFIJO = 'PRUEBA-EST14-'
const HOY = new Date()
const dias = (n: number) => new Date(HOY.getTime() + n * 86400000)
const ymd = (d: Date) => d.toISOString().slice(0, 10)

/** Los cuatro escenarios. Las fechas cuentan la historia de cada uno. */
const ESCENARIOS = [
  {
    code: 'N1', nombre: 'Nivel 1 — en curso', estado: 'en_curso' as const,
    inicio: dias(-30), fin: dias(30), estudiantes: 5,
    sirve: 'Ver el cobro de ₡5.000 que cubre N1+N2 y los folletos de 1 y 2 juntos.',
  },
  {
    code: 'N2', nombre: 'Nivel 2 — listo para cerrar (EL CORTE)', estado: 'en_curso' as const,
    inicio: dias(-90), fin: dias(-2), estudiantes: 5,
    sirve: 'Cerrarlo pregunta «¿continúa a nivel 3-4?». Con SÍ crea el grupo sucesor y el cobro de ₡10.000; con NO avisa a los comités.',
  },
  {
    code: 'N3', nombre: 'Nivel 3 — en curso', estado: 'en_curso' as const,
    inicio: dias(-20), fin: dias(40), estudiantes: 4,
    sirve: 'El otro par: ₡10.000 y folletos de 3 y 4.',
  },
  {
    code: 'N4', nombre: 'Nivel 4 — listo para cerrar (FIN DE LA CADENA)', estado: 'en_curso' as const,
    inicio: dias(-85), fin: dias(-1), estudiantes: 4,
    sirve: 'Cerrarlo NO pregunta nada ni crea sucesor. Al lado del de N2 se ve la diferencia.',
  },
]

const NOMBRES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fabián', 'Gaby', 'Hugo', 'Irene', 'Joel',
                 'Karla', 'Luis', 'Marta', 'Nico', 'Olga', 'Pablo', 'Rita', 'Saúl']

async function main() {
  console.log(`\nSeed EST-14 · base: ${NOMBRE_DE_ENTORNO[entorno]} (${ARCHIVO_ENV})`)
  console.log(APLICAR ? 'MODO: aplicando\n' : 'MODO: dry-run, no escribe nada\n')

  const { data: planes } = await db.from('study_plans').select('id, code, name')
  const porCode = new Map((planes ?? []).map((p: { id: string; code: string; name: string }) => [p.code, p]))
  const faltan = ESCENARIOS.filter(e => !porCode.has(e.code)).map(e => e.code)
  if (faltan.length) { console.error(`✋ Faltan planes en esta base: ${faltan.join(', ')}`); process.exit(1) }

  // Un dirigente de prueba, compartido por los cuatro grupos: así se ve cómo
  // los ve un dirigente real con varios grupos a cargo.
  const dirigente = await miembro(0, 'Dirigente', 'de Prueba')

  const resumen: Array<Record<string, string | number>> = []
  let n = 1
  for (const e of ESCENARIOS) {
    const plan = porCode.get(e.code)!
    const nombreGrupo = `${MARCA} ${e.nombre}`
    const grupoId = await grupo(nombreGrupo, plan.id, dirigente, e)
    const alumnos: string[] = []
    for (let i = 0; i < e.estudiantes; i++) {
      const m = await miembro(n++, NOMBRES[(n + i) % NOMBRES.length], `${e.code} Prueba`)
      alumnos.push(m)
      if (grupoId) await matricular(grupoId, m)
    }
    resumen.push({
      grupo: e.nombre, plan: e.code, estado: e.estado,
      estudiantes: alumnos.length, 'termina': ymd(e.fin), 'para qué sirve': e.sirve,
    })
  }
  console.table(resumen.map(r => ({ grupo: String(r.grupo).slice(0, 44), plan: r.plan, estudiantes: r.estudiantes, termina: r.termina })))
  console.log('\nPara qué sirve cada uno:')
  for (const r of resumen) console.log(`  · ${r.plan}: ${r['para qué sirve']}`)

  if (!APLICAR) console.log('\n(dry-run: no se escribió nada. Agregá --aplicar.)\n')
  else console.log(`\n✓ Listo. Dirigente: ${MARCA} Dirigente de Prueba. Borrar con scripts/limpiar-datos-de-prueba.ts\n`)
}

async function miembro(i: number, nombre: string, apellido: string): Promise<string> {
  const externalId = `${PREFIJO}${String(i).padStart(2, '0')}`
  const { data: ya } = await db.from('members').select('id').eq('external_id', externalId).maybeSingle()
  if (ya) return (ya as { id: string }).id
  if (!APLICAR) return ''
  const { data, error } = await db.from('members').insert({
    first_name: `${MARCA} ${nombre}`, last_name: apellido,
    email: `est14-${externalId.toLowerCase()}@${DOMINIO}`,
    external_id: externalId, is_active: true,
    birth_date: `${1990 + (i % 15)}-0${1 + (i % 9)}-1${i % 10}`,
  }).select('id').single()
  if (error) throw new Error(`miembro ${externalId}: ${error.message}`)
  return (data as { id: string }).id
}

async function grupo(
  nombre: string, planId: string, leaderId: string,
  e: { estado: string; inicio: Date; fin: Date },
): Promise<string> {
  const { data: ya } = await db.from('study_groups').select('id').eq('name', nombre).maybeSingle()
  if (ya) return (ya as { id: string }).id
  if (!APLICAR) return ''
  const { data, error } = await db.from('study_groups').insert({
    plan_id: planId, name: nombre, leader_id: leaderId || null, status: e.estado,
    max_students: 20, zone: 'Heredia', schedule_days: ['M'], schedule_time: '19:00',
    location: `${MARCA} Aula de pruebas`,
    starts_at: e.inicio.toISOString(), ends_at: e.fin.toISOString(),
    enrollment_start_date: ymd(dias(-120)), enrollment_end_date: ymd(dias(-1)),
  }).select('id').single()
  if (error) throw new Error(`grupo ${nombre}: ${error.message}`)
  return (data as { id: string }).id
}

async function matricular(groupId: string, memberId: string) {
  if (!APLICAR || !groupId || !memberId) return
  const { data: ya } = await db.from('study_enrollments')
    .select('id').eq('group_id', groupId).eq('member_id', memberId).maybeSingle()
  if (ya) return
  const { error } = await db.from('study_enrollments').insert({
    group_id: groupId, member_id: memberId, status: 'enrolled',
    enrolled_at: HOY.toISOString(), notes: `${MARCA} EST-14`,
  })
  if (error) throw new Error(`matrícula: ${error.message}`)
}

main().catch(e => { console.error('✗', e.message); process.exit(1) })
