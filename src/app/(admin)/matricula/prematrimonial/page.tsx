'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Heart, Search, Check, IdCard, ArrowLeft, ArrowRight, Loader2, AlertCircle, Upload, UserCog } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL, isValidDocument, documentFormatMessage, type DocumentType } from '@/lib/cedula'
import {
  DATING_TIME_QUESTION, DATING_TIME_OPTIONS, FIRST_MARRIAGE_QUESTION, PREVIOUS_MARRIAGE_LABEL,
  CHILDREN_QUESTION, CHILDREN_AGES_LABEL, LIVING_QUESTION, LIVING_OPTIONS,
  CEREMONY_DATE_QUESTION, DIAGNOSTIC_QUESTION, parsePrematBackground,
} from '@/lib/studies/premat-background'
import { useAuth } from '@/hooks/useAuth'
import { minCeremonyDate } from '@/lib/studies/premat-dates'
import { PREMAT_REQUIREMENT_LABEL } from '@/lib/studies/premat-requirement'
import { toYmdLocal } from '@/lib/format'
import { ScholarshipRequestModal } from '@/components/finance/ScholarshipRequestModal'
import { PageContainer } from '@/components/layout/PageContainer'

type Enrollee = { member_id: string; name: string; email: string | null; has_cedula: boolean; meets_requirement: boolean }

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
const TIMES = ['Tarde', 'Noche']
// Lista fija a propósito (PRE-2, decisión 2026-07-25): NO conectar al catálogo
// de sedes. Registros viejos con zonas fuera de la lista se muestran tal cual
// en la cola (PrematrimonialQueue hace join de lo guardado).
const ZONES = ['Este de San José', 'Oeste de San José', 'Alajuela', 'Cartago', 'Liberia', 'Heredia']

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[13px] font-body border transition-colors ${active ? 'bg-teal text-white border-teal' : 'bg-white text-navy border-navy/15 hover:border-navy/30'}`}>
      {children}
    </button>
  )
}

export default function PrematrimonialWizardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loaded } = useAuth()
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')

  // Modo admin "en nombre de": llega ?member_id de "Ver disponibilidad como".
  // Solo aplica si el usuario es admin/direccion y el id es de OTRO miembro.
  const requestedMemberId = searchParams.get('member_id')?.trim() || ''
  const isPrivileged = (user?.roles ?? []).some(r => r === 'admin' || r === 'direccion')
  const onBehalf = !!requestedMemberId && requestedMemberId !== user?.member_id && isPrivileged
  const [enrollee, setEnrollee] = useState<Enrollee | null>(null)
  const [enrolleeError, setEnrolleeError] = useState('')
  // PRE-5: requisito del propio usuario en autoservicio (null = cargando; el
  // gate no bloquea mientras carga — el POST re-valida server-side igual).
  // PRE-6: el mismo fetch trae premat_plan_id para la solicitud de beca, así
  // que corre para el miembro EFECTIVO (self u onBehalf, el staff tiene permiso).
  const [selfPrematOk, setSelfPrematOk] = useState<boolean | null>(null)
  const [prematPlanId, setPrematPlanId] = useState<string | null>(null)
  const effectiveMemberId = onBehalf ? requestedMemberId : (user?.member_id ?? '')
  useEffect(() => {
    if (!effectiveMemberId) return
    let alive = true
    fetch(`/api/matricula/eligibility?member_id=${effectiveMemberId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d) return
        if (!onBehalf) setSelfPrematOk(!!d.premat_ok)
        setPrematPlanId(d.premat_plan_id ?? null)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [onBehalf, effectiveMemberId])
  // PRE-6: modal de solicitud de beca (mismo flujo que la matrícula normal).
  const [scholarshipOpen, setScholarshipOpen] = useState(false)

  useEffect(() => {
    if (!onBehalf) return
    let alive = true
    fetch(`/api/studies/prematrimonial/enrollee?member_id=${encodeURIComponent(requestedMemberId)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('No se pudo cargar el miembro.')))
      .then((d: Enrollee) => { if (alive) setEnrollee(d) })
      .catch(() => { if (alive) setEnrolleeError('No se pudo cargar el miembro a inscribir.') })
    return () => { alive = false }
  }, [onBehalf, requestedMemberId])

  // PRE-7: captura inline del documento cuando el inscrito no tiene cédula.
  const [docType, setDocType] = useState<DocumentType>('cedula')
  const [docNumber, setDocNumber] = useState('')
  const [docSaving, setDocSaving] = useState(false)
  const [docSaved, setDocSaved] = useState(false)
  const [docError, setDocError] = useState('')
  async function saveDocument() {
    if (docSaving) return
    if (!isValidDocument(docType, docNumber)) { setDocError(documentFormatMessage(docType)); return }
    setDocError(''); setDocSaving(true)
    try {
      const targetId = onBehalf ? requestedMemberId : user?.member_id
      const res = await fetch(`/api/members/${targetId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_type: docType, cedula: docNumber.trim() }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'No se pudo guardar el documento.')
      setDocSaved(true)
    } catch (e) {
      setDocError(e instanceof Error ? e.message : 'No se pudo guardar el documento.')
    } finally { setDocSaving(false) }
  }

  // Paso 2 — pareja
  const [spouseQuery, setSpouseQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [spouse, setSpouse] = useState<{ id: string; name: string; meets_requirement: boolean; same_gender: boolean; gender_missing: 'requester' | 'spouse' | 'both' | null } | null>(null)
  const [spouseMsg, setSpouseMsg] = useState('')
  // Homónimos: cuando la búsqueda por nombre trae varios, se eligen de una lista.
  const [spouseMatches, setSpouseMatches] = useState<
    Array<{ spouse_member_id: string; name: string; meets_requirement: boolean }>
  >([])

  // Paso 3 — logística
  const [days, setDays] = useState<string[]>([])
  const [times, setTimes] = useState<string[]>([])
  const [zones, setZones] = useState<string[]>([])
  const [canHost, setCanHost] = useState(false)
  const [hostAddress, setHostAddress] = useState('')
  const [hostMaps, setHostMaps] = useState('')

  // Paso 4 — ceremonia. PRE-3: la boda debe ser mínimo hoy + 6 meses calendario;
  // el default arranca en ese mínimo (el server valida igual con code boda_muy_pronto).
  const minWeddingDate = minCeremonyDate(toYmdLocal(new Date()))
  const [ceremonyDate, setCeremonyDate] = useState(minWeddingDate)
  const [dateDefined, setDateDefined] = useState(false)
  // PRE-9: el lugar ya no se pregunta — las columnas venue_* quedan en la BD
  // (datos históricos) y las solicitudes nuevas las guardan en false.
  const venueDefined = false
  const venueOutsideGam = false
  // PRE-9: antecedentes de la pareja (paso 2) + diagnóstico (paso 4).
  const [datingTime, setDatingTime] = useState('')
  const [firstMarriage, setFirstMarriage] = useState<boolean | null>(null)
  const [prevMarriageNotes, setPrevMarriageNotes] = useState('')
  const [hasChildren, setHasChildren] = useState<boolean | null>(null)
  const [childrenAges, setChildrenAges] = useState('')
  const [living, setLiving] = useState('')
  const [diagnostic, setDiagnostic] = useState('')
  const [comments, setComments] = useState('')

  // Paso 5 — pago
  const [reference, setReference] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])

  // Nombre del que se inscribe: el miembro visto (onBehalf) o el usuario logueado.
  const enrolleeName = onBehalf ? (enrollee?.name ?? 'este miembro') : (user?.name ?? '')
  // En onBehalf esperamos a tener los datos del miembro para decidir la cédula
  // (mientras carga, no bloqueamos). Fuera de onBehalf, la del usuario.
  const hasCedula = onBehalf ? (enrollee?.has_cedula ?? true) : (user?.has_cedula ?? true)

  /** Busca por nombre/documento/correo/teléfono. Con `memberId` se pide una
   *  persona concreta: es lo que pasa al elegir de la lista de homónimos. */
  async function searchSpouse(memberId?: string) {
    setSpouseMsg(''); setSpouse(null); setSpouseMatches([]); setSearching(true)
    try {
      const res = await fetch('/api/studies/prematrimonial/spouse-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: spouseQuery.trim(),
          ...(memberId ? { spouse_member_id: memberId } : {}),
          ...(onBehalf ? { on_behalf_of: requestedMemberId } : {}),
        }),
      })
      const d = await res.json()
      if (d.found) setSpouse({ id: d.spouse_member_id, name: d.name, meets_requirement: d.meets_requirement, same_gender: !!d.same_gender, gender_missing: d.gender_missing ?? null })
      else if (Array.isArray(d.matches) && d.matches.length > 0) setSpouseMatches(d.matches)
      else setSpouseMsg(d.message || 'No encontrado.')
    } catch { setSpouseMsg('No se pudo buscar. Intentá de nuevo.') }
    finally { setSearching(false) }
  }

  // PRE-9: misma validación que el POST (fuente única) para el gate del paso 2.
  const backgroundError = (() => {
    const parsed = parsePrematBackground({
      dating_time: datingTime, first_marriage: firstMarriage,
      previous_marriage_notes: prevMarriageNotes, has_children: hasChildren,
      children_ages: childrenAges, living_arrangement: living,
      diagnostic_notes: diagnostic,
    })
    return parsed.ok ? null : parsed.error
  })()

  async function submit() {
    setError('')
    if (!spouse) { setError('Falta seleccionar a tu pareja.'); return }
    if (!file) { setError('Adjuntá el comprobante de pago.'); return }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('spouse_member_id', spouse.id)
      fd.set('reference_code', reference.trim())
      fd.set('logistica', JSON.stringify({ available_days: days, available_times: times, zones, can_host: canHost, host_address: hostAddress.trim() || null, host_maps_url: hostMaps.trim() || null }))
      fd.set('ceremonia', JSON.stringify({ ceremony_date: ceremonyDate || null, ceremony_date_defined: dateDefined, venue_defined: venueDefined, venue_outside_gam: venueOutsideGam, comments: comments.trim() || null }))
      fd.set('background', JSON.stringify({
        dating_time: datingTime, first_marriage: firstMarriage,
        previous_marriage_notes: prevMarriageNotes, has_children: hasChildren,
        children_ages: childrenAges, living_arrangement: living,
        diagnostic_notes: diagnostic,
      }))
      fd.set('receipt', file)
      if (onBehalf) fd.set('on_behalf_of', requestedMemberId)
      const res = await fetch('/api/studies/prematrimonial', { method: 'POST', body: fd })
      const d = await res.json().catch(() => null)
      if (!res.ok) { setError(d?.error || 'No se pudo enviar la inscripción.'); setSubmitting(false); return }
      router.push('/matricula?premat=ok')
    } catch { setError('No se pudo enviar. Intentá de nuevo.'); setSubmitting(false) }
  }

  if (onBehalf && enrolleeError) {
    return (
      <div className="page max-w-2xl mx-auto">
        <div className="rounded-2xl border border-coral/25 bg-coral/5 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 text-coral-deep" size={28} />
          <h2 className="text-lg font-bold text-navy font-display">No se pudo cargar el miembro</h2>
          <p className="mt-2 text-sm text-navy-light/70 font-body">{enrolleeError}</p>
          <Link href="/matricula" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm font-medium text-white">
            <ArrowLeft size={14} /> Volver a matrícula
          </Link>
        </div>
      </div>
    )
  }

  // Bloqueo por cédula (PRE-7: el documento se completa ACÁ MISMO — el PATCH
  // de members valida por tipo, normaliza y dedupea con 409 si pertenece a
  // otro miembro; permite self y staff del padrón).
  if (loaded && (!onBehalf || enrollee) && !hasCedula && !docSaved) {
    return (
      <div className="page max-w-2xl mx-auto">
        <div className="rounded-2xl border border-coral/25 bg-coral/5 p-6">
          <div className="text-center">
            <IdCard className="mx-auto mb-3 text-coral-deep" size={28} />
            <h2 className="text-lg font-bold text-navy font-display">{onBehalf ? `${enrolleeName} no tiene documento registrado` : 'Necesitás registrar tu documento de identidad'}</h2>
            <p className="mt-2 text-sm text-navy-light/70 font-body">
              {onBehalf
                ? 'Esta persona no tiene documento registrado. Ingresá su cédula o número de documento de identidad para continuar — queda guardado en su perfil.'
                : 'La inscripción al prematrimonial requiere tu documento de identidad. Ingresalo acá para continuar — queda guardado en tu perfil.'}
            </p>
          </div>
          <div className="mx-auto mt-4 max-w-sm space-y-3">
            <div>
              <label htmlFor="doc-type" className="block text-[12px] font-medium text-navy-light/70 font-body mb-1.5">Tipo de documento</label>
              <select id="doc-type" value={docType} onChange={e => setDocType(e.target.value as DocumentType)}
                className="w-full rounded-xl border border-navy/15 px-3 py-2.5 text-sm text-navy outline-none focus:border-navy/30 font-body bg-white">
                {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{DOCUMENT_TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="doc-number" className="block text-[12px] font-medium text-navy-light/70 font-body mb-1.5">Número de documento</label>
              <input id="doc-number" value={docNumber} onChange={e => setDocNumber(e.target.value)}
                className="w-full rounded-xl border border-navy/15 px-3 py-2.5 text-sm text-navy outline-none focus:border-navy/30 font-body" />
            </div>
            {docError && <p className="text-[13px] text-coral-deep font-body" role="alert">{docError}</p>}
            <button type="button" onClick={saveDocument} disabled={docSaving || !docNumber.trim()}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-coral px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 font-body">
              {docSaving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <><IdCard size={14} /> Guardar documento y continuar</>}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // PRE-5: bloqueo si el inscrito no cumple el requisito. En onBehalf viene del
  // endpoint enrollee; en autoservicio, de /api/matricula/eligibility (premat_ok).
  // El POST re-valida server-side de todas formas (409 requisito_n2).
  const meetsReq = onBehalf ? (enrollee?.meets_requirement ?? true) : (selfPrematOk ?? true)
  if (loaded && (!onBehalf || enrollee) && !meetsReq) {
    return (
      <div className="page max-w-2xl mx-auto">
        <div className="rounded-2xl border border-coral/25 bg-coral/5 p-6 text-center">
          <Heart className="mx-auto mb-3 text-coral-deep" size={28} />
          <h2 className="text-lg font-bold text-navy font-display">{onBehalf ? 'El miembro aún no cumple el requisito' : 'Aún no cumplís el requisito'}</h2>
          <p className="mt-2 text-sm text-navy-light/70 font-body">
            El curso prematrimonial requiere <strong>{PREMAT_REQUIREMENT_LABEL}</strong>{onBehalf ? ` — ${enrolleeName} todavía no lo cumple.` : '. Matriculate en Nivel 2 y volvé.'}
          </p>
          <Link href="/matricula" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm font-medium text-white">
            <ArrowRight size={14} /> Ir a matrícula
          </Link>
        </div>
      </div>
    )
  }

  return (
    <PageContainer width="form" className="page">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/15"><Heart size={20} className="text-teal-deep" /></div>
        <div>
          <h1 className="text-xl font-bold text-navy font-display">Inscripción al Curso Prematrimonial</h1>
          <p className="text-[13px] text-navy-light/70 font-body">Paso {step} de 3</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 ring-1 ring-navy/10">
        {/* PASO 1 — pareja (la confirmación de cédula ya la garantiza el gate
            previo, así que no hay una pantalla aparte para eso) */}
        {step === 1 && (
          <div className="space-y-3">
            {onBehalf && (
              <div className="flex items-start gap-2 rounded-xl border border-coral/25 bg-coral/5 px-3 py-2.5 text-[13px] text-navy font-body">
                <UserCog size={16} className="mt-0.5 shrink-0 text-coral-deep" />
                <span>Estás inscribiendo <strong>en nombre de {enrolleeName}</strong> (desde “Ver disponibilidad como”). La solicitud y el pago quedan a nombre de esta persona.</span>
              </div>
            )}
            <h2 className="font-semibold text-navy font-display">La pareja</h2>
            <p className="text-sm text-navy-light/70 font-body">El curso son <strong>10 sesiones</strong> y debe iniciar <strong>mínimo 6 meses antes</strong> de la boda. {onBehalf ? 'La pareja' : 'Tu pareja'} debe ser miembro con <strong>{PREMAT_REQUIREMENT_LABEL}</strong> — buscala por nombre, documento, correo o teléfono.</p>
            <div className="flex gap-2">
              <input value={spouseQuery} onChange={e => setSpouseQuery(e.target.value)} placeholder="Nombre, cédula, correo o teléfono"
                className="flex-1 rounded-xl border border-navy/15 px-3 py-2.5 text-sm text-navy outline-none focus:border-navy/30 font-body" />
              <button type="button" onClick={() => searchSpouse()} disabled={searching || !spouseQuery.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm text-white disabled:opacity-50 font-body">
                {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
              </button>
            </div>
            {spouseMatches.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[13px] text-navy-light/70 font-body">
                  Encontramos varias personas con ese nombre. Elegí a tu pareja:
                </p>
                {spouseMatches.map(m => (
                  <button
                    key={m.spouse_member_id}
                    type="button"
                    onClick={() => searchSpouse(m.spouse_member_id)}
                    className="w-full rounded-xl border border-navy/15 px-4 py-2.5 text-left text-sm text-navy hover:bg-surface-low transition-colors font-body"
                  >
                    {m.name}
                    {!m.meets_requirement && (
                      <span className="ml-2 text-[12px] text-coral-deep">· aún no cumple el requisito</span>
                    )}
                  </button>
                ))}
                <p className="text-[12px] text-navy-light/70 font-body">
                  ¿No está en la lista? Buscala por cédula o correo.
                </p>
              </div>
            )}
            {spouse && (
              <div className="rounded-xl border border-teal/25 bg-teal/5 px-4 py-3 text-sm font-body">
                <p className="text-navy inline-flex items-center gap-1.5"><Check size={15} className="text-teal-deep" /> Encontrado: <strong>{spouse.name}</strong></p>
                {!spouse.meets_requirement && <p className="mt-1 text-coral-deep text-[13px]">⚠ Tu pareja aún no cumple el requisito ({PREMAT_REQUIREMENT_LABEL}); no podrás inscribirte hasta que lo cumpla.</p>}
                {/* PRE-7: mismo género = probable error de selección o de dato. */}
                {spouse.same_gender && (
                  <p className="mt-1 text-coral-deep text-[13px]">⚠ La persona seleccionada tiene el mismo género registrado. Verificá que seleccionaste a la persona correcta; si el género en el perfil está incorrecto, contactá al equipo para corregirlo.</p>
                )}
                {spouse.gender_missing && (
                  <p className="mt-1 text-coral-deep text-[13px]">⚠ {spouse.gender_missing === 'both' ? 'A ambos perfiles les falta' : spouse.gender_missing === 'requester' ? (onBehalf ? 'Al perfil del miembro le falta' : 'A tu perfil le falta') : 'Al perfil de la pareja le falta'} el género registrado. Completá ese dato en el perfil antes de continuar.</p>
                )}
              </div>
            )}
            {spouseMsg && <p className="rounded-xl bg-coral/5 px-4 py-3 text-[13px] text-coral-deep font-body">{spouseMsg}</p>}
          </div>
        )}

        {/* PASO 2 — logística */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-navy font-display">Disponibilidad y logística</h2>
            <div><p className="mb-1.5 text-[13px] font-medium text-navy-light/70 font-body">Días disponibles</p>
              <div className="flex flex-wrap gap-2">{DAYS.map(d => <Chip key={d} active={days.includes(d)} onClick={() => toggle(days, setDays, d)}>{d}</Chip>)}</div></div>
            <div><p className="mb-1.5 text-[13px] font-medium text-navy-light/70 font-body">Horario</p>
              <div className="flex flex-wrap gap-2">{TIMES.map(t => <Chip key={t} active={times.includes(t)} onClick={() => toggle(times, setTimes, t)}>{t}</Chip>)}</div></div>
            <div><p className="mb-1.5 text-[13px] font-medium text-navy-light/70 font-body">Zonas donde pueden llevarlo <span className="text-navy-light/70">(Madrid = Virtual)</span></p>
              <div className="flex flex-wrap gap-2">{ZONES.map(z => <Chip key={z} active={zones.includes(z)} onClick={() => toggle(zones, setZones, z)}>{z}</Chip>)}</div></div>
            <label className="flex items-center gap-2 text-sm text-navy font-body"><input type="checkbox" checked={canHost} onChange={e => setCanHost(e.target.checked)} /> Podemos ofrecer nuestra casa para impartirlo</label>
            {canHost && (
              <div className="space-y-2 pl-6">
                <input value={hostAddress} onChange={e => setHostAddress(e.target.value)} placeholder="Dirección" className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm outline-none focus:border-navy/30 font-body" />
                <input value={hostMaps} onChange={e => setHostMaps(e.target.value)} placeholder="Link de Waze / Google Maps (opcional)" className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm outline-none focus:border-navy/30 font-body" />
              </div>
            )}
            {/* PRE-9: Antecedentes de la pareja */}
            <div className="mt-2 space-y-4 border-t border-navy/10 pt-4">
              <h3 className="font-semibold text-navy font-display">Antecedentes de la pareja</h3>
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-navy-light/70 font-body">{DATING_TIME_QUESTION} <span className="text-coral">*</span></p>
                <div className="flex flex-wrap gap-2">
                  {DATING_TIME_OPTIONS.map(o => (
                    <button key={o.value} type="button" aria-pressed={datingTime === o.value} onClick={() => setDatingTime(o.value)}
                      className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-body border transition-colors',
                        datingTime === o.value ? 'bg-teal text-white border-teal' : 'bg-white text-navy border-navy/15 hover:border-navy/30')}>{o.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-navy-light/70 font-body">{FIRST_MARRIAGE_QUESTION} <span className="text-coral">*</span></p>
                <div className="flex gap-2">
                  {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(o => (
                    <button key={o.l} type="button" aria-pressed={firstMarriage === o.v} onClick={() => setFirstMarriage(o.v)}
                      className={cn('rounded-full px-4 py-1.5 text-[13px] font-body border transition-colors',
                        firstMarriage === o.v ? 'bg-teal text-white border-teal' : 'bg-white text-navy border-navy/15 hover:border-navy/30')}>{o.l}</button>
                  ))}
                </div>
                {firstMarriage === false && (
                  <textarea value={prevMarriageNotes} onChange={e => setPrevMarriageNotes(e.target.value)} rows={2}
                    placeholder={PREVIOUS_MARRIAGE_LABEL} aria-label={PREVIOUS_MARRIAGE_LABEL}
                    className="mt-2 w-full rounded-xl border border-navy/15 px-3 py-2 text-sm outline-none focus:border-navy/30 font-body" />
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-navy-light/70 font-body">{CHILDREN_QUESTION} <span className="text-coral">*</span></p>
                <div className="flex gap-2">
                  {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(o => (
                    <button key={o.l} type="button" aria-pressed={hasChildren === o.v} onClick={() => setHasChildren(o.v)}
                      className={cn('rounded-full px-4 py-1.5 text-[13px] font-body border transition-colors',
                        hasChildren === o.v ? 'bg-teal text-white border-teal' : 'bg-white text-navy border-navy/15 hover:border-navy/30')}>{o.l}</button>
                  ))}
                </div>
                {hasChildren === true && (
                  <input value={childrenAges} onChange={e => setChildrenAges(e.target.value)}
                    placeholder={CHILDREN_AGES_LABEL} aria-label={CHILDREN_AGES_LABEL}
                    className="mt-2 w-full rounded-xl border border-navy/15 px-3 py-2 text-sm outline-none focus:border-navy/30 font-body" />
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-navy-light/70 font-body">{LIVING_QUESTION} <span className="text-coral">*</span></p>
                <div className="flex flex-wrap gap-2">
                  {LIVING_OPTIONS.map(o => (
                    <button key={o.value} type="button" aria-pressed={living === o.value} onClick={() => setLiving(o.value)}
                      className={cn('rounded-full px-3.5 py-1.5 text-[13px] font-body border transition-colors',
                        living === o.value ? 'bg-teal text-white border-teal' : 'bg-white text-navy border-navy/15 hover:border-navy/30')}>{o.label}</button>
                  ))}
                </div>
              </div>
              {backgroundError && (
                <p className="rounded-xl bg-coral/5 px-4 py-3 text-[13px] text-coral-deep font-body" role="alert">{backgroundError}</p>
              )}
            </div>
            <div className="mt-2 space-y-4 border-t border-navy/10 pt-4">
              <h3 className="font-semibold text-navy font-display">La boda</h3>
              {/* PRE-9: la pregunta del LUGAR se quitó. PRE-10: la del OFICIANTE
                  también — Theos dejó de ofrecer ese servicio. Queda la fecha,
                  con su regla y su copy exacto (mínimo hoy + 6 meses). */}
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-navy-light/70 font-body">{CEREMONY_DATE_QUESTION}</p>
                <input type="date" value={ceremonyDate} min={minWeddingDate} onChange={e => setCeremonyDate(e.target.value)} className="rounded-xl border border-navy/15 px-3 py-2 text-sm outline-none focus:border-navy/30 font-body" />
                <label className="ml-3 text-[13px] text-navy font-body"><input type="checkbox" checked={dateDefined} onChange={e => setDateDefined(e.target.checked)} /> Fecha ya definida</label>
              </div>
              <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} placeholder="Comentarios adicionales (opcional)" className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm outline-none focus:border-navy/30 font-body" />
            </div>
          </div>
        )}

        {/* PASO 3 — diagnóstico + pago (PRE-10: era el 4) */}
        {step === 3 && (
          <div className="space-y-4">
            {/* PRE-9: diagnóstico (opcional) antes del pago. */}
            <div className="space-y-2 border-b border-navy/10 pb-4">
              <h2 className="font-semibold text-navy font-display">Diagnóstico</h2>
              <label htmlFor="premat-diagnostic" className="block text-[13px] text-navy-light/70 font-body">{DIAGNOSTIC_QUESTION}</label>
              <textarea id="premat-diagnostic" value={diagnostic} onChange={e => setDiagnostic(e.target.value)} rows={3}
                placeholder="Opcional — lo que escribas lo ve solo la coordinación de estudios."
                className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm outline-none focus:border-navy/30 font-body" />
            </div>
            <h2 className="font-semibold text-navy font-display">Pago — ₡25.000 por pareja</h2>
            <div className="rounded-xl bg-surface-low p-4 text-[13px] text-navy font-body space-y-1">
              <p><strong>Cuenta BAC:</strong> 908921570</p>
              <p><strong>IBAN:</strong> CR36010200009089215706</p>
              <p><strong>SINPE Móvil:</strong> 87267406</p>
              <p><strong>A nombre de:</strong> Asociación Theos Place (céd. jurídica 3-002-563360)</p>
              <p className="text-navy-light/70">Luego de pagar, notificá a mariajose@theosplace.org.</p>
            </div>
            <p className="text-[13px] text-navy-light/70 font-body">El pago se hace <strong>antes</strong> de completar la inscripción: subí el comprobante y el número para que finanzas lo revise.</p>
            {/* PRE-6: solicitud de beca — mismo flujo que la matrícula normal
                (finance_requests tipo scholarship sobre el plan PREMAT). La
                solicitud queda abierta y el pago sigue pendiente hasta que
                becas la resuelva. */}
            {prematPlanId && (
              <button
                type="button"
                onClick={() => setScholarshipOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 px-4 py-2 text-[13px] text-teal-deep hover:bg-teal/5 transition-colors font-body"
              >
                <Heart size={14} /> Solicitar beca
              </button>
            )}
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-navy-light/70 font-body">Número de comprobante</p>
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Ej: 123456789" className="w-full rounded-xl border border-navy/15 px-3 py-2.5 text-sm outline-none focus:border-navy/30 font-body" />
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-navy-light/70 font-body">Comprobante (imagen o PDF)</p>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-navy/25 px-4 py-3 text-sm text-navy-light/70 font-body hover:border-navy/40">
                <Upload size={16} /> {file ? file.name : 'Seleccionar archivo'}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
        )}

        {error && <p className="mt-4 flex items-center gap-1.5 rounded-xl bg-coral/5 px-3 py-2 text-[13px] text-coral-deep font-body"><AlertCircle size={14} /> {error}</p>}

        {/* PRE-6: modal de solicitud de beca (destino fijo: plan PREMAT). */}
        {scholarshipOpen && prematPlanId && effectiveMemberId && (
          <ScholarshipRequestModal
            memberId={effectiveMemberId}
            fixedTarget={{ entity_type: 'study_plan', id: prematPlanId, name: 'Curso Prematrimonial' }}
            onClose={() => setScholarshipOpen(false)}
          />
        )}

        {/* Navegación */}
        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={() => step === 1 ? router.push('/matricula') : setStep(s => s - 1)}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-navy-light/70 hover:bg-navy/5 font-body">
            <ArrowLeft size={15} /> {step === 1 ? 'Salir' : 'Atrás'}
          </button>
          {step < 3 ? (
            <button type="button" disabled={
              (step === 1 && (!spouse || spouse.same_gender || !!spouse.gender_missing))
              || (step === 2 && backgroundError !== null)
            }
              onClick={() => setStep(s => s + 1)}
              className="inline-flex items-center gap-1.5 rounded-full bg-teal px-5 py-2 text-sm font-medium text-white disabled:opacity-50 font-body">
              Continuar <ArrowRight size={15} />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={submitting || !file}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-5 py-2 text-sm font-medium text-white disabled:opacity-50 font-body">
              {submitting ? <><Loader2 size={15} className="animate-spin" /> Enviando…</> : <><Check size={15} /> Enviar inscripción</>}
            </button>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
