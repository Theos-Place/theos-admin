import { NextResponse } from 'next/server'
import { requireModuleView } from '@/lib/auth/guard'
import { moduleScope } from '@/lib/auth/roles'
import { getCommittees, getManageableCommitteeIds } from '@/lib/supabase/queries/servers'

export async function GET() {
  try {
    const auth = await requireModuleView('servidores')
    if (auth.res) return auth.res
    const committees = await getCommittees()
    // SEC-1: lider_comite (alcance 'committee') recibía TODOS los comités con
    // los datos de contacto de sus servidores — se recorta a los que lidera
    // (directos o por área liderada, mismo criterio que canManageCommittee).
    if (moduleScope(auth.ctx.roles, 'servidores') === 'committee') {
      const ids = new Set(auth.ctx.memberId ? await getManageableCommitteeIds(auth.ctx.memberId) : [])
      return NextResponse.json(committees.filter(c => ids.has(c.id)))
    }
    return NextResponse.json(committees)
  } catch (error) {
    console.error('GET /api/servers/committees:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
