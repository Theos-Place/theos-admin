'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Heart, Search, Check, IdCard, ArrowLeft, ArrowRight, Loader2, AlertCircle, Upload, UserCog } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

type Enrollee = { member_id: string; name: string; email: string | null; has_cedula: boolean; has_n2: boolean }

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
const TIMES = ['Tarde', 'Noche']
const ZONES = ['Virtual', 'Este de San José', 'Oeste de San José', 'Alajuela', 'Cartago', 'Liberia', 'Heredia']
const OFFICIANTS = ['Ernesto Desanti', 'Roberto Acosta', 'Héctor Morales', 'Mario Madrigal', 'Pablo Rojas', 'Roberto Morales', 'No requerimos de este servicio', 'Otro (especificar en comentarios)']

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

  useEffect(() => {
    if (!onBehalf) return
    let alive = true
    fetch(`/api/studies/prematrimonial/enrollee?member_id=${encodeURIComponent(requestedMemberId)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('No se pudo cargar el miembro.')))
      .then((d: Enrollee) => { if (alive) setEnrollee(d) })
      .catch(() => { if (alive) setEnrolleeError('No se pudo cargar el miembro a inscribir.') })
    return () => { alive = false }
  }, [onBehalf, requestedMemberId])

  // Paso 2 — pareja
  const [spouseQuery, setSpouseQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [spouse, setSpouse] = useState<{ id: string; name: string; has_n2: boolean } | null>(null)
  const [spouseMsg, setSpouseMsg] = useState('')

  // Paso 3 — logística
  const [days, setDays] = useState<string[]>([])
  const [times, setTimes] = useState<string[]>([])
  const [zones, setZones] = useState<string[]>([])
  const [canHost, setCanHost] = useState(false)
  const [hostAddress, setHostAddress] = useState('')
  const [hostMaps, setHostMaps] = useState('')

  // Paso 4 — ceremonia
  const [ceremonyDate, setCeremonyDate] = useState('')
  const [dateDefined, setDateDefined] = useState(false)
  const [venueDefined, setVenueDefined] = useState(false)
  const [venueOutsideGam, setVenueOutsideGam] = useState(false)
  const [officiant, setOfficiant] = useState('')
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

  async function searchSpouse() {
    setSpouseMsg(''); setSpouse(null); setSearching(true)
    try {
      const res = await fetch('/api/studies/prematrimonial/spouse-search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: spouseQuery.trim(), ...(onBehalf ? { on_behalf_of: requestedMemberId } : {}) }),
      })
      const d = await res.json()
      if (d.found) setSpouse({ id: d.spouse_member_id, name: d.name, has_n2: d.has_n2 })
      else setSpouseMsg(d.message || 'No encontrado.')
    } catch { setSpouseMsg('No se pudo buscar. Intentá de nuevo.') }
    finally { setSearching(false) }
  }

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
      fd.set('ceremonia', JSON.stringify({ ceremony_date: ceremonyDate || null, ceremony_date_defined: dateDefined, venue_defined: venueDefined, venue_outside_gam: venueOutsideGam, officiant: officiant || null, comments: comments.trim() || null }))
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

  // Bloqueo por cédula: en onBehalf lo evaluamos solo cuando ya cargó el miembro.
  if (loaded && (!onBehalf || enrollee) && !hasCedula) {
    return (
      <div className="page max-w-2xl mx-auto">
        <div className="rounded-2xl border border-coral/25 bg-coral/5 p-6 text-center">
          <IdCard className="mx-auto mb-3 text-coral-deep" size={28} />
          <h2 className="text-lg font-bold text-navy font-display">{onBehalf ? 'El miembro necesita cédula registrada' : 'Necesitás registrar tu cédula'}</h2>
          <p className="mt-2 text-sm text-navy-light/70 font-body">
            {onBehalf
              ? `Antes de inscribir a ${enrolleeName} al prematrimonial, su cédula debe estar registrada en el perfil.`
              : 'La inscripción al prematrimonial requiere tu cédula. Completala en tu perfil y volvé.'}
          </p>
          <Link href={`/miembros/${onBehalf ? requestedMemberId : user?.member_id}/editar?completar=cedula`} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm font-medium text-white">
            <IdCard size={14} /> Completar cédula
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page max-w-2xl mx-auto">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal/15"><Heart size={20} className="text-teal-deep" /></div>
        <div>
          <h1 className="text-xl font-bold text-navy font-display">Inscripción al Curso Prematrimonial</h1>
          <p className="text-[13px] text-navy-light/70 font-body">Paso {step} de 4</p>
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
            <p className="text-sm text-navy-light/70 font-body">El curso son <strong>10 sesiones</strong> y debe iniciar <strong>mínimo 6 meses antes</strong> de la boda. {onBehalf ? 'La pareja' : 'Tu pareja'} debe ser miembro con Nivel 2 — buscala por cédula, correo o teléfono.</p>
            <div className="flex gap-2">
              <input value={spouseQuery} onChange={e => setSpouseQuery(e.target.value)} placeholder="Cédula, correo o teléfono"
                className="flex-1 rounded-xl border border-navy/15 px-3 py-2.5 text-sm text-navy outline-none focus:border-navy/30 font-body" />
              <button type="button" onClick={searchSpouse} disabled={searching || !spouseQuery.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-4 py-2.5 text-sm text-white disabled:opacity-50 font-body">
                {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Buscar
              </button>
            </div>
            {spouse && (
              <div className="rounded-xl border border-teal/25 bg-teal/5 px-4 py-3 text-sm font-body">
                <p className="text-navy inline-flex items-center gap-1.5"><Check size={15} className="text-teal-deep" /> Encontrado: <strong>{spouse.name}</strong></p>
                {!spouse.has_n2 && <p className="mt-1 text-coral-deep text-[13px]">⚠ Tu pareja no tiene el Nivel 2 completado; no podrás inscribirte hasta que lo tenga.</p>}
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
            <div><p className="mb-1.5 text-[13px] font-medium text-navy-light/70 font-body">Zonas donde pueden llevarlo <span className="text-navy-light/50">(Madrid = Virtual)</span></p>
              <div className="flex flex-wrap gap-2">{ZONES.map(z => <Chip key={z} active={zones.includes(z)} onClick={() => toggle(zones, setZones, z)}>{z}</Chip>)}</div></div>
            <label className="flex items-center gap-2 text-sm text-navy font-body"><input type="checkbox" checked={canHost} onChange={e => setCanHost(e.target.checked)} /> Podemos ofrecer nuestra casa para impartirlo</label>
            {canHost && (
              <div className="space-y-2 pl-6">
                <input value={hostAddress} onChange={e => setHostAddress(e.target.value)} placeholder="Dirección" className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm outline-none focus:border-navy/30 font-body" />
                <input value={hostMaps} onChange={e => setHostMaps(e.target.value)} placeholder="Link de Waze / Google Maps (opcional)" className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm outline-none focus:border-navy/30 font-body" />
              </div>
            )}
          </div>
        )}

        {/* PASO 3 — ceremonia */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-navy font-display">La ceremonia</h2>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-navy-light/70 font-body">Fecha de la boda {dateDefined ? '(definida)' : '(aproximada)'}</p>
              <input type="date" value={ceremonyDate} onChange={e => setCeremonyDate(e.target.value)} className="rounded-xl border border-navy/15 px-3 py-2 text-sm outline-none focus:border-navy/30 font-body" />
              <label className="ml-3 text-[13px] text-navy font-body"><input type="checkbox" checked={dateDefined} onChange={e => setDateDefined(e.target.checked)} /> Fecha ya definida</label>
            </div>
            <label className="flex items-center gap-2 text-sm text-navy font-body"><input type="checkbox" checked={venueDefined} onChange={e => setVenueDefined(e.target.checked)} /> Ya tenemos el lugar definido</label>
            <label className="flex items-center gap-2 text-sm text-navy font-body"><input type="checkbox" checked={venueOutsideGam} onChange={e => setVenueOutsideGam(e.target.checked)} /> La boda será fuera del GAM</label>
            {venueOutsideGam && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-700 font-body">Si la boda es fuera del GAM, avisanos para coordinar.</p>}
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-navy-light/70 font-body">¿Quién dirige la ceremonia?</p>
              <select value={officiant} onChange={e => setOfficiant(e.target.value)} className="w-full rounded-xl border border-navy/15 px-3 py-2.5 text-sm text-navy outline-none focus:border-navy/30 font-body">
                <option value="">Seleccioná…</option>
                {OFFICIANTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} placeholder="Comentarios adicionales (si elegiste 'Otro' para el oficiante, especificá acá para solicitar autorización)" className="w-full rounded-xl border border-navy/15 px-3 py-2 text-sm outline-none focus:border-navy/30 font-body" />
          </div>
        )}

        {/* PASO 4 — pago */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-navy font-display">Pago — ₡25.000 por pareja</h2>
            <div className="rounded-xl bg-surface-low p-4 text-[13px] text-navy font-body space-y-1">
              <p><strong>Cuenta BAC:</strong> 908921570</p>
              <p><strong>IBAN:</strong> CR36010200009089215706</p>
              <p><strong>SINPE Móvil:</strong> 87267406</p>
              <p><strong>A nombre de:</strong> Asociación Theos Place (céd. jurídica 3-002-563360)</p>
              <p className="text-navy-light/70">Luego de pagar, notificá a mariajose@theosplace.org.</p>
            </div>
            <p className="text-[13px] text-navy-light/70 font-body">El pago se hace <strong>antes</strong> de completar la inscripción: subí el comprobante y el número para que finanzas lo revise.</p>
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

        {/* Navegación */}
        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={() => step === 1 ? router.push('/matricula') : setStep(s => s - 1)}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm text-navy-light/70 hover:bg-navy/5 font-body">
            <ArrowLeft size={15} /> {step === 1 ? 'Salir' : 'Atrás'}
          </button>
          {step < 4 ? (
            <button type="button" disabled={step === 1 && !spouse}
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
    </div>
  )
}
