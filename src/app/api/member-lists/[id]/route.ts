import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import {
  getMemberListById, updateMemberList, deleteMemberList, recomputeMemberList,
  autoriaDeLaLista, fichasExistentes,
} from '@/lib/supabase/queries/member-lists'
import { logAudit } from '@/lib/audit'
import { reportarError } from '@/lib/observabilidad'
import { aplicarCambioDePersonas, puedeEditarLista, tieneFiltroEditable } from '@/lib/members/editar-lista'
import type { FilterState } from '@/types/filters'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    let list = await getMemberListById(id)
    if (!list) return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })
    // Una lista DINÁMICA se recalcula acá, al leerla. Es lo que su nombre
    // promete y lo que el banner de la pantalla decía sin que nadie lo
    // cumpliera: `filters` se guardaba y nada lo volvía a correr.
    //
    // Se recalcula en el GET y no en un cron para que quien abra la lista vea
    // el dato de HOY, y para que "Comunicar a esta lista" —que sale de esta
    // misma respuesta— no mande a una audiencia vieja.
    //
    // Best-effort: si el recálculo falla, se devuelve la última membresía
    // conocida en vez de romper la pantalla.
    if (list.is_dynamic) {
      try {
        const r = await recomputeMemberList(id)
        if (r.ok) list = r.list
      } catch (e) {
        console.warn('recálculo de lista dinámica falló, se devuelve la última conocida:', e)
      }
    }
    // PAR-9 · quién la creó y quién la tocó por última vez, con nombre.
    const autoria = await autoriaDeLaLista(list).catch(() => ({ creada_por: null, ultima_edicion: null }))
    return NextResponse.json({ ...list, ...autoria, puede_editar: puedeEditarLista(auth.ctx, list) })
  } catch (error) {
    reportarError('GET /api/member-lists/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PAR-9 · El filtro llega como JSON y se guarda tal cual en `filters`; acá se
 * exige la forma mínima (y `v: 2`, el filtro completo) sin re-describir cada
 * tipo de condición, que vive en `types/filters.ts` y crece seguido.
 */
const filtroCompleto = z.object({
  v: z.literal(2),
  conditions: z.array(z.object({ id: z.number(), type: z.string() }).passthrough()),
  groups: z.array(z.object({ id: z.number() }).passthrough()),
  topLevelOps: z.record(z.string(), z.enum(['AND', 'OR'])).optional(),
  is_donor: z.boolean().optional(),
  is_server: z.boolean().optional(),
  active_attendance: z.union([z.boolean(), z.literal('estudios')]).optional(),
  search: z.string().max(200).optional(),
})

const datosDeLaLista = {
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
}

const cuerpoPatch = z.discriminatedUnion('action', [
  // Renombrar, descripción, tags. Vale para cualquier lista.
  z.object({ action: z.literal('datos'), ...datosDeLaLista }),
  // Nuevo filtro: mismo id, mismo nombre — sigue sirviendo en todo lo que la usa.
  z.object({
    action: z.literal('actualizar_filtros'),
    filters: filtroCompleto,
    segment_label: z.string().max(500),
    is_dynamic: z.boolean().optional(),
    ...datosDeLaLista,
  }),
  // Listas FIJAS: personas a mano.
  z.object({
    action: z.enum(['agregar_personas', 'quitar_personas']),
    member_ids: z.array(z.string().uuid()).min(1).max(5000),
  }),
])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Solo sesión: el permiso fino es puedeEditarLista (los roles que gestionan
  // listas O quien la creó), y se decide con la lista en mano, más abajo.
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = cuerpoPatch.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const lista = await getMemberListById(id)
    if (!lista) return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })
    if (!puedeEditarLista(auth.ctx, lista)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    const b = parsed.data

    if (b.action === 'datos') {
      const { action: _a, ...patch } = b
      void _a
      await updateMemberList(id, patch)
      await logAudit({
        actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'member_lists', entityId: id,
        oldData: { name: lista.name, description: lista.description, tags: lista.tags },
        newData: { name: patch.name ?? lista.name, description: patch.description ?? lista.description, tags: patch.tags ?? lista.tags },
      })
      return NextResponse.json({ ok: true })
    }

    if (b.action === 'actualizar_filtros') {
      const { action: _a, filters, segment_label, is_dynamic, ...datos } = b
      void _a
      await updateMemberList(id, {
        ...datos, filters: filters as unknown as FilterState, segment_label,
        ...(is_dynamic === undefined ? {} : { is_dynamic }),
      })
      // La membresía la calcula el SERVIDOR con el filtro nuevo, no la manda
      // el navegador: así la lista queda igual a lo que diría Miembros hoy.
      const r = await recomputeMemberList(id)
      const despues = r.ok ? r.despues : lista.member_count
      await logAudit({
        actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'member_lists', entityId: id,
        oldData: { segment_label: lista.segment_label, filters: lista.filters, member_count: lista.member_count, is_dynamic: lista.is_dynamic },
        newData: { segment_label, filters, member_count: despues, is_dynamic: is_dynamic ?? lista.is_dynamic, ...datos },
      })
      return NextResponse.json({ ok: true, antes: lista.member_count, despues })
    }

    // agregar / quitar personas: solo en las fijas. En una con filtro, el
    // próximo recálculo borraría lo que se agregó a mano sin avisar.
    if (tieneFiltroEditable(lista.filters)) {
      return NextResponse.json({
        error: 'Esta lista sale de un filtro: para cambiar quién está, editá sus filtros.',
        code: 'lista_con_filtro',
      }, { status: 409 })
    }
    const ids = b.action === 'agregar_personas' ? await fichasExistentes(b.member_ids) : b.member_ids
    const r = aplicarCambioDePersonas(lista.member_ids, b.action, ids)
    await updateMemberList(id, { member_ids: r.member_ids, member_count: r.member_ids.length })
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'UPDATE', entityType: 'member_lists', entityId: id,
      oldData: { member_count: lista.member_count, ...(r.quitados.length ? { quitados: r.quitados } : {}) },
      newData: { member_count: r.member_ids.length, ...(r.agregados.length ? { agregados: r.agregados } : {}) },
    })
    return NextResponse.json({ ok: true, antes: lista.member_count, despues: r.member_ids.length })
  } catch (error) {
    reportarError('PATCH /api/member-lists/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Solo sesión: igual que el PATCH, decide puedeEditarLista con la lista en mano.
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const lista = await getMemberListById(id)
    if (!lista) return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })
    if (!puedeEditarLista(auth.ctx, lista)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    await deleteMemberList(id)
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'DELETE', entityType: 'member_lists', entityId: id,
      oldData: { name: lista.name, segment_label: lista.segment_label, member_count: lista.member_count, filters: lista.filters },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('DELETE /api/member-lists/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
