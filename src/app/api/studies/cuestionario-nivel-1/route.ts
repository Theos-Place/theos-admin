import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportarError } from '@/lib/observabilidad'
import {
  veredicto, TITULO_DEL_FORMULARIO, type RespuestasDelCuestionario,
} from '@/lib/studies/cuestionario-de-matricula'

/**
 * EST-15 · El cuestionario que se responde al matricular Nivel 1.
 *
 * NO REUSA `/api/forms/[id]/responses` a propósito. Ese endpoint arrastra la
 * maquinaria de CONVOCATORIA de CDEB —`memberFormFillAccess`, que deja enviar
 * solo a quien fue invitado— y acá pasa lo contrario: tiene que poder
 * contestarlo cualquiera que esté matriculándose. Reusarlo habría significado
 * abrirle un agujero a esa regla, que existe por una decisión de 2026-08-06.
 *
 * Lo que SÍ se reusa es donde importa: las respuestas van a `form_responses` y
 * `form_response_values`, o sea que se leen desde el módulo de formularios como
 * cualquier otra y el acceso se da POR FORMULARIO con `form_access_grants`
 * (FRM-4). Eso no es un detalle: acá se guarda afiliación religiosa, que es
 * dato sensible bajo la Ley 8968, y los grants permiten dárselo a quien
 * corresponda sin abrir un rol nuevo.
 *
 * EL VEREDICTO LO CALCULA EL SERVIDOR. La pantalla lo vuelve a calcular para
 * dibujar, pero el que vale es este: el del navegador se cambia con la consola
 * abierta.
 */

/** El formulario se resuelve por TÍTULO y no por un uuid escrito a mano: así el
 *  seed y esto no se pueden desincronizar sin que falle el mismo día. */
async function formularioYCampos(supabase: ReturnType<typeof createAdminClient>) {
  const { data: form } = await supabase
    .from('forms').select('id, is_active').eq('title', TITULO_DEL_FORMULARIO).maybeSingle()
  if (!form) return null
  const { data: campos } = await supabase
    .from('form_fields')
    .select('id, field_type, label, description, is_required, options, conditions, sort_order')
    .eq('form_id', (form as { id: string }).id)
    .order('sort_order')
  return { form: form as { id: string; is_active: boolean }, campos: campos ?? [] }
}

export async function GET() {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const supabase = createAdminClient()
    const encontrado = await formularioYCampos(supabase)
    // Sin formulario sembrado el flujo SIGUE: la matrícula no se cae porque
    // falte el cuestionario. Se avisa con `disponible:false` y la pantalla no
    // dibuja el paso.
    if (!encontrado || !encontrado.form.is_active) {
      return NextResponse.json({ disponible: false, campos: [] })
    }
    let yaRespondio = false
    if (auth.ctx.memberId) {
      const { count } = await supabase
        .from('form_responses')
        .select('id', { count: 'exact', head: true })
        .eq('form_id', encontrado.form.id)
        .eq('member_id', auth.ctx.memberId)
      yaRespondio = (count ?? 0) > 0
    }
    return NextResponse.json({
      disponible: true,
      form_id: encontrado.form.id,
      ya_respondio: yaRespondio,
      campos: encontrado.campos,
    })
  } catch (error) {
    reportarError('GET /api/studies/cuestionario-nivel-1:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  try {
    const body = await req.json().catch(() => null) as { respuestas?: Record<string, string> } | null
    const respuestas = body?.respuestas
    if (!respuestas || typeof respuestas !== 'object') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }
    if (!auth.ctx.memberId) {
      return NextResponse.json({ error: 'Tu sesión no tiene una ficha asociada.' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const encontrado = await formularioYCampos(supabase)
    if (!encontrado) return NextResponse.json({ error: 'El cuestionario no existe.' }, { status: 404 })

    // Las respuestas llegan por ETIQUETA —es lo que la regla entiende— y se
    // guardan por `field_id`, que es lo que la tabla espera.
    const idPorEtiqueta = new Map(
      (encontrado.campos as Array<{ id: string; label: string }>).map(c => [c.label, c.id]),
    )

    const v = veredicto(respuestas as RespuestasDelCuestionario)
    if (v.estado === 'incompleto') {
      return NextResponse.json({ error: 'Faltan preguntas por contestar.', detalles: v.falta }, { status: 400 })
    }

    const { data: resp, error: eResp } = await supabase.from('form_responses').insert({
      form_id: encontrado.form.id,
      member_id: auth.ctx.memberId,
    }).select('id').single()
    if (eResp) throw eResp

    const valores = Object.entries(respuestas)
      .filter(([etiqueta, valor]) => idPorEtiqueta.has(etiqueta) && String(valor ?? '').trim() !== '')
      .map(([etiqueta, valor]) => ({
        response_id: (resp as { id: string }).id,
        field_id: idPorEtiqueta.get(etiqueta)!,
        value_text: String(valor),
      }))
    if (valores.length > 0) {
      const { error } = await supabase.from('form_response_values').insert(valores)
      if (error) throw error
    }

    return NextResponse.json({ ok: true, veredicto: v })
  } catch (error) {
    reportarError('POST /api/studies/cuestionario-nivel-1:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
