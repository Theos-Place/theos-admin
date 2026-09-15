import { NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getSystemEmailStats } from '@/lib/supabase/queries/communications'

// GET: el aporte de los correos automáticos al resumen del mes. Va aparte del
// listado paginado de /system-emails porque no es una página de esa lista: son
// cuatro conteos del mes entero, y la pantalla los pide aunque el usuario nunca
// abra la pestaña "Del sistema".
export async function GET() {
  const auth = await requireRoles('comunicaciones', 'direccion')
  if (auth.res) return auth.res
  try {
    return NextResponse.json(await getSystemEmailStats())
  } catch (error) {
    console.error('GET /api/communications/summary:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
