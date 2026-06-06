import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Rutas accesibles sin sesión.
const PUBLIC_PREFIXES = ['/login', '/recuperar', '/calendario', '/completar-perfil']

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Sin sesión en ruta protegida → al login.
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach(c => redirect.cookies.set(c))
    return redirect
  }

  // Con sesión intentando entrar al login o a la raíz → al dashboard.
  if (user && (pathname === '/login' || pathname === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    const redirect = NextResponse.redirect(url)
    response.cookies.getAll().forEach(c => redirect.cookies.set(c))
    return redirect
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|jpg|jpeg|gif|ico|webp|woff|woff2|otf|ttf)$).*)',
  ],
}
