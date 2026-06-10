import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getEvents, createEvent } from '@/lib/supabase/queries/events'
import { formToWriteInput, formToSubEvents } from '@/lib/events/form-mapper'
import type { EventType, EventStatus } from '@/types/event'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRoles()
    if (auth.res) return auth.res
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
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const event = await createEvent(formToWriteInput(body), formToSubEvents(body))
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('POST /api/events:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
