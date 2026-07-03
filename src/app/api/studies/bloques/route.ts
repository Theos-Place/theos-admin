import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getBloques, createBloque } from '@/lib/supabase/queries/bloques'

// Bloques de capacitación: solo coordinador de estudios y admin.
export async function GET() {
  const auth = await requireRoles('coordinador_estudios', 'admin')
  if (auth.res) return auth.res
  try {
    return NextResponse.json(await getBloques())
  } catch (error) {
    console.error('GET /api/studies/bloques:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles('coordinador_estudios', 'admin')
  if (auth.res) return auth.res
  try {
    const b = (await req.json()) as { nombre?: string; anio?: number; fecha_apertura?: string; fecha_cierre_matricula?: string }
    if (!b.nombre?.trim() || !b.anio || !b.fecha_apertura || !b.fecha_cierre_matricula) {
      return NextResponse.json({ error: 'Nombre, año y ambas fechas son obligatorios.' }, { status: 400 })
    }
    const { id } = await createBloque({
      nombre: b.nombre.trim(), anio: Number(b.anio),
      fecha_apertura: b.fecha_apertura, fecha_cierre_matricula: b.fecha_cierre_matricula,
    })
    return NextResponse.json({ id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/studies/bloques:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
