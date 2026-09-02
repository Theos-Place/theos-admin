/**
 * SET DE DATOS DE PRUEBA — agosto 2026
 *
 * Crea un conjunto completo y REVERSIBLE para probar los flujos principales
 * sobre la base real (no hay staging). Todo queda marcado por tres vías:
 *
 *   · el nombre empieza con "[prueba] " — se ve en cualquier listado;
 *   · members.external_id = "PRUEBA-0001", "PRUEBA-0002"… — es la llave del borrado;
 *   · el correo vive en @prueba.theosplace.invalid — TLD reservado por RFC 2606:
 *     no resuelve, así que un broadcast por error no le llega a nadie real.
 *
 * Se apoya en lo que los otros seeds ya dejaron cargado (planes de estudio,
 * charlas, comités) y comparte con seed-test-users.ts el alta de cuentas
 * (scripts/lib/cuentas-de-prueba.ts). NO reimplementa los importadores.
 *
 * Uso:
 *   PERMITIR_SEED_PRUEBA=1 npx tsx scripts/seed-datos-de-prueba.ts
 *
 * Al terminar escribe docs/datos-de-prueba.md con TODO lo creado.
 * Para borrarlo: scripts/limpiar-datos-de-prueba.ts (dry-run por defecto).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { crearCuentaDeAcceso } from './lib/cuentas-de-prueba'

// ── Entorno ──────────────────────────────────────────────────────────────────
for (const f of ['.env', '.env.local']) {
  try {
    for (const l of readFileSync(f, 'utf8').split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* sin archivo */ }
}

// GUARD: esto escribe en la base REAL. Que sea una decisión, no un accidente.
if (process.env.PERMITIR_SEED_PRUEBA !== '1') {
  console.error(`
✋ Este script crea datos en la base de PRODUCCIÓN (no hay staging).

   Todo queda marcado con "[prueba]" y external_id PRUEBA-xxxx, y se borra con
   scripts/limpiar-datos-de-prueba.ts — pero mientras tanto vive en el padrón real.

   Si es lo que querés:
     PERMITIR_SEED_PRUEBA=1 npx tsx scripts/seed-datos-de-prueba.ts
`)
  process.exit(1)
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1) }
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) as SupabaseClient<never, 'public', never>
/** payments y otras tablas tienen columnas fuera de los tipos generados. */
const laxo = db as unknown as SupabaseClient

// ── Constantes del set ───────────────────────────────────────────────────────
export const MARCA = '[prueba]'
export const PREFIJO_EXTERNAL = 'PRUEBA-'
export const DOMINIO = 'prueba.theosplace.invalid'
/** Contraseña única para todas las cuentas del set. Son cuentas con correo
 *  .invalid que se borran en dos semanas: se documenta a propósito. */
const CLAVE = process.env.PRUEBA_PASSWORD ?? 'Prueba.Agosto.2026'

const HOY = new Date()
const BORRADO = new Date(HOY.getTime() + 14 * 86400000)
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const NOTA = `Dato de prueba creado el ${ymd(HOY)}. Borrado previsto: ${ymd(BORRADO)}.`

let seq = 0
const externalId = () => `${PREFIJO_EXTERNAL}${String(++seq).padStart(4, '0')}`

// ── Hoja de referencia (se va llenando y se escribe al final) ────────────────
type FilaPersona = {
  nombre: string; correo: string; clave: string | null; rol: string
  caso: string; sirve: string
}
type FilaGrupo = {
  nombre: string; plan: string; etapa: string; estado: string
  dirigente: string; estudiantes: number; sirve: string
}
const personas: FilaPersona[] = []
const grupos: FilaGrupo[] = []
const otros: Array<{ bloque: string; que: string; detalle: string }> = []

// ── Utilidades ───────────────────────────────────────────────────────────────
let telSeq = 0
const telefono = () => `8000-00${String(++telSeq).padStart(2, '0')}`
/** Correo a partir del nombre. Los DÍGITOS se conservan: con `[^a-z]` (el bug
 *  del 2026-08-05) "Est01 Para Cierre" y "Est02 Para Cierre" caían los dos en
 *  est.para.cierre@ — doce personas compartiendo correo, que además el detector
 *  de duplicados del sistema iba a reportar como si fuera un error suyo. */
const correo = (nombre: string) =>
  `${nombre.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '.')}@${DOMINIO}`

async function crearMiembro(input: {
  nombre: string           // "Ana Rojas" (sin la marca; se agrega acá)
  genero?: 'M' | 'F'
  cedula?: string
  conCuenta?: boolean
  rol?: string
  caso: string
  sirve: string
}): Promise<{ id: string; nombre: string; correo: string }> {
  const nombreCompleto = `${MARCA} ${input.nombre}`
  const [first, ...resto] = input.nombre.split(' ')
  const email = correo(input.nombre)
  const ext = externalId()

  // Idempotente por external_id: re-correr no duplica.
  const { data: ya } = await laxo.from('members').select('id, email').eq('external_id', ext).maybeSingle()
  let id = (ya as { id: string; email: string | null } | null)?.id ?? null

  // Ya existe: se corrigen nombre y correo si cambiaron (así el arreglo de los
  // correos duplicados llega a los registros que ya estaban, sin duplicar gente).
  if (id) {
    const actual = (ya as { email: string | null }).email
    if (actual !== email) {
      const { error } = await laxo.from('members')
        .update({ first_name: `${MARCA} ${first}`, last_name: resto.join(' ') || '·', email })
        .eq('id', id)
      if (error) throw new Error(`actualizar ${input.nombre}: ${error.message}`)
    }
  }

  if (!id) {
    const { data, error } = await laxo.from('members').insert({
      first_name: `${MARCA} ${first}`,
      last_name: resto.join(' ') || '·',
      email,
      phone: telefono(),
      gender: input.genero ?? null,
      cedula: input.cedula ?? null,
      external_id: ext,
      is_active: true,
      occupation: NOTA,
    }).select('id').single()
    if (error) throw new Error(`miembro ${input.nombre}: ${error.message}`)
    id = (data as { id: string }).id
  }

  if (input.conCuenta) {
    await crearCuentaDeAcceso(db, {
      email, password: CLAVE, nombre: nombreCompleto, memberId: id,
      role: (input.rol as never) ?? undefined,
    })
  }

  personas.push({
    nombre: nombreCompleto,
    correo: email,
    clave: input.conCuenta ? CLAVE : null,
    rol: input.rol ?? 'miembro',
    caso: input.caso,
    sirve: input.sirve,
  })
  return { id: id!, nombre: nombreCompleto, correo: email }
}

