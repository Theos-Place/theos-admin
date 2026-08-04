import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, resolveTargetMemberId } from '@/lib/auth/guard'
import { STUDY_ADMIN_ROLES } from '@/lib/auth/roles'
import { enrollMember, withdrawMember, setEnrollmentGrade } from '@/lib/supabase/queries/studies'
import { notifyEnrollment } from '@/lib/email/enrollment-notify'
import { createAutoFolletoIfNeeded } from '@/lib/supabase/queries/folletos'
import { ymdCR } from '@/lib/format'
import { scholarshipErrorResponse } from '@/lib/supabase/queries/scholarships'
import { groupFullMessage } from '@/lib/studies/enrollment-capacity'

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
    const { member_id, scholarship_id, coupon_code, override_pago_pendiente } = await req.json()
    const targetMemberId = resolveTargetMemberId(auth.ctx, member_id, STUDY_ADMIN_ROLES)
    if (!targetMemberId) return NextResponse.json({ error: 'No se pudo determinar el miembro.' }, { status: 400 })
    // GRU-1: la ventana de matrícula aplica al autoservicio; el staff con
    // STUDY_ADMIN_ROLES puede matricular fuera de la ventana.
    const isStaff = auth.ctx.roles.some(r => (STUDY_ADMIN_ROLES as readonly string[]).includes(r) || r === 'admin')
    const result = await enrollMember(id, targetMemberId, { scholarship_id, coupon_code }, {
      enforceEnrollmentWindow: !isStaff,
      // PAG-2: el bloqueo por pago de estudios pendiente aplica a TODOS; el
      // staff puede saltarlo solo con el override EXPLÍCITO del body (la UI
      // se lo confirma — nunca silencioso).
      allowPendingStudyPayments: isStaff && override_pago_pendiente === true,
    })
    // Correos de matrícula (estudiante + dirigentes). Best-effort, no bloquea.
    await notifyEnrollment(id, targetMemberId)
    // FOL-1: si esta matrícula llenó el cupo, genera el tiquete de folletos
    // (idempotente vía índice único; best-effort: no revierte la matrícula).
    // Desde 2026-08-04 toda matrícula cuenta acá: antes, las que tenían costo
    // quedaban 'pendiente_de_pago' y no disparaban la regla hasta que alguien
    // aprobara el comprobante — el folleto salía tarde.
    try { await createAutoFolletoIfNeeded(id, 'cupo_lleno', ymdCR()) } catch (e) { console.warn('folleto cupo_lleno:', e) }
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'YA_COMPLETADO') {
      return NextResponse.json(
        { error: 'El miembro ya completó este estudio en este grupo.' },
        { status: 409 },
      )
    }
    if (error instanceof Error && error.message.startsWith('CUPO_LLENO')) {
      const max = Number(error.message.split(':')[1] || 0)
      return NextResponse.json(
        { error: groupFullMessage(max), code: 'cupo_lleno' },
        { status: 409 },
      )
    }
    // A3: deuda del MISMO plan (se retiró debiendo la matrícula y vuelve).
    if (error instanceof Error && error.message === 'PAGO_PENDIENTE') {
      return NextResponse.json(
        { error: 'El miembro tiene el pago de este mismo estudio sin resolver; hay que completarlo antes de volver a matricularlo.' },
        { status: 409 },
      )
    }
    if (error instanceof Error && error.message === 'GRUPO_VIRTUAL_NO_AUTORIZADO') {
      return NextResponse.json(
        { error: 'Este grupo es virtual y el miembro no tiene autorización para estudios virtuales.' },
        { status: 403 },
      )
    }
    if (error instanceof Error && error.message.startsWith('PAGO_ESTUDIOS_PENDIENTE:')) {
      const count = Number(error.message.split(':')[1] || 1)
      return NextResponse.json(
        {
          error: `El miembro tiene ${count} pago${count !== 1 ? 's' : ''} de estudios pendiente${count !== 1 ? 's' : ''}; debe completarlo${count !== 1 ? 's' : ''} antes de matricular otro estudio.`,
          code: 'pago_pendiente',
          count,
        },
        { status: 409 },
      )
    }
    if (error instanceof Error && error.message === 'MATRICULA_CERRADA') {
      return NextResponse.json(
        { error: 'El período de matrícula de este grupo no está abierto.', code: 'matricula_cerrada' },
        { status: 409 },
      )
    }
    if (error instanceof Error && error.message === 'CEDULA_REQUERIDA') {
      return NextResponse.json(
        { error: 'Este curso requiere el documento de identidad registrado. Completalo en tu perfil para poder inscribirte.', code: 'cedula_requerida' },
        { status: 409 },
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
