import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/auth/link-error'

// Canje del token de un enlace de correo (invitación o recuperar contraseña).
//
// POR QUÉ EXISTE (2026-08-03): el cliente del navegador usa el flujo PKCE, que
// exige un `code_verifier` guardado EN EL MISMO navegador donde se pidió el
// enlace. Con eso, un enlace abierto en el celular después de pedirlo en la
// compu — o abierto en otro navegador — fallaba con "enlace inválido", aunque el
// token estuviera perfecto. Era el caso de la mayoría de la gente.
//
// `verifyOtp` con `token_hash` NO necesita verifier: funciona desde cualquier
// dispositivo. El canje pasa acá, en el servidor, y la sesión queda en cookies
// (el cliente del navegador también lee cookies, así que las páginas siguen
// funcionando igual).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const tokenHash = sp.get('token_hash')
  const type = sp.get('type')
  const next = safeNextPath(sp.get('next'))

  const fail = (motivo: string) => {
    // Mismo formato de error que manda Supabase, para que las pantallas lo lean
    // con readAuthLinkError y muestren el mensaje correcto.
    const url = new URL(next, req.nextUrl.origin)
    url.hash = `error=access_denied&error_code=${motivo}`
    return NextResponse.redirect(url)
  }

  if (!tokenHash || (type !== 'recovery' && type !== 'invite' && type !== 'email')) {
    return fail('invalid_request')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as 'recovery' | 'invite' | 'email',
  })
  if (error) {
    // El caso normal acá es un enlace ya usado o vencido.
    return fail(error.code === 'otp_expired' ? 'otp_expired' : 'invalid_request')
  }

  return NextResponse.redirect(new URL(next, req.nextUrl.origin))
}
