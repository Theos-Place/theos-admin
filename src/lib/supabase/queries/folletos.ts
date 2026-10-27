import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { FOLLETO_NOTIFY_ROLES, destinatariosDeFolletos } from '@/lib/studies/folleto-notifications'
import type { FolletoState } from '@/lib/studies/folletos'
import { estimatedAvailableDate, levelLabel } from '@/lib/studies/folletos'
import { hasOwnFolleto, shouldCreateAutoFolleto, type AutoFolletoTipo } from '@/lib/studies/folleto-auto-rules'
import { desgloseFolletos, type DesgloseFolletos } from '@/lib/studies/folleto-desglose'
import { contarResultadosCierre, type ConteoCierre } from '@/lib/studies/close-result-read'
import { reportarError } from '@/lib/observabilidad'
import { folletosQuePide } from '@/lib/studies/corte-de-bloque'
import type { ResultadoPorTiquete } from '@/lib/studies/cambio-de-estado-folleto'
import { modalidadDe } from '@/lib/studies/modalidad-de-bloques'

export type DbFolletoRequest = {
  id: string
  source_group_id: string | null
  source_plan_code: string | null
  target_level_code: string | null
  quantity: number
  sede: string | null
  close_date: string
  available_at: string
  status: FolletoState
  tipo: string
  bloque_id: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  created_at: string
  note: string | null
  target_leader_id: string | null
  target_leader_name: string | null
  source_group: { name: string | null; modalidad?: string | null; dirigente?: string | null } | null
  bloque: { nombre: string } | null
  target_leader: { first_name: string | null; last_name: string | null } | null
  /** Pagos individuales enlazados a este tiquete. Ausente = nivel sin cobro. */
  pagos: { total: number; pagados: number }
  /** Cuántos folletos de verdad: estudiantes + dirigentes. `quantity` sola es
   *  solo la parte de estudiantes, y la cola tiene que mostrar el total. */
  desglose: DesgloseFolletos
}

/** Personas a cargo de los folletos (para notificaciones + correos).
 *
 *  La audiencia la decide `destinatariosDeFolletos` (módulo puro, con tests).
 *  Antes se derivaba de los permisos —"todo rol que pueda ver el módulo"— y por
 *  eso `solo_lectura`, cuyo permiso es `module: 'all'`, recibía los correos:
 *  comunicacion@theosplace.org los estuvo recibiendo hasta el 2026-09-21. */
export async function getFolletoRecipients(): Promise<Array<{ member_id: string; email: string | null; name: string }>> {
  const supabase = createAdminClient()
  if (FOLLETO_NOTIFY_ROLES.length === 0) return []
  const { data, error } = await supabase
    .from('member_roles')
    .select('member_id, role, is_active, member:members!member_roles_member_id_fkey(email, first_name, last_name, is_active, email_bounced, email_complained)')
    .in('role', FOLLETO_NOTIFY_ROLES as unknown as string[])
    .eq('is_active', true)
  if (error) { console.warn('getFolletoRecipients:', error.message); return [] }
  type Fila = {
    member_id: string
    role: string
    is_active: boolean
    member: {
      email: string | null; first_name: string; last_name: string; is_active: boolean
      email_bounced: boolean | null; email_complained: boolean | null
    } | null
  }
  const filas = (data ?? []) as Fila[]
  const permitidos = new Set(destinatariosDeFolletos(filas.map(f => ({
    member_id: f.member_id,
    role: f.role,
    role_active: f.is_active !== false,
    member_active: f.member?.is_active === true,
  }))))

  const byId = new Map<string, { member_id: string; email: string | null; name: string }>()
  for (const r of filas) {
    if (!r.member || !permitidos.has(r.member_id)) continue
    // La campana sí les llega; el correo no. Una dirección marcada como
    // rebotada o con queja vuelve a rebotar en cada envío, y cada rebote le
    // pega a la reputación del dominio en SES. Se detectó el 2026-09-02:
    // admin@ y lectura@ rebotaban en TODOS los avisos de folletos.
    const correoUtil = !!r.member.email && !r.member.email_bounced && !r.member.email_complained
    byId.set(r.member_id, {
      member_id: r.member_id,
      email: correoUtil ? r.member.email : null,
      name: `${r.member.first_name} ${r.member.last_name}`.trim(),
    })
  }
  return [...byId.values()]
}

/** Sede tomada del perfil del dirigente (líder) del grupo. */
export async function getLeaderSedeForGroup(groupId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: g } = await supabase.from('study_groups').select('leader_id').eq('id', groupId).maybeSingle()
  const leaderId = (g as { leader_id: string | null } | null)?.leader_id
  if (!leaderId) return null
  const { data: m } = await supabase
    .from('members').select('sede:sedes(name)').eq('id', leaderId).maybeSingle()
  const sede = (m as { sede: { name: string } | { name: string }[] | null } | null)?.sede
  const one = Array.isArray(sede) ? sede[0] : sede
  return one?.name ?? null
}

/** Sede resuelta para un grupo, en orden: 1) la sede de ENTREGA DE FOLLETOS
 *  elegida al crear el grupo (folletos_sede, si no es TBD); 2) el perfil del
 *  dirigente (líder); 3) la zona propia del grupo. Usado por todo folleto
 *  generado a partir de un grupo (automáticos y reubicación individual). */
export async function getSedeForGroup(groupId: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: g } = await supabase.from('study_groups').select('zone, folletos_sede').eq('id', groupId).maybeSingle()
  const row = g as { zone: string | null; folletos_sede: string | null } | null
  if (row?.folletos_sede && row.folletos_sede !== 'TBD') return row.folletos_sede
  const leaderSede = await getLeaderSedeForGroup(groupId)
  if (leaderSede) return leaderSede
  const zoneCode = row?.zone
  if (!zoneCode) return null
  const { data: s } = await supabase.from('sedes').select('name').eq('code', zoneCode).maybeSingle()
  return (s as { name: string } | null)?.name ?? null
}

