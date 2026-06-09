import { NextRequest, NextResponse } from 'next/server'
import {
  addEmployeeDocument, uploadEmployeeDocFile, type DocumentWriteInput,
} from '@/lib/supabase/queries/employees'
import type { DocumentType } from '@/types/employee'

// POST: agrega un documento. Acepta multipart/form-data (file + doc_type + title)
// para subir el archivo al bucket privado, o JSON (sin archivo) como respaldo.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      const docType = (form.get('doc_type') as string | null) ?? 'otro'
      const title = (form.get('title') as string | null) || (file?.name ?? 'Documento')
      if (!file) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })

      const bytes = await file.arrayBuffer()
      const path = await uploadEmployeeDocFile(id, file.name, bytes, file.type || 'application/octet-stream', Date.now())
      const doc = await addEmployeeDocument({
        employee_id: id, title, doc_type: docType as DocumentType, file_url: path,
      })
      return NextResponse.json(doc, { status: 201 })
    }

    const body = (await req.json()) as Omit<DocumentWriteInput, 'employee_id'>
    const doc = await addEmployeeDocument({ ...body, employee_id: id })
    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    console.error('POST /api/employees/[id]/documents:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
