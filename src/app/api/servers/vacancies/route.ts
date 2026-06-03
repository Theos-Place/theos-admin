import { NextRequest, NextResponse } from 'next/server'
import { getVacancies, createVacancy, type VacancyWriteInput } from '@/lib/supabase/queries/servers'

export async function GET() {
  try {
    return NextResponse.json(await getVacancies())
  } catch (error) {
    console.error('GET /api/servers/vacancies:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const vacancy = await createVacancy((await req.json()) as VacancyWriteInput)
    return NextResponse.json(vacancy, { status: 201 })
  } catch (error) {
    console.error('POST /api/servers/vacancies:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
