import { NextResponse } from 'next/server'
import { getUserAccess } from '@/lib/supabase/queries/members'

// GET: miembros con roles asignados (gestión de accesos).
export async function GET() {
  try {
    return NextResponse.json(await getUserAccess())
  } catch (error) {
    console.error('GET /api/accesos:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
