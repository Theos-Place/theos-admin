import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  updateDirigenteConfig, setDirigenteActive, setLeaderAdminStatus, membersWithActiveGroups,
  getFichaDeDisponibilidad,
} from '@/lib/supabase/queries/studies'
import { requireRoles } from '@/lib/auth/guard'
import {
  EN_REVISION_BLOCK_MESSAGE, SETTABLE_STATUSES, canSeeLeaderAdminStatus,
} from '@/lib/studies/leader-admin-status'
import {
  CAMPOS_DEL_DIRIGENTE, motivoQueImpideEditar, motivoQueImpideElRango, sanearSlots,
} from '@/lib/studies/disponibilidad-de-dirigente'
import { ymdCR } from '@/lib/format'
import { reportarError } from '@/lib/observabilidad'

const bodySchema = z.object({
  qualified_study_codes: z.array(z.string()).optional(),
  zone_preference: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  // DIR-6: el matiz administrativo. Solo lo escriben los roles que lo ven.
  availability_status: z.enum(SETTABLE_STATUSES).optional(),
  // SRV-9 · lo que el propio dirigente dice de sí mismo.
  interested_study_codes: z.array(z.string()).optional(),
  available_slots: z.array(z.string()).optional(),
  offers_home: z.boolean().optional(),
  available_as_substitute: z.boolean().optional(),
  available_from: z.string().nullable().optional(),
  available_to: z.string().nullable().optional(),
  folleto_location: z.string().max(200).nullable().optional(),
  /** Sella la fecha de confirmación aunque no venga ningún cambio: para el
   *  comité, «no cambió nada» y «no contestó» son cosas distintas. */
  action: z.literal('confirmar_datos').optional(),
}).strict()

/** Quién puede LEER la ficha de otra persona. Es la misma lista que puede
 *  escribirla, más nadie: la disponibilidad dice dónde vive alguien los martes
 *  en la noche. */
const LEE_LA_FICHA = ['admin', 'direccion', 'coordinador_dirigentes', 'coordinador_estudios']

/** Los campos de este body que son del COMITÉ y no del dirigente. */
const CAMPOS_DE_DISPONIBILIDAD = new Set<string>([...CAMPOS_DEL_DIRIGENTE, 'action'])

