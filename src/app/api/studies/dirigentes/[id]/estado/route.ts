import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { reportarError } from '@/lib/observabilidad'
import { createAdminClient } from '@/lib/supabase/admin'
import { DIRIGENTES_ADMIN_ROLES } from '@/lib/auth/roles'
import {
  motivoInvalido,
  ESTADOS_BASE, RAZONES_INACTIVO, DETALLES_NO_EJERCE, SITUACIONES_CDEB,
  DISPONIBILIDADES, RAZONES_NO_DISPONIBLE, RAZONES_DE_REVISION,
  type EstadoDelDirigente,
} from '@/lib/leaders/estado-del-dirigente'
import { puedeEscribirNotas, puedeVerBanderita } from '@/lib/leaders/notas-confidenciales'

/**
 * DIR-8 · Guardar el estado administrativo del dirigente.
 *
 * El `id` de la ruta es el MEMBER_ID, igual que el resto de
 * `/api/studies/dirigentes/[id]`: la ficha trabaja con la persona, no con la
 * fila de `study_leaders`, y pedirle a la pantalla que conozca las dos
 * llaves es invitar a que use la equivocada.
 *
 * Ruta aparte del PUT general a propósito: ese lo usan los tres roles que
 * mantienen datos (`DIRIGENTES_ADMIN_ROLES`), y acá hay dos cosas que NO
 * todos pueden tocar —las notas y la banderita—. Mezclarlas en el mismo
 * handler obligaría a filtrar campo por campo en medio de la lógica, que es
 * donde se olvida uno.
 */
const esquema = z.object({
  estado_base: z.enum(ESTADOS_BASE),
  razon_inactivo: z.enum(RAZONES_INACTIVO).nullable().default(null),
  detalle_no_ejerce: z.enum(DETALLES_NO_EJERCE).nullable().default(null),
  situacion_cdeb: z.enum(SITUACIONES_CDEB).nullable().default(null),
  disponibilidad: z.enum(DISPONIBILIDADES).nullable().default(null),
  razon_no_disponible: z.enum(RAZONES_NO_DISPONIBLE).nullable().default(null),
  pausa_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  revision: z.array(z.enum(RAZONES_DE_REVISION)).default([]),
  nota_revision: z.string().trim().max(2000).nullable().optional(),
  nota_cdeb: z.string().trim().max(2000).nullable().optional(),
  nota_decision_propia: z.string().trim().max(2000).nullable().optional(),
  nota_pausa: z.string().trim().max(2000).nullable().optional(),
  nota_general: z.string().trim().max(4000).nullable().optional(),
  /**
   * DIR-8 · «Está en el grupo de WhatsApp». Manual: nadie puede saberlo
   * desde el sistema, lo marca quien administra el grupo. No es una nota
   * confidencial —es logística— así que lo edita cualquiera que pueda
   * editar el estado.
   */
  en_grupo_whatsapp: z.boolean().optional(),
})

const CAMPOS_RESERVADOS = [
  'nota_revision', 'nota_cdeb', 'nota_decision_propia', 'nota_pausa', 'nota_general',
] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRoles(...DIRIGENTES_ADMIN_ROLES)
  if (auth.res) return auth.res
  try {
    const { id } = await params
    const parsed = esquema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', detalles: z.treeifyError(parsed.error) },
        { status: 400 },
      )
    }
    const d = parsed.data

    // La MISMA función que valida en la pantalla, y la base tiene además su
    // CHECK. Tres capas para la misma regla porque las tres se escriben
    // solas: la pantalla puede tener un bug, el endpoint lo puede llamar un
    // script, y a la tabla se escribe a mano.
    const estado: EstadoDelDirigente = {
      base: d.estado_base,
      razonInactivo: d.razon_inactivo,
      detalleNoEjerce: d.detalle_no_ejerce,
      situacionCdeb: d.situacion_cdeb,
      disponibilidad: d.disponibilidad,
      razonNoDisponible: d.razon_no_disponible,
      pausaHasta: d.pausa_hasta,
      revision: d.revision,
    }
    const motivo = motivoInvalido(estado)
    if (motivo) {
      return NextResponse.json({ error: motivo, code: 'estado_invalido' }, { status: 400 })
    }

    const { estado_base, razon_inactivo, detalle_no_ejerce, situacion_cdeb,
      disponibilidad, razon_no_disponible, pausa_hasta, revision } = d
    const cambios: Record<string, unknown> = {
      estado_base, razon_inactivo, detalle_no_ejerce, situacion_cdeb,
      disponibilidad, razon_no_disponible, pausa_hasta,
      // `is_active` se mantiene en espejo mientras quede código leyéndola.
      is_active: estado_base === 'activo',
    }
    // Opcional de verdad: si no viene, NO se toca. Mandar `false` por
    // omisión sacaría del grupo a todo el que se edite desde otra pantalla.
    if (d.en_grupo_whatsapp !== undefined) cambios.en_grupo_whatsapp = d.en_grupo_whatsapp

    // La BANDERITA y las NOTAS solo las toca quien puede. Quien no, puede
    // seguir editando el estado —es su trabajo— y lo que mandó de estos
    // campos se IGNORA en silencio en vez de rechazar todo: un 403 por un
    // campo que su pantalla ni le muestra sería incomprensible.
    if (puedeVerBanderita(auth.ctx.roles)) cambios.revision = revision
    if (puedeEscribirNotas(auth.ctx.roles)) {
      for (const c of CAMPOS_RESERVADOS) {
        if (c in d) cambios[c] = d[c] ?? null
      }
    }

    const supabase = createAdminClient()
    // `as never` porque `types/database.ts` todavía no conoce las columnas
    // de DIR-8: se regenera con el CLI de Supabase, que pide Docker. Mismo
    // patrón que los inserts de finance.ts. La forma la garantizan el zod de
    // arriba, `motivoInvalido` y los CHECK de la tabla.
    /**
     * `member_id`, NO `id`. El `[id]` de la ruta es el del MIEMBRO —así lo
     * arma la lista y así lo espera el resto de la pantalla—, y
     * `study_leaders` tiene su propia PK.
     *
     * BUG hasta el 2026-10-13: decía `.eq('id', id)`. Los dos UUID son
     * válidos y distintos, así que el update no encontraba fila, no daba
     * error y devolvía 200 OK. O sea que TODO lo que se editaba en la ficha
     * administrativa —estado, razón, banderita, notas— se perdía en
     * silencio y la pantalla decía «guardado».
     *
     * Se encontró porque el check de WhatsApp no persistía; el resto de los
     * campos llevaba un día haciendo lo mismo sin que nadie lo notara.
     */
    const { error, count } = await supabase
      .from('study_leaders')
      .update(cambios as never, { count: 'exact' })
      .eq('member_id', id)
    if (error) throw error
    // Si no tocó ninguna fila, la pantalla NO puede decir «guardado». Es
    // exactamente lo que escondía el bug de arriba.
    if (count === 0) {
      return NextResponse.json(
        { error: 'Ese dirigente no tiene ficha.', code: 'sin_ficha' }, { status: 404 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportarError('PATCH /api/studies/dirigentes/[id]/estado:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
