import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import {
  esFormularioAbierto, faltaEnEnvioInvitado, claveLimite, ENVIOS_MAX_POR_IP, VENTANA_MS,
} from '@/lib/forms/public-access'
import { formWindowStatus, FORM_WINDOW_BLOCKED } from '@/lib/forms/active-window'
import { esCampoCalculado } from '@/lib/forms/computed-fields'

// POST: respuesta de un INVITADO a un formulario abierto. Sin sesión.
//
// Es la única ruta de escritura del sistema sin autenticación, así que la
// defensa es en capas y ninguna es opcional:
//
//   1. El formulario tiene que estar ABIERTO (las dos banderas) y dentro de su
//      ventana. Si no, 404 — no se confirma que el id exista.
//   2. Tope por IP y por formulario: sin sesión no hay a quién limitar más.
//   3. Nombre y correo obligatorios: son la única identidad de la respuesta.
//   4. Solo se guardan respuestas de campos QUE EXISTEN en ese formulario. Sin
//      esto, cualquiera podría inflar la tabla mandando claves inventadas.
//   5. Los campos calculados se ignoran: dependen de una ficha de miembro que
//      un invitado no tiene, y aceptarlos del cliente sería dejar que quien
//      responde escriba su propio historial.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { data } = await supabase
      .from('forms').select('id, is_public, requires_auth, is_active, starts_at, ends_at, allow_multiple_responses')
      .eq('id', id).maybeSingle()
    const f = data as {
      is_public: boolean; requires_auth: boolean; is_active: boolean
      starts_at: string | null; ends_at: string | null
    } | null
    if (!f || !esFormularioAbierto(f)) {
      return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    }
    const ventana = formWindowStatus(f)
    if (ventana !== 'activo') {
      return NextResponse.json({ error: FORM_WINDOW_BLOCKED[ventana], code: 'formulario_cerrado' }, { status: 403 })
    }

    // La IP real detrás del proxy de Vercel. Si no viene, el límite igual
    // aplica sobre una clave común: prefiero frenar de más que no frenar.
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
    if (!rateLimit(claveLimite(id, ip), ENVIOS_MAX_POR_IP, VENTANA_MS)) {
      return NextResponse.json(
        { error: 'Ya se enviaron varias respuestas desde acá. Probá de nuevo en un rato.' },
        { status: 429 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const falta = faltaEnEnvioInvitado({ nombre: body?.guest_name, correo: body?.guest_email })
    if (falta) return NextResponse.json({ error: falta }, { status: 400 })

    // Solo campos de ESTE formulario, y ninguno calculado.
    const { data: campos } = await supabase
      .from('form_fields').select('id, field_type').eq('form_id', id)
    const validos = new Set(((campos ?? []) as Array<{ id: string; field_type: string }>)
      .filter(c => !esCampoCalculado(c.field_type)).map(c => c.id))
    const entrada = (body?.answers ?? {}) as Record<string, unknown>
    const answers: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(entrada)) if (validos.has(k)) answers[k] = v

    /**
     * UNA RESPUESTA POR CORREO, salvo que el formulario permita varias.
     *
     * Mismo criterio que la ruta con sesión, pero acá la clave es el correo:
     * es lo único que identifica a un invitado entre dos envíos. La IP no
     * sirve —una familia comparte la del router— y el límite por IP que ya
     * había frena el abuso, no el doble clic.
     *
     * En la ruta autenticada esto dejó 7 duplicados de 61 respuestas, todos
     * con 0 o 1 segundo de diferencia (2026-09-03). Acá todavía no había
     * pasado, y se cierra antes de que pase.
     */
    const { submitResponse, hasGuestResponded } = await import('@/lib/supabase/queries/forms')
    const correo = String(body.guest_email).trim().toLowerCase()
    const { data: formCfg } = await supabase
      .from('forms').select('allow_multiple_responses').eq('id', id).maybeSingle()
    const permiteVarias = (formCfg as { allow_multiple_responses: boolean } | null)?.allow_multiple_responses === true
    if (!permiteVarias && await hasGuestResponded(id, correo)) {
      return NextResponse.json(
        { error: 'Ya recibimos una respuesta con ese correo.', code: 'ya_respondido' },
        { status: 409 },
      )
    }

    const creada = await submitResponse(id, {
      member_id: null,
      guest_name: String(body.guest_name).trim(),
      guest_email: correo,
      answers: answers as Record<string, string | string[] | number>,
    })

    // La IP queda registrada: es lo único que identifica el origen de una
    // respuesta sin sesión, y sin eso un abuso no se puede rastrear ni limpiar.
    if (ip) {
      await supabase.from('form_responses').update({ ip_address: ip }).eq('id', creada.id)
    }
    return NextResponse.json({ ok: true, id: creada.id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/public/forms/[id]/responder:', error)
    return NextResponse.json({ error: 'No se pudo enviar el formulario.' }, { status: 500 })
  }
}