/** FOL-1: tiquete AUTOMÁTICO de folletos del PROPIO nivel del grupo.
 *  Dispara en dos momentos (reglas que reemplazan cierre/hitos):
 *    · cupo_lleno:    al confirmar la matrícula que llena el cupo;
 *    · fin_matricula: al vencer la ventana (GRU-1) con >= 5 matriculados.
 *  Idempotente: el índice único parcial folleto_requests_auto_por_grupo
 *  garantiza UN tiquete por grupo (el 23505 se trata como "ya existe").
 *  Best-effort para los callers: nunca revienta la matrícula ni el cron. */
export async function createAutoFolletoIfNeeded(
  groupId: string,
  tipo: AutoFolletoTipo,
  todayIso: string,
  /** Lugar de entrega dicho por quien cierra. Si no viene, se resuelve solo
   *  (grupo → dirigente → zona) como siempre. */
  sedeExplicita?: string | null,
  /** El grupo que se CERRÓ (tipo='cierre'). `groupId` es el sucesor, el que va
   *  a usar los folletos; sin este enlace el tiquete no puede decir cuántos
   *  aprobaron, reprobaron o se retiraron. */
  originGroupId?: string | null,
  /** EST-30 · El automático pide al CUPO, no a los matriculados, y nace con
   *  una nota que dice de dónde sale el número. Solo lo usa
   *  `pedirFolletosAnticipadosAutomaticos`. */
  extras?: { cantidadFija?: number; note?: string },
  // `id` sale también cuando el tiquete YA existía: quien llama lo necesita
  // para enlazarle los pagos, y ese enlace tiene que ser idempotente igual que
  // la creación.
): Promise<{ created: boolean; id?: string; reason?: string }> {
  const supabase = createAdminClient()
  const [{ data: g }, { count }, { count: conPar }] = await Promise.all([
    supabase.from('study_groups')
      .select('id, max_students, folletos_sede, leader_id, co_leader_id, modalidad, plan:study_plans(code)')
      .eq('id', groupId).maybeSingle(),
    // 'pendiente_de_pago' cuenta: los que avanzan por cierre entran así (la
    // matrícula es efectiva de inmediato y el cobro va aparte), y si no se
    // contaran, el grupo sucesor tendría 0 y nunca pediría folletos.
    supabase.from('study_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId).in('status', ['enrolled', 'pendiente_de_pago']),
    /**
     * En un grupo LEGACY, quien ya pagó el par tampoco necesita el folleto:
     * lo recibió al entrar al bloque. Se descuenta del conteo o se imprime
     * de más — el error que EST-14 vino a arreglar, reintroducido al revés.
     */
    supabase.from('study_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId).eq('cubre_bloque', true)
      .in('status', ['enrolled', 'pendiente_de_pago']),
  ])
  const row = g as { id: string; max_students: number | null; folletos_sede: string | null; leader_id: string | null; co_leader_id: string | null; modalidad: string | null; plan: { code: string | null } | { code: string | null }[] | null } | null
  if (!row) return { created: false, reason: 'grupo_no_encontrado' }
  const plan = Array.isArray(row.plan) ? row.plan[0] : row.plan
  const code = plan?.code ?? null
  if (!hasOwnFolleto(code)) return { created: false, reason: 'plan_sin_folleto' }

  const enrolled = count ?? 0
  if (!shouldCreateAutoFolleto(tipo, { enrolled, max_students: row.max_students })) {
    return { created: false, reason: 'umbral_no_alcanzado' }
  }

  // Resolución única (getSedeForGroup): sede de entrega del grupo → sede del
  // dirigente → zona del grupo.
  const sede = (sedeExplicita ?? '').trim() || await getSedeForGroup(groupId)
  // El dirigente y el co-dirigente también dan el estudio y también necesitan
  // folleto: se guardan aparte de `quantity` para que el desglose sea visible y
  // para no reinterpretar lo que `quantity` significa en los tiquetes viejos.
  const folletosDeDirigentes = (row.leader_id ? 1 : 0) + (row.co_leader_id ? 1 : 0)

  /**
   * EST-14 · UNA ORDEN POR GRUPO, que cubre el par.
   *
   * Primero se hizo al revés —un tiquete por folleto— y al probarlo se vio
   * que no sirve: quien imprime recibía DOS pedidos del mismo grupo, el
   * mismo día y a la misma sede, y tenía que juntarlos mentalmente. Una
   * orden por grupo es lo que se pidió (Floriana, 2026-10-01).
   *
   * Qué folletos cubre NO se guarda: se deriva del plan con
   * `folletosQuePide`, que es la misma regla que decide el cobro y el conteo
   * de impresión. `target_level_code` guarda el PRIMERO del par, que es el
   * nivel con el que la orden se identifica.
   *
   * Un grupo de N2 o N4 no pide nada: su gente ya tiene los folletos desde
   * que entró al bloque. Eso es lo que hace desaparecer solo el pedido por
   * cierre de 1→2 y 3→4, sin tocar el endpoint de cierre.
   */
  /**
   * LEGACY vs BLOQUES (2026-10-05). Un grupo legacy pide SU propio folleto:
   * su gente recibió el del nivel anterior cuando entró a ese nivel, no el
   * par. Sin esta distinción los cierres 3→4 de los grupos viejos no pedían
   * nada y 32 estudiantes se quedaron sin material.
   */
  const aPedir = folletosQuePide(code, modalidadDe(row.modalidad))
  if (aPedir.length === 0) return { created: false, reason: 'ya_los_tiene_del_bloque' }

  // Cuántos juegos se imprimen de verdad: los matriculados MENOS los que ya
  // recibieron el par. Nunca negativo. El automático de EST-30 trae la
  // cantidad decidida (el cupo): acá no se recalcula.
  const aImprimir = extras?.cantidadFija ?? Math.max(0, enrolled - (conPar ?? 0))
  if (aImprimir === 0) return { created: false, reason: 'ya_los_tiene_del_bloque' }

  const { data: creado, error } = await supabase.from('folleto_requests').insert({
    tipo,
    source_group_id: groupId,
    origin_group_id: originGroupId ?? null,
    source_plan_code: code,
    target_level_code: aPedir[0],
    quantity: aImprimir,
    quantity_leaders: folletosDeDirigentes,
    sede,
    close_date: todayIso,
    available_at: estimatedAvailableDate(todayIso),
    note: extras?.note ?? null,
  }).select('id').single()
  if (error) {
    if ((error as { code?: string }).code !== '23505') throw error
    const { data: previo } = await supabase.from('folleto_requests')
      .select('id').eq('source_group_id', groupId)
      .in('tipo', TIPOS_UNA_ORDEN_POR_GRUPO).maybeSingle()
    const id = (previo as { id: string } | null)?.id
    if (!id) return { created: false, reason: 'ya_existe' }
    return { created: false, id, reason: 'ya_existe' }
  }
  const folletoId = (creado as { id: string }).id

  // AVISO. El correo se arma desde el MISMO detalle que muestra la pantalla,
  // para que los dos digan lo mismo.
  //
  // El HTML se arma en su propio try, y aparte del envío. Antes era un solo
  // bloque, y cuando armar el cuerpo reventaba se caía TODO — ni campana ni
  // correo — con un console.warn que nadie ve. Pasó el 2026-09-02 en el cierre
  // de Floriana Fonseca: `schedule_days` es un array y se estaba tratando como
  // texto, así que `.trim()` no existía. El tiquete quedó creado y en silencio.
  //
  // Ahora, si el cuerpo falla, igual sale el aviso con un texto mínimo: es
  // preferible un correo pobre a ninguno. Quien imprime se entera igual y el
  // detalle está a un clic.
  /**
   * EST-14 · El aviso habla del PAR, no del primer folleto.
   *
   * Un grupo de N1 genera dos tiquetes, y mandar dos correos iguales del
   * mismo grupo entrena a ignorarlos. Va UNO que los nombra a los dos; el
   * enlace apunta al primero y desde la cola se ven los dos juntos porque
   * comparten grupo.
   */
  const etiquetaDelPar = aPedir.map(n => levelLabel(n)).join(' + ')
  let asunto = `Folletos de ${etiquetaDelPar} — ${sede ?? 'sede sin definir'}`
  let cuerpo = `<p>Se generó una solicitud de folletos. Abrila para ver el detalle:</p>
    <p><a href="https://admin.theosplace.org/estudios/folletos/${folletoId}">Ver la solicitud</a></p>`
  let resumen = `${aImprimir} juego(s) de ${etiquetaDelPar} · ${sede ?? 'sede sin definir'}`
  try {
    const detalle = await getFolletoDetalle(folletoId)
    if (detalle) {
      const { asuntoFolleto, cuerpoFolleto, etiquetaTipo } = await import('@/lib/email/folleto-request-notify')
      const { renderEmail } = await import('@/lib/email/baseLayout')
      // Con un par, el detalle del primer tiquete describe UN folleto: se le
      // agrega la mención del otro para que el correo no mienta por omisión.
      asunto = aPedir.length > 1
        ? `Folletos de ${etiquetaDelPar} — ${sede ?? 'sede sin definir'}`
        : asuntoFolleto(detalle)
      const extra = aPedir.length > 1
        ? `<p><strong>Son ${aPedir.length} folletos por persona</strong> (${etiquetaDelPar}): `
          + 'se entregan juntos al empezar el bloque. En la cola aparecen como dos '
          + 'solicitudes del mismo grupo.</p>'
        : ''
      cuerpo = renderEmail(cuerpoFolleto(detalle) + extra)
      resumen = `${detalle.desglose.total} × ${etiquetaDelPar} · ${sede ?? 'sede sin definir'} (${etiquetaTipo(tipo)})`
    }
  } catch (e) {
    reportarError('folletos: el detalle del aviso falló, va la versión mínima:', e)
  }
  try {
    await notifyFolletoRecipients({
      title: 'Folletos solicitados',
      body: resumen,
      subject: asunto,
      html: cuerpo,
      link: `/estudios/folletos/${folletoId}`,
    })
  } catch (e) {
    reportarError('folletos: tiquete creado pero NADIE fue avisado:', e)
  }
  return { created: true, id: folletoId }
}

/**
 * Los tipos que entran en «una orden por grupo» (índice único parcial
 * `folleto_requests_auto_por_grupo`). Espejo de la migración
 * 20261027120000: si se agrega un tipo allá, va acá.
 */
export const TIPOS_UNA_ORDEN_POR_GRUPO = ['cupo_lleno', 'fin_matricula', 'cierre', 'anticipado', 'anticipado_auto'] as const

/** Las matrículas de un grupo con sus pagos, para contar confirmados y
 *  pendientes con `contarMatricula`. */
async function matriculaConPagos(groupId: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('study_enrollments')
    .select('status, payments!payments_enrollment_id_fkey(status)')
    .eq('group_id', groupId)
  if (error) throw error
  return (data ?? []) as unknown as Array<{ status: string | null; payments: Array<{ status: string | null }> | null }>
}

export type ResumenAnticipadosAuto = {
  creados: Array<{ group_id: string; folleto_id: string; cantidad: number }>
  /** Ya tenían tiquete (EST-21 o cierre): se les subió la cantidad al cupo. */
  actualizados: Array<{ group_id: string; folleto_id: string; de: number; a: number }>
  omitidos: Array<{ group_id: string; motivo: string }>
}

/**
 * EST-30 · Recorre los grupos de Nivel 1 en matrícula y, a los que están a
 * dos semanas (o menos) del fin de matrícula y no tienen tiquete, les pide
 * los folletos AL CUPO MÁXIMO. Lo llama el cron diario de ventanas.
 *
 * IDEMPOTENTE: el índice único por grupo hace que la segunda corrida no
 * cree nada; y la convivencia con un tiquete previo (botón de EST-21,
 * cierre del grupo anterior) solo levanta la cantidad si el tiquete sigue
 * en «creada» y pedía menos — una vez.
 */
export async function pedirFolletosAnticipadosAutomaticos(hoy: string): Promise<ResumenAnticipadosAuto> {
  const {
    tocaPedirAutomatico, cantidadAnticipada, contarMatricula, totalMatriculados,
    notaInicial, cantidadAlConvivir, anexarNota, NIVELES_CON_TIQUETE_AUTOMATICO,
  } = await import('@/lib/studies/folletos-anticipados-auto')
  const supabase = createAdminClient()
  const out: ResumenAnticipadosAuto = { creados: [], actualizados: [], omitidos: [] }

  const { data, error } = await supabase
    .from('study_groups')
    .select('id, status, max_students, modalidad, enrollment_end_date, plan:study_plans!inner(code)')
    .eq('status', 'en_matricula')
    .not('enrollment_end_date', 'is', null)
    .in('plan.code', [...NIVELES_CON_TIQUETE_AUTOMATICO])
  if (error) throw error
  type Row = { id: string; status: string; max_students: number | null; modalidad: string | null; enrollment_end_date: string | null; plan: { code: string | null } | { code: string | null }[] | null }

  for (const g of (data ?? []) as Row[]) {
    const plan = Array.isArray(g.plan) ? g.plan[0] : g.plan
    if (!tocaPedirAutomatico({ planCode: plan?.code, status: g.status, enrollment_end_date: g.enrollment_end_date, modalidad: modalidadDe(g.modalidad) }, hoy)) continue

    const conteo = contarMatricula(await matriculaConPagos(g.id))
    const cupo = cantidadAnticipada({ max_students: g.max_students, matriculados: totalMatriculados(conteo) })
    if (cupo === 0) { out.omitidos.push({ group_id: g.id, motivo: 'sin cupo ni matriculados' }); continue }

    // Convivencia: ¿ya hay orden para este grupo?
    const { data: previo } = await supabase.from('folleto_requests')
      .select('id, status, quantity, note').eq('source_group_id', g.id)
      .in('tipo', TIPOS_UNA_ORDEN_POR_GRUPO).maybeSingle()
    const t = previo as { id: string; status: string; quantity: number; note: string | null } | null
    if (t) {
      const nueva = cantidadAlConvivir({ status: t.status, quantity: t.quantity, cupo })
      if (nueva == null) { out.omitidos.push({ group_id: g.id, motivo: 'ya tiene orden' }); continue }
      const anexo = `Dos semanas antes del fin de matrícula se sube al cupo máximo. Cantidad: ${t.quantity} → ${nueva}.`
      const { error: eUp } = await supabase.from('folleto_requests')
        .update({ quantity: nueva, note: anexarNota(t.note, anexo) })
        .eq('id', t.id).eq('status', 'creada')
      if (eUp) throw eUp
      out.actualizados.push({ group_id: g.id, folleto_id: t.id, de: t.quantity, a: nueva })
      continue
    }

    const r = await createAutoFolletoIfNeeded(g.id, 'anticipado_auto', hoy, null, null, {
      cantidadFija: cupo,
      note: notaInicial({ hoy, finDeMatricula: g.enrollment_end_date!, cantidad: cupo, maxStudents: g.max_students, conteo }),
    })
    if (r.created && r.id) out.creados.push({ group_id: g.id, folleto_id: r.id, cantidad: cupo })
    else out.omitidos.push({ group_id: g.id, motivo: r.reason ?? 'no se creó' })
  }
  return out
}

/**
 * EST-30 · Cuando el grupo ABRE (fin de la matrícula, pasa a en curso), el
 * MISMO tiquete anticipado se actualiza con los números finales y se avisa a
 * folletos. No se crea un segundo tiquete; la nota deja inicial → final.
 *
 * Aplica a los dos anticipados (automático y el botón de EST-21): quien
 * imprime quiere el número final en los dos casos. Lo llaman el cron de
 * ventanas y el cambio manual de estado. Idempotente por la marca en la nota.
 */
export async function actualizarFolletoAlAbrir(groupId: string, hoy: string): Promise<boolean> {
  const { contarMatricula, totalMatriculados, notaDeApertura, anexarNota, yaSeActualizoAlAbrir, textoConteo } =
    await import('@/lib/studies/folletos-anticipados-auto')
  const supabase = createAdminClient()
  const { data: previo } = await supabase.from('folleto_requests')
    .select('id, status, quantity, note, sede, target_level_code, source_plan_code')
    .eq('source_group_id', groupId).in('tipo', ['anticipado', 'anticipado_auto']).maybeSingle()
  const t = previo as { id: string; status: string; quantity: number; note: string | null; sede: string | null; target_level_code: string | null; source_plan_code: string | null } | null
  if (!t || t.status === 'cerrada' || yaSeActualizoAlAbrir(t.note)) return false

  const { data: g } = await supabase.from('study_groups').select('status, name, modalidad').eq('id', groupId).maybeSingle()
  const grupo = g as { status: string; name: string | null; modalidad: string | null } | null
  if (!grupo || grupo.status !== 'en_curso') return false

  const filas = await matriculaConPagos(groupId)
  const conteo = contarMatricula(filas)
  const final = totalMatriculados(conteo)
  const note = anexarNota(t.note, notaDeApertura({ hoy, cantidadInicial: t.quantity, cantidadFinal: final, conteo }))
  const { error } = await supabase.from('folleto_requests').update({ quantity: final, note }).eq('id', t.id)
  if (error) throw error

  const par = folletosQuePide(t.source_plan_code, modalidadDe(grupo.modalidad)).map(levelLabel).join(' + ')
    || levelLabel(t.target_level_code)
  const sede = t.sede ?? 'sede sin definir'
  const cambio = t.quantity === final ? `se mantiene en ${final}` : `${t.quantity} → ${final}`
  try {
    const { renderEmail } = await import('@/lib/email/baseLayout')
    await notifyFolletoRecipients({
      title: 'Folletos: número final',
      body: `${grupo.name ?? 'Grupo'} abrió · ${par}: ${cambio} · ${sede}`,
      subject: `Folletos de ${par} — número final: ${final} para ${sede}`,
      link: `/estudios/folletos/${t.id}`,
      html: renderEmail(`<p class="greeting">El grupo abrió: este es el número final</p>
<p>El grupo <strong>${grupo.name ?? ''}</strong> cerró su matrícula y arrancó. El tiquete de folletos
que se pidió por adelantado al cupo máximo queda con los números de hoy:</p>
<div class="info-box">
  <p class="info-title">Números finales</p>
  <p style="font-size:14px; color:#161440; line-height:1.8; margin:0;">
    <strong>Cantidad de estudiantes: ${cambio}</strong><br/>
    ${textoConteo(conteo)}<br/>
    Folletos: ${par} · enviar a ${sede}
  </p>
</div>
<p style="text-align:center; margin:28px 0;">
  <a class="btn" href="https://admin.theosplace.org/estudios/folletos/${t.id}">Ver el tiquete</a>
</p>`),
    })
  } catch (e) {
    reportarError('folletos: tiquete actualizado al abrir pero NADIE fue avisado:', e)
  }
  return true
}

/** Enlaza al tiquete de folletos los pagos pendientes de los estudiantes de ese
 *  grupo.
 *
 *  Los pagos siguen siendo INDIVIDUALES, uno por estudiante: acá no se crea ni
 *  se agrupa nada, solo se sella `payments.folleto_request_id`. Es lo que
 *  sobrevive a Tilopay — cuando entre la pasarela, cada estudiante paga el
 *  suyo y lo único que desaparece es la capa de comprobantes del dirigente.
 *
 *  No toca pagos que ya tengan tiquete: el cierre se puede reintentar
 *  (reconciliación YA_CERRADO) y esto debe poder correr dos veces.
 *
 *  Devuelve 0 sin ruido cuando el nivel es gratis (DIS2, DIS3): ahí no hay
 *  pagos que enlazar porque el folleto se pagó al matricularse en DIS1. */
export async function linkPaymentsToFolletoRequest(
  groupId: string,
  folletoRequestId: string,
): Promise<{ linked: number }> {
  const supabase = createAdminClient()
  const { data: enr } = await supabase
    .from('study_enrollments').select('id').eq('group_id', groupId)
  const ids = ((enr ?? []) as Array<{ id: string }>).map(e => e.id)
  if (ids.length === 0) return { linked: 0 }

  // .in() por tandas: un grupo grande pasado entero arma una URL que PostgREST
  // rechaza.
  let linked = 0
  for (let i = 0; i < ids.length; i += 200) {
    const { count, error } = await supabase
      .from('payments')
      .update({ folleto_request_id: folletoRequestId }, { count: 'exact' })
      .in('enrollment_id', ids.slice(i, i + 200))
      .is('folleto_request_id', null)
    if (error) throw error
    linked += count ?? 0
  }
  return { linked }
}

/** Solicitud de folletos MANUAL (caso especial, no ligada a cierre): entra a la
 *  misma cola con tipo 'manual'. Guarda cantidad, sede, dirigente destinatario y
 *  nota. close_date/available_at = hoy (no hay cierre que las derive). */
export async function createManualFolletoRequest(input: {
  target_level_code: string
  quantity: number
  sede: string | null
  target_leader_id: string | null
  target_leader_name: string | null
  note: string | null
  today: string
  confirmed_by: string | null
}): Promise<{ id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('folleto_requests').insert({
    tipo: 'manual',
    target_level_code: input.target_level_code,
    quantity: input.quantity,
    sede: input.sede,
    target_leader_id: input.target_leader_id,
    target_leader_name: input.target_leader_name,
    note: input.note,
    close_date: input.today,
    available_at: input.today,
    status: 'creada',
    confirmed_by: input.confirmed_by,
  }).select('id').single()
  if (error) throw error
  return data as { id: string }
}

/** OJO con el embed de `study_groups`: folleto_requests tiene DOS llaves hacia
 *  esa tabla (source_group_id y origin_group_id), así que PostgREST exige el
 *  hint `!folleto_requests_source_group_id_fkey`. Sin él la consulta ENTERA
 *  falla con PGRST201 y la cola se ve vacía — pasó en producción el 2026-09-02,
 *  al agregar origin_group_id. El cast `as Array<Record<string, unknown>>` de
 *  más abajo es lo que impide que TypeScript lo cache antes de tiempo. */
export async function getFolletoRequests(filters: { sede?: string; status?: FolletoState; tipo?: string } = {}): Promise<DbFolletoRequest[]> {
  const supabase = createAdminClient()
  let q = supabase
    .from('folleto_requests')
    .select('id, source_group_id, source_plan_code, target_level_code, quantity, quantity_leaders, sede, close_date, available_at, status, tipo, bloque_id, confirmed_by, confirmed_at, created_at, note, target_leader_id, target_leader_name, source_group:study_groups!folleto_requests_source_group_id_fkey(name, modalidad, leader_id, co_leader_id, leader:members!study_groups_leader_id_fkey(first_name, last_name)), bloque:capacitacion_bloques(nombre), target_leader:members!folleto_requests_target_leader_id_fkey(first_name, last_name)')
    .order('created_at', { ascending: false })
  if (filters.sede) q = q.eq('sede', filters.sede)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.tipo) q = q.eq('tipo', filters.tipo)
  const { data, error } = await q
  if (error) throw error
  const filas = (data ?? []) as Array<Record<string, unknown>>

  // Pagos individuales colgados de cada tiquete. Una sola query para toda la
  // lista (no una por fila) y se cuenta en memoria: son decenas de filas, no
  // vale una vista ni un rpc.
  const pagos = new Map<string, { total: number; pagados: number }>()
  if (filas.length > 0) {
    const { data: pays } = await supabase
      .from('payments')
      .select('folleto_request_id, status')
      .in('folleto_request_id', filas.map(f => String(f.id)))
    for (const p of (pays ?? []) as Array<{ folleto_request_id: string | null; status: string | null }>) {
      if (!p.folleto_request_id) continue
      const acc = pagos.get(p.folleto_request_id) ?? { total: 0, pagados: 0 }
      acc.total++
      if (p.status === 'paid') acc.pagados++
      pagos.set(p.folleto_request_id, acc)
    }
  }

  return filas.map(row => {
    const crudo = (Array.isArray(row.source_group) ? (row.source_group[0] ?? null) : row.source_group) as
      { name: string | null; leader_id?: string | null; co_leader_id?: string | null
        leader?: { first_name: string | null; last_name: string | null } | Array<{ first_name: string | null; last_name: string | null }> | null } | null
    // 2026-10-19 · El nombre del DIRIGENTE, para el título del tiquete: un grupo
    // creado en el sistema se llama «N2 — Escazú» y no dice de quién es.
    const lider = Array.isArray(crudo?.leader) ? crudo?.leader[0] : crudo?.leader
    const grupo = crudo
      ? { ...crudo, leader: undefined, dirigente: lider ? `${lider.first_name ?? ''} ${lider.last_name ?? ''}`.trim() || null : null }
      : null
    const leaders = (row.quantity_leaders as number | null) ?? null
    // Los tiquetes anteriores al 2026-09-02 no guardaron los folletos de
    // dirigentes: se deducen del grupo, que es la mejor lectura disponible.
    const desglose = leaders == null
      ? desgloseFolletos({
        estudiantes: Number(row.quantity ?? 0),
        tieneDirigente: !!grupo?.leader_id,
        tieneCoDirigente: !!grupo?.co_leader_id,
      })
      : {
        estudiantes: Number(row.quantity ?? 0),
        dirigentes: leaders,
        total: Number(row.quantity ?? 0) + leaders,
      }
    return {
      ...row,
      source_group: grupo,
      bloque: Array.isArray(row.bloque) ? (row.bloque[0] ?? null) : row.bloque,
      target_leader: Array.isArray(row.target_leader) ? (row.target_leader[0] ?? null) : row.target_leader,
      pagos: pagos.get(String(row.id)) ?? { total: 0, pagados: 0 },
      desglose,
    }
  }) as DbFolletoRequest[]
}

/** Cambio de estado (individual o en lote). QA 2026-07-17: el flujo es LINEAL
 *  (creada → en_impresion → enviado_entregado → cerrada) y la UI solo ofrece
 *  "avanzar al siguiente" — el update se condiciona al estado PREDECESOR, así
 *  un request repetido/adulterado no salta pasos ni retrocede. Las filas que
 *  no estaban en el estado esperado se omiten (se refleja en `updated`). */
/**
 * Mueve tiquetes de estado y dice QUÉ PASÓ CON CADA UNO.
 *
 * ANTES devolvía solo un número, y la pantalla mostraba «0 folletos → En
 * impresión» cuando no se movía ninguno — que se lee como un éxito. El
 * `.eq('status', prev)` dejaba quietos a los que no estaban exactamente un
 * paso atrás, y nadie podía saber cuáles ni por qué (FOL-2, 2026-10-05).
 *
 * `libre` permite cualquier salto, incluido hacia atrás; sin él se mantiene
 * la regla vieja de avanzar un paso, que es la del botón del lote.
 */
export async function setFolletoRequestsStatus(
  ids: string[],
  status: FolletoState,
  opciones: { libre?: boolean } = {},
): Promise<{ updated: number; resultados: ResultadoPorTiquete[] }> {
  if (ids.length === 0) return { updated: 0, resultados: [] }
  const { FOLLETO_STATES, FOLLETO_STATE_LABEL } = await import('@/lib/studies/folletos')
  const { posicionDe } = await import('@/lib/studies/cambio-de-estado-folleto')
  const idx = FOLLETO_STATES.indexOf(status)
  if (idx < 0) return { updated: 0, resultados: [] }
  const supabase = createAdminClient()

  // Se LEE el estado de cada uno antes de tocar nada: sin esto no hay forma
  // de decir por qué uno no se movió.
  const { data: antes, error: errAntes } = await supabase
    .from('folleto_requests').select('id, status').in('id', ids)
  if (errAntes) throw errAntes
  const estadoDe = new Map(
    ((antes ?? []) as Array<{ id: string; status: string }>).map(r => [r.id, r.status]))

  const prev = idx > 0 ? FOLLETO_STATES[idx - 1] : null
  const resultados: ResultadoPorTiquete[] = []
  const aMover: string[] = []
  for (const id of ids) {
    const desde = estadoDe.get(id)
    if (!desde) { resultados.push({ id, movido: false, desde: '—', motivo: 'No se encontró el tiquete.' }); continue }
    if (desde === status) {
      resultados.push({ id, movido: false, desde, motivo: `Ya estaba en ${FOLLETO_STATE_LABEL[status]}.` })
      continue
    }
    if (!opciones.libre) {
      if (prev === null) {
        resultados.push({ id, movido: false, desde, motivo: 'A «Creada» no se llega por transición.' })
        continue
      }
      if (desde !== prev) {
        resultados.push({
          id, movido: false, desde,
          motivo: posicionDe(desde) > idx
            ? `Está en ${FOLLETO_STATE_LABEL[desde as FolletoState] ?? desde}, más adelante: usá el cambio libre del detalle.`
            : `Está en ${FOLLETO_STATE_LABEL[desde as FolletoState] ?? desde} y falta pasar por ${FOLLETO_STATE_LABEL[prev]}.`,
        })
        continue
      }
    }
    aMover.push(id)
  }

  let movidos: string[] = []
  if (aMover.length > 0) {
    const { data, error } = await supabase
      .from('folleto_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', aMover)
      .select('id')
    if (error) throw error
    movidos = ((data ?? []) as Array<{ id: string }>).map(r => r.id)
    for (const id of aMover) {
      const desde = estadoDe.get(id)!
      resultados.push(movidos.includes(id)
        ? { id, movido: true, desde }
        : { id, movido: false, desde, motivo: 'La base no lo actualizó.' })
    }
  }

  // Al pasar a "enviado / entregado" se le avisa al dirigente que ya puede ir
  // por sus folletos. Solo a los que DE VERDAD cambiaron, y NUNCA en un
  // cambio libre: ése es una corrección a mano y reenviar el aviso sería
  // escribirle otra vez a alguien a quien ya se le escribió (FOL-2).
  if (status === 'enviado_entregado' && movidos.length > 0 && !opciones.libre) {
    const { notificarFolletosListos } = await import('@/lib/email/folleto-ready-send')
    for (const id of movidos) {
      try { await notificarFolletosListos(id) } catch (e) {
        reportarError('folletos: no se pudo avisar que el folleto está listo:', e, { id })
      }
    }
  }
  return { updated: movidos.length, resultados }
}

/** Notifica (campana + correo) a quienes tienen el permiso de folletos.
 *  Centraliza el patrón que duplicaban el cierre de grupo y el cron de
 *  bloques (~40 líneas cada uno). Best-effort: los correos fallidos se
 *  loguean sin bloquear (allSettled — antes eran awaits secuenciales). */
export async function notifyFolletoRecipients(input: {
  title: string
  body: string
  subject: string
  html: string
  /** Destino de la campana. Default: la cola de folletos. Los avisos de hito
   *  de bloque apuntan a /estudios/bloques (el hito ya no crea tiquetes). */
  link?: string
}): Promise<void> {
  const recipients = await getFolletoRecipients()
  if (recipients.length === 0) return
  const supabase = createAdminClient()

  const { error } = await supabase.from('internal_notifications').insert(recipients.map(r => ({
    recipient_member_id: r.member_id,
    type: 'folleto_created',
    title: input.title,
    body: input.body,
    link: input.link ?? '/estudios/folletos',
  })))
  if (error) console.warn('notifyFolletoRecipients notificaciones:', error.message)

  const { sendEmail } = await import('@/lib/email/provider')
  await Promise.allSettled(recipients
    .filter(r => r.email)
    .map(r => sendEmail({
      to: { email: r.email!, name: r.name },
      subject: input.subject,
      html: input.html,
      kind: 'transactional',
    }).catch(e => console.warn('sendEmail folletos falló:', e))))
}

/* ────────────────────────────────────────────────────────────────────────────
 * FOL-3 (2026-09-02) · Detalle de un tiquete
 *
 * Un tiquete traía nivel, cantidad y sede, y con eso quien imprime no podía
 * trabajar: no sabía a quién entregarle, dónde se da el estudio, ni de dónde
 * salía la cantidad. Esto junta todo en una sola lectura, y lo usan por igual
 * la pantalla de detalle y el correo de aviso — así los dos dicen lo mismo.
 * ──────────────────────────────────────────────────────────────────────────── */

export type FolletoGrupoInfo = {
  id: string
  name: string | null
  nivel: string | null
  dirigente: string | null
  co_dirigente: string | null
  /** Dónde se da el estudio (no dónde se entregan los folletos). */
  ubicacion: string | null
  zona: string | null
  es_virtual: boolean
  /** EST-28 · 'legacy' | 'bloques'. Para poder decir en el tiquete por qué
   *  este grupo pide el par y aquel uno solo. Temporal: dura lo que dure la
   *  transición. Opcional: los fixtures de los correos no lo necesitan y
   *  `modalidadDe` ya trata la ausencia como 'legacy'. */
  modalidad?: string | null
  /** `study_groups.schedule_days`: es un ARRAY de códigos (L/M/X/J/V/S/D), no
   *  un texto. Tratarlo como string reventaba el correo — ver el 2026-09-02. */
  dias: string[] | null
  hora: string | null
  starts_at: string | null
}

/** Cómo terminó el grupo que se cerró. Solo existe en tiquetes de tipo 'cierre'. */
export type FolletoCierreInfo = { grupo: FolletoGrupoInfo } & ConteoCierre

export type FolletoDetalle = {
  id: string
  tipo: string
  status: FolletoState
  nivel: string | null
  /** EST-28 · El código del plan del GRUPO que origina el tiquete, para
   *  poder decir si ese grupo lleva el par o un folleto solo. Temporal, y
   *  opcional para no obligar a los fixtures de los correos a conocerlo. */
  grupo_plan_code?: string | null
  sede_entrega: string | null
  close_date: string
  available_at: string
  note: string | null
  created_at: string
  /** Desglose de la cantidad: estudiantes + dirigentes. */
  desglose: DesgloseFolletos
  /** Grupo que va a USAR los folletos. */
  grupo: FolletoGrupoInfo | null
  /** Grupo que se cerró y disparó el tiquete. null en cupo_lleno/fin_matricula. */
  cierre: FolletoCierreInfo | null
  pagos: { total: number; pagados: number }
  /** Destinatario de una solicitud manual. */
  target_leader_name: string | null
  /**
   * De quién es esta reubicación (FOL, 2026-10-12).
   *
   * El tiquete de una reubicación nace sin `source_group_id` ni
   * `origin_group_id`, así que el detalle salía en blanco: ni estudiante, ni
   * dirigente, ni de dónde venía. «Ese detalle no me dice prácticamente
   * nada» (Floriana).
   *
   * El dato SÍ existía: `study_requests.resulting_folleto_request_id` apunta
   * al tiquete desde la solicitud, que sabe quién es y con quién estaba.
   * Faltaba seguir el enlace.
   */
  reubicacion: FolletoReubicacionInfo | null
}

export type FolletoReubicacionInfo = {
  solicitud_id: string
  estudiante: string | null
  estudiante_id: string | null
  /** Con quién estaba antes. Texto libre: lo escribe quien pide el traslado. */
  dirigente_anterior: string | null
  /** A qué grupo entró, si ya se resolvió. */
  grupo_destino: { id: string; name: string | null; dirigente: string | null } | null
  /** Quién resolvió la reubicación. */
  resuelta_por: string | null
}

type GrupoRow = {
  id: string
  name: string | null
  location: string | null
  zone: string | null
  is_virtual: boolean | null
  schedule_days: string[] | null
  schedule_time: string | null
  starts_at: string | null
  leader_id: string | null
  co_leader_id: string | null
  modalidad: string | null
  plan: { name: string | null } | { name: string | null }[] | null
  leader: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null
  co_leader: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null
}

const GRUPO_SELECT =
  'id, name, location, zone, is_virtual, schedule_days, schedule_time, starts_at, leader_id, co_leader_id, modalidad,'
  + ' plan:study_plans(name),'
  + ' leader:members!study_groups_leader_id_fkey(first_name, last_name),'
  + ' co_leader:members!study_groups_co_leader_id_fkey(first_name, last_name)'

function uno<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function nombre(p: { first_name: string | null; last_name: string | null } | null): string | null {
  if (!p) return null
  const n = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
  return n || null
}

function aGrupoInfo(row: GrupoRow | null): FolletoGrupoInfo | null {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    nivel: uno(row.plan)?.name ?? null,
    dirigente: nombre(uno(row.leader)),
    co_dirigente: nombre(uno(row.co_leader)),
    ubicacion: row.location,
    zona: row.zone,
    es_virtual: row.is_virtual === true,
    modalidad: row.modalidad,
    dias: row.schedule_days,
    hora: row.schedule_time,
    starts_at: row.starts_at,
  }
}

