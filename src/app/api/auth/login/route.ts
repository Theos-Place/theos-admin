import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const GENERIC_ERROR = 'Correo o cédula o contraseña incorrectos.'

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

  // Match exacto primero; si no, comparación normalizada contra los que tienen correo.
  const exact = await admin
    .from('members')
    .select('email, cedula')
    .eq('cedula', cedula)
    .not('email', 'is', null)
    .limit(1)
    .maybeSingle()
  if (exact.data?.email) return exact.data.email

  const all = await admin
    .from('members')
    .select('email, cedula')
    .not('cedula', 'is', null)
    .not('email', 'is', null)
  const hit = all.data?.find(m => normalizeCedula(m.cedula as string) === normalized)
  return hit?.email ?? null
}

export async function POST(req: NextRequest) {
  try {
    const { identifier, password } = await req.json()

    if (!identifier?.trim() || !password) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
    }

    const id = identifier.trim()
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
