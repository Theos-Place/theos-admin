import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { setDirigenteActive } from '@/lib/supabase/queries/studies'
import { repartirDirigentes, dirigeAhora, MESES_DE_VIGENCIA, type SituacionDelDirigente } from '@/lib/studies/dirigente-activo'
import { todayCR } from '@/lib/format'
import { reportarError } from '@/lib/observabilidad'
import { pingHealthcheck } from '@/lib/health'

/**
 * PAR-2 · Recalcula quién es dirigente activo. Corre el 1 de cada mes.
 *
 * LA REGLA vive en `lib/studies/dirigente-activo`, que es pura y tiene tests:
 * activo si dirige un grupo en curso o en matrícula, o si el último que dirigió
 * cerró dentro de los últimos 12 meses (tres cuatrimestres).
 *
 * ESTO DESACTIVA GENTE, y desactivar no es cosmético: saca del comité de
 * Dirigentes y REVOCA EL ROL `dirigente`. Se aplica automáticamente por decisión
 * del usuario (2026-09-23), con la primera corrida medida antes de encenderlo:
 * 31 bajas y 12 altas sobre 505 dirigentes.
 *
 * UN DATO QUE CONVIENE NO OLVIDAR: buena parte de las fechas de cierre vienen
 * de la importación de CCB y son fechas de COHORTE, no de cierre real — el 27
 * de julio se repite con 156 grupos en 2019, 135 en 2025 y 106 en 2017. Con la
 * ventana en 12 meses el corte cae sobre la cohorte del 2025-07-27 y de ahí
 * salen 20 de las 31 bajas. Se aplicó igual, con el dato a la vista. Si un mes
 * las bajas se ven raras, mirar esto primero.
 *
 * NO MANDA CORREOS. El rastro queda en el audit_log y en la respuesta.
 *
 * IDEMPOTENTE: la segunda corrida no encuentra nada que cambiar.
 */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('direccion', 'admin')
  return auth.res ?? null
}

export async function GET(req: NextRequest) {
  const noAutorizado = await authorize(req)
  if (noAutorizado) return noAutorizado

  // `?ensayo=1` calcula y no escribe: sirve para mirar qué haría antes del 1.
  const ensayo = new URL(req.url).searchParams.get('ensayo') === '1'

  try {
    const supabase = createAdminClient()

    const { data: sl, error: eSl } = await supabase
      .from('study_leaders').select('member_id, is_active')
    if (eSl) throw eSl
    const dirigentes = (sl ?? []) as Array<{ member_id: string; is_active: boolean | null }>
    if (dirigentes.length === 0) {
      await pingHealthcheck('HEALTHCHECK_URL_DIRIGENTES_ACTIVOS')
      return NextResponse.json({ ok: true, total: 0, activados: 0, desactivados: 0 })
    }

    // Se miran las DOS columnas: alguien puede ser co-líder de lo único que
    // dirigió, y leer solo `leader_id` lo daría por inactivo.
    const situaciones = new Map<string, SituacionDelDirigente>()
    for (const col of ['leader_id', 'co_leader_id'] as const) {
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await supabase
          .from('study_groups')
          .select(`${col}, status, closed_at, ends_at`)
          .not(col, 'is', null)
          .order(col)
          .range(desde, desde + 999)
        if (error) throw error
        const lote = (data ?? []) as unknown as Array<Record<string, unknown>>
        for (const g of lote) {
          const id = g[col] as string
          const fin = ((g.closed_at ?? g.ends_at) as string | null)?.slice(0, 10) ?? null
          const prev = situaciones.get(id) ?? { dirigeAhora: false, ultimoCierre: null }
          const estado = g.status as string | null
          if (dirigeAhora([estado])) prev.dirigeAhora = true
          else if (estado === 'finalizado' && fin && (!prev.ultimoCierre || fin > prev.ultimoCierre)) {
            prev.ultimoCierre = fin
          }
          situaciones.set(id, prev)
        }
        if (lote.length < 1000) break
      }
    }

    // Los nombres, solo para que la respuesta y la bitácora se puedan leer.
    // De a 200, que es el tamaño que ya usa el resto del repo para `.in()`:
    // PostgREST arma un GET y con 500 ids la URL se pasa de largo — el fetch
    // falla entero y sin mensaje útil. Pasó en la primera corrida: los nombres
    // salieron como UUID porque el error venía ignorado. Ahora se reporta.
    const ids = dirigentes.map(d => d.member_id)
    const nombres = new Map<string, string>()
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase.from('members')
        .select('id, first_name, last_name').in('id', ids.slice(i, i + 200))
      if (error) console.warn('nombres de dirigentes:', error.message)
      for (const m of (data ?? []) as Array<{ id: string; first_name: string; last_name: string }>) {
        nombres.set(m.id, `${m.first_name} ${m.last_name}`.trim())
      }
    }

    const hoy = todayCR()
    const reparto = repartirDirigentes(dirigentes.map(d => ({
      memberId: d.member_id,
      nombre: nombres.get(d.member_id) ?? d.member_id,
      activoHoy: d.is_active === true,
      situacion: situaciones.get(d.member_id) ?? { dirigeAhora: false, ultimoCierre: null },
    })), hoy)

    if (ensayo) {
      return NextResponse.json({
        ok: true, ensayo: true, hoy, meses: MESES_DE_VIGENCIA,
        total: dirigentes.length, sin_cambio: reparto.sinCambio,
        activar: reparto.activar.map(x => x.nombre),
        desactivar: reparto.desactivar.map(x => x.nombre),
      })
    }

    // De a uno, y un fallo NO corta el lote: si a alguien lo frena un guard
    // —un grupo activo abierto, por ejemplo— el resto igual se recalcula y el
    // problema queda listado en la respuesta.
    const fallos: Array<{ nombre: string; motivo: string }> = []
    let activados = 0
    let desactivados = 0
    for (const c of [...reparto.activar, ...reparto.desactivar]) {
      try {
        await setDirigenteActive(c.memberId, c.a, { porRecalculo: true })
        if (c.a) activados++
        else desactivados++
        const { error } = await supabase.from('audit_log').insert({
          action: 'UPDATE', entity_type: 'study_leaders', entity_id: c.memberId,
          old_data: { is_active: c.de },
          new_data: { is_active: c.a, op: 'recalculo_dirigente_activo', nombre: c.nombre },
        })
        if (error) console.warn('audit dirigente:', error.message)
      } catch (e) {
        fallos.push({ nombre: c.nombre, motivo: e instanceof Error ? e.message : String(e) })
      }
    }

    await pingHealthcheck('HEALTHCHECK_URL_DIRIGENTES_ACTIVOS')
    return NextResponse.json({
      ok: true, hoy, meses: MESES_DE_VIGENCIA, total: dirigentes.length,
      activados, desactivados, sin_cambio: reparto.sinCambio, fallos,
    })
  } catch (error) {
    reportarError('GET /api/cron/dirigentes-activos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
