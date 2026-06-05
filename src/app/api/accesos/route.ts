import { NextResponse } from 'next/server'
import { getUserAccess } from '@/lib/supabase/queries/members'

// GET: miembros con roles asignados (gestión de accesos).
export async function GET() {
  try {
    return NextResponse.json(await getUserAccess())
  } catch (error) {
    console.error('GET /api/accesos:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
