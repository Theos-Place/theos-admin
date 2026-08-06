import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/auth/guard'
import { getFormById, updateForm, deleteForm, resolveDynamicOptions, hasFormAccessGrant } from '@/lib/supabase/queries/forms'
import { memberFormFillAccess } from '@/lib/supabase/queries/form-fill-access'
import { hasFormsModule } from '@/lib/auth/forms-scope'
import { notifyFormAssignedIfNeeded } from '@/lib/email/form-assigned-notify'
import { formToPartialWriteInput, formToFields } from '@/lib/forms/form-mapper'
import { requireFormEdit } from '@/lib/auth/event-guard'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Decisión documentada (FEA-1): la lectura de UN formulario exige solo
    // sesión, porque los destinatarios del correo form_asignado son miembros
    // comunes y la página de llenado (/formularios/[id]/preview) carga el form
    // por acá. La definición del form no expone datos de terceros; el listado
    // (/api/forms), las respuestas y toda escritura siguen guardados por rol.
    const auth = await requireRoles()
    if (auth.res) return auth.res
    const { id } = await params
    const form = await getFormById(id)
    if (!form) return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    const resuelto = await resolveDynamicOptions(form)
    // ?fill_access=1 · la pantalla de llenado pregunta ANTES de mostrar las
    // preguntas si esta persona puede enviarlo, para no hacerle llenar 24 campos
    // y rechazarla al final. El guard de verdad sigue estando en el POST.
    if (_req.nextUrl.searchParams.get('fill_access') === '1') {
      const acceso = await memberFormFillAccess({
        formId: id,
        memberId: auth.ctx.memberId,
        isStaff: hasFormsModule(auth.ctx.roles) || await hasFormAccessGrant(id, auth.ctx.memberId),
      })
      return NextResponse.json({ ...resuelto, fill_access: acceso })
    }
    return NextResponse.json(resuelto)
  } catch (error) {
    console.error('GET /api/forms/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    // Editar la ESTRUCTURA: el módulo formularios o el ENCARGADO del evento al
    // que pertenece (FRM-1 B). El acceso puntual a un formulario suelto NO
    // alcanza: ese es de lectura.
    const { id } = await params
    const auth = await requireFormEdit(id)
    if (auth.res) return auth.res
  try {
    const body = await req.json()
    const fields = 'fields' in body ? formToFields(body) : undefined
    await updateForm(id, formToPartialWriteInput(body), fields)
    // FEA-1: correo form_asignado si la asignación es nueva (dedupe interno).
    // Best-effort: un fallo de correo no revierte el guardado.
    try { await notifyFormAssignedIfNeeded(id) } catch (e) { console.warn('form_asignado notify:', e) }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/forms/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    // Borrar SÍ queda con lista explícita: se lleva las respuestas por delante,
    // así que el rol 'forms' (view/create/edit/export) no lo tiene.
    const auth = await requireRoles('comunicaciones', 'direccion', 'encargado_staff')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    await deleteForm(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/forms/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
