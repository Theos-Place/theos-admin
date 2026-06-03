import { NextRequest, NextResponse } from 'next/server'
import { getForms, createForm } from '@/lib/supabase/queries/forms'
import { formToWriteInput, formToFields } from '@/lib/forms/form-mapper'

export async function GET() {
  try {
    return NextResponse.json(await getForms())
  } catch (error) {
    console.error('GET /api/forms:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const form = await createForm(formToWriteInput(body), formToFields(body))
    return NextResponse.json(form, { status: 201 })
  } catch (error) {
    console.error('POST /api/forms:', error)
    const detail = error instanceof Error ? { message: error.message } : error
    return NextResponse.json({ error: 'Error interno', detail }, { status: 500 })
  }
}
