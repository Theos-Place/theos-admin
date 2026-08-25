/**
 * ETAPA 3 · Aplicar las graduaciones a las matrículas de NUESTRA base.
 *
 *   dry-run:  npx tsx scripts/ccb-migracion-2026-08/etapa3-graduaciones.ts
 *   aplicar:  ... etapa3-graduaciones.ts --aplicar
 *
 * REGLA DE ORO — dos defensas para no cerrar una matrícula ACTUAL con una
 * graduación vieja:
 *   1) Se EXCLUYEN las matrículas de los 102 grupos abiertos de CCB. Esa gente
 *      está llevando ese estudio AHORA; una graduación de mayo no le
 *      corresponde. Los ids salen del archivo que dejó la Etapa 2.
 *   2) FILTRO POR FECHA: el grupo de la matrícula destino tiene que haber
 *      empezado ANTES del fecha_due del proceso. Sin fecha confiable → revisión
 *      manual, nunca "se aplica igual".
 *
 * No inserta nada: solo cambia el estado de matrículas que ya existen. No crea
 * pagos (ver NO_CREAR_PAGOS en lib.ts).
 */
import { readFileSync } from 'node:fs'
import { createAdminClient } from '../../src/lib/supabase/admin'
import { leerCsv, norm, planDe } from './lib'

const APLICAR = process.argv.includes('--aplicar')
const admin = createAdminClient() as unknown as { from: (t: string) => any }

/** Códigos que NO son capacitación (espejo de CAPACITACION_EXCLUDED_CODES). */
const NO_CAPACITACION = ['N1', 'N2', 'N3', 'N4', 'DIS2', 'DIS3']

/**
 * Colas genéricas resueltas A MANO por el usuario (2026-08-24).
 *
 * "Reprueba Capacitación" no dice qué capacitación, y estas dos personas tenían
 * varias abiertas que calzaban (Hermenéutica, Grupo Parejas, Efesios). El
 * usuario confirmó que reprobaron Cómo Interpretar la Biblia (Junio 2026).
 *
 * Va por external_id + cola, no por nombre: son dos casos puntuales y el id no
 * se presta a confusión. Cualquier otra cola genérica ambigua sigue yendo a
 * revisión manual — esto NO relaja la regla, la resuelve para dos filas.
 */
