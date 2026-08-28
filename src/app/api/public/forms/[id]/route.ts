import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { esFormularioAbierto } from '@/lib/forms/public-access'
import { formWindowStatus, FORM_WINDOW_BLOCKED } from '@/lib/forms/active-window'

// GET: un formulario ABIERTO, para contestarlo sin cuenta.
//
// SIN SESIÓN, así que la respuesta es una whitelist estricta y nunca un spread
// del formulario: acá no salen created_by, ni la entidad dueña, ni nada de las
// respuestas de otros. Solo lo que hace falta para dibujarlo y contestarlo.
//
// 404 —y no 403— cuando el formulario no es abierto: responder "existe pero no
// podés" le confirma a cualquiera qué ids son válidos.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('forms')
      .select('id, title, description, is_public, requires_auth, is_active, starts_at, ends_at, hero_image_url, hero_title, hero_subtitle')
      .eq('id', id).maybeSingle()
    const f = data as {
      id: string; title: string; description: string | null
      is_public: boolean; requires_auth: boolean; is_active: boolean
      starts_at: string | null; ends_at: string | null
      hero_image_url: string | null; hero_title: string | null; hero_subtitle: string | null
    } | null
    if (!f || !esFormularioAbierto(f)) {
      return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    }

    // La ventana de vigencia se resuelve acá y no en el cliente: si está
    // cerrado, no se mandan ni los campos.
    const ventana = formWindowStatus(f)
    if (ventana !== 'activo') {
      return NextResponse.json({ error: FORM_WINDOW_BLOCKED[ventana], code: 'formulario_cerrado' }, { status: 403 })
    }

    const { data: campos } = await supabase
      .from('form_fields')
      .select('id, field_type, label, placeholder, help_text, is_required, options, conditions, sort_order, description, scale_min, scale_max, scale_min_label, scale_max_label')
      .eq('form_id', id).order('sort_order')

    return NextResponse.json({
      form: {
        id: f.id, title: f.title, description: f.description,
        hero_image_url: f.hero_image_url, hero_title: f.hero_title, hero_subtitle: f.hero_subtitle,
      },
      fields: campos ?? [],
    })
  } catch (error) {
    console.error('GET /api/public/forms/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
