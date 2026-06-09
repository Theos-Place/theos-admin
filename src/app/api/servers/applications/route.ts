import { NextRequest, NextResponse } from 'next/server'
import { getApplications, createApplication } from '@/lib/supabase/queries/servers'

export async function GET() {
  try {
    return NextResponse.json(await getApplications())
  } catch (error) {
    console.error('GET /api/servers/applications:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await createApplication(await req.json())
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/applications:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
