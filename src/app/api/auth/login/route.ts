import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, clientIp } from '@/lib/rate-limit'

const GENERIC_ERROR = 'Correo o cédula o contraseña incorrectos.'
const RATE_LIMIT_ERROR = 'Demasiados intentos. Esperá un momento y volvé a intentar.'

function isEmail(value: string): boolean {
  return value.includes('@')
}

function normalizeCedula(value: string): string {
  return value.replace(/[-\s]/g, '')
}

/** Resuelve el correo a partir de una cédula. Usa service role para esquivar RLS. */
async function emailFromCedula(cedula: string): Promise<string | null> {
  const admin = createAdminClient()
  const normalized = normalizeCedula(cedula)
  if (!normalized) return null

  // Lookup indexado sobre la columna generada (migración 039).
  const { data, error } = await admin
    .from('members')
    .select('email')
    .eq('cedula_normalized', normalized)
    .not('email', 'is', null)
    .limit(1)
    .maybeSingle()

  if (!error) return data?.email ?? null

  // Fallback si la migración 039 aún no está aplicada (columna inexistente):
  // match exacto sobre la cédula tal cual se escribió. Indexado también.
  console.warn('login: cedula_normalized no disponible, usando match exacto:', error.message)
  const exact = await admin
    .from('members')
    .select('email')
    .eq('cedula', cedula)
    .not('email', 'is', null)
    .limit(1)
    .maybeSingle()
  return exact.data?.email ?? null
}

export async function POST(req: NextRequest) {
  try {
    const { identifier, password } = await req.json()

    if (!identifier?.trim() || !password) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
    }

    const id = identifier.trim()

    // Rate limit: por IP (frena barridos) y por identificador (frena fuerza
    // bruta sobre una cuenta concreta aunque roten de IP).
    const ip = clientIp(req)
    const ipOk = rateLimit(`login:ip:${ip}`, 20, 60_000)
    const idOk = rateLimit(`login:id:${id.toLowerCase()}`, 5, 60_000)
    if (!ipOk || !idOk) {
      return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 })
    }

    const email = isEmail(id) ? id.toLowerCase() : await emailFromCedula(id)
    if (!email) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
    }

    // El cliente de server escribe las cookies de sesión en la respuesta.
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/auth/login:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
