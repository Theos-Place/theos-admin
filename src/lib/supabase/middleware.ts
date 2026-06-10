import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refresca la sesión de Supabase en cada request y devuelve el usuario actual.
 * Patrón oficial de @supabase/ssr para Next.js: NO meter lógica entre
 * createServerClient y getUser(), o la sesión se puede perder.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ¿El usuario tiene un segundo factor (TOTP) pendiente de verificar?
  // getAuthenticatorAssuranceLevel lee currentLevel del JWT y nextLevel de los
  // factores ya presentes en la sesión local — no hace round-trip de red.
  let needsMfa = false
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    needsMfa = aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2'
  }

  return { response, user, needsMfa }
}
