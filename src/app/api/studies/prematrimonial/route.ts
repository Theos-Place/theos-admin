import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, requireModuleView } from '@/lib/auth/guard'
import { isStudyGroupsOnly } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { PAYMENT_RECEIPTS_BUCKET } from '@/lib/supabase/queries/payments'
import {
  createPrematrimonialRequest, getPrematrimonialQueue, meetsPrematRequirement,
} from '@/lib/supabase/queries/prematrimonial'
import { PREMAT_REQUIREMENT_LABEL } from '@/lib/studies/premat-requirement'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { minCeremonyDate, ceremonyDateTooSoon, PREMAT_MIN_MONTHS } from '@/lib/studies/premat-dates'
import { PREMAT_EVAL_ROLES, needsFollowUp } from '@/lib/studies/premat-evaluation'
import { parsePrematBackground, redactSensitiveBackground } from '@/lib/studies/premat-background'
import { checkCoupleGender, SAME_GENDER_MESSAGE, missingGenderMessage } from '@/lib/studies/premat-gender'
import { todayCR, formatDate } from '@/lib/format'

const MAX_BYTES = 8 * 1024 * 1024

// GET: cola de solicitudes para la coordinación de estudios.
// SEC-1: beyondOwn — dirigente/miembro no ven la cola (datos de parejas).
export async function GET() {
  const auth = await requireModuleView('estudios', { beyondOwn: true })
  if (auth.res) return auth.res
  // El rol acotado de grupos tiene el módulo estudios solo para gestionar
  // grupos: la cola de solicitudes (incluida esta) no es suya.
  if (isStudyGroupsOnly(auth.ctx.roles)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  try {
    // PRE-8: la marca de SEGUIMIENTO (plan de acción != "listos") viaja como
    // flag para toda la cola; el plan concreto solo para PREMAT_EVAL_ROLES
    // (el contenido de la evaluación se lee aparte, con gate estrecho).
    const canSeeEval = auth.ctx.roles.some(r => (PREMAT_EVAL_ROLES as string[]).includes(r))
    const items = (await getPrematrimonialQueue()).map(raw => {
      const r = raw as Record<string, unknown> & { evaluation?: { action_plan: string } | { action_plan: string }[] | null }
      const ev = Array.isArray(r.evaluation) ? r.evaluation[0] : r.evaluation
      const plan = ev?.action_plan ?? null
      const rest = { ...r }
      delete rest.evaluation
      const safe = canSeeEval ? rest : redactSensitiveBackground(rest)
      return {
        ...safe,
        needs_follow_up: plan ? needsFollowUp(plan) : false,
        follow_up_plan: canSeeEval ? plan : null,
      }
    })
    return NextResponse.json({ items })
  } catch (error) {
    console.error('GET prematrimonial:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST (multipart): crea la solicitud + el pago por comprobante. Normalmente la
// inicia el miembro logueado (requester); cubre a la pareja. Un admin/direccion
// puede inscribir EN NOMBRE DE otro miembro (flujo "Ver disponibilidad como")
// pasando on_behalf_of — solo esos roles, validado server-side.
export async function POST(req: NextRequest) {
  const auth = await requireRoles()
  if (auth.res) return auth.res
  if (!auth.ctx.memberId) return NextResponse.json({ error: 'No se pudo determinar el miembro.' }, { status: 400 })
  if (!rateLimit(`premat:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Esperá un momento.' }, { status: 429 })
  }
  try {
    const form = await req.formData()
    const file = form.get('receipt')
    const referenceCode = (form.get('reference_code') as string | null)?.trim() || null
    const spouseMemberId = (form.get('spouse_member_id') as string | null)?.trim() || ''

    // Requester efectivo: el logueado, salvo que un admin/direccion inscriba a
    // otro (on_behalf_of). Cualquier otro rol que intente el override → 403.
    const onBehalfOf = (form.get('on_behalf_of') as string | null)?.trim() || ''
    const admin = createAdminClient()
    let requester = auth.ctx.memberId
    if (onBehalfOf && onBehalfOf !== auth.ctx.memberId) {
      const isPrivileged = auth.ctx.roles.includes('admin') || auth.ctx.roles.includes('direccion')
      if (!isPrivileged) return NextResponse.json({ error: 'No autorizado para inscribir a otro miembro.' }, { status: 403 })
      const { data: target } = await admin.from('members').select('id').eq('id', onBehalfOf).maybeSingle()
      if (!target) return NextResponse.json({ error: 'No se encontró el miembro a inscribir.' }, { status: 404 })
      requester = onBehalfOf
    }
    let logistica, ceremonia
    try {
      logistica = JSON.parse((form.get('logistica') as string) || '{}')
      ceremonia = JSON.parse((form.get('ceremonia') as string) || '{}')
    } catch {
      return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
    }

    // PRE-9: antecedentes de la pareja + diagnóstico (opciones cerradas
    // validadas server-side; los condicionales se exigen según la respuesta).
    let background = null
    try {
      const raw = form.get('background')
      if (typeof raw === 'string' && raw) {
        const parsed = parsePrematBackground(JSON.parse(raw))
        if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: 'antecedentes_invalidos' }, { status: 400 })
        background = parsed.value
      }
    } catch {
      return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
    }

    // Regla PRE-3: si la fecha de boda viene definida, debe ser al menos
    // hoy + 6 meses CALENDARIO (hora CR). El min del input del wizard es solo
    // UX; esta es la validación confiable.
    const ceremonyDate = typeof ceremonia.ceremony_date === 'string' ? ceremonia.ceremony_date : null
    if (ceremonia.ceremony_date_defined && ceremonyDate && ceremonyDateTooSoon(ceremonyDate, todayCR())) {
      const minima = formatDate(minCeremonyDate(todayCR()))
      return NextResponse.json(
        { error: `La boda debe ser al menos ${PREMAT_MIN_MONTHS} meses después de hoy (mínimo ${minima}): el curso son 10 sesiones y debe completarse antes de la ceremonia.`, code: 'boda_muy_pronto' },
        { status: 400 },
      )
    }

    // Requisito: quien se inscribe debe tener cédula (bloqueante para esta acción).
    const { data: me } = await admin.from('members').select('cedula').eq('id', requester).maybeSingle()
    if (!me?.cedula || !String(me.cedula).trim()) {
      return NextResponse.json({ error: 'El miembro debe tener el documento de identidad registrado antes de inscribirse.', code: 'cedula_requerida' }, { status: 409 })
    }

    // Cónyuge: debe existir y no ser el mismo que se inscribe.
    if (!spouseMemberId) return NextResponse.json({ error: 'Falta seleccionar a la pareja.' }, { status: 400 })
    if (spouseMemberId === requester) return NextResponse.json({ error: 'La pareja no puede ser el mismo miembro que se inscribe.' }, { status: 400 })

    // PRE-7: género de la pareja (server-side, confiable). Género faltante o
    // fuera de M/F pide completar el perfil; mismo género se trata como error
    // de selección/dato.
    const { data: genderRows } = await admin.from('members').select('id, gender').in('id', [requester, spouseMemberId])
    const genderById = new Map((genderRows ?? []).map(g => [(g as { id: string }).id, (g as { gender: string | null }).gender]))
    const genderCheck = checkCoupleGender(genderById.get(requester) ?? null, genderById.get(spouseMemberId) ?? null)
    if (!genderCheck.ok) {
      return NextResponse.json(
        genderCheck.code === 'mismo_genero'
          ? { error: SAME_GENDER_MESSAGE, code: 'mismo_genero' }
          : { error: missingGenderMessage(genderCheck.who), code: 'genero_faltante' },
        { status: 409 },
      )
    }

    // Requisito PRE-5 para AMBOS (server-side, sobre los member_id — confiable):
    // N1 completado + al menos inscrito en N2. El code se mantiene 'requisito_n2'
    // por compatibilidad con los consumidores.
    const [reqOk, spouseOk] = await Promise.all([meetsPrematRequirement(requester), meetsPrematRequirement(spouseMemberId)])
    if (!reqOk || !spouseOk) {
      const quien = !reqOk && !spouseOk ? 'Ninguno de los dos cumple' : !reqOk ? 'El miembro no cumple' : 'La pareja no cumple'
      return NextResponse.json({ error: `${quien} el requisito del curso prematrimonial (${PREMAT_REQUIREMENT_LABEL}).`, code: 'requisito_n2' }, { status: 409 })
    }

    // Comprobante (archivo obligatorio).
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Adjuntá el comprobante de pago.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'El comprobante supera los 8MB.' }, { status: 400 })
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `prematrimonial/${crypto.randomUUID()}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await admin.storage.from(PAYMENT_RECEIPTS_BUCKET)
      .upload(path, buf, { contentType: file.type || 'application/octet-stream', upsert: false })
    if (upErr) throw upErr

    const result = await createPrematrimonialRequest({
      requesterMemberId: requester,
      spouseMemberId,
      logistica: {
        available_days: Array.isArray(logistica.available_days) ? logistica.available_days : [],
        available_times: Array.isArray(logistica.available_times) ? logistica.available_times : [],
        zones: Array.isArray(logistica.zones) ? logistica.zones : [],
        can_host: !!logistica.can_host,
        host_address: logistica.host_address ?? null,
        host_maps_url: logistica.host_maps_url ?? null,
      },
      background,
      ceremonia: {
        ceremony_date: ceremonia.ceremony_date || null,
        ceremony_date_defined: !!ceremonia.ceremony_date_defined,
        venue_defined: !!ceremonia.venue_defined,
        venue_outside_gam: !!ceremonia.venue_outside_gam,
        officiant: ceremonia.officiant ?? null,
        comments: ceremonia.comments ?? null,
      },
      receiptPath: path,
      referenceCode,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'SOLICITUD_ACTIVA_EXISTE') {
      return NextResponse.json({ error: 'Ya tenés una solicitud de prematrimonial en curso con esta pareja.', code: 'duplicada' }, { status: 409 })
    }
    console.error('POST prematrimonial:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
