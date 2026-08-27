import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { buildCsp, newNonce } from '@/lib/csp'
import { loginUrlWithDest, safeDest } from '@/lib/auth/redirect-target'

// Rutas accesibles sin sesión.
// '/ayuda' es público a propósito: los correos de invitación linkean ahí y el
// tutorial de "crear mi contraseña" se lee ANTES de poder entrar. El contenido
// interno igual se filtra en el servidor por rol (src/lib/help/loader.ts).
// '/auth/confirm' canjea el token del correo: por definición se abre SIN sesión
// (es lo que la crea). Sin esto el proxy lo mandaba al login y el enlace del
// correo nunca funcionaba.
const PUBLIC_PREFIXES = ['/login', '/recuperar', '/calendario', '/completar-perfil', '/terminos', '/vacantes', '/ayuda', '/auth/confirm', '/auth/continuar']

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// Ruta de step-up donde el usuario completa el segundo factor (TOTP).
const MFA_PATH = '/verificacion'

/** Redirige limpiando el query. `search` permite colgar uno propio (el
 *  ?redirect= del login); sin él la URL queda pelada, que es lo que quieren los
 *  otros casos (MFA, login con sesión, raíz → dashboard). */
function redirectTo(request: NextRequest, response: NextResponse, pathname: string, search = '') {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = search
  const redirect = NextResponse.redirect(url)
  response.cookies.getAll().forEach(c => redirect.cookies.set(c))
  return redirect
}

export async function proxy(request: NextRequest) {
  // CSP con nonce por request (B17): se setea en los headers del REQUEST antes
  // de updateSession — su NextResponse.next({ request }) los propaga al SSR,
  // donde Next lee el nonce y lo estampa en sus scripts. La misma política va
  // también en el response para que el browser la aplique.
  const nonce = newNonce()
  const csp = buildCsp(nonce)
  request.headers.set('content-security-policy', csp)
  request.headers.set('x-nonce', nonce)

  const { response, user, needsMfa } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Sin sesión en ruta protegida → al login, GUARDANDO a dónde iba. Antes se
  // perdía y todo el mundo aterrizaba en el dashboard: los deep links de las
  // notificaciones y de los correos llegaban a ningún lado.
  //
  // Va el pathname Y el search: `/mis-pagos?pago=<id>` sin el search abre la
  // página pero no el pago.
  if (!user && !isPublic(pathname)) {
    const destino = loginUrlWithDest(pathname, request.nextUrl.search)
    const [ruta, query = ''] = destino.split('?')
    return redirectTo(request, response, ruta, query ? `?${query}` : '')
  }

  if (user) {
    // Segundo factor pendiente (sesión aal1 con TOTP) → forzar verificación.
    if (needsMfa && pathname !== MFA_PATH) {
      return redirectTo(request, response, MFA_PATH)
    }

    // Ya verificado (o sin MFA) no tiene nada que hacer en la pantalla de step-up.
    if (!needsMfa && pathname === MFA_PATH) {
      return redirectTo(request, response, '/dashboard')
    }

    // Con sesión completa intentando entrar al login o a la raíz → al dashboard.
    //
    // PERO si el login trae un ?redirect= válido, se HONRA en vez de botarlo.
    // Antes esta rama redirigía con search='' siempre, así que a quien YA tenía
    // sesión y abría un deep link con login-gate (el link público de un evento,
    // los enlaces de las notificaciones) lo soltaba en el dashboard y el destino
    // se perdía sin dejar rastro: la pantalla no abría nada ni decía nada.
    // Reproducido el 2026-08-27 con el link de inscripción a un evento.
    if (!needsMfa && (pathname === '/login' || pathname === '/')) {
      const pedido = pathname === '/login' ? request.nextUrl.searchParams.get('redirect') : null
      const destino = safeDest(pedido, '/dashboard')
      const [ruta, query] = destino.split('?')
      return redirectTo(request, response, ruta, query ? `?${query}` : '')
    }
  }

  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|jpg|jpeg|gif|ico|webp|woff|woff2|otf|ttf)$).*)',
  ],
}
