import { NextRequest, NextResponse } from 'next/server'
import { getEvents } from '@/lib/supabase/queries/events'
import type { EventType, EventStatus } from '@/types/event'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const search     = searchParams.get('search')     ?? undefined
    const event_type = searchParams.get('event_type') ?? undefined
    const status     = searchParams.get('status')     ?? undefined
    const is_active  = searchParams.get('is_active')
    const page       = Number(searchParams.get('page') ?? 1)
    const pageSize   = Number(searchParams.get('pageSize') ?? 100)

    const result = await getEvents({
      search,
      event_type: event_type as EventType | undefined,
      status:     status as EventStatus | undefined,
      is_active:  is_active !== null ? is_active === 'true' : true,
      page,
      pageSize,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/events:', error)
    const detail = error instanceof Error
      ? { message: error.message, ...(error as unknown as Record<string, unknown>) }
      : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
