import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPasswordLink } from '@/lib/auth/password-link'

// POST { identifier } → manda el enlace para definir/restablecer la contraseña.
//
// SIN SESIÓN a propósito: es el flujo de "no puedo entrar". Por eso lleva dos
// cuidados:
//   · La respuesta es SIEMPRE la misma, exista o no la cuenta — así la pantalla
//     no se convierte en un verificador de qué correos están registrados.
//   · Rate limit por IP y por identificador, para que no se use como
//     ametralladora de correos a terceros.
//
// Reemplaza a resetPasswordForEmail del navegador: ese usaba PKCE y el enlace
// solo servía en el MISMO navegador donde se pidió (ver lib/auth/password-link.ts).

const schema = z.object({
  /** Correo o documento de identidad. */
  identifier: z.string().min(3).max(120),
})

const RESPUESTA_NEUTRAL = {
  ok: true,
  message: 'Si ese correo tiene una cuenta, ya le mandamos el enlace. Revisá tu bandeja y la carpeta de spam.',
}

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Escribí tu correo o tu documento.' }, { status: 400 })
    }
    const identifier = parsed.data.identifier.trim().toLowerCase()

    if (!rateLimit(`pwlink:ip:${clientIp(req)}`, 10, 15 * 60_000)) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Esperá unos minutos y volvé a probar.' }, { status: 429 },
      )
    }
    // Por identificador: 3 en 15 minutos alcanza de sobra para un caso real y
    // evita llenarle el buzón a alguien más.
    if (!rateLimit(`pwlink:id:${identifier}`, 3, 15 * 60_000)) {
      return NextResponse.json(RESPUESTA_NEUTRAL)
    }

    // Resolver a un miembro: se acepta correo o documento, igual que el login.
    const supabase = createAdminClient()
    const esCorreo = identifier.includes('@')
    const query = supabase.from('members').select('first_name, email, auth_user_id').limit(1)
    const { data } = esCorreo
      ? await query.ilike('email', identifier)
      : await query.eq('cedula_normalized', identifier.replace(/[\s-]/g, '').toUpperCase())
    const member = (data ?? [])[0] as
      | { first_name: string | null; email: string | null; auth_user_id: string | null }
      | undefined

    const email = member?.email?.trim()
    if (email) {
      // El tipo (definir vs restablecer) lo resuelve sendPasswordLink: acá solo
      // va la pista, porque auth_user_id puede estar desincronizado.
      const res = await sendPasswordLink({
        email,
        tieneCuenta: !!member?.auth_user_id,
        nombre: member?.first_name ?? null,
      })
      if (!res.sent && res.reason !== 'sin_cuenta') {
        console.error('password-link:', res.reason)
      }
    }

    return NextResponse.json(RESPUESTA_NEUTRAL)
  } catch (error) {
    console.error('POST /api/auth/password-link:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
