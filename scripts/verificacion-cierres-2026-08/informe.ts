/**
 * VERIFICACIÓN DE CIERRES · formulario "EB — Fin de Capacitación" vs. la base.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/informe.ts
 *   ... informe.ts --anio 2025      (segunda pasada; por defecto 2026)
 *
 * NO ESCRIBE EN LA BASE. Produce docs/verificacion-cierres-2026-08.md.
 *
 * Los tres cruces:
 *   1. grupos en_curso cuyo dirigente YA reportó el fin de esa capacitación
 *      → son cierres que nos faltan
 *   2. las graduaciones que la migración dejó sin resolver, contra las listas
 *      de aprobados del formulario → evidencia de en qué grupo se graduaron
 *   3. grupos finalizados en el sistema sin formulario → lista para el
 *      coordinador (no es un error del sistema)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parsearLista, capacitacionAPlan, norm } from '../../src/lib/studies/ccb-form-parse'
import { leerCsv, DIRIGENTES_POR_EXTERNAL_ID } from '../ccb-migracion-2026-08/lib'
import { cargarEnv, IndiceMiembros, todo, type Miembro, type Match } from './lib'

cargarEnv()

const ANIO = (() => {
  const i = process.argv.indexOf('--anio')
  return i >= 0 ? process.argv[i + 1] : '2026'
})()

type Grupo = {
  id: string; name: string; status: string; starts_at: string | null; ends_at: string | null
  leader_id: string | null; co_leader_id: string | null; plan_id: string | null
}
type Fila = Record<string, string>

const esc = (s: unknown) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')

async function main() {
  const { createAdminClient } = await import('../../src/lib/supabase/admin')
  const admin = createAdminClient() as never as Parameters<typeof todo>[0]

  // ── datos ──────────────────────────────────────────────────────────────────
  const todasLasFilas = leerCsv('ccb-form-fin-capacitacion.csv')
  const filas = todasLasFilas.filter(r => r.fecha_envio.slice(0, 4) === ANIO)

  const { data: planRows } = await (admin as never as { from: (t: string) => { select: (s: string) => Promise<{ data: Array<{ id: string; code: string; name: string }> | null }> } })
    .from('study_plans').select('id, code, name')
  const planPorCodigo = new Map((planRows ?? []).map(p => [p.code, p]))
  const codigoPorPlanId = new Map((planRows ?? []).map(p => [p.id, p.code]))

  const miembros = await todo<Miembro>(admin, 'members', 'id, external_id, first_name, last_name')
  const porExternal = new Map(miembros.filter(m => m.external_id).map(m => [String(m.external_id).trim(), m]))
  const porId = new Map(miembros.map(m => [m.id, m]))
  const indice = new IndiceMiembros(miembros)

  const grupos = await todo<Grupo>(admin, 'study_groups',
    'id, name, status, starts_at, ends_at, leader_id, co_leader_id, plan_id')

  const enrolls = await todo<{ id: string; member_id: string; group_id: string | null; plan_id: string | null; status: string }>(
    admin, 'study_enrollments', 'id, member_id, group_id, plan_id, status')
  const porGrupo = new Map<string, typeof enrolls>()
  for (const e of enrolls) if (e.group_id) porGrupo.set(e.group_id, [...(porGrupo.get(e.group_id) ?? []), e])

  const lineas: string[] = []
  const out = (s = '') => lineas.push(s)

  // ── resolución del dirigente de cada respuesta ─────────────────────────────
  type Respuesta = Fila & { _plan: string | null; _lider: Miembro | null; _liderPorNombre: boolean }
  const respuestas: Respuesta[] = filas.map(r => {
    let lider = porExternal.get(String(r.dirigente_external_id).trim()) ?? null
    let porNombre = false
    if (!lider) {
      // Fallback por nombre, MARCADO. La tabla de alias de la migración de
      // agosto ya resolvió seis dirigentes cuyo nombre en CCB no calza.
      const alias = DIRIGENTES_POR_EXTERNAL_ID[norm(r.dirigente_nombre)]
      const m = alias ? porExternal.get(alias) ?? null : indice.buscar(r.dirigente_nombre).miembro
      if (m) { lider = m; porNombre = true }
    }
    return { ...r, _plan: capacitacionAPlan(r.capacitacion), _lider: lider, _liderPorNombre: porNombre }
  })

  /**
   * Para el cruce 3, "nunca envió el formulario" significa NUNCA, no "no lo
   * envió ese año". Los formularios llegan con atraso — hay respuestas de enero
   * de 2025 reportando cierres de noviembre de 2024 — así que medir contra un
   * solo año inventa incumplimientos.
   */
  const respuestasTodas = todasLasFilas.map(r => ({
    _plan: capacitacionAPlan(r.capacitacion),
    _lider: porExternal.get(String(r.dirigente_external_id).trim())
      ?? (DIRIGENTES_POR_EXTERNAL_ID[norm(r.dirigente_nombre)]
        ? porExternal.get(DIRIGENTES_POR_EXTERNAL_ID[norm(r.dirigente_nombre)]) ?? null
        : indice.buscar(r.dirigente_nombre).miembro),
  }))

  const sinPlan = respuestas.filter(r => !r._plan)
  const sinLider = respuestas.filter(r => !r._lider)

  // ══ CRUCE 1 ════════════════════════════════════════════════════════════════
  const enCurso = grupos.filter(g => g.status === 'en_curso')
  /**
   * Qué tipo de arreglo necesita cada caso. Verificado contra la base el
   * 2026-08-28: de los grupos que salen acá, varios YA tienen a su gente
   * calificada y lo único que quedó abierto es el grupo. Tratarlos igual que a
   * uno sin calificar haría re-calificar a gente ya graduada.
   */
  type Estado = 'solo_cerrar_grupo' | 'cierre_parcial' | 'cierre_completo'
  type Falta = {
    grupo: Grupo; plan: string; resp: Respuesta; estado: Estado
    cursando: number; calificados: number
    /** ¿La cantidad de gente del formulario calza con la del grupo? Si no
     *  calza, el formulario NO alcanza para cerrar: falta gente en una de las
     *  dos puntas y hay que mirarlo a mano. */
    cuadra: boolean
    aprob: ReturnType<typeof parsearLista>; repro: ReturnType<typeof parsearLista>
  }
  const ESTADO_LABEL: Record<Estado, string> = {
    solo_cerrar_grupo: 'Solo falta cerrar el grupo',
    cierre_parcial: 'Cierre a medias',
    cierre_completo: 'Cierre completo',
  }
  const faltantes: Falta[] = []
  for (const g of enCurso) {
    const code = g.plan_id ? codigoPorPlanId.get(g.plan_id) ?? null : null
    if (!code) continue
    const lideres = [g.leader_id, g.co_leader_id].filter(Boolean) as string[]
    if (!lideres.length) continue
    const cand = respuestas.filter(r =>
      r._plan === code
      && r._lider && lideres.includes(r._lider.id)
      // El fin reportado tiene que ser POSTERIOR al inicio del grupo. Sin
      // fecha de inicio no se puede afirmar nada: no entra.
      && !!g.starts_at && !!r.fecha_finalizacion
      && r.fecha_finalizacion > String(g.starts_at).slice(0, 10))
    if (!cand.length) continue
    // El reporte más reciente: si un dirigente cerró varias cohortes del mismo
    // estudio, la que corresponde a un grupo abierto es la última.
    const resp = cand.reduce((a, b) => (b.fecha_finalizacion > a.fecha_finalizacion ? b : a))
    const ins = porGrupo.get(g.id) ?? []
    const cursando = ins.filter(e => e.status === 'enrolled' || e.status === 'pendiente_de_pago').length
    const calificados = ins.filter(e => ['completed', 'reprobado', 'retirado'].includes(e.status)).length
    const estado: Estado = cursando === 0 && calificados > 0 ? 'solo_cerrar_grupo'
      : calificados > 0 ? 'cierre_parcial' : 'cierre_completo'
    const enForm = parsearLista(resp.aprobaron_texto).personas.length + parsearLista(resp.reprobaron_texto).personas.length
    faltantes.push({
      grupo: g, plan: code, resp, estado, cursando, calificados,
      cuadra: enForm === cursando + calificados,
      aprob: parsearLista(resp.aprobaron_texto), repro: parsearLista(resp.reprobaron_texto),
    })
  }
  faltantes.sort((a, b) => a.resp.fecha_finalizacion.localeCompare(b.resp.fecha_finalizacion))

  // ══ CRUCE 3 ════════════════════════════════════════════════════════════════
  const finalizados = grupos.filter(g =>
    g.status === 'finalizado' && String(g.ends_at ?? '').slice(0, 4) === ANIO)
  const usadas = new Set(faltantes.map(f => f.resp.response_id))
  const sinForm = finalizados.filter(g => {
    const code = g.plan_id ? codigoPorPlanId.get(g.plan_id) ?? null : null
    const lideres = [g.leader_id, g.co_leader_id].filter(Boolean) as string[]
    if (!code || !lideres.length) return false
    return !respuestasTodas.some(r => r._plan === code && r._lider && lideres.includes(r._lider.id))
  })

  // ══ CRUCE 2 ════════════════════════════════════════════════════════════════
  // Universo: TODAS las respuestas (no solo las del año), porque el grupo donde
  // alguien se graduó puede haberlo reportado un dirigente en cualquier fecha.
  const todasResp = todasLasFilas.map(r => ({ ...r, _plan: capacitacionAPlan(r.capacitacion) }))
  const menciones = new Map<string, Array<{ r: typeof todasResp[number]; lista: 'aprobados' | 'reprobados'; nota: number | null; crudo: string }>>()
  for (const r of todasResp) {
    for (const [campo, lista] of [['aprobaron_texto', 'aprobados'], ['reprobaron_texto', 'reprobados']] as const) {
      for (const p of parsearLista(r[campo]).personas) {
        const m = indice.buscarVariantes(p.variantes)
        if (!m.miembro) continue
        const k = `${m.miembro.id}|${r._plan ?? '?'}`
        menciones.set(k, [...(menciones.get(k) ?? []), { r, lista, nota: p.nota, crudo: p.crudo }])
      }
    }
  }

  // Los pendientes de la migración: procesos Done sin matrícula candidata.
  const grads = leerCsv('ccb-graduaciones-2026-08.csv').filter(g => g.status === 'Done')
  const enrollsPorMiembro = new Map<string, typeof enrolls>()
  for (const e of enrolls) enrollsPorMiembro.set(e.member_id, [...(enrollsPorMiembro.get(e.member_id) ?? []), e])
  const grupoPorId = new Map(grupos.map(g => [g.id, g]))

  /**
   * Dos calidades de evidencia, y no se mezclan.
   *
   * FUERTE: la cola nombra una capacitación concreta ("Aprueba Panorama") y un
   * dirigente menciona a la persona en el formulario de ESA capacitación. El
   * formulario dice en qué grupo fue.
   *
   * DÉBIL: la cola es genérica ("Reprueba Capacitación", que no dice cuál). Acá
   * lo único que se puede ofrecer son las menciones en listas de REPROBADOS
   * cerca de la fecha del proceso — el resto de la historia de la persona no es
   * evidencia de nada. Sin el filtro por lista y por fecha, esta sección
   * devolvía toda la trayectoria de cada persona (incluidas sus aprobaciones)
   * como si fuera prueba, que es peor que no devolver nada.
   */
  /**
   * MISMO UNIVERSO QUE LA ETAPA 3 DE LA MIGRACIÓN, o los números no se pueden
   * comparar.
   *
   * La etapa 3 descarta las matrículas que están en los 102 grupos abiertos de
   * CCB: esa gente está llevando el estudio AHORA, así que una graduación vieja
   * no le corresponde. Sin esta exclusión acá, alguien cuya única matrícula del
   * plan está en un grupo abierto de CCB se veía como "ya resuelto" y quedaba
   * fuera del cruce — que es justo el caso que este informe tiene que atrapar.
   */
  const gruposCcb = new Set<string>(JSON.parse(
    readFileSync('scripts/ccb-migracion-2026-08/grupos-de-esta-migracion.json', 'utf8')))

  const VENTANA_DIAS = 180
  const diasEntre = (a: string, b: string) =>
    Math.abs((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000)

  type Evidencia = { plan: string; fecha: string; dirigente: string; lista: string; nota: number | null; crudo: string; responseId: string }
  // response_id → grupo del cruce 1, para poder decir "esto se resuelve solo al
  // cerrar ese grupo" en vez de dejarlo como dos pendientes sueltos.
  const grupoPorRespuesta = new Map(faltantes.map(f => [f.resp.response_id, f.grupo]))
  type Pendiente = { grad: Fila; persona: Miembro; fuerza: 'fuerte' | 'debil'; evidencia: Evidencia[] }
  const pendientes: Pendiente[] = []
  let sinEvidencia = 0, sinPersonaGrad = 0
  for (const g of grads) {
    const persona = porExternal.get(String(g.external_id).trim())
    if (!persona) { sinPersonaGrad++; continue }
    const code = capacitacionAPlan(g.queue_name)
    const generica = /^(a|re)prueba\b/.test(norm(g.queue_name)) && !code
    // "Sin resolver" = no tiene NINGUNA matrícula del plan que nombra la cola.
    // Con cola genérica no hay plan que mirar, así que entra igual.
    const suyas = (enrollsPorMiembro.get(persona.id) ?? [])
      .filter(e => code && codigoPorPlanId.get(e.plan_id ?? '') === code)
      .filter(e => !e.group_id || !gruposCcb.has(e.group_id))
    if (code && suyas.length > 0) continue

    const todas: Evidencia[] = [...menciones.entries()]
      .filter(([k]) => k.startsWith(`${persona.id}|`))
      .flatMap(([k, vs]) => vs.map(v => ({
        plan: k.split('|')[1], fecha: v.r.fecha_finalizacion || v.r.fecha_envio.slice(0, 10),
        dirigente: v.r.dirigente_nombre, lista: v.lista, nota: v.nota, crudo: v.crudo,
        responseId: v.r.response_id,
      })))

    let ev: Evidencia[]
    let fuerza: 'fuerte' | 'debil'
    if (code) {
      ev = todas.filter(e => e.plan === code)
      fuerza = 'fuerte'
    } else if (generica) {
      const esReprueba = /^reprueba/.test(norm(g.queue_name))
      ev = todas.filter(e =>
        (esReprueba ? e.lista === 'reprobados' : e.lista === 'aprobados')
        && e.fecha && g.fecha_due && diasEntre(e.fecha, g.fecha_due) <= VENTANA_DIAS)
      fuerza = 'debil'
    } else { ev = []; fuerza = 'debil' }

    if (ev.length) pendientes.push({ grad: g, persona, fuerza, evidencia: ev })
    else sinEvidencia++
  }
  const fuertes = pendientes.filter(p => p.fuerza === 'fuerte')
  const debiles = pendientes.filter(p => p.fuerza === 'debil')

  // ── informe ────────────────────────────────────────────────────────────────
  const hoy = new Date().toISOString().slice(0, 10)
  out(`# Verificación de cierres · formulario "EB — Fin de Capacitación"`)
  out()
  out(`Corrida del ${hoy} sobre **${ANIO}**. Este informe **no cambió nada en la base**:`)
  out(`sale de \`scripts/verificacion-cierres-2026-08/informe.ts\`, que solo lee.`)
  out()
  out(`## Resumen ejecutivo`)
  out()
  out(`| | |`)
  out(`|---|---|`)
  out(`| Respuestas del formulario en ${ANIO} | ${filas.length} |`)
  out(`| **Cierres que nos faltan** (cruce 1) | **${faltantes.length}** |`)
  out(`| ↳ de esos, con la lista del formulario cuadrando | ${faltantes.filter(f => f.cuadra).length} |`)
  out(`| ↳ de esos, descuadrados (van a mano) | ${faltantes.filter(f => !f.cuadra).length} |`)
  out(`| Pendientes de graduación con evidencia fuerte (cruce 2) | ${fuertes.length} |`)
  out(`| ↳ con evidencia solo débil | ${debiles.length} |`)
  out(`| Grupos cerrados sin formulario (cruce 3) | ${sinForm.length} |`)
  out(`| Grupos en curso en total | ${enCurso.length} |`)
  out()
  if (sinPlan.length || sinLider.length) {
    out(`### Lo que no se pudo resolver`)
    out()
    if (sinPlan.length) {
      out(`**${sinPlan.length} respuesta(s) con una capacitación que no mapea a ningún plan.** No se adivina el plan más parecido:`)
      out()
      for (const r of sinPlan) out(`- \`${esc(r.capacitacion) || '(vacío)'}\` — ${esc(r.dirigente_nombre)}, ${r.fecha_envio.slice(0, 10)}`)
      out()
    }
    if (sinLider.length) {
      out(`**${sinLider.length} respuesta(s) cuyo dirigente no se encontró** (ni por external_id ni por nombre):`)
      out()
      for (const r of sinLider) out(`- ${esc(r.dirigente_nombre)} (id CCB ${esc(r.dirigente_external_id)}) — ${esc(r.capacitacion)}, ${r.fecha_envio.slice(0, 10)}`)
      out()
    }
  }

  // ── CRUCE 1 ────────────────────────────────────────────────────────────────
  out(`## Cruce 1 · Grupos en curso que ya deberían estar cerrados`)
  out()
  out(`El dirigente reportó el fin de esa capacitación y el grupo sigue abierto en el`)
  out(`sistema. Criterio: mismo plan, el dirigente (o co-dirigente) del grupo es quien`)
  out(`firmó el formulario, y la fecha de finalización reportada es **posterior** a la`)
  out(`fecha de inicio del grupo.`)
  out()
  if (!faltantes.length) out(`Ninguno.`)
  else {
    out(`**${faltantes.length} cierres pendientes.**`)
    out()
    for (const [e, label] of Object.entries(ESTADO_LABEL)) {
      const n = faltantes.filter(f => f.estado === e).length
      if (n) out(`- **${label}:** ${n}`)
    }
    const noCuadran = faltantes.filter(f => !f.cuadra).length
    out(`- **De esos, con la cantidad de gente descuadrada:** ${noCuadran} → el formulario no alcanza, van a mano`)
    out()
    out(`| Grupo | Plan | Dirigente | Fin reportado | Qué falta | En la base | En el form (ap./rep.) | ¿Cuadra? | Notas |`)
    out(`|---|---|---|---|---|---|---|---|---|`)
    for (const f of faltantes) {
      const notas = f.aprob.personas.filter(p => p.nota !== null).length
      out(`| ${esc(f.grupo.name)} | ${f.plan} | ${esc(f.resp.dirigente_nombre)}${f.resp._liderPorNombre ? ' ⚠️' : ''} | ${f.resp.fecha_finalizacion} | ${ESTADO_LABEL[f.estado]} | ${f.cursando} cursando / ${f.calificados} calificados | ${f.aprob.personas.length} / ${f.repro.personas.length} | ${f.cuadra ? 'sí' : `⚠️ ${f.aprob.personas.length + f.repro.personas.length} vs ${f.cursando + f.calificados}`} | ${notas}/${f.aprob.personas.length} |`)
    }
    out()
    out(`⚠️ = el dirigente se resolvió por **nombre**, no por id de CCB. Verificar antes de cerrar.`)
    out()
    out(`### Detalle para hacer los cierres`)
    out()
    for (const f of faltantes) {
      out(`#### ${f.grupo.name}`)
      out()
      out(`- **Qué falta:** ${ESTADO_LABEL[f.estado]} — en la base hay ${f.cursando} cursando y ${f.calificados} ya calificados`)
      if (!f.cuadra) out(`- ⚠️ **La cantidad no cuadra:** el formulario lista ${f.aprob.personas.length + f.repro.personas.length} personas y el grupo tiene ${f.cursando + f.calificados}. Revisar antes de cerrar.`)
      out(`- **Plan:** ${f.plan} · **inicio:** ${String(f.grupo.starts_at ?? '—').slice(0, 10)} · **fin en el sistema:** ${String(f.grupo.ends_at ?? '—').slice(0, 10)} · **fin reportado:** ${f.resp.fecha_finalizacion}`)
      out(`- **Dirigente:** ${esc(f.resp.dirigente_nombre)}${f.resp.codirigente ? ` · co-dirigente en el form: ${esc(f.resp.codirigente)}` : ''}`)
      out(`- **Grupo:** \`/estudios/grupos/${f.grupo.id}\``)
      if (f.resp.comentarios) out(`- **Comentarios del dirigente:** ${esc(f.resp.comentarios)}`)
      out()
      const tabla = (t: string, l: ReturnType<typeof parsearLista>) => {
        out(`**${t} (${l.personas.length})**`)
        out()
        if (!l.personas.length) { out(`_(ninguno)_`); out(); return }
        out(`| Nombre en el formulario | Persona en la base | Score | Nota | Observación |`)
        out(`|---|---|---|---|---|`)
        for (const p of l.personas) {
          const m: Match = indice.buscarVariantes(p.variantes)
          const quien = m.miembro
            ? `${m.miembro.first_name} ${m.miembro.last_name}`
            : m.ambiguo.length ? `⚠️ ${m.ambiguo.length} candidatos: ${m.ambiguo.map(x => `${x.first_name} ${x.last_name}`).join(' / ')}`
            : '❌ sin match'
          out(`| ${esc(p.crudo)} | ${esc(quien)} | ${m.miembro ? m.score.toFixed(2) : '—'} | ${p.nota ?? (p.notaAmbigua ? `⚠️ "${p.notaAmbigua}"` : '—')} | ${esc(p.observacion ?? '')} |`)
        }
        out()
        if (l.descartadas.length) {
          out(`_Líneas que no son personas y se descartaron:_ ${l.descartadas.map(d => `\`${esc(d)}\``).join(', ')}`)
          out()
        }
      }
      tabla('Aprobados', f.aprob)
      tabla('Reprobados', f.repro)
    }
  }
  out()

  // ── CRUCE 2 ────────────────────────────────────────────────────────────────
  out(`## Cruce 2 · Graduaciones pendientes con evidencia en el formulario`)
  out()
  out(`Personas cuya graduación de CCB no encontró matrícula destino. La evidencia`)
  out(`viene en dos calidades y **no se mezclan**.`)
  out()
  out(`> Esta sección **no depende del año** del informe: la cola de graduaciones`)
  out(`> pendientes es una sola, y el formulario que la resuelve puede ser de`)
  out(`> cualquier fecha. Sale igual en la corrida de 2025 y en la de 2026.`)
  out()
  out(`| | |`)
  out(`|---|---|`)
  out(`| Procesos \`Done\` de CCB | ${grads.length} |`)
  out(`| Pendientes con **evidencia fuerte** | ${fuertes.length} |`)
  out(`| Pendientes con **evidencia débil** | ${debiles.length} |`)
  out(`| Pendientes sin ninguna evidencia (quedan manuales) | ${sinEvidencia} |`)
  if (sinPersonaGrad) out(`| Graduaciones cuya persona no está en la base | ${sinPersonaGrad} |`)
  out()
  const tablaEv = (ps: Pendiente[]) => {
    out(`| Persona | Cola de CCB | Fecha del proceso | Formulario | ¿Es un grupo del cruce 1? | Lista | Nota | Línea original |`)
    out(`|---|---|---|---|---|---|---|---|`)
    for (const p of ps) for (const e of p.evidencia) {
      const g = grupoPorRespuesta.get(e.responseId)
      out(`| ${esc(p.persona.first_name)} ${esc(p.persona.last_name)} | ${esc(p.grad.queue_name)} | ${esc(p.grad.fecha_due)} | ${esc(e.dirigente)}, ${e.fecha} (${e.plan}) | ${g ? `**sí** — ${esc(g.name)}` : 'no'} | ${e.lista} | ${e.nota ?? '—'} | \`${esc(e.crudo)}\` |`)
    }
    out()
    const enCruce1 = ps.flatMap(p => p.evidencia).filter(e => grupoPorRespuesta.has(e.responseId)).length
    if (enCruce1) {
      out(`**${enCruce1} de estas menciones vienen de un formulario que además es un cierre`)
      out(`pendiente del cruce 1.** No son dos problemas: cerrar ese grupo resuelve la`)
      out(`graduación, porque el cierre crea la matrícula que hoy le falta a la persona.`)
      out()
    }
  }
  out(`### Evidencia fuerte`)
  out()
  out(`La cola de CCB nombra una capacitación concreta y un dirigente menciona a la`)
  out(`persona en el formulario **de esa misma capacitación**. Ese formulario dice en`)
  out(`qué grupo fue.`)
  out()
  if (!fuertes.length) out(`Ninguna.`)
  else tablaEv(fuertes)
  out()
  out(`### Evidencia débil`)
  out()
  out(`La cola es genérica (\`Reprueba Capacitación\` no dice **cuál**). Lo único`)
  out(`ofrecible son menciones en listas de reprobados dentro de ±${VENTANA_DIAS} días del`)
  out(`proceso. **No alcanza para resolver solo**: es una pista de por dónde buscar.`)
  out()
  if (!debiles.length) out(`Ninguna.`)
  else tablaEv(debiles)
  out()

  // ── CRUCE 3 ────────────────────────────────────────────────────────────────
  out(`## Cruce 3 · Cierres en el sistema sin formulario`)
  out()
  out(`Grupos finalizados en ${ANIO} cuyo dirigente **nunca** envió el formulario de esa`)
  out(`capacitación — en ningún año, porque los formularios llegan con atraso. **No es un`)
  out(`error del sistema** — es gente que no llenó el form.`)
  out()
  if (!sinForm.length) out(`Ninguno.`)
  else {
    out(`**${sinForm.length} grupos.**`)
    out()
    out(`| Grupo | Plan | Dirigente | Cerró |`)
    out(`|---|---|---|---|`)
    for (const g of sinForm.sort((a, b) => String(a.ends_at).localeCompare(String(b.ends_at)))) {
      const l = g.leader_id ? porId.get(g.leader_id) : null
      out(`| ${esc(g.name)} | ${codigoPorPlanId.get(g.plan_id ?? '') ?? '—'} | ${l ? esc(`${l.first_name} ${l.last_name}`) : '—'} | ${String(g.ends_at ?? '').slice(0, 10)} |`)
    }
  }
  out()
  out(`---`)
  out()
  out(`## Cómo leer esto`)
  out()
  out(`Las listas del formulario son **texto libre**. El parser (\`src/lib/studies/ccb-form-parse.ts\`,`)
  out(`con tests) resuelve las grafías que aparecen de verdad en el archivo y **descarta lo`)
  out(`que no parece una persona en vez de adivinar**. Dos reglas que importan:`)
  out()
  out(`- **Ambigüedad no se resuelve sola.** Un nombre con dos candidatos en la base sale`)
  out(`  marcado ⚠️ con los dos, no se elige el primero.`)
  out(`- **Las notas en escala 0-10 no se convierten.** Un "9.0" puede ser un 9 o un 90;`)
  out(`  esos casos salen como \`⚠️ "9.0"\` y la nota queda vacía. Las que sí salen están`)
  out(`  en escala 0-100, que es la de \`study_enrollments.grade\` (verificado: los 252`)
  out(`  valores que ya hay en la base van de 70 a 105,2).`)
  out()
  out(`### Cómo volver a correrlo`)
  out()
  out(`\`\`\`bash`)
  out(`NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/informe.ts --anio ${ANIO}`)
  out(`\`\`\``)
  out()
  out(`El script **solo lee**. Los arreglos van después, caso por caso.`)

  const ruta = `docs/verificacion-cierres-${ANIO}.md`
  writeFileSync(ruta, lineas.join('\n') + '\n')
  console.log(`\n══ ${ANIO} ══`)
  console.log(`  respuestas del formulario:        ${filas.length}`)
  console.log(`  CIERRES QUE FALTAN (cruce 1):     ${faltantes.length}`)
  console.log(`  cruce 2 · evidencia fuerte:       ${fuertes.length}`)
  console.log(`  cruce 2 · evidencia débil:        ${debiles.length}`)
  console.log(`  cruce 2 · sin evidencia:          ${sinEvidencia}`)
  console.log(`  cerrados sin formulario (cr. 3):  ${sinForm.length}`)
  console.log(`  capacitación sin mapeo:           ${sinPlan.length}`)
  console.log(`  dirigente sin resolver:           ${sinLider.length}`)
  console.log(`\n  → ${ruta}`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
