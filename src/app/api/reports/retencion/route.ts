import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getRetencionReport } from '@/lib/supabase/queries/reports'

// GET: reporte de Retención y Transición en Grupos. Permiso de módulo 'reportes'.
export async function GET() {
  try {
    const auth = await requireModuleView('reportes')
    if (auth.res) return auth.res
    return NextResponse.json(await getRetencionReport())
  } catch (error) {
    console.error('GET /api/reports/retencion:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
