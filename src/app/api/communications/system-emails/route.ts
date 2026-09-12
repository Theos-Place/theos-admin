import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getSystemEmails } from '@/lib/supabase/queries/communications'
import { FILTROS_CORREO, type FiltroCorreo } from '@/lib/communications/correos-del-sistema'

// GET: los correos que manda el SISTEMA solo (avisos automáticos), paginados.
// Guard igual que el resto del módulo. No es solo curiosidad: acá se contesta
// "¿le llegó el correo?" sin deducirlo.
export async function GET(req: NextRequest) {
  const auth = await requireRoles('comunicaciones', 'direccion')
  if (auth.res) return auth.res
  try {
    const sp = req.nextUrl.searchParams
    const pedido = sp.get('filtro') ?? 'todos'
    const filtro: FiltroCorreo = FILTROS_CORREO.some(f => f.id === pedido) || pedido === 'sent' || pedido === 'bounced' || pedido === 'failed' || pedido === 'pending'
      ? (pedido as FiltroCorreo)
      : 'todos'
    return NextResponse.json(await getSystemEmails({
      page: Number(sp.get('page')) || 1,
      pageSize: Number(sp.get('pageSize')) || 50,
      filtro,
      q: sp.get('q') ?? '',
    }))
  } catch (error) {
    console.error('GET /api/communications/system-emails:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
