import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Rutas accesibles sin sesión.
const PUBLIC_PREFIXES = ['/login', '/recuperar', '/calendario', '/completar-perfil']

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// Ruta de step-up donde el usuario completa el segundo factor (TOTP).
const MFA_PATH = '/verificacion'

function redirectTo(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  const redirect = NextResponse.redirect(url)
  response.cookies.getAll().forEach(c => redirect.cookies.set(c))
  return redirect
}

export async function proxy(request: NextRequest) {
  const { response, user, needsMfa } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Sin sesión en ruta protegida → al login.
  if (!user && !isPublic(pathname)) {
    return redirectTo(request, response, '/login')
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
    if (!needsMfa && (pathname === '/login' || pathname === '/')) {
      return redirectTo(request, response, '/dashboard')
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|jpg|jpeg|gif|ico|webp|woff|woff2|otf|ttf)$).*)',
  ],
}
