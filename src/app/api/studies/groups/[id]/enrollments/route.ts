import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, resolveTargetMemberId } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { enrollMember, withdrawMember, setEnrollmentGrade } from '@/lib/supabase/queries/studies'
import { notifyEnrollment } from '@/lib/email/enrollment-notify'
import { scholarshipErrorResponse } from '@/lib/supabase/queries/scholarships'

// POST: inscribe un miembro. Body: { member_id, scholarship_id?, coupon_code? }.
// Autoservicio real: cualquier autenticado puede matricularse a sí mismo; el
// staff (STUDY_ADMIN_ROLES) puede matricular a otro pasando su member_id
// (anti-suplantación vía resolveTargetMemberId).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles() // solo exige sesión; quién matricula A OTROS se resuelve abajo
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const { member_id, scholarship_id, coupon_code } = await req.json()
    const targetMemberId = resolveTargetMemberId(auth.ctx, member_id, STUDY_ADMIN_ROLES)
    if (!targetMemberId) return NextResponse.json({ error: 'No se pudo determinar el miembro.' }, { status: 400 })
    const result = await enrollMember(id, targetMemberId, { scholarship_id, coupon_code })
    // Correos de matrícula (estudiante + dirigentes). Best-effort, no bloquea.
    await notifyEnrollment(id, targetMemberId, result.status)
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'YA_COMPLETADO') {
      return NextResponse.json(
        { error: 'El miembro ya completó este estudio en este grupo.' },
        { status: 409 },
      )
    }
    if (error instanceof Error && error.message === 'PAGO_PENDIENTE') {
      return NextResponse.json(
        { error: 'El miembro ya tiene una matrícula pendiente de pago para este estudio; debe subir el comprobante para activarla.' },
        { status: 409 },
      )
    }
    if (error instanceof Error && error.message === 'GRUPO_VIRTUAL_NO_AUTORIZADO') {
      return NextResponse.json(
        { error: 'Este grupo es virtual y el miembro no tiene autorización para estudios virtuales.' },
        { status: 403 },
      )
    }
    const scholarshipRes = scholarshipErrorResponse(error)
    if (scholarshipRes) return scholarshipRes
    console.error('POST enrollments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// PATCH: actualiza nota. Body: { member_id, grade }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    const auth = await requireRoles('coordinador_estudios', 'coordinador_dirigentes', 'direccion')
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const { member_id, grade } = await req.json()
    await setEnrollmentGrade(id, member_id, Number(grade))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH enrollments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE: retira un miembro. Body: { member_id, reason? }
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
    // Simétrico con el POST (Fase 3a): cualquier autenticado puede retirar su
    // PROPIA matrícula (p. ej. cancelar el alta con costo si no completa el
    // pago); el staff (STUDY_ADMIN_ROLES) puede retirar a otro pasando su
    // member_id. resolveTargetMemberId corta la suplantación. withdrawMember
    // ya protege 'completed' (NO_RETIRABLE) y cancela el pago pendiente.
    const auth = await requireRoles()
    if (auth.res) return auth.res
  try {
    const { id } = await params
    const { member_id, reason } = await req.json()
    const targetMemberId = resolveTargetMemberId(auth.ctx, member_id, STUDY_ADMIN_ROLES)
    if (!targetMemberId) return NextResponse.json({ error: 'No se pudo determinar el miembro.' }, { status: 400 })
    await withdrawMember(id, targetMemberId, reason)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_RETIRABLE') {
      return NextResponse.json(
        { error: 'La inscripción ya no está activa (completada o ya retirada); refrescá la página.' },
        { status: 409 },
      )
    }
    console.error('DELETE enrollments:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
