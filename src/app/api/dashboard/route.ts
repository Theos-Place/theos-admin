import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/supabase/queries/dashboard'

export async function GET() {
  try {
    return NextResponse.json(await getDashboardStats())
  } catch (error) {
    console.error('GET /api/dashboard:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
