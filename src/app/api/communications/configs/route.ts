import { NextResponse } from 'next/server'
import { getChannelConfigs } from '@/lib/supabase/queries/communications'

export async function GET() {
  try {
    return NextResponse.json(await getChannelConfigs())
  } catch (error) {
    console.error('GET /api/communications/configs:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
