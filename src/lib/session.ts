// NOTA PRODUCCIÓN: migrar a cookies HttpOnly via Route Handler de Next.js
// antes del go-live. Ver: nextjs.org/docs/app/building-your-application/routing/route-handlers

export const SESSION_COOKIE = 'theos_session'

export function setSessionCookie(remember: boolean = false) {
  const maxAge = remember ? 30 * 24 * 60 * 60 : 24 * 60 * 60
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  document.cookie = `${SESSION_COOKIE}=true; path=/; max-age=${maxAge}; SameSite=Strict${secure}`
}

export function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Strict`
}