/**
 * GET · La ficha de disponibilidad de este dirigente.
 *
 * Mismas dos puertas que el PATCH: el comité y la propia persona. Devuelve 404
 * cuando no hay ficha —y no un objeto vacío— porque eso es lo que decide si el
 * tab del perfil aparece: «no tiene ficha» y «tiene ficha vacía» son cosas
 * distintas.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    const esComite = auth.ctx.roles.some(r => LEE_LA_FICHA.includes(r))
    if (!esComite && auth.ctx.memberId !== id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    const ficha = await getFichaDeDisponibilidad(id)
    if (!ficha) return NextResponse.json({ error: 'Sin ficha de dirigente' }, { status: 404 })
    return NextResponse.json(ficha)
  } catch (error) {
    reportarError('GET /api/studies/dirigentes/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    /**
     * SRV-9 · Dos puertas para el mismo endpoint.
     *
     * El comité entra como siempre. El PROPIO dirigente entra también, pero
     * solo a los campos de su disponibilidad: la formación la certifica el
     * comité y el estado administrativo es una decisión sobre la persona, no
     * una preferencia suya. El chequeo campo por campo va abajo, con la lista
     * de PERMITIDOS de `motivoQueImpideEditar` — con una lista de prohibidos,
     * la columna que se agregue mañana nacería abierta.
     */
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params // member_id
    const esComite = auth.ctx.roles.some(r => LEE_LA_FICHA.includes(r))
    const esSuPropiaFicha = !!auth.ctx.memberId && auth.ctx.memberId === id
    if (!esComite && !esSuPropiaFicha) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    /**
     * Y solo si YA TIENE ficha de dirigente.
     *
     * Sin esto, cualquiera con sesión podría mandar un PATCH a su propio id y
     * `updateDirigenteConfig` le CREARÍA la ficha —insert cuando no existe—:
     * se metería solo al módulo de dirigentes como inactivo, y el comité vería
     * crecer su lista con gente que nunca nombró. Llenar la disponibilidad es
     * algo que hace un dirigente, no algo que lo convierte en uno.
     */
    if (!esComite) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const { data: ficha } = await createAdminClient()
        .from('study_leaders').select('id').eq('member_id', id).maybeSingle()
      if (!ficha) {
        return NextResponse.json(
          { error: 'No tenés ficha de dirigente. Si creés que debería, escribile a la coordinación.', code: 'sin_ficha' },
          { status: 403 },
        )
      }
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) }, { status: 400 })
    }
    const body = parsed.data

    // Campo por campo, y con el mensaje que explica POR QUÉ. Un 403 genérico
    // acá se lee como un bug y termina en un reporte.
    if (!esComite) {
      for (const campo of Object.keys(body)) {
        if (CAMPOS_DE_DISPONIBILIDAD.has(campo)) continue
        const motivo = motivoQueImpideEditar(campo)
        if (motivo) return NextResponse.json({ error: motivo, code: 'campo_del_comite' }, { status: 403 })
      }
    }

    // La ventana del año se valida con la regla pura, que además ataja el
    // 31 de febrero (el formato solo no alcanza).
    if (body.available_from !== undefined || body.available_to !== undefined) {
      const motivo = motivoQueImpideElRango(body.available_from, body.available_to, ymdCR())
      if (motivo) return NextResponse.json({ error: motivo, code: 'rango_invalido' }, { status: 400 })
    }

    // DIR-6 · Estado administrativo. Gate propio DENTRO del handler: este
    // endpoint lo abre también 'direccion', que puede activar/desactivar pero
    // NO poner a nadie en pausa ni en revisión.
    if (body.availability_status !== undefined) {
      if (!canSeeLeaderAdminStatus(auth.ctx.roles)) {
        return NextResponse.json(
          { error: 'El estado administrativo lo maneja la coordinación de dirigentes.' },
          { status: 403 },
        )
      }
      await setLeaderAdminStatus(id, body.availability_status)
    }

    // Toggle manual de estado (activo/inactivo). No se puede desactivar a quien
    // tiene un grupo en curso/abierto (punto 1).
    if (typeof body.active === 'boolean') {
      if (!body.active) {
        const blocked = await membersWithActiveGroups([id])
        if (blocked.has(id)) {
          return NextResponse.json(
            { error: 'No se puede desactivar: tiene un grupo en curso o abierto.', code: 'has_active_groups' },
            { status: 409 },
          )
        }
      }
      await setDirigenteActive(id, body.active)
    }
    /**
     * La disponibilidad. Los slots se SANEAN antes de guardar (se tira lo que
     * no es un día×franja real y se ordena canónicamente): dos personas con la
     * misma disponibilidad tienen que quedar con el mismo arreglo, o comparar
     * dos fichas deja de funcionar.
     */
    const patch: Parameters<typeof updateDirigenteConfig>[1] = {}
    for (const campo of CAMPOS_DEL_DIRIGENTE) {
      const v = (body as Record<string, unknown>)[campo]
      if (v !== undefined) (patch as Record<string, unknown>)[campo] = v
    }
    if (patch.available_slots) patch.available_slots = sanearSlots(patch.available_slots)
    // `folleto_location` en blanco es «no dijo», no una cadena vacía.
    if (typeof patch.folleto_location === 'string') {
      patch.folleto_location = patch.folleto_location.trim() || null
    }
    // Confirmar sella la fecha AUNQUE no venga ningún cambio: es el dato que
    // le dice al comité quién revisó y quién no.
    if (body.action === 'confirmar_datos') {
      patch.availability_confirmed_at = new Date().toISOString()
    }
    if (Object.keys(patch).length > 0) await updateDirigenteConfig(id, patch)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'DIRIGENTE_NO_RECOMENDADO') {
      return NextResponse.json(
        { error: 'Esta persona está marcada como no recomendada para dar estudios.' },
        { status: 400 },
      )
    }
    if (error instanceof Error && error.message === 'DIRIGENTE_EN_REVISION') {
      return NextResponse.json(
        { error: EN_REVISION_BLOCK_MESSAGE, code: 'dirigente_en_revision' },
        { status: 409 },
      )
    }
    if (error instanceof Error && error.message === 'DIRIGENTE_CON_GRUPO_ACTIVO') {
      return NextResponse.json(
        { error: 'Tiene un grupo en curso o abierto: primero hay que resolver el grupo.', code: 'has_active_groups' },
        { status: 409 },
      )
    }
    reportarError('PATCH /api/studies/dirigentes/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
