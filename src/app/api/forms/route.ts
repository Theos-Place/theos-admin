import { NextRequest, NextResponse } from 'next/server'
import { requireModuleView, getAuthContext } from '@/lib/auth/guard'
import { getForms, createForm, getGrantedFormIds } from '@/lib/supabase/queries/forms'
import { hasFormsModule } from '@/lib/auth/forms-scope'
import { formToWriteInput, formToFields } from '@/lib/forms/form-mapper'
import { notifyFormAssignedIfNeeded } from '@/lib/email/form-assigned-notify'

export async function GET() {
  try {
    // Con el módulo, TODOS los formularios. Sin el módulo, quien tenga accesos
    // puntuales (form_access_grants) recibe SOLO esos — el resto, 403.
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const forms = await getForms()
    if (hasFormsModule(ctx.roles)) return NextResponse.json(forms)
    const granted = new Set(await getGrantedFormIds(ctx.memberId))
    if (granted.size === 0) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    return NextResponse.json(forms.filter(f => granted.has(f.id)))
  } catch (error) {
    console.error('GET /api/forms:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    // Crear exige el permiso de CREAR del módulo formularios — la misma fuente
    // de verdad que el listado (antes era una lista de roles a mano que no
    // coincidía con quién veía el módulo).
    const auth = await requireModuleView('formularios', { action: 'create' })
    if (auth.res) return auth.res
    const body = await req.json()
    const form = await createForm(formToWriteInput(body), formToFields(body))
    // FEA-1: correo form_asignado si nace activo y asignado (dedupe interno).
    try { await notifyFormAssignedIfNeeded(form.id) } catch (e) { console.warn('form_asignado notify:', e) }
    return NextResponse.json(form, { status: 201 })
  } catch (error) {
    console.error('POST /api/forms:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
