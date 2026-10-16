import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveAttendanceMemberIds } from '@/lib/supabase/queries/members-attendance'
import {
  repartirRevision, asistenciaCreible, justificacion, type CambioDeRevision,
} from '@/lib/leaders/revision-por-compromiso'
import { reportarError } from '@/lib/observabilidad'
import { pingHealthcheck } from '@/lib/health'

/**
 * DIR-14 · La banderita «por compromiso», automática. Corre los lunes.
 *
 * LA REGLA vive en `lib/leaders/revision-por-compromiso` (pura, con tests), y
 * lo que es cumplir viene de las definiciones centrales: donación por
 * `members.is_donor` (FIN-10, el cónyuge cuenta) y asistencia por
 * `getActiveAttendanceMemberIds()`. Acá solo se juntan los datos y se escribe.
 *
 * SOLO TOCA SUS COLUMNAS (`revision_auto_faltan`, `revision_auto_desde`). Las
 * razones manuales viven en `revision` y este cron ni las lee: la automática
 * y las manuales se muestran juntas, pero ninguna puede pisar a la otra.
 *
 * NO MANDA CORREOS NI NOTIFICACIONES. La banderita es administrativa y
 * confidencial; la ve solo quien ya la ve según DIR-8. El rastro queda en el
 * audit_log, con la justificación.
 *
 * IDEMPOTENTE: la segunda corrida no encuentra nada que cambiar.
 *
 * `?ensayo=1` calcula y no escribe: es la lista de a quién se le pondría HOY,
 * para que coordinación la vea antes de que aparezcan decenas de golpe.
 */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('direccion', 'admin')
  return auth.res ?? null
}

type Fila = {
  member_id: string
  estado_base: string | null
  revision_auto_faltan: string[] | null
}

export async function GET(req: NextRequest) {
  const noAutorizado = await authorize(req)
  if (noAutorizado) return noAutorizado
  const ensayo = new URL(req.url).searchParams.get('ensayo') === '1'

  try {
    const supabase = createAdminClient()

    const dirigentes: Fila[] = []
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await supabase
        .from('study_leaders')
        .select('member_id, estado_base, revision_auto_faltan')
        .order('member_id')
        .range(desde, desde + 999)
      if (error) throw error
      // `as unknown`: database.ts no conoce todavía las columnas de DIR-14.
      const lote = (data ?? []) as unknown as Fila[]
      dirigentes.push(...lote)
      if (lote.length < 1000) break
    }

    const asistencia = await getActiveAttendanceMemberIds()
    if (!asistenciaCreible(asistencia)) {
      // No se escribe y NO se avisa a Healthchecks: que la corrida figure
      // como no hecha es justo lo que tiene que ver quien lo vigila.
      reportarError('cron dirigentes-compromisos', new Error('La asistencia llegó vacía: no se recalcula nada.'))
      return NextResponse.json(
        { error: 'La asistencia llegó vacía; no se cambió ninguna banderita.', code: 'asistencia_vacia' },
        { status: 503 },
      )
    }
    const conAsistencia = new Set(asistencia)

    // Donante y nombre de cada uno. De a 200: con 500 ids la URL del GET de
    // PostgREST se pasa de largo (ver el cron de dirigentes-activos).
    const ids = dirigentes.map(d => d.member_id)
    const miembros = new Map<string, { nombre: string; donante: boolean }>()
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase.from('members')
        .select('id, first_name, last_name, is_donor').in('id', ids.slice(i, i + 200))
      if (error) throw error
      for (const m of (data ?? []) as Array<{ id: string; first_name: string; last_name: string; is_donor: boolean | null }>) {
        miembros.set(m.id, { nombre: `${m.first_name} ${m.last_name}`.trim(), donante: m.is_donor === true })
      }
    }

    const reparto = repartirRevision(dirigentes.map(d => ({
      memberId: d.member_id,
      nombre: miembros.get(d.member_id)?.nombre ?? d.member_id,
      activo: d.estado_base === 'activo',
      donante: miembros.get(d.member_id)?.donante ?? false,
      asistencia: conAsistencia.has(d.member_id),
      faltanAhora: d.revision_auto_faltan ?? [],
    })))

    const enPalabras = (c: CambioDeRevision) => ({ nombre: c.nombre, justificacion: justificacion(c.a) || 'Ya cumple' })
    if (ensayo) {
      return NextResponse.json({
        ok: true, ensayo: true,
        total: dirigentes.length,
        activos: dirigentes.filter(d => d.estado_base === 'activo').length,
        sin_cambio: reparto.sinCambio,
        poner: reparto.poner.map(enPalabras),
        actualizar: reparto.actualizar.map(enPalabras),
        quitar: reparto.quitar.map(enPalabras),
      })
    }

    // De a uno, y un fallo no corta el lote: queda listado en la respuesta.
    const fallos: Array<{ nombre: string; motivo: string }> = []
    const ahora = new Date().toISOString()
    let escritos = 0
    for (const c of [...reparto.poner, ...reparto.actualizar, ...reparto.quitar]) {
      try {
        const cambios: Record<string, unknown> = { revision_auto_faltan: c.a }
        // «Desde» es cuándo se PUSO. Si solo cambió lo que falta, sigue siendo
        // la misma situación abierta y la fecha no se mueve.
        if (c.de.length === 0) cambios.revision_auto_desde = ahora
        if (c.a.length === 0) cambios.revision_auto_desde = null
        const { error } = await supabase.from('study_leaders')
          .update(cambios as never).eq('member_id', c.memberId)
        if (error) throw error
        escritos++
        const { error: eAudit } = await supabase.from('audit_log').insert({
          action: 'UPDATE', entity_type: 'study_leaders', entity_id: c.memberId,
          old_data: { revision_auto_faltan: c.de },
          new_data: {
            revision_auto_faltan: c.a,
            justificacion: justificacion(c.a) || 'Ya cumple: se quita la banderita automática',
            origen: 'cron dirigentes-compromisos (DIR-14)',
          },
        })
        if (eAudit) console.warn('audit dirigentes-compromisos:', eAudit.message)
      } catch (e) {
        fallos.push({ nombre: c.nombre, motivo: e instanceof Error ? e.message : String(e) })
      }
    }

    await pingHealthcheck('HEALTHCHECK_URL_DIRIGENTES_COMPROMISOS')
    return NextResponse.json({
      ok: fallos.length === 0,
      total: dirigentes.length,
      puestas: reparto.poner.length,
      actualizadas: reparto.actualizar.length,
      quitadas: reparto.quitar.length,
      escritos,
      sin_cambio: reparto.sinCambio,
      fallos,
    })
  } catch (error) {
    reportarError('GET /api/cron/dirigentes-compromisos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