/** Check-ins de charla para que la elegibilidad los cuente de verdad.
 *  `cantidad` dentro de la ventana (6 meses completos + lo que va del mes), y
 *  siempre al menos uno en los últimos 60 días (la otra condición del criterio). */
async function darAsistencia(memberId: string, cantidad: number, charlas: string[]) {
  const { count } = await laxo.from('event_checkins')
    .select('id', { count: 'exact', head: true }).eq('member_id', memberId)
  if ((count ?? 0) >= cantidad) return // ya la tiene (re-corrida)
  const filas: Array<{ event_id: string; member_id: string; checked_in_at: string; method: string }> = []
  for (let i = 0; i < cantidad; i++) {
    const f = new Date(HOY)
    // La primera hace 5 días (cumple la recencia de 60); el resto, hacia atrás.
    f.setDate(f.getDate() - (5 + i * 12))
    filas.push({
      event_id: charlas[i % charlas.length],
      member_id: memberId,
      checked_in_at: f.toISOString(),
      method: 'manual',
    })
  }
  const { error } = await laxo.from('event_checkins').insert(filas)
  if (error) throw new Error(`asistencia: ${error.message}`)
}

/** Donación reciente: el trigger trg_donations_donor recalcula members.is_donor. */
async function hacerDonante(memberId: string) {
  const { count } = await laxo.from('donations')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId).eq('source_file', 'seed-datos-de-prueba')
  if (count) return
  const f = new Date(HOY); f.setMonth(f.getMonth() - 1)
  const { error } = await laxo.from('donations').insert({
    member_id: memberId, donation_date: ymd(f), amount: 10000, currency: 'CRC',
    source_file: 'seed-datos-de-prueba', is_identified: true,
  })
  if (error) throw new Error(`donación: ${error.message}`)
}

/** Asignación activa en un comité (es lo que hace "servidor", no la vacante). */
async function hacerServidor(memberId: string, positionId: string) {
  const { count } = await laxo.from('volunteers')
    .select('id', { count: 'exact', head: true }).eq('member_id', memberId).eq('position_id', positionId)
  if (count) return
  const { error } = await laxo.from('volunteers').insert({
    member_id: memberId, position_id: positionId, status: 'active', start_date: ymd(HOY),
  })
  if (error) throw new Error(`servidor: ${error.message}`)
}

