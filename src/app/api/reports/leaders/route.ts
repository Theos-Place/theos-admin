import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { getDirigentesReport } from '@/lib/supabase/queries/reports'
import { canSeeLeaderAdminStatus } from '@/lib/studies/leader-admin-status'

// GET: reporte de dirigentes (DIR-7). Permiso de módulo 'reportes' como el resto.
//
// El desglose de "en pausa" y "en revisión" es lo único acotado: solo viaja para
// coordinador_dirigentes/coordinador_estudios/admin (DIR-6). Para el resto los
// dos se suman a inactivos ANTES de serializar — el número no sale del servidor.
export async function GET() {
  try {
    const auth = await requireModuleView('reportes')
    if (auth.res) return auth.res
    const verMatiz = canSeeLeaderAdminStatus(auth.ctx.roles)
    return NextResponse.json({ ...(await getDirigentesReport(verMatiz)), ver_matiz: verMatiz })
  } catch (error) {
    console.error('GET /api/reports/leaders:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
