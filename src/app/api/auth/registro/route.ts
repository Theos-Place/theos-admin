import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteMemberToCompleteProfile } from '@/lib/auth/invite'
import { sendPasswordLink } from '@/lib/auth/password-link'
import { DOCUMENT_TYPES, normalizeCedula } from '@/lib/cedula'
import {
  MENSAJE_REGISTRO_CREADO, MENSAJE_SIN_CORREO, MENSAJE_YA_EXISTE,
  erroresDeRegistro, normalizarRegistro, planDeRegistro,
} from '@/lib/auth/registro-publico'

// POST { first_name, last_name, document_type, cedula, email, phone? }
// → crea la ficha y su cuenta de acceso. SIN SESIÓN: es el registro público.
//
// Tres cuidados, cada uno por una razón distinta:
//
//  · RESPUESTA SIEMPRE IGUAL, exista o no el documento. Si cambiara, la
//    pantalla se vuelve un verificador de qué cédulas están registradas.
//  · SI EL DOCUMENTO YA EXISTE no se crea nada y el enlace va al correo DE LA
//    FICHA, nunca al que se acaba de escribir. Sin eso, registrarse con la
//    cédula de otro y un correo propio entrega su cuenta con su historial y sus
//    pagos. Es el único camino de apropiación que abre esta pantalla.
//  · RATE LIMIT por IP y por documento, para que no se use de ametralladora
//    contra buzones ajenos ni para tantear cédulas.
//
// El rol NO se escribe: 'miembro' es el piso implícito de toda ficha
// (withBaseRole). Ver src/lib/auth/registro-publico.ts.
const schema = z.object({
  first_name: z.string().trim().min(2).max(80),
  last_name: z.string().trim().min(2).max(120),
  document_type: z.enum(DOCUMENT_TYPES),
  cedula: z.string().trim().min(4).max(30),
  email: z.string().trim().min(5).max(254),
  phone: z.string().trim().max(20).optional().nullable(),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Revisá los datos del formulario.' }, { status: 400 })
    }
    // La misma validación que corre la pantalla: nunca se acepta acá algo que
    // el formulario rechaza, ni al revés.
    const errores = erroresDeRegistro(parsed.data)
    if (Object.keys(errores).length) {
      return NextResponse.json({ error: 'Revisá los datos del formulario.', campos: errores }, { status: 400 })
    }
    const d = normalizarRegistro(parsed.data)

    if (!rateLimit(`registro:ip:${clientIp(req)}`, 5, 15 * 60_000)) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Esperá unos minutos y volvé a probar.' }, { status: 429 },
      )
    }
    // Por documento: 3 en 15 minutos. Es lo que evita que la pantalla se use
    // para tantear cédulas en masa, ahora que sí dice cuándo una ya existe.
    if (!rateLimit(`registro:doc:${d.document_type}:${d.cedula}`, 3, 15 * 60_000)) {
      return NextResponse.json(
        { error: 'Demasiados intentos con ese documento. Esperá unos minutos.' }, { status: 429 },
      )
    }

    const supabase = createAdminClient()
    // Por DOCUMENTO primero: es la llave fuerte, con índice único detrás.
    const { data: porDoc } = await supabase
      .from('members').select('id, email')
      .eq('document_type', d.document_type)
      .eq('cedula_normalized', normalizeCedula(d.cedula))
      .limit(1).maybeSingle()
    // Y por CORREO, que no tiene índice único pero igual identifica a alguien:
    // sin este chequeo, la misma persona con otro documento se crea dos veces.
    const { data: porCorreo } = porDoc ? { data: null } : await supabase
      .from('members').select('id, email').ilike('email', d.email).limit(1).maybeSingle()

    const existente = ((porDoc ?? porCorreo) as { id: string; email: string | null } | null) ?? null
    const plan = planDeRegistro({ existente })

    if (plan.accion === 'derivar_a_staff') {
      // Existe pero sin correo: no hay a dónde mandar el enlace, y usar el que
      // se acaba de escribir sería regalar la cuenta.
      console.warn('registro público, ficha sin correo:', plan.motivo)
      return NextResponse.json({ ok: true, ya_existia: true, message: MENSAJE_SIN_CORREO })
    }

    if (plan.accion === 'reenviar') {
      // Al correo DE LA FICHA, nunca al escrito. Y se le dice que ya existía:
      // sin eso queda esperando un correo de bienvenida que no va a llegar.
      await sendPasswordLink({ email: plan.correoDeLaFicha, tieneCuenta: true, nombre: d.first_name })
      return NextResponse.json({ ok: true, ya_existia: true, message: MENSAJE_YA_EXISTE })
    }

    const { data: creada, error: insErr } = await supabase.from('members').insert({
      first_name: d.first_name,
      last_name: d.last_name,
      document_type: d.document_type,
      cedula: d.cedula,
      email: d.email,
      phone: d.phone,
      is_active: true,
    }).select('id').single()
    if (insErr) {
      // 23505 = el índice único de documento. Puede pasar si dos registros
      // entran a la vez con la misma cédula: la respuesta es la de siempre.
      if ((insErr as { code?: string }).code === '23505') {
        return NextResponse.json({ ok: true, ya_existia: true, message: MENSAJE_YA_EXISTE })
      }
      throw insErr
    }
    const memberId = (creada as { id: string }).id

    const invite = await inviteMemberToCompleteProfile(memberId, d.email)
    if (!invite.sent) console.error('registro público, invitación:', invite.reason)

    // Sin logAudit explícito: no hay actor —es un registro público— y el
    // trigger de la base ya deja el INSERT con actor_id NULL, que es
    // exactamente lo que corresponde acá.
    return NextResponse.json({ ok: true, message: MENSAJE_REGISTRO_CREADO })
  } catch (error) {
    console.error('POST /api/auth/registro:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
