/**
 * ETAPA 1 · Los 102 grupos abiertos de CCB.
 *
 *   dry-run:  npx tsx scripts/ccb-migracion-2026-08/etapa1-grupos.ts
 *   aplicar:  ... etapa1-grupos.ts --aplicar
 *
 * IDEMPOTENCIA SIN COLUMNA NUEVA (decisión del usuario, 2026-08-24): no se
 * agrega ccb_group_id. La llave es el NOMBRE normalizado del grupo, que en CCB
 * es único (verificado: 102/102) y codifica plan + dirigente + mes. Se combina
 * con la equivalencia (plan + dirigente + mes de inicio) para que un renombre en
 * nuestra base no genere un gemelo. Correr dos veces no crea nada la segunda.
 *
 * SEDE (decisión del usuario): en blanco para los que no la dicen; Madrid para
 * los de Madrid y para el único con la etiqueta descontinuada "Europa" (su
 * nombre dice Madrid); is_virtual para los que dicen "Virtual" — que es
 * modalidad, no sede.
 *
 * CORREOS: este script NO envía nada; escribe con service role, fuera de la app.
 * Lo que sí puede disparar correos DESPUÉS es el cron diario de recordatorios de
 * cierre, que barre los grupos en_curso. El reporte cuenta cuántos caerían ahí.
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import {
  leerCsv, norm, planDe, inicioDe, esVirtual,
  esListaAdministrativa, esDirigenteInstitucional, DIRIGENTES_POR_EXTERNAL_ID, nombreEnLaBase,
} from './lib'

const APLICAR = process.argv.includes('--aplicar')
const admin = createAdminClient() as unknown as { from: (t: string) => any }

async function todo<T>(tabla: string, select: string): Promise<T[]> {
  const out: T[] = []
  for (let d = 0; ; d += 1000) {
    const { data, error } = await admin.from(tabla).select(select).range(d, d + 999).order('id')
    if (error) throw new Error(`${tabla}: ${error.message}`)
    out.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  return out
}

type Plan = { id: string; code: string; duration_weeks: number | null }

async function main() {
  console.log(APLICAR ? '⚠️  MODO APLICAR — escribe en la base\n' : '🔍 DRY-RUN — no escribe nada\n')
  const csv = leerCsv('ccb-grupos-abiertos-2026-08.csv')
  const parts = leerCsv('ccb-participantes-grupos-2026-08.csv')

  const { data: planRows } = await admin.from('study_plans').select('id, code, duration_weeks')
  const planPorCode = new Map<string, Plan>((planRows ?? []).map((p: Plan) => [p.code, p]))
  const miembros = await todo<any>('members', 'id, external_id, first_name, last_name, is_active')
  const porExternal = new Map(miembros.filter(m => m.external_id).map(m => [String(m.external_id).trim(), m]))
  const porNombre = new Map<string, any[]>()
  for (const m of miembros) {
    const n = norm(`${m.first_name} ${m.last_name}`)
    porNombre.set(n, [...(porNombre.get(n) ?? []), m])
  }
  const gruposBd = await todo<any>('study_groups', 'id, name, plan_id, leader_id, co_leader_id, starts_at, status, sede, is_virtual')
  const porNombreBd = new Map(gruposBd.map(g => [norm(g.name), g]))
  const porEq = new Map<string, any[]>()
  for (const g of gruposBd) {
    const k = `${g.plan_id}|${g.leader_id ?? '-'}|${(g.starts_at ?? '').slice(0, 7)}`
    porEq.set(k, [...(porEq.get(k) ?? []), g])
  }

  // Co-dirigente: el SEGUNDO 'Leader' del mismo grupo en participantes.
  const leadersPorGrupo = new Map<string, string[]>()
  for (const p of parts) {
    if (p.rol !== 'Leader') continue
    leadersPorGrupo.set(p.group_name, [...(leadersPorGrupo.get(p.group_name) ?? []), p.external_id])
  }
  const conParticipantes = new Set(parts.map(p => p.group_name))

  const resolverLider = (first: string, last: string) => {
    const n = norm(`${first} ${last}`)
    const forzado = DIRIGENTES_POR_EXTERNAL_ID[n]
    if (forzado) return porExternal.get(forzado) ?? null
    const c = porNombre.get(n) ?? []
    return c.find((m: any) => m.is_active) ?? c[0] ?? null
  }

  const crear: any[] = [], enlazar: any[] = [], conflictoEstado: string[] = []
  const excluidas: string[] = [], sinParticipantes: string[] = [], viejos: string[] = []

  for (const r of csv) {
    const nombre = r.group_name
    if (esListaAdministrativa(nombre) || esDirigenteInstitucional(`${r.leader_first} ${r.leader_last}`)) {
      excluidas.push(nombre); continue
    }
    const code = planDe(nombre)!
    const plan = planPorCode.get(code)!
    const lider = resolverLider(r.leader_first, r.leader_last)
    const inicio = inicioDe(nombre)
    const virtual = esVirtual(nombre)
    // Madrid: por tipo de grupo, y el único "Europa" (etiqueta descontinuada)
    // va a Madrid porque su propio nombre lo dice.
    const esMadrid = /madrid|europa/.test(norm(r.group_type)) || /madrid/.test(norm(nombre))
    const sede = esMadrid ? 'madrid' : null

    if (!conParticipantes.has(nombre)) sinParticipantes.push(nombre)
    if (inicio && inicio < '2025-06-01') viejos.push(`${nombre} (inicio ${inicio})`)

    const coId = (leadersPorGrupo.get(nombre) ?? [])[1]
    const coLider = coId ? porExternal.get(coId) ?? null : null

    const existente = porNombreBd.get(norm(nombreEnLaBase(nombre)))
      ?? porNombreBd.get(norm(nombre))
      ?? (porEq.get(`${plan.id}|${lider?.id ?? '-'}|${(inicio ?? '').slice(0, 7)}`) ?? [])[0]

    if (existente) {
      // Solo se completa lo que FALTA. El estado no se toca: si acá dice
      // finalizado y CCB lo trae abierto, es un conflicto para revisar, no algo
      // que este script deba decidir.
      const patch: Record<string, unknown> = {}
      if (!existente.leader_id && lider) patch.leader_id = lider.id
      if (!existente.co_leader_id && coLider) patch.co_leader_id = coLider.id
      if (!existente.sede && sede) patch.sede = sede
      if (virtual && !existente.is_virtual) patch.is_virtual = true
      if (existente.status !== 'en_curso') {
        conflictoEstado.push(`${nombre} → acá está "${existente.status}", CCB lo trae abierto`)
      }
      enlazar.push({ id: existente.id, nombre, patch })
    } else {
      crear.push({
        plan_id: plan.id, name: nombre, status: 'en_curso',
        leader_id: lider?.id ?? null, co_leader_id: coLider?.id ?? null,
        starts_at: inicio, sede, is_virtual: virtual,
      })
    }
  }

  console.log('══ RESUMEN ══')
  console.log(`  a CREAR:                    ${crear.length}`)
  console.log(`  ya existen (se completan):  ${enlazar.length}`)
  console.log(`     · de esos, con algo que completar: ${enlazar.filter(e => Object.keys(e.patch).length).length}`)
  console.log(`  listas administrativas excluidas: ${excluidas.length}`)
  console.log(`  total procesado: ${crear.length + enlazar.length + excluidas.length} de ${csv.length}`)

  if (conflictoEstado.length) {
    console.log(`\n══ CONFLICTO DE ESTADO (${conflictoEstado.length}) — NO se tocan, revisá ══`)
    for (const c of conflictoEstado.slice(0, 20)) console.log(`  · ${c}`)
    if (conflictoEstado.length > 20) console.log(`  … y ${conflictoEstado.length - 20} más`)
  }
  if (sinParticipantes.length) {
    console.log(`\n══ SIN PARTICIPANTES (${sinParticipantes.length}) — se crean igual ══`)
    for (const g of sinParticipantes) console.log(`  · ${g}`)
  }
  if (viejos.length) {
    console.log(`\n══ ABIERTOS HACE MUCHO (${viejos.length}) — probablemente sin cerrar en CCB ══`)
    for (const g of viejos) console.log(`  · ${g}`)
  }
  if (excluidas.length) {
    console.log(`\n══ LISTAS EXCLUIDAS ══`)
    for (const g of excluidas) console.log(`  · ${g}`)
  }

  // Grupos que nacerían YA VENCIDOS: el cron de cierre les escribiría mañana al
  // dirigente por un grupo que solo se está migrando. Se les sellan las marcas.
  //
  // SOLO a esos, a propósito: un grupo que todavía está en curso SÍ debe recibir
  // su recordatorio cuando de verdad le toque. Sellar todo por comodidad
  // silenciaría avisos legítimos de aquí a unos meses.
  const hoy = new Date().toISOString().slice(0, 10)
  const yaVencido = (g: any) => {
    const plan = (planRows ?? []).find((p: Plan) => p.id === g.plan_id)
    if (!g.starts_at || !plan?.duration_weeks) return false
    const fin = new Date(new Date(g.starts_at).getTime() + plan.duration_weeks * 7 * 86_400_000)
    return fin.toISOString().slice(0, 10) < hoy
  }
  const vencidos = crear.filter(yaVencido)
  const sello = new Date().toISOString()
  for (const g of vencidos) {
    g.close_reminder_sent_at = sello
    g.close_overdue_notified_at = sello
    // OJO: survey_send_at NO se toca. No es una marca de "ya enviado" sino de
    // "cuándo enviar": el cron manda la encuesta cuando survey_send_at <= ahora.
    // Sellarla con la fecha de hoy PROGRAMARÍA la encuesta, exactamente lo
    // contrario de lo que se busca. Nula está bien: solo se programa al cerrar.
    g.start_notified_at = sello
  }
  console.log(`\n══ CORREOS QUE DISPARARÍA EL CRON DE CIERRE ══`)
  console.log(`  de los ${crear.length} nuevos, quedarían VENCIDOS hoy mismo: ${vencidos.length}`)
  console.log(`  → mañana 8:30 a.m. el cron le escribe al dirigente de cada uno.`)
  console.log(`  → SELLADOS al crear (4 marcas), así no sale ninguno.`)
  console.log(`  → los otros ${crear.length - vencidos.length} quedan sin sellar: siguen en curso y su`)
  console.log(`     recordatorio debe salir cuando de verdad les toque.`)

  console.log('\n══ MUESTRA DE LO QUE SE CREARÍA (5) ══')
  for (const g of crear.slice(0, 5)) {
    console.log(`  · ${g.name}`)
    console.log(`      plan=${(planRows ?? []).find((p: Plan) => p.id === g.plan_id)?.code} inicio=${g.starts_at} sede=${g.sede ?? '(vacía)'} virtual=${g.is_virtual} dirigente=${g.leader_id ? 'sí' : 'NO'} co=${g.co_leader_id ? 'sí' : 'no'}`)
  }

  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }
  console.log('\n── aplicando ──')
  let creados = 0, actualizados = 0
  for (const g of crear) {
    const { error } = await admin.from('study_groups').insert(g)
    if (error) { console.log(`  ✗ ${g.name}: ${error.message}`); continue }
    creados++
  }
  for (const e of enlazar) {
    if (!Object.keys(e.patch).length) continue
    const { error } = await admin.from('study_groups').update(e.patch).eq('id', e.id)
    if (error) { console.log(`  ✗ ${e.nombre}: ${error.message}`); continue }
    actualizados++
  }
  console.log(`  creados: ${creados} · actualizados: ${actualizados}`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
