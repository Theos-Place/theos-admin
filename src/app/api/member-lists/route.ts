import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { getMemberLists, createMemberList } from '@/lib/supabase/queries/member-lists'
import { reportarError } from '@/lib/observabilidad'
import { logAudit } from '@/lib/audit'
import { ROLES_QUE_GESTIONAN_LISTAS } from '@/lib/members/editar-lista'
import type { FilterState } from '@/types/filters'

const cuerpoPost = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  // El filtro se guarda tal cual (su forma vive en types/filters.ts); las listas
  // fijas no traen.
  filters: z.object({ conditions: z.array(z.unknown()), groups: z.array(z.unknown()) }).passthrough().nullable().optional(),
  segment_label: z.string().max(500).nullable().optional(),
  member_ids: z.array(z.string().uuid()).max(50000).optional(),
  member_count: z.number().int().min(0).optional(),
  is_dynamic: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
})

export async function GET() {
  try {
    // Listas de segmentación del padrón: para quien ve el padrón o gestiona
    // comunicaciones — no para cualquier sesión (alineado con las escrituras).
    const auth = await requireModuleView('miembros', { beyondOwn: true })
    if (auth.res) {
      const com = await requireModuleView('comunicaciones')
      if (com.res) return com.res
    }
    return NextResponse.json(await getMemberLists())
  } catch (error) {
    reportarError('GET /api/member-lists:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRoles(...ROLES_QUE_GESTIONAN_LISTAS)
    if (auth.res) return auth.res
    const parsed = cuerpoPost.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    // PAR-9 · quién la creó: hasta el 30-oct-2026 no se guardaba (las 17
    // listas de producción lo tienen vacío) y la pantalla decía «Creada por».
    const list = await createMemberList({
      ...parsed.data,
      filters: (parsed.data.filters ?? null) as FilterState | null,
      created_by: auth.ctx.memberId,
    })
    await logAudit({
      actorUserId: auth.ctx.userId, action: 'INSERT', entityType: 'member_lists', entityId: list.id,
      newData: { name: list.name, segment_label: list.segment_label, member_count: list.member_count, is_dynamic: list.is_dynamic },
    })
    return NextResponse.json(list, { status: 201 })
  } catch (error) {
    reportarError('POST /api/member-lists:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
