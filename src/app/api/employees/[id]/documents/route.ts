import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import {
  addEmployeeDocument, uploadEmployeeDocFile, type DocumentWriteInput,
} from '@/lib/supabase/queries/employees'
import type { DocumentType } from '@/types/employee'

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const DOC_TYPES = new Set<string>(['contrato', 'identificacion', 'seguro_social', 'otro'])

/** Detecta el tipo real por los primeros bytes (no confiamos en el MIME del
 *  browser ni en la extensión). Mismos formatos que acepta la UI. */
function sniffContentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'application/pdf' // %PDF
  }
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  return null
}

// POST: agrega un documento. Acepta multipart/form-data (file + doc_type + title)
// para subir el archivo al bucket privado, o JSON (sin archivo) como respaldo.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('direccion', 'encargado_staff')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file') as File | null
      const docType = (form.get('doc_type') as string | null) ?? 'otro'
      const title = (form.get('title') as string | null) || (file?.name ?? 'Documento')
      if (!file) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
      if (!DOC_TYPES.has(docType)) {
        return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'El archivo supera el límite de 10 MB' }, { status: 400 })
      }

      const bytes = await file.arrayBuffer()
      const realType = sniffContentType(new Uint8Array(bytes))
      if (!realType) {
        return NextResponse.json({ error: 'Solo se aceptan PDF, JPG o PNG' }, { status: 400 })
      }

      const path = await uploadEmployeeDocFile(id, file.name, bytes, realType, Date.now())
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