/** Cuenta cómo terminó cada quien en un grupo ya cerrado.
 *
 *  Se trae `notes` porque el RPC `close_group` guarda la reprobación AHÍ y no
 *  en el status — la regla, con sus tests, vive en close-result-read. Leer solo
 *  el status contaría a esos reprobados como aprobados. */
async function contarResultados(groupId: string, inicioGrupo: string | null): Promise<ConteoCierre> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('study_enrollments').select('status, notes, completed_at').eq('group_id', groupId)
  return contarResultadosCierre(
    (data ?? []) as Array<{ status: string | null; notes: string | null; completed_at: string | null }>,
    inicioGrupo,
  )
}

export async function getFolletoDetalle(id: string): Promise<FolletoDetalle | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('folleto_requests')
    .select('id, tipo, status, target_level_code, source_plan_code, quantity, quantity_leaders, sede, close_date, available_at, note, created_at, source_group_id, origin_group_id, target_leader_name')
    .eq('id', id).maybeSingle()
  if (error) throw error
  const t = data as {
    id: string; tipo: string; status: FolletoState; target_level_code: string | null
    /** EST-28 · el plan del GRUPO, para saber si lleva el par o uno solo. */
    source_plan_code: string | null
    quantity: number; quantity_leaders: number | null; sede: string | null
    close_date: string; available_at: string; note: string | null; created_at: string
    source_group_id: string | null; origin_group_id: string | null; target_leader_name: string | null
  } | null
  if (!t) return null

  const [grupoRes, origenRes, pagosRes, reubRes] = await Promise.all([
    t.source_group_id
      ? supabase.from('study_groups').select(GRUPO_SELECT).eq('id', t.source_group_id).maybeSingle()
      : Promise.resolve({ data: null }),
    t.origin_group_id
      ? supabase.from('study_groups').select(GRUPO_SELECT).eq('id', t.origin_group_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('payments').select('status').eq('folleto_request_id', t.id),
    /**
     * La solicitud que generó este tiquete. Se pide SIEMPRE y no solo cuando
     * `tipo === 'reubicacion'`: el tipo es un texto de la fila y, si mañana
     * aparece otro que también venga de una solicitud, el detalle lo muestra
     * sin que nadie se acuerde de agregarlo acá. Es una consulta por id
     * indexado y va en el mismo Promise.all.
     */
    supabase.from('study_requests')
      .select(`id, member_id, last_leader_name, reviewed_by,
               estudiante:members!study_requests_member_id_fkey(first_name, last_name),
               revisor:members!study_requests_reviewed_by_fkey(first_name, last_name),
               destino:study_groups!study_requests_resolved_group_id_fkey(
                 id, name, leader:members!study_groups_leader_id_fkey(first_name, last_name))`)
      .eq('resulting_folleto_request_id', t.id).maybeSingle(),
  ])

  const grupoPropio = aGrupoInfo(grupoRes.data as GrupoRow | null)
  const origen = aGrupoInfo(origenRes.data as GrupoRow | null)

  // Los tiquetes anteriores al 2026-09-02 no tienen quantity_leaders: ahí el
  // desglose se deduce del grupo, que es la mejor lectura disponible. No se
  // reescribe `quantity` — sigue siendo la cantidad de estudiantes.
  // OJO: el desglose se calcula con el grupo PROPIO del tiquete, nunca con el
  // de destino de una reubicación. El dirigente que recibe a la persona ya
  // tiene su folleto; sumarle uno pediría dos folletos para trasladar a uno.
  const desglose = t.quantity_leaders == null
    ? desgloseFolletos({
      estudiantes: t.quantity,
      tieneDirigente: !!grupoPropio?.dirigente,
      tieneCoDirigente: !!grupoPropio?.co_dirigente,
    })
    : { estudiantes: t.quantity, dirigentes: t.quantity_leaders, total: t.quantity + t.quantity_leaders }

  const pagos = ((pagosRes.data ?? []) as Array<{ status: string | null }>)

  type ReubRow = {
    id: string; member_id: string | null; last_leader_name: string | null
    estudiante: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
    revisor: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
    destino: {
      id: string; name: string | null
      leader: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
    } | { id: string; name: string | null; leader: unknown }[] | null
  }
  const rr = (reubRes as { data: ReubRow | null }).data
  const destino = rr ? uno(rr.destino) as { id: string; name: string | null; leader: unknown } | null : null
  const reubicacion: FolletoReubicacionInfo | null = rr ? {
    solicitud_id: rr.id,
    estudiante: nombre(uno(rr.estudiante)),
    estudiante_id: rr.member_id,
    dirigente_anterior: rr.last_leader_name?.trim() || null,
    grupo_destino: destino
      ? { id: destino.id, name: destino.name, dirigente: nombre(uno(destino.leader as never)) }
      : null,
    resuelta_por: nombre(uno(rr.revisor)),
  } : null

  /**
   * EL GRUPO QUE RECIBE. En una reubicación el tiquete no tiene
   * `source_group_id`, así que «A quién se le entrega» salía con «Grupo: —,
   * Dirigente: Sin asignar — nadie va a recibir los folletos», que era falso:
   * el sistema SÍ sabe a qué grupo entró la persona (Floriana, 2026-10-12).
   *
   * El grupo que recibe el folleto es el de DESTINO. Se carga con el mismo
   * select de siempre para que la tarjeta traiga también dirigente, lugar y
   * horario, que es lo que hace falta para ir a dejarlo.
   *
   * Va DESPUÉS del desglose a propósito: ver el comentario de arriba.
   */
  let grupo = grupoPropio
  if (!grupo && reubicacion?.grupo_destino) {
    const { data: gd } = await supabase
      .from('study_groups').select(GRUPO_SELECT).eq('id', reubicacion.grupo_destino.id).maybeSingle()
    grupo = aGrupoInfo(gd as GrupoRow | null)
  }

  return {
    id: t.id,
    tipo: t.tipo,
    status: t.status,
    nivel: levelLabel(t.target_level_code),
    grupo_plan_code: t.source_plan_code ?? null,
    sede_entrega: t.sede,
    close_date: t.close_date,
    available_at: t.available_at,
    note: t.note,
    created_at: t.created_at,
    desglose,
    grupo,
    cierre: origen ? { grupo: origen, ...(await contarResultados(origen.id, origen.starts_at)) } : null,
    pagos: { total: pagos.length, pagados: pagos.filter(p => p.status === 'paid').length },
    target_leader_name: t.target_leader_name,
    reubicacion,
  }
}