const RESUELTAS_A_MANO: Record<string, string> = {
  '1877|Reprueba Capacitación': 'HER',  // Melissa Acón Chaves
  '2908|Reprueba Capacitación': 'HER',  // Ignacio Mora Valverde
}
const CADENA_NIVELES = ['N1', 'N2', 'N3', 'N4']

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

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const grads = leerCsv('ccb-graduaciones-2026-08.csv')
  const excluidos = new Set<string>(JSON.parse(
    readFileSync('scripts/ccb-migracion-2026-08/grupos-de-esta-migracion.json', 'utf8')))
  console.log(`grupos de CCB excluidos del universo: ${excluidos.size}\n`)

  const { data: planRows } = await admin.from('study_plans').select('id, code')
  const codePorId = new Map<string, string>((planRows ?? []).map((p: any) => [p.id, p.code]))
  const miembros = await todo<any>('members', 'id, external_id, first_name, last_name')
  const porExternal = new Map(miembros.filter(m => m.external_id).map(m => [String(m.external_id).trim(), m]))
  const grupos = await todo<any>('study_groups', 'id, name, starts_at')
  const grupoPorId = new Map(grupos.map(g => [g.id, g]))
  const enrolls = await todo<any>('study_enrollments', 'id, member_id, group_id, plan_id, status')
  const porMiembro = new Map<string, any[]>()
  for (const e of enrolls) porMiembro.set(e.member_id, [...(porMiembro.get(e.member_id) ?? []), e])

  const done = grads.filter(g => g.status === 'Done')
  const notStarted = grads.filter(g => g.status === 'Not Started')

  const aplicar: any[] = []
  const varias: string[] = [], ninguna: string[] = [], yaCerrada: string[] = []
  const conflicto: string[] = [], sinPersona: string[] = [], sinFecha: string[] = []
  // Cuántas veces ACTUÓ cada defensa. Sin esto no se sabe si la regla de oro
  // sirvió o si simplemente no había casos.
  let bloqueoPorGrupoCcb = 0, bloqueoPorFecha = 0

  for (const g of done) {
    const persona = porExternal.get(g.external_id)
    if (!persona) { sinPersona.push(`${g.external_id} · ${g.individual_name} · ${g.queue_name}`); continue }
    const quien = `${persona.first_name} ${persona.last_name}`
    const destino = g.resultado === 'aprobado' ? 'completed' : 'reprobado'

    // Qué planes puede tocar este proceso.
    //
    // Las colas genéricas se detectan ANTES de planDe(), y es imprescindible:
    // "Reprueba Nivel 1 - 4" contiene el texto "Nivel 1", así que planDe() lo
    // mapeaba a N1 y el proceso se aplicaba a UN nivel concreto en vez de a la
    // cadena. Es lo que producía 15 "conflictos" que no existían.
    const esGenerica = /^reprueba\b/.test(norm(g.queue_name))
    const manual = RESUELTAS_A_MANO[`${g.external_id}|${g.queue_name}`] ?? null
    const code = manual ?? (esGenerica ? null : planDe(g.queue_name))
    let codesPosibles: string[]
    if (code) codesPosibles = [code]
    else if (/reprueba nivel/.test(norm(g.queue_name))) codesPosibles = CADENA_NIVELES
    else if (/reprueba capacitacion/.test(norm(g.queue_name)))
      codesPosibles = [...new Set((planRows ?? []).map((p: any) => p.code))].filter(c => !NO_CAPACITACION.includes(c))
    else { ninguna.push(`${quien} · cola no reconocida: "${g.queue_name}"`); continue }

    const suyas = (porMiembro.get(persona.id) ?? [])
      .filter(e => codesPosibles.includes(codePorId.get(e.plan_id) ?? ''))

    // ── Defensa 1: fuera las matrículas de los grupos abiertos de CCB ────────
    const noActuales = suyas.filter(e => !e.group_id || !excluidos.has(e.group_id))
    bloqueoPorGrupoCcb += suyas.filter(e => e.status === 'enrolled').length
      - noActuales.filter(e => e.status === 'enrolled').length
    const abiertas = noActuales.filter(e => e.status === 'enrolled')

    // ── Defensa 2: el grupo tuvo que empezar ANTES del fecha_due ─────────────
    const conFecha: any[] = [], sinFechaFiables: any[] = []
    for (const e of abiertas) {
      const grp = e.group_id ? grupoPorId.get(e.group_id) : null
      const inicio = grp?.starts_at ? String(grp.starts_at).slice(0, 10) : null
      if (!inicio) sinFechaFiables.push(e)
      else if (inicio < g.fecha_due) conFecha.push(e)
      else bloqueoPorFecha++ // el grupo arrancó DESPUÉS de la graduación: no aplica
    }

    if (conFecha.length === 1 && sinFechaFiables.length === 0) {
      aplicar.push({ id: conFecha[0].id, quien, cola: g.queue_name, destino,
        grupo: grupoPorId.get(conFecha[0].group_id)?.name ?? '(sin grupo)', due: g.fecha_due })
      continue
    }
    if (conFecha.length + sinFechaFiables.length > 1) {
      varias.push(`${quien} · ${g.queue_name} (${g.fecha_due}) → ${conFecha.length + sinFechaFiables.length} candidatas: ` +
        [...conFecha, ...sinFechaFiables].map(e => grupoPorId.get(e.group_id)?.name ?? '(sin grupo)').join(' | '))
      continue
    }
    if (sinFechaFiables.length === 1) {
      sinFecha.push(`${quien} · ${g.queue_name} (${g.fecha_due}) → única candidata SIN fecha de inicio: ` +
        (grupoPorId.get(sinFechaFiables[0].group_id)?.name ?? '(matrícula sin grupo)'))
      continue
    }

    // No quedaron abiertas: ¿ya estaba cerrada?
    //
    // OJO: esto SOLO tiene sentido cuando la cola nombra un plan concreto. Las
    // colas genéricas ("Reprueba Nivel 1 - 4") abarcan los cuatro niveles, así
    // que alguien que APROBÓ N1 y reprobó N3 aparecería como "conflicto" —
    // aprobar un nivel no contradice reprobar otro. Con la cola genérica no se
    // puede saber de cuál habla, así que sin candidata abierta va a revisión
    // manual, no a conflicto. (Sin esta distinción salían 18 conflictos falsos.)
    const cerradas = noActuales.filter(e => e.status === 'completed' || e.status === 'reprobado')
    if (cerradas.length) {
      if (!code) {
        ninguna.push(`${quien} · ${g.queue_name} (${g.fecha_due}) · ${g.resultado} · sin abierta en la cadena; cerradas: ${cerradas.map(e => `${codePorId.get(e.plan_id)}=${e.status}`).join(', ')}`)
        continue
      }
      const coincide = cerradas.some(e => e.status === destino)
      if (coincide) yaCerrada.push(`${quien} · ${g.queue_name}`)
      else conflicto.push(`${quien} · ${g.queue_name}: el archivo dice "${destino}", la base tiene "${cerradas.map(e => e.status).join('/')}"`)
      continue
    }
    ninguna.push(`${quien} · ${g.queue_name} (${g.fecha_due}) · ${g.resultado}`)
  }

  console.log('══ RESUMEN ══')
  console.log(`  procesos Done:                    ${done.length}`)
  console.log(`  ─────────────────────────────────`)
  console.log(`  A APLICAR (una sola candidata):   ${aplicar.length}`)
  console.log(`     aprobado → completed:  ${aplicar.filter(a => a.destino === 'completed').length}`)
  console.log(`     reprobado → reprobado: ${aplicar.filter(a => a.destino === 'reprobado').length}`)
  console.log(`  ya cerradas (no se tocan):        ${yaCerrada.length}`)
  console.log(`  VARIAS candidatas (manual):       ${varias.length}`)
  console.log(`  sin fecha confiable (manual):     ${sinFecha.length}`)
  console.log(`  NINGUNA candidata:                ${ninguna.length}`)
  console.log(`  CONFLICTO de estado:              ${conflicto.length}`)
  console.log(`  sin persona:                      ${sinPersona.length}`)
  console.log(`  ─────────────────────────────────`)
  console.log(`  suma: ${aplicar.length + yaCerrada.length + varias.length + sinFecha.length + ninguna.length + conflicto.length + sinPersona.length}`)
  console.log(`\n  Not Started (anomalía, excluidos): ${notStarted.length}`)
  console.log(`\n══ LA REGLA DE ORO, ¿actuó? ══`)
  console.log(`  matrículas descartadas por estar en un grupo ABIERTO de CCB: ${bloqueoPorGrupoCcb}`)
  console.log(`  matrículas descartadas porque el grupo empezó DESPUÉS del due: ${bloqueoPorFecha}`)

  const bloque = (t: string, xs: string[], max = 25) => {
    if (!xs.length) return
    console.log(`\n══ ${t} (${xs.length}) ══`)
    for (const x of xs.slice(0, max)) console.log(`  · ${x}`)
    if (xs.length > max) console.log(`  … y ${xs.length - max} más`)
  }
  bloque('CONFLICTO DE ESTADO — revisar a mano', conflicto)
  bloque('VARIAS CANDIDATAS — revisar a mano', varias)
  bloque('SIN FECHA CONFIABLE — revisar a mano', sinFecha)
  bloque('NINGUNA CANDIDATA — el grupo donde se graduó no está migrado', ninguna, 200)
  bloque('SIN PERSONA', sinPersona)
  bloque('NOT STARTED (no son graduaciones)', notStarted.map(n => `${n.individual_name} · ${n.queue_name} · ${n.fecha_due}`), 30)

  console.log('\n══ MUESTRA DE LO QUE SE APLICARÍA (8) ══')
  for (const a of aplicar.slice(0, 8)) {
    console.log(`  · ${a.quien.padEnd(32)} ${a.cola.padEnd(24)} → ${a.destino}`)
    console.log(`      grupo: ${a.grupo}  (inició antes de ${a.due})`)
  }

  if (!APLICAR) { console.log('\n(dry-run — no se escribió nada)'); return }
  console.log('\n── aplicando ──')
  let ok = 0
  for (const a of aplicar) {
    const patch: any = { status: a.destino }
    if (a.destino === 'completed') patch.completed_at = `${a.due}T12:00:00+00`
    const { error } = await admin.from('study_enrollments').update(patch).eq('id', a.id).eq('status', 'enrolled')
    if (error) { console.log(`  ✗ ${a.quien}: ${error.message}`); continue }
    ok++
  }
  console.log(`  matrículas actualizadas: ${ok}`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
