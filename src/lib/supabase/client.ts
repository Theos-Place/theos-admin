import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      // Opt-in experimental: passkeys (Supabase beta, mayo 2026).
      // Solo activa la API auth.signInWithPasskey/registerPasskey/passkey.*;
      // no rompe nada en navegadores sin WebAuthn — esos flujos se ocultan/
      // manejan en la UI. El login con email/password queda intacto.
      auth: { experimental: { passkey: true } },
    }
  )
}