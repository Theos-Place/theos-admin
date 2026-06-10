import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getForms, createForm } from '@/lib/supabase/queries/forms'
import { formToWriteInput, formToFields } from '@/lib/forms/form-mapper'

export async function GET() {
  try {
  const auth = await requireRoles()
  if (auth.res) return auth.res
    return NextResponse.json(await getForms())
  } catch (error) {
    console.error('GET /api/forms:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const form = await createForm(formToWriteInput(body), formToFields(body))
    return NextResponse.json(form, { status: 201 })
  } catch (error) {
    console.error('POST /api/forms:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