/** Matrícula ya completada de un plan — para los prerequisitos de cadena. */
async function completarEstudio(memberId: string, planId: string) {
  const { count } = await laxo.from('study_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId).eq('plan_id', planId).eq('status', 'completed')
  if (count) return
  const { error } = await laxo.from('study_enrollments').insert({
    member_id: memberId, plan_id: planId, status: 'completed',
    enrolled_at: new Date(HOY.getTime() - 200 * 86400000).toISOString(),
    completed_at: new Date(HOY.getTime() - 30 * 86400000).toISOString(),
    grade: 90, notes: NOTA,
  })
  if (error) throw new Error(`estudio completado: ${error.message}`)
}

/** Horario distinto por grupo: hay un índice único
 *  (plan_id, leader_id, schedule_time, zone) sobre los grupos activos, así que
 *  dos grupos del mismo plan con el mismo dirigente chocan si comparten hora. */
let horaSeq = 0
const horarioLibre = () => `${String(8 + (horaSeq++ % 12)).padStart(2, '0')}:00`

async function crearGrupo(input: {
  nombre: string; planId: string; planCode: string; etapa: string
  leaderId: string; leaderNombre: string
  estado: 'en_matricula' | 'en_curso' | 'finalizado'
  inicio?: Date; fin?: Date
  sirve: string
}): Promise<string> {
  const nombre = `${MARCA} ${input.nombre}`
  // La fila de la hoja se registra SIEMPRE, exista o no el grupo: si no, una
  // re-corrida generaba la hoja sin los grupos que ya estaban.
  grupos.push({
    nombre, plan: input.planCode, etapa: input.etapa, estado: input.estado,
    dirigente: input.leaderNombre, estudiantes: 0, sirve: input.sirve,
  })
  const { data: ya } = await laxo.from('study_groups').select('id').eq('name', nombre).maybeSingle()
  if (ya) return (ya as { id: string }).id

  const desde = input.inicio ?? HOY
  const hasta = input.fin ?? new Date(HOY.getTime() + 60 * 86400000)
  const { data, error } = await laxo.from('study_groups').insert({
    plan_id: input.planId,
    name: nombre,
    leader_id: input.leaderId,
    status: input.estado,
    max_students: 20,
    zone: 'Heredia',
    schedule_days: ['M'],
    schedule_time: horarioLibre(),
    location: `${MARCA} Aula de pruebas`,
    starts_at: desde.toISOString(),
    ends_at: hasta.toISOString(),
    // Ventana de matrícula abierta de par en par para poder probar el alta.
    enrollment_start_date: ymd(new Date(HOY.getTime() - 7 * 86400000)),
    enrollment_end_date: ymd(new Date(HOY.getTime() + 60 * 86400000)),
  }).select('id').single()
  if (error) throw new Error(`grupo ${nombre}: ${error.message}`)
  return (data as { id: string }).id
}

async function matricular(groupId: string, memberId: string, status = 'enrolled') {
  const { data: ya } = await laxo.from('study_enrollments')
    .select('id').eq('group_id', groupId).eq('member_id', memberId).maybeSingle()
  if (ya) return (ya as { id: string }).id
  const { data, error } = await laxo.from('study_enrollments')
    .insert({ group_id: groupId, member_id: memberId, status, enrolled_at: HOY.toISOString(), notes: NOTA })
    .select('id').single()
  if (error) throw new Error(`matrícula: ${error.message}`)
  return (data as { id: string }).id
}


// ─────────────────────────────────────────────────────────────────────────────
// EL SET
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nSet de datos de prueba · ${ymd(HOY)} · borrado previsto ${ymd(BORRADO)}\n`)

  // Catálogos que YA cargaron los otros seeds (no se recrean).
  const { data: planesRaw } = await laxo.from('study_plans').select('id, code, name, level')
  const planes = new Map((planesRaw ?? []).map((p: { id: string; code: string; name: string; level: string }) =>
    [p.code, p]))
  const plan = (code: string) => {
    const p = planes.get(code)
    if (!p) throw new Error(`Falta el plan ${code}: corré antes scripts/seed-study-plans.ts`)
    return p as { id: string; code: string; name: string; level: string }
  }

  const { data: charlasRaw } = await laxo.from('events')
    .select('id').eq('event_type', 'charla')
    .gte('starts_at', new Date(HOY.getTime() - 170 * 86400000).toISOString())
    .lte('starts_at', HOY.toISOString()).limit(30)
  const charlas = (charlasRaw ?? []).map((e: { id: string }) => e.id)
  if (charlas.length < 6) throw new Error('No hay charlas recientes para colgar asistencia (corré seed-charlas.ts)')

  // Puesto de servicio de prueba, en un comité real: lo que hace "servidor" es
  // la asignación (volunteers), no la vacante.
  const { data: comite } = await laxo.from('areas')
    .select('id, name').eq('area_type', 'committee').order('name').limit(1).maybeSingle()
  const comiteId = (comite as { id: string; name: string }).id
  const puestoNombre = `${MARCA} Puesto de servicio`
  let { data: puesto } = await laxo.from('service_positions').select('id').eq('title', puestoNombre).maybeSingle()
  if (!puesto) {
    const { data, error } = await laxo.from('service_positions').insert({
      area_id: comiteId, title: puestoNombre, description: NOTA, quantity: 50, is_active: true,
    }).select('id').single()
    if (error) throw new Error(`puesto: ${error.message}`)
    puesto = data as { id: string }
  }
  const puestoId = (puesto as { id: string }).id
  otros.push({ bloque: 'Servicio', que: puestoNombre, detalle: `Comité "${(comite as { name: string }).name}" · lo usan los servidores del set` })

  // ── Dirigentes de prueba (nunca uno real) ──────────────────────────────────
  console.log('· Dirigentes')
  const dirigente = await crearMiembro({
    nombre: 'Dora Dirigente', genero: 'F', conCuenta: true, rol: 'dirigente',
    caso: 'Dirigente de todos los grupos del set',
    sirve: 'Entrar como dirigente y ver solo SUS grupos; tomar asistencia y cerrar un grupo',
  })
  const coDirigente = await crearMiembro({
    nombre: 'Coco Codirigente', genero: 'M', conCuenta: true, rol: 'dirigente',
    caso: 'Co-dirigente',
    sirve: 'Probar que el co-dirigente ve el grupo igual que el dirigente',
  })

  // ── A) Un grupo por categoría, en matrícula ────────────────────────────────
  console.log('· A · grupos en matrícula, uno por categoría')
  const gruposMatricula: Record<string, string> = {}
  const catalogo: Array<[string, string, string]> = [
    ['N1', 'niveles', 'Matrícula sin compromisos: cualquiera elegible por cadena'],
    ['N2', 'niveles', 'Pide N1 completado — probar el bloqueo por prerequisito'],
    ['N3', 'niveles', 'Pide N2 completado'],
    ['N4', 'niveles', 'Último de la cadena de niveles'],
    ['SCJ', 'inicial', 'Etapa inicial: pide asistencia activa (≥6 charlas)'],
    ['DIS1', 'intermedia', 'Etapa intermedia: pide donante + servidor + asistencia reforzada (≥12)'],
    ['CDEB', 'avanzada', 'Etapa avanzada: mismos compromisos que intermedia Y solo por invitación (EST-5)'],
    ['TRANS', 'campaña', 'Campaña: sin compromisos ni prerequisitos'],
  ]
  for (const [code, etapa, sirve] of catalogo) {
    const p = plan(code)
    gruposMatricula[code] = await crearGrupo({
      nombre: `Grupo ${code} en matrícula`, planId: p.id, planCode: code, etapa,
      leaderId: dirigente.id, leaderNombre: dirigente.nombre, estado: 'en_matricula', sirve,
    })
    await laxo.from('study_groups').update({ co_leader_id: coDirigente.id }).eq('id', gruposMatricula[code])
  }

  // ── B) Personas elegibles, una por categoría ───────────────────────────────
  console.log('· B · personas elegibles y casos negativos')
  // Niveles: solo cadena.
  const anaN1 = await crearMiembro({
    nombre: 'Ana Nivel Uno', genero: 'F', conCuenta: true,
    caso: 'Sin historial: elegible solo para N1 y campañas',
    sirve: 'Matrícula a N1 y a la campaña; ver que N2+ le salen bloqueados por prerequisito',
  })
  const brunoN3 = await crearMiembro({
    nombre: 'Bruno Nivel Tres', genero: 'M', conCuenta: true,
    caso: 'N1 y N2 completados',
    sirve: 'Matrícula a N3 (prerequisito cumplido) y ver el histórico de estudios en su ficha',
  })
  await completarEstudio(brunoN3.id, plan('N1').id)
  await completarEstudio(brunoN3.id, plan('N2').id)

  const cintiaInicial = await crearMiembro({
    nombre: 'Cintia Inicial', genero: 'F', conCuenta: true,
    caso: 'Asistencia activa (8 charlas, una reciente)',
    sirve: 'Matrícula a etapa inicial (SCJ) con el resumen de compromisos en verde',
  })
  await darAsistencia(cintiaInicial.id, 8, charlas)

  const danielIntermedia = await crearMiembro({
    nombre: 'Daniel Intermedio', genero: 'M', conCuenta: true,
    caso: 'Cumple los 3 compromisos de intermedia: 14 charlas, donante y servidor',
    sirve: 'Matrícula a intermedia (DIS1) con los tres compromisos en verde',
  })
  await darAsistencia(danielIntermedia.id, 14, charlas)
  await hacerDonante(danielIntermedia.id)
  await hacerServidor(danielIntermedia.id, puestoId)

  const elenaAvanzada = await crearMiembro({
    nombre: 'Elena Avanzada', genero: 'F', conCuenta: true,
    caso: 'Cumple los compromisos de avanzada pero NO tiene invitación',
    sirve: 'Ver que CDEB no aparece aunque cumpla todo (EST-5: es por invitación)',
  })
  await darAsistencia(elenaAvanzada.id, 14, charlas)
  await hacerDonante(elenaAvanzada.id)
  await hacerServidor(elenaAvanzada.id, puestoId)

  // Casos negativos, uno por requisito.
  const negSinAsistencia = await crearMiembro({
    nombre: 'Nora Sin Asistencia', genero: 'F',
    caso: 'NEGATIVO · donante y servidora, pero sin charlas',
    sirve: 'Ver el bloqueo y el mensaje de asistencia en el resumen de compromisos (MAT-1)',
  })
  await hacerDonante(negSinAsistencia.id)
  await hacerServidor(negSinAsistencia.id, puestoId)

  const negSinDonacion = await crearMiembro({
    nombre: 'Nelson Sin Donar', genero: 'M',
    caso: 'NEGATIVO · asistencia reforzada y servidor, pero no donante',
    sirve: 'Ver el bloqueo por donante en intermedia',
  })
  await darAsistencia(negSinDonacion.id, 14, charlas)
  await hacerServidor(negSinDonacion.id, puestoId)

  const negSinServicio = await crearMiembro({
    nombre: 'Nidia Sin Servicio', genero: 'F',
    caso: 'NEGATIVO · asistencia reforzada y donante, pero no sirve en ningún comité',
    sirve: 'Ver el bloqueo por servicio en intermedia',
  })
  await darAsistencia(negSinServicio.id, 14, charlas)
  await hacerDonante(negSinServicio.id)

  await crearMiembro({
    nombre: 'Nacho Sin Prerequisito', genero: 'M',
    caso: 'NEGATIVO · sin ningún estudio completado',
    sirve: 'Ver el bloqueo por prerequisito al intentar N3',
  })

  // Matrículas de muestra en los grupos abiertos.
  await matricular(gruposMatricula.N1, anaN1.id)
  await matricular(gruposMatricula.SCJ, cintiaInicial.id)
  await matricular(gruposMatricula.DIS1, danielIntermedia.id)

  // ── C) Pagos en todos los estados de la cola ───────────────────────────────
  console.log('· C · pagos y becas')
  const planPago = plan('N1')
  async function personaConPago(input: {
    nombre: string; review: 'sin_comprobante' | 'en_revision' | 'rechazado'
    caso: string; sirve: string
  }) {
    const m = await crearMiembro({ nombre: input.nombre, conCuenta: true, caso: input.caso, sirve: input.sirve })
    const enrollmentId = await matricular(gruposMatricula.N1, m.id)
    const base: Record<string, unknown> = {
      member_id: m.id, amount: 12000, currency: 'CRC', payment_method: 'comprobante',
      concept: 'matricula', enrollment_id: enrollmentId, study_group_id: gruposMatricula.N1,
      entity_type: 'study_group', status: 'pending', description: NOTA,
    }
    if (input.review === 'en_revision') { base.review_status = 'en_revision'; base.receipt_path = 'prueba/comprobante.jpg' }
    if (input.review === 'rechazado') {
      base.review_status = 'rechazado'
      base.receipt_path = 'prueba/comprobante.jpg'
      base.rejection_reason = 'No se lee el monto (comprobante de prueba)'
      base.reviewed_at = new Date(HOY.getTime() - 2 * 86400000).toISOString()
    }
    const { count: yaPago } = await laxo.from('payments')
      .select('id', { count: 'exact', head: true }).eq('enrollment_id', enrollmentId)
    if (!yaPago) {
      const { error } = await laxo.from('payments').insert(base)
      if (error) throw new Error(`pago ${input.nombre}: ${error.message}`)
    }
    return m
  }

  await personaConPago({
    nombre: 'Pablo Pago Pendiente', review: 'sin_comprobante',
    caso: 'Matriculado en N1 con cobro pendiente, sin comprobante',
    sirve: 'Ver el cobro en /mis-pagos y subir el comprobante desde el perfil',
  })
  await personaConPago({
    nombre: 'Paula Pago En Revision', review: 'en_revision',
    caso: 'Comprobante subido, esperando revisión',
    sirve: 'Aprobar o rechazar desde la cola de /finanzas/pagos',
  })
  await personaConPago({
    nombre: 'Pedro Pago Rechazado', review: 'rechazado',
    caso: 'Comprobante rechazado hace 2 días',
    sirve: 'Ver el motivo del rechazo y volver a subir; comprobar que NO pierde la matrícula',
  })

  const conBeca = await crearMiembro({
    nombre: 'Beatriz Beca Activa', conCuenta: true,
    caso: 'Beca activa del 100% para N1',
    sirve: 'Matricularse aplicando la beca y ver que no se genera cobro',
  })
  const { count: yaBeca } = await laxo.from('scholarships')
    .select('id', { count: 'exact', head: true }).eq('member_id', conBeca.id)
  const { error: eBeca } = yaBeca ? { error: null } : await laxo.from('scholarships').insert({
    member_id: conBeca.id, entity_type: 'study_plan', plan_id: planPago.id,
    discount_type: 'percentage', discount_value: 100, status: 'active', kind: 'asignada',
    approval_type: 'total', is_used: false, reason: NOTA, notes: NOTA,
  })
  if (eBeca) throw new Error(`beca: ${eBeca.message}`)

  const becaUsada = await crearMiembro({
    nombre: 'Benito Beca Usada', conCuenta: true,
    caso: 'Beca ya consumida',
    sirve: 'Ver que una beca usada no se puede volver a aplicar',
  })
  const { count: yaBeca2 } = await laxo.from('scholarships')
    .select('id', { count: 'exact', head: true }).eq('member_id', becaUsada.id)
  if (!yaBeca2) await laxo.from('scholarships').insert({
    member_id: becaUsada.id, entity_type: 'study_plan', plan_id: planPago.id,
    discount_type: 'percentage', discount_value: 50, status: 'used', kind: 'asignada',
    approval_type: 'parcial', is_used: true, used_at: HOY.toISOString(), reason: NOTA, notes: NOTA,
  })

  // ── D) Grupo listo para cierre ─────────────────────────────────────────────
  console.log('· D · grupo listo para cierre')
  const grupoCierre = await crearGrupo({
    nombre: 'Grupo N2 listo para cierre', planId: plan('N2').id, planCode: 'N2', etapa: 'niveles',
    leaderId: dirigente.id, leaderNombre: dirigente.nombre, estado: 'en_curso',
    inicio: new Date(HOY.getTime() - 120 * 86400000),
    fin: new Date(HOY.getTime() - 3 * 86400000),
    sirve: 'Probar el cierre completo: aprobados, reprobados con justificación y retirados con motivo (ahora obligatorio)',
  })
  for (let i = 1; i <= 8; i++) {
    const est = await crearMiembro({
      nombre: `Est${String(i).padStart(2, '0')} Para Cierre`,
      caso: `Estudiante ${i} de 8 del grupo listo para cierre`,
      sirve: i === 1 ? 'Marcarlo aprobado, reprobado o retirado en el cierre' : '—',
    })
    await matricular(grupoCierre, est.id)
    await darAsistencia(est.id, 3, charlas)
  }
  grupos.find(g => g.nombre.includes('N2 listo para cierre'))!.estudiantes = 8

  // ── E) Grupo DIS3 para el flujo de recomendación a CDEB ────────────────────
  console.log('· E · grupo DIS3 para recomendación a CDEB')
  const grupoDis3 = await crearGrupo({
    nombre: 'Grupo DIS3 listo para cierre', planId: plan('DIS3').id, planCode: 'DIS3', etapa: 'intermedia',
    leaderId: dirigente.id, leaderNombre: dirigente.nombre, estado: 'en_curso',
    inicio: new Date(HOY.getTime() - 150 * 86400000),
    fin: new Date(HOY.getTime() - 5 * 86400000),
    sirve: 'Cierre con recomendación a CDEB por estudiante (EST-9)',
  })
  const alumnosDis3: Array<{ id: string; nombre: string }> = []
  for (let i = 1; i <= 4; i++) {
    const est = await crearMiembro({
      nombre: `Dis${String(i).padStart(2, '0')} Candidato CDEB`,
      caso: `Estudiante ${i} de DIS3, candidato a CDEB`,
      sirve: 'Llenar la recomendación a CDEB al cerrar el grupo',
    })
    await matricular(grupoDis3, est.id)
    alumnosDis3.push({ id: est.id, nombre: est.nombre })
  }
  grupos.find(g => g.nombre.includes('DIS3 listo'))!.estudiantes = 4

  // ── F) Recomendaciones ya creadas ──────────────────────────────────────────
  console.log('· F · recomendaciones ya llenas')
  const recomendaciones = [
    { r: 'si_sin_reservas', txt: 'Sí, sin reservas' },
    { r: 'si_con_reservas', txt: 'Sí, con reservas' },
    { r: 'no', txt: 'No recomendado' },
  ]
  for (let i = 0; i < recomendaciones.length; i++) {
    const al = alumnosDis3[i]
    const { count: yaRec } = await laxo.from('cdeb_recommendations')
      .select('id', { count: 'exact', head: true }).eq('member_id', al.id)
    if (yaRec) { otros.push({ bloque: 'Recomendaciones CDEB', que: al.nombre, detalle: recomendaciones[i].txt }); continue }
    const { error } = await laxo.from('cdeb_recommendations').insert({
      member_id: al.id, group_id: grupoDis3, filled_by: dirigente.id, status: 'enviada',
      recommendation: recomendaciones[i].r,
      testimony_score: 4, passion_score: 4, bible_knowledge_score: 3, speech_score: 3,
      committee_notes: `${recomendaciones[i].txt}. ${NOTA}`,
    })
    if (error) {
      // El catálogo de valores puede diferir: se avisa y se sigue (no bloquea el set).
      console.warn(`  ⚠ recomendación "${recomendaciones[i].r}": ${error.message}`)
      break
    }
    otros.push({ bloque: 'Recomendaciones CDEB', que: al.nombre, detalle: recomendaciones[i].txt })
  }

  // ── G) Dos parejas para prematrimonial ─────────────────────────────────────
  console.log('· G · parejas de prematrimonial')
  async function pareja(nom: string, cumple: boolean) {
    const el = await crearMiembro({
      nombre: `${nom} Novio`, genero: 'M', cedula: `9-${telSeq}000-${telSeq}001`, conCuenta: true,
      caso: cumple ? 'Novio que CUMPLE el requisito (N1 completado + matriculado en N2, con cédula)'
                   : 'Novio que NO cumple (sin N1 ni N2)',
      sirve: cumple ? 'Inscripción al prematrimonial que pasa los guards' : 'Ver el bloqueo de PRE-5 diciendo quién no cumple',
    })
    const ella = await crearMiembro({
      nombre: `${nom} Novia`, genero: 'F', cedula: `9-${telSeq}000-${telSeq}002`, conCuenta: true,
      caso: cumple ? 'Novia que CUMPLE el requisito' : 'Novia sin documento registrado',
      sirve: cumple ? 'La otra mitad de la pareja que sí puede' : 'Ver el bloqueo por documento faltante',
    })
    if (cumple) {
      for (const p of [el, ella]) {
        await completarEstudio(p.id, plan('N1').id)
        await matricular(gruposMatricula.N2, p.id)
      }
    }
    otros.push({
      bloque: 'Prematrimonial',
      que: `${el.nombre} + ${ella.nombre}`,
      detalle: cumple ? 'CUMPLE PRE-5: ambos con N1 completado y matriculados en N2, géneros distintos'
                      : 'NO cumple: sirve para ver los bloqueos de PRE-5 y PRE-7',
    })
  }
  // Segunda evaluación para el MISMO candidato, de otro grupo y otro dirigente:
  // sirve para ver cómo se lee la lista cuando hay más de una (pedido 2026-08-05).
  const grupoPanCerrado = await crearGrupo({
    nombre: 'Grupo Panorama cerrado', planId: plan('PAN').id, planCode: 'PAN', etapa: 'intermedia',
    leaderId: coDirigente.id, leaderNombre: coDirigente.nombre, estado: 'finalizado',
    inicio: new Date(HOY.getTime() - 300 * 86400000),
    fin: new Date(HOY.getTime() - 120 * 86400000),
    sirve: 'Grupo ya cerrado · aporta una SEGUNDA evaluación a CDEB del mismo candidato, hecha por otro dirigente',
  })
  const segundas = [
    { al: alumnosDis3[0], r: 'si_con_reservas', txt: 'Sí, con reservas' },
    { al: alumnosDis3[1], r: 'si_otro_estudio', txt: 'Sí, pero debería llevar otro estudio primero' },
  ]
  for (const { al, r, txt } of segundas) {
    await matricular(grupoPanCerrado, al.id, 'completed')
    const { count: ya } = await laxo.from('cdeb_recommendations')
      .select('id', { count: 'exact', head: true }).eq('member_id', al.id).eq('group_id', grupoPanCerrado)
    if (!ya) {
      const { error } = await laxo.from('cdeb_recommendations').insert({
        member_id: al.id, group_id: grupoPanCerrado, filled_by: coDirigente.id, status: 'enviada',
        recommendation: r,
        testimony_score: 3, passion_score: 3, bible_knowledge_score: 4, speech_score: 4,
        committee_notes: `Segunda evaluación, de otro grupo y otro dirigente. ${NOTA}`,
      })
      if (error) console.warn(`  ⚠ segunda recomendación de ${al.nombre}: ${error.message}`)
    }
    otros.push({
      bloque: 'Recomendaciones CDEB',
      que: `${al.nombre} (2.ª)`,
      detalle: `${txt} · la hizo ${coDirigente.nombre} al cerrar Panorama`,
    })
  }
  grupos.find(g => g.nombre.includes('Panorama cerrado'))!.estudiantes = segundas.length

  await pareja('Cumple', true)
  await pareja('NoCumple', false)

  // ── H) Evento con inscripción y formulario ─────────────────────────────────
  console.log('· H · evento y formulario')
  const tituloEvento = `${MARCA} Evento con inscripción`
  let { data: evento } = await laxo.from('events').select('id').eq('title', tituloEvento).maybeSingle()
  if (!evento) {
    const { data, error } = await laxo.from('events').insert({
      title: tituloEvento, description: NOTA, event_type: 'social',
      starts_at: new Date(HOY.getTime() + 10 * 86400000).toISOString(),
      ends_at: new Date(HOY.getTime() + 10 * 86400000 + 7200000).toISOString(),
      location: `${MARCA} Salón de pruebas`, requires_registration: true, requires_checkin: true,
      requires_payment: false, max_capacity: 50, is_active: true, status: 'upcoming',
    }).select('id').single()
    if (error) throw new Error(`evento: ${error.message}`)
    evento = data as { id: string }
  }
  const eventoId = (evento as { id: string }).id
  otros.push({ bloque: 'Eventos', que: tituloEvento, detalle: 'Inscripción abierta, check-in activo, sin costo · en 10 días' })

  const tituloForm = `${MARCA} Formulario del evento`
  let { data: form } = await laxo.from('forms').select('id').eq('title', tituloForm).maybeSingle()
  if (!form) {
    const { data, error } = await laxo.from('forms').insert({
      title: tituloForm, description: NOTA, is_active: true, requires_auth: true,
      entity_type: 'event', entity_id: eventoId, category: 'event_registration',
    }).select('id').single()
    if (error) throw new Error(`formulario: ${error.message}`)
    form = data as { id: string }
  }
  otros.push({ bloque: 'Formularios', que: tituloForm, detalle: 'Asociado al evento de prueba · probar respuestas, export y acceso puntual' })

  // ── I) Grupo cerrado con retroalimentación del dirigente ──────────────────
  // El flujo entero necesita un grupo YA cerrado con varias evaluaciones para
  // poder mirar el panel: promedio, distribución, comentarios y el paso de
  // revisión (ocultar uno y compartir con el dirigente).
  //
  // OJO: acá NO se manda el correo de la encuesta. Las cuentas de prueba usan un
  // dominio inexistente y cada envío sería un rebote duro contra la reputación
  // de SES. Se marca `feedback_requested_at` como si ya hubiera salido y se
  // insertan las respuestas directo.
  console.log('· I · grupo cerrado con retroalimentación')
  const grupoRetro = await crearGrupo({
    nombre: 'Grupo N3 cerrado con evaluaciones', planId: plan('N3').id, planCode: 'N3', etapa: 'niveles',
    leaderId: dirigente.id, leaderNombre: dirigente.nombre, estado: 'finalizado',
    inicio: new Date(HOY.getTime() - 180 * 86400000),
    fin: new Date(HOY.getTime() - 10 * 86400000),
    sirve: 'Retroalimentación al dirigente: ver el panel, ocultar un comentario y compartirlo',
  })
  // El dirigente necesita ficha en study_leaders: leader_evaluations apunta ahí.
  let { data: fichaDir } = await laxo.from('study_leaders').select('id').eq('member_id', dirigente.id).maybeSingle()
  if (!fichaDir) {
    const { data, error } = await laxo.from('study_leaders')
      .insert({ member_id: dirigente.id, is_active: true }).select('id').single()
    if (error) throw new Error(`ficha de dirigente: ${error.message}`)
    fichaDir = data as { id: string }
  }
  const RESPUESTAS = [
    { score: 5, comments: 'Explicaba con mucha claridad y siempre llegaba puntual.' },
    { score: 4, comments: 'Muy bueno. A veces nos quedábamos cortos de tiempo al final.' },
    { score: 5, comments: null },
    { score: 3, comments: 'Cumplió, pero me hubiera gustado más discusión en grupo.' },
    { score: 2, comments: 'ESTE COMENTARIO ES PARA PROBAR EL BOTÓN DE OCULTAR.' },
  ]
  for (let i = 0; i < RESPUESTAS.length; i++) {
    const est = await crearMiembro({
      nombre: `Ret${String(i + 1).padStart(2, '0')} Evaluador`,
      caso: `Estudiante ${i + 1} de 5 del grupo cerrado con evaluaciones`,
      sirve: i === 4 ? 'Su comentario es el que sirve para probar "ocultar"' : '—',
    })
    await matricular(grupoRetro, est.id, 'completed')
    const { data: yaEval } = await laxo.from('leader_evaluations')
      .select('id').eq('group_id', grupoRetro).eq('member_id', est.id).maybeSingle()
    if (!yaEval) {
      await laxo.from('leader_evaluations').insert({
        leader_id: (fichaDir as { id: string }).id,
        group_id: grupoRetro,
        member_id: est.id,
        score: RESPUESTAS[i].score,
        comments: RESPUESTAS[i].comments,
        evaluation_date: ymd(new Date(HOY.getTime() - 8 * 86400000)),
      })
    }
  }
  grupos.find(g => g.nombre.includes('N3 cerrado con evaluaciones'))!.estudiantes = RESPUESTAS.length
  // Como si el correo ya hubiera salido, pero SIN compartirla: así el panel
  // abre en el estado que hay que probar (la coordinación tiene que revisar).
  await laxo.from('study_groups')
    .update({ feedback_requested_at: HOY.toISOString(), feedback_released_at: null })
    .eq('id', grupoRetro)
  otros.push({
    bloque: 'Estudios',
    que: `${MARCA} Grupo N3 cerrado con evaluaciones`,
    detalle: '5 evaluaciones del dirigente sin revisar · abrir la ficha del grupo, ocultar un comentario y compartirla',
  })

  // ── Lista guardada con todos ───────────────────────────────────────────────
  console.log('· lista guardada')
  const { data: todos } = await laxo.from('members').select('id').like('external_id', `${PREFIJO_EXTERNAL}%`)
  const ids = (todos ?? []).map((m: { id: string }) => m.id)
  const nombreLista = `${MARCA} Datos de prueba agosto 2026`
  const { data: listaYa } = await laxo.from('member_lists').select('id').eq('name', nombreLista).maybeSingle()
  const filaLista = {
    name: nombreLista, description: NOTA, member_ids: ids, member_count: ids.length,
    is_dynamic: false, segment_label: 'Datos de prueba',
  }
  if (listaYa) await laxo.from('member_lists').update(filaLista).eq('id', (listaYa as { id: string }).id)
  else await laxo.from('member_lists').insert(filaLista)
  otros.push({ bloque: 'Listas', que: nombreLista, detalle: `${ids.length} personas · verlas juntas en /miembros/listas` })

  // Validación de cierre: dos personas con el mismo correo rompen el alta de
  // cuentas y el detector de duplicados las reporta como si fueran un error del
  // sistema. Mejor que el seed falle acá que descubrirlo probando.
  const porCorreo = new Map<string, string[]>()
  for (const p of personas) {
    const k = p.correo.toLowerCase()
    porCorreo.set(k, [...(porCorreo.get(k) ?? []), p.nombre])
  }
  const repetidos = [...porCorreo.entries()].filter(([, quienes]) => quienes.length > 1)
  if (repetidos.length) {
    console.error('\n✗ Hay correos repetidos en el set:')
    for (const [c, quienes] of repetidos) console.error(`   ${c} → ${quienes.join(', ')}`)
    throw new Error('correos duplicados: revisá los nombres del seed')
  }

  escribirHoja()
  console.log(`\n✓ Listo. ${personas.length} personas, ${grupos.length} grupos.`)
  console.log('  Hoja de referencia: content/ayuda/datos-de-prueba.md (se lee en /ayuda/datos-de-prueba)')
  console.log(`  Borrado previsto: ${ymd(BORRADO)} · scripts/limpiar-datos-de-prueba.ts\n`)
}

// ─────────────────────────────────────────────────────────────────────────────
// HOJA DE REFERENCIA
// ─────────────────────────────────────────────────────────────────────────────
function escribirHoja() {
  const tabla = (cabeceras: string[], filas: string[][]) => [
    `| ${cabeceras.join(' | ')} |`,
    `|${cabeceras.map(() => '---').join('|')}|`,
    ...filas.map(f => `| ${f.map(c => c.replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n')

  // El artículo del centro de ayuda es la ÚNICA copia: lo escribe el seed con su
  // frontmatter y los testers lo leen en /ayuda/datos-de-prueba. No lleva
  // `visibilidad: publica` a propósito — trae una contraseña compartida, así que
  // va con `roles:` y sin sesión responde 404.
  const md = `---
titulo: Datos de prueba (agosto 2026)
seccion: Primeros pasos
tipo: tutorial
roles: [admin, direccion, coordinador_estudios, coordinador_dirigentes, finanzas, comunicaciones, encargado_staff]
orden: 90
resumen: Usuarios y grupos de prueba para probar el sistema sin tocar datos reales. Se borran el ${ymd(BORRADO)}.
---

# Datos de prueba (agosto 2026)

**Estos datos se borran el ${ymd(BORRADO)}.** No construyas nada encima esperando que dure:
listas, comunicados o reportes armados sobre esta gente se quedan sin base ese día.

## Qué esperamos de vos

**Que pruebes los recorridos de abajo y reportes lo que se vea raro.** No es "usar el
sistema" un rato: es seguir un recorrido, mirar si pasa lo que debería pasar, y avisar
cuando no. Un hallazgo reportado vale más que media hora navegando sin anotar nada.

Sirve todo: algo que no funciona, algo que funciona pero confunde, un texto que dice una
cosa y el sistema hace otra, un botón que no encontraste.

**Dónde reportar:** [completar: canal de reporte]

## Qué NO tocar

Trabajá **solo con los registros marcados \`${MARCA}\`**. En el padrón conviven con las
23 mil personas reales de la iglesia.

- No edités, matriculés ni borrés a una persona real.
- No mandés comunicados a nadie que no sea del set (los de prueba tienen correo
  inexistente a propósito; los reales, no).
- Si hacés algo por error sobre un dato real, **avisá de una** — se arregla mucho más
  fácil recién hecho que dos semanas después.

## Cómo reconocerlos

- El nombre empieza con **\`${MARCA}\`** — se ve en cualquier listado sin abrir nada.
- \`external_id\` con prefijo **\`${PREFIJO_EXTERNAL}\`** — es la llave del borrado.
- Los correos son **@${DOMINIO}**: el TLD \`.invalid\` está reservado (RFC 2606) y no
  resuelve, así que un comunicado mandado por error no le llega a ninguna persona real.
- Los teléfonos son del rango ficticio **8000-00xx**.
- Todos están juntos en la lista guardada **${MARCA} Datos de prueba agosto 2026**
  (/miembros/listas).

**Contraseña de todas las cuentas:** \`${CLAVE}\`
(cuentas de prueba con correo inexistente; se borran junto con el resto)

## Personas

${tabla(
  ['Nombre', 'Correo', 'Cuenta', 'Rol', 'Qué caso representa', 'Qué se puede probar'],
  personas.map(p => [p.nombre, p.correo, p.clave ? 'sí' : 'no', p.rol, p.caso, p.sirve]),
)}

## Grupos de estudio

${tabla(
  ['Grupo', 'Plan', 'Etapa', 'Estado', 'Dirigente', 'Estudiantes', 'Qué flujo permite probar'],
  grupos.map(g => [g.nombre, g.plan, g.etapa, g.estado, g.dirigente, String(g.estudiantes), g.sirve]),
)}

## Lo demás

${tabla(
  ['Bloque', 'Qué', 'Detalle'],
  otros.map(o => [o.bloque, o.que, o.detalle]),
)}

## Recorridos sugeridos

1. **Matrícula y compromisos.** Entrá como \`${MARCA} Daniel Intermedio\` y matriculate en el
   grupo DIS1: los tres compromisos salen en verde. Después probá con
   \`${MARCA} Nelson Sin Donar\` — el mismo grupo le sale bloqueado, y el resumen dice cuál
   requisito falta.
2. **Invitación (EST-5).** \`${MARCA} Elena Avanzada\` cumple todo pero CDEB no le aparece:
   es solo por invitación. Mandale una desde el perfil y volvé a mirar.
3. **Pagos.** La cola de /finanzas/pagos tiene un comprobante en revisión y uno rechazado.
   Aprobá el primero; rechazá y comprobá que la persona **no** pierde la matrícula.
4. **Cierre de grupo.** El grupo N2 listo para cierre tiene 8 estudiantes: marcá uno
   aprobado, uno reprobado (pide justificación) y uno retirado (ahora también pide motivo).
5. **Recomendación a CDEB.** El grupo DIS3 tiene 4 estudiantes y tres recomendaciones ya
   llenas, con las tres respuestas posibles.
6. **Prematrimonial.** La pareja "Cumple" pasa los guards; la pareja "NoCumple" sirve para
   ver los mensajes de PRE-5 y PRE-7.
7. **Evento y formulario.** Inscribite al evento de prueba, hacé check-in y respondé el
   formulario asociado.

---

*Generado el ${ymd(HOY)} por \`scripts/seed-datos-de-prueba.ts\`. Para borrar el set:
\`npx tsx scripts/limpiar-datos-de-prueba.ts\` (sin \`--aplicar\` solo lista qué borraría).*
`
  writeFileSync('content/ayuda/datos-de-prueba.md', md)
}

main().catch(e => { console.error('\n✗', e instanceof Error ? e.message : e); process.exit(1) })
