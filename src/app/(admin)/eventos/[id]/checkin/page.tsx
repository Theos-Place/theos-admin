'use client'

import { use, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { type AttendanceType, type EventCheckin } from '@/types/event'
import { useEvent } from '@/hooks/useEvents'
import { usePermissions } from '@/hooks/usePermissions'
import { CheckinCard } from '@/components/events/CheckinCard'
import { puertaDeServidor, ofreceServidor, type InfoDeServidor } from '@/lib/events/puerta-de-servidor'
import { cumpleEstaSemana, textoDelCumple } from '@/lib/members/cumple-esta-semana'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ChevronLeft, UserPlus, X, Camera, Trash2, UserCheck } from 'lucide-react'
import { FamilyMemberModal, type FamilyDraft } from '@/components/members/FamilyMemberModal'
import { DocumentCapture } from '@/components/members/DocumentCapture'
import { ContactCapture } from '@/components/members/ContactCapture'
import { Modal } from '@/components/shared/Modal'
import { getInitials, toYmdLocal, formatMoney } from '@/lib/format'
import { validarAltaDePersona } from '@/lib/members/alta-persona'
import { normalizeCedula, DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL } from '@/lib/cedula'
import { PageContainer } from '@/components/layout/PageContainer'
import { MemberCombobox } from '@/components/shared/MemberCombobox'
import { motivoQueImpideCrear } from '@/lib/members/menor-protegido'
import { checkinsDeLaOcurrencia, diaQueSeEstaViendo } from '@/lib/events/checkins-del-dia'
import { todayCR } from '@/lib/format'
import {
  encolarPendientes, MENSAJE_MENOR_SIN_ADULTO, type PendienteDeContacto,
} from '@/lib/events/contacto-en-la-puerta'
import {
  marcaEnLaBusqueda, textoYaRegistrado, textoDeshacer, textoQrRepetido,
  esYaRegistrado, type CheckinExistente,
} from '@/lib/events/checkin-duplicado'

// El escáner QR (zxing, ~100KB+) se carga solo cuando el usuario abre la cámara:
// no forma parte del bundle inicial de la página.
const QrScanner = dynamic(
  () => import('@/components/events/QrScanner').then(m => m.QrScanner),
  {
    ssr: false,
    loading: () => (
      <div className="w-full aspect-square max-h-[340px] rounded-2xl bg-surface-card flex items-center justify-center shadow-[var(--shadow-sm)]">
        <p className="text-sm text-navy-light/80 font-body">Cargando cámara…</p>
      </div>
    ),
  },
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Feedback al escanear: beep corto (WebAudio) + vibración.
function scanFeedback(ok: boolean) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AC()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = ok ? 880 : 300
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.start(); osc.stop(ctx.currentTime + 0.18)
    osc.onended = () => ctx.close()
  } catch { /* sin audio */ }
  try { navigator.vibrate?.(ok ? 80 : [60, 40, 60]) } catch { /* */ }
}

const AVATAR_COLORS: Record<string, string> = {
  A: 'bg-coral', B: 'bg-teal-deep', C: 'bg-navy', D: 'bg-navy-light', E: 'bg-coral-deep',
  F: 'bg-coral', G: 'bg-teal-deep', H: 'bg-navy', I: 'bg-navy-light', J: 'bg-coral-deep',
  K: 'bg-coral', L: 'bg-teal-deep', M: 'bg-navy', N: 'bg-navy-light', O: 'bg-coral-deep',
  P: 'bg-coral', Q: 'bg-teal-deep', R: 'bg-navy', S: 'bg-navy-light', T: 'bg-coral-deep',
  U: 'bg-coral', V: 'bg-teal-deep', W: 'bg-navy', X: 'bg-navy-light', Y: 'bg-coral-deep', Z: 'bg-coral',
}

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charAt(0).toUpperCase()] ?? 'bg-navy'
}
function Clock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }, 1000)
    return () => clearInterval(interval)
  }, [])
  return (
    <span className="tabular-nums text-white/80 text-lg font-mono">
      {time}
    </span>
  )
}

export default function CheckinLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { can } = usePermissions()
  const canCheckin = can('eventos', 'edit') // encargado_eventos, direccion, admin
  const { event, loading, refetch } = useEvent(id)
  // Fecha de ESTA ocurrencia (si venimos de una recurrente con ?date=).
  const occParam = useSearchParams().get('date')
  // Subevento destino del check-in (null = evento padre).
  const [targetSub, setTargetSub] = useState<string | null>(null)
  const [scanOn, setScanOn] = useState(false)
  const [scanMsg, setScanMsg] = useState<{ kind: 'ok' | 'dup' | 'error'; text: string } | null>(null)
  const [toDelete, setToDelete] = useState<EventCheckin | null>(null)
  /**
   * Persona que se seleccionó y YA tenía check-in. No es un error: en la puerta
   * el caso normal es que el operador dude ("¿ya la registré?"). El panel se
   * lo dice y le ofrece deshacer, que es el caso raro.
   */
  const [yaRegistrado, setYaRegistrado] = useState<
    { nombre: string; checkin: CheckinExistente } | null>(null)
  const [deshaciendo, setDeshaciendo] = useState(false)
  const [confirmarDeshacer, setConfirmarDeshacer] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const lastScanRef = useRef<{ id: string; t: number } | null>(null)
  const [query, setQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string; birth_md?: string | null } | null>(null)
  const [checkins, setCheckins] = useState<EventCheckin[]>([])
  const [memberResults, setMemberResults] = useState<{
    id: string; name: string; has_document?: boolean; birth_md?: string | null
    pedir_documento?: boolean
    falta_contacto?: { email: boolean; phone: boolean }
    menor_sin_adulto?: boolean
  }[]>([])
  // FIN-2 (3): captura OPCIONAL de documento tras un check-in. Vive fuera del
  // flujo de la fila: se puede ignorar y seguir registrando gente.
  const [docCapture, setDocCapture] = useState<{ id: string; name: string } | null>(null)
  // CHK-5: a quién hay que pedirle el correo. Lo decide el SERVIDOR y viene ya
  // resuelto en /lookup y en /family — la puerta no recibe la fecha de
  // nacimiento de nadie.
  //
  // Es una COLA y no una persona porque el check-in en familia registra a
  // varios de una: si fuera una sola, de una familia de cuatro se le pediría el
  // dato a uno y los otros tres se perderían en silencio. Se atiende de a uno
  // —la fila sigue avanzando y dos formularios apilados la trancan— y cerrar
  // pasa al siguiente.
  const [colaDeContacto, setColaDeContacto] = useState<PendienteDeContacto[]>([])
  const contactCapture = colaDeContacto[0] ?? null
  const siguienteContacto = () => setColaDeContacto(prev => prev.slice(1))
  const encolarContacto = (p: PendienteDeContacto[]) =>
    setColaDeContacto(prev => encolarPendientes(prev, p))
  const [searching, setSearching] = useState(false)
  const [showNewPerson, setShowNewPerson] = useState(false)
  const [familyCheckin, setFamilyCheckin] = useState<{
    member: { id: string; name: string }
    family: { member_id: string; name: string; relation: string
              falta_contacto?: { email: boolean; phone: boolean }
              menor_sin_adulto?: boolean }[]
  } | null>(null)
  const [checkingFamily, setCheckingFamily] = useState(false)
  // Persona NO inscrita en un evento pago (los 3 métodos convergen acá). En
  // Fase 2 abre el modal de cobro en sitio; en Fase 1 avisa de forma consistente.
  const [cobroTarget, setCobroTarget] = useState<{ id: string; name: string; method: 'manual' | 'qr' } | null>(null)
  // Camino en curso del cobro en sitio ('pending' | 'verified'), para el estado del botón.
  const [cobroSubmitting, setCobroSubmitting] = useState<'pending' | 'verified' | null>(null)
  // ¿El miembro seleccionado es servidor de algún comité organizador? (gating de "Servidor")
  const [serverInfo, setServerInfo] = useState<{ hasCommittees: boolean; isServer: boolean } | null>(null)

  // Sin permiso → fuera (el registro lo hace un encargado autenticado).
  useEffect(() => { if (!canCheckin) router.replace('/dashboard') }, [canCheckin, router])

  // Sincroniza los check-ins ya registrados cuando carga (o recarga) el evento.
  // Es copia local porque cada registro se agrega de forma optimista antes de
  // que responda el server. El ajuste va durante el render y no en un efecto:
  // así la lista nueva no aparece un frame después de la vieja.
  /**
   * El día de ESTA ocurrencia. Un recurrente es UNA fila con una regla y todos
   * sus check-ins cuelgan de ahí, así que sin filtrar por día la pantalla
   * mostraba los de todas las semanas juntos — el 15 de setiembre la Charla
   * Meridiano Martes decía 189 y eran de la semana anterior. Y peor: esa lista
   * decide si alguien "ya estaba registrado", o sea quien vino una vez no podía
   * volver a marcar.
   */
  const diaOcurrencia = diaQueSeEstaViendo(occParam, !!event?.is_recurring, todayCR())

  const [eventoPrevio, setEventoPrevio] = useState(event)
  if (eventoPrevio !== event) {
    setEventoPrevio(event)
    if (event) setCheckins(checkinsDeLaOcurrencia(event.checkins, event.is_recurring, diaOcurrencia))
  }

  // Al seleccionar un miembro, consulta si es servidor de los comités organizadores.
  useEffect(() => {
    if (!selectedMember) { setServerInfo(null); return }
    let alive = true
    setServerInfo(null)
    fetch(`/api/events/${id}/server-check?member_id=${selectedMember.id}`)
      .then(r => (r.ok ? r.json() : { hasCommittees: false, isServer: false }))
      .then(d => { if (alive) setServerInfo({ hasCommittees: !!d.hasCommittees, isServer: !!d.isServer }) })
      .catch(() => { if (alive) setServerInfo({ hasCommittees: false, isServer: false }) })
    return () => { alive = false }
  }, [selectedMember, id])

  /**
   * CHK-2 · El día de HOY en hora de Costa Rica, para saber quién cumple años
   * esta semana. Se calcula una vez: en la fila se marcan decenas de personas y
   * no tiene sentido rehacerlo por fila. 'en-CA' da YYYY-MM-DD.
   */
  const hoyCR = useMemo(
    () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Costa_Rica' }),
    [],
  )
  const avisoDeCumple = useCallback(
    (birthMd: string | null | undefined) => cumpleEstaSemana(birthMd, hoyCR),
    [hoyCR],
  )

  // Búsqueda real entre TODOS los miembros (debounced). Va por /lookup y no
  // por /api/members: el rol encargado_eventos —el que hace check-in— no tiene
  // el módulo miembros, así que ahí la búsqueda devolvía siempre vacío
  // (bug 2026-08-04).
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setMemberResults([]); return }
    let alive = true
    setSearching(true)
    const t = setTimeout(() => {
      fetch(`/api/members/lookup?search=${encodeURIComponent(q)}&pageSize=8`)
        .then(r => (r.ok ? r.json() : { members: [] }))
        .then(d => {
          if (!alive) return
          const list = (d.members ?? []) as Array<{
            id: string; first_name: string; last_name: string; cedula?: string | null
            birth_md?: string | null; falta_contacto?: { email: boolean; phone: boolean }
            menor_sin_adulto?: boolean; pedir_documento?: boolean
          }>
          // FIN-2: el lookup ya trae el documento; se conserva para marcar a
          // quién le falta y poder capturarlo al vuelo (nunca frena la fila).
          setMemberResults(list.map(m => ({
            id: m.id,
            name: `${m.first_name} ${m.last_name}`.trim(),
            has_document: !!String(m.cedula ?? '').trim(),
            // FIN-2 + 2026-09-22: la cédula se pide SOLO a mayores de 18, y
            // quién lo es lo decide el servidor (la puerta no recibe el año de
            // nacimiento — ver CHK-2).
            pedir_documento: m.pedir_documento === true,
            // CHK-2: 'MM-DD' — el lookup no manda el año (no hace falta la edad
            // para felicitar a alguien).
            birth_md: m.birth_md ?? null,
            // CHK-5 y DAT-12: ver el comentario de colaDeContacto.
            falta_contacto: m.falta_contacto,
            menor_sin_adulto: m.menor_sin_adulto,
          })))
        })
        .catch(() => { if (alive) setMemberResults([]) })
        .finally(() => { if (alive) setSearching(false) })
    }, 300)
    return () => { alive = false; clearTimeout(t) }
  }, [query])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-low flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-navy-light/80">
          <div className="h-8 w-8 rounded-full border-2 border-coral/30 border-t-coral animate-spin" aria-hidden />
          <p className="text-sm font-body">Cargando evento…</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-surface-low flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-navy-light/80 font-body">Evento no encontrado.</p>
          <Link href="/eventos" className="text-coral hover:text-coral-deep">← Volver</Link>
        </div>
      </div>
    )
  }

  const registeredIds = new Set(event.registrations.map(r => r.member_id))
  /** member_id → su check-in de HOY. Se arma UNA vez de la lista que la
   *  pantalla ya tiene, en vez de una consulta por fila del resultado. */
  const checkinPorMiembro = new Map(
    checkins.filter(c => c.member_id).map(c => [c.member_id, {
      id: c.id, checked_at: c.checked_at, checked_in_as: c.attendance_type === 'server' ? 'servidor' : 'asistente',
    } as CheckinExistente]))
  const searchResults = memberResults

  // Persiste un check-in (optimista con rollback). CHOKE POINT ÚNICO de los tres
  // métodos (QR, nombre/cédula, familia, persona nueva) — acá vive el gate de
  // "evento pago requiere inscripción" para que TODOS se comporten igual
  // (Fase 1). 'not_registered' = evento pago y la persona no está inscrita.
  async function persistCheckin(m: { id: string; name: string }, type: AttendanceType, method: 'manual' | 'qr' = 'manual', subEvent: string | null = targetSub): Promise<'ok' | 'dup' | 'error' | 'not_registered'> {
    // Gate cliente (feedback inmediato sin round-trip); el server lo re-valida.
    if (event!.requires_payment && !registeredIds.has(m.id)) return 'not_registered'
    const subEventId = subEvent // null = evento padre; o el subevento elegido para esta persona
    const nowIso = new Date().toISOString()       // fecha real del check-in (válida)
    const tempId = `tmp:${nowIso}:${m.id}`        // id temporal para rollback/replace
    const newCheckin: EventCheckin & { _new?: boolean } = {
      id: tempId, // optimista; al refrescar trae el id real de la BD
      member_id: m.id,
      member_name: m.name,
      attendance_type: type,
      sub_event_id: subEventId,
      checked_at: nowIso,
      _new: true,
    }
    setCheckins(prev => [newCheckin, ...prev])
    const rollback = () => {
      setCheckins(prev => prev.filter(c => c.id !== tempId))
    }
    try {
      const res = await fetch(`/api/events/${id}/checkins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // attendance_type viajaba SOLO en el estado optimista: el POST no lo
        // mandaba y la elección de "Servidor" se perdía al refrescar (bug
        // 2026-09-10, 168.743 check-ins sin la distinción).
        body: JSON.stringify({ member_id: m.id, sub_event_id: subEventId, method, attendance_type: type }),
      })
      if (res.status === 409) {
        rollback()
        const data = await res.json().catch(() => null) as
          { code?: string; checkin?: CheckinExistente | null } | null
        /**
         * El servidor dice que ya estaba registrada y manda los datos del
         * check-in que existe. Se pinta el panel con ESO y no con el estado
         * local: si dos operadores trabajan en paralelo, el de esta pantalla
         * puede estar viejo y el servidor es el que sabe.
         */
        if (esYaRegistrado(res.status, data)) {
          if (data?.checkin) setYaRegistrado({ nombre: m.name, checkin: data.checkin })
          return 'dup'
        }
        return data?.code === 'not_registered' ? 'not_registered' : 'dup'
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Reemplaza el id optimista por el real (para poder eliminarlo luego).
      const data = await res.json().catch(() => null) as { id?: string } | null
      if (data?.id) {
        setCheckins(prev => prev.map(c => c.id === tempId ? { ...c, id: data.id! } : c))
      }
      return 'ok'
    } catch (err) {
      console.error('No se pudo registrar el check-in:', err)
      rollback()
      return 'error'
    }
  }

  // Lee un QR (member_id) y registra al miembro en este evento. Mantiene la
  // cámara abierta; ignora el mismo código por 3s para no duplicar lecturas.
  async function handleScan(text: string) {
    const memberId = text.trim()
    const now = Date.now()
    if (lastScanRef.current && lastScanRef.current.id === memberId && now - lastScanRef.current.t < 3000) return
    lastScanRef.current = { id: memberId, t: now }
    const flash = (kind: 'ok' | 'dup' | 'error', txt: string) => { setScanMsg({ kind, text: txt }); setTimeout(() => setScanMsg(m => (m?.text === txt ? null : m)), 3000) }

    if (!UUID_RE.test(memberId)) { scanFeedback(false); flash('error', 'QR no válido'); return }
    // QR repetido: se informa, no se reprocha. Es la señal que el operador de
    // puerta necesita — "ya pasó"— no un error.
    const already = checkins.find(c => c.member_id === memberId)
    if (already) {
      scanFeedback(false)
      flash('dup', textoQrRepetido(already.member_name, {
        id: already.id, checked_at: already.checked_at,
        checked_in_as: already.attendance_type === 'server' ? 'servidor' : 'asistente',
      }))
      return
    }
    try {
      // Por /lookup?id= y no por /api/members/[id]: ese exige el módulo
      // miembros, que encargado_eventos no tiene — todo QR ajeno daba 403 y la
      // pantalla lo reportaba como "no corresponde a ningún miembro"
      // (bug 2026-09-09). Mismo motivo por el que la búsqueda por nombre ya iba
      // por /lookup desde agosto; al QR se le pasó.
      // El lookup SOLO sirve para saber el nombre y poder decir "✓ Fulano
      // registrado". El check-in no lo necesita: el servidor resuelve todo con
      // el member_id.
      //
      // Por eso un fallo acá YA NO FRENA EL ESCANEO (2026-09-10). Antes sí, y
      // cualquier hipo —la sesión que se vence con la pantalla abierta, un
      // segundo sin señal— dejaba a la persona parada en la fila con un "No se
      // pudo verificar el QR" mientras el check-in habría funcionado. Se
      // registra igual y el nombre aparece al refrescar.
      const res = await fetch(`/api/members/lookup?id=${encodeURIComponent(memberId)}`).catch(() => null)
      if (res?.status === 401) {
        // Este SÍ frena, y con la instrucción correcta: sin sesión no se puede
        // registrar nada, y reintentar el escaneo no lo va a arreglar.
        scanFeedback(false)
        flash('error', 'Se venció tu sesión. Volvé a entrar para seguir registrando.')
        return
      }
      const mem = res?.ok
        ? ((await res.json().catch(() => null))?.members ?? [])[0] as {
            first_name: string; last_name: string; birth_md?: string | null
            falta_contacto?: { email: boolean; phone: boolean }
            menor_sin_adulto?: boolean
          } | undefined
        : undefined
      // Sin nombre se sigue igual. Solo se corta si el lookup respondió BIEN y
      // dijo que ese id no es de nadie: ahí el QR sí está mal.
      if (res?.ok && !mem) { scanFeedback(false); flash('error', 'El QR no corresponde a ningún miembro'); return }
      const name = mem ? `${mem.first_name} ${mem.last_name}`.trim() : 'Persona registrada'
      // El gate de "evento pago requiere inscripción" vive en persistCheckin
      // (mismo camino que nombre/cédula). 'not_registered' → cobro en sitio.
      const r = await persistCheckin({ id: memberId, name }, 'participant', 'qr')
      const dest = targetSub ? subName(targetSub) : null
      if (r === 'ok') {
        scanFeedback(true)
        // CHK-2: por QR no hay tarjeta de confirmación —se registra y ya—, así
        // que el aviso va en el mismo flash o el operador no se entera.
        const cumple = avisoDeCumple(mem?.birth_md)
        flash('ok', cumple
          ? `✓ ${name} registrado${dest ? ` → ${dest}` : ''} · ${textoDelCumple(name, cumple)}`
          : `✓ ${name} registrado${dest ? ` → ${dest}` : ''}`)
        // Se registró sin haber podido leer el nombre: se refresca para que la
        // lista muestre a quién, en vez de dejar "Persona registrada".
        if (!mem) void refetch()
        // CHK-5: el panel se queda abierto mientras la cámara sigue escaneando.
        // No estorba —es una tarjeta más en la columna— y si el operador sigue
        // sin atenderlo, los siguientes se apilan en la cola.
        if (mem?.menor_sin_adulto) encolarContacto([{ id: memberId, name, tipo: 'menor_sin_adulto' }])
        else if (mem?.falta_contacto) encolarContacto([{ id: memberId, name, pedir: mem.falta_contacto }])
      }
      else if (r === 'dup') { scanFeedback(false); flash('dup', `${name} ya estaba registrado`) }
      else if (r === 'not_registered') { scanFeedback(false); requestCobro({ id: memberId, name }, 'qr') }
      else { scanFeedback(false); flash('error', 'No se pudo registrar') }
    } catch { scanFeedback(false); flash('error', 'Error al registrar') }
  }

  // Persona no inscrita en evento pago: punto único al que llegan los 3 métodos.
  // Abre el modal de cobro en sitio (Fase 2, 2 caminos).
  function requestCobro(m: { id: string; name: string }, method: 'manual' | 'qr' = 'manual') {
    setSelectedMember(null)
    setCobroTarget({ ...m, method })
  }

  // Cobro en sitio + check-in de una persona no inscrita (Fase 2).
  //   'pending'  → inscribe con pago pendiente + correo + check-in.
  //   'verified' → inscribe con pago aprobado (comprobante ya visto) + check-in.
  // Tras el éxito refresca el evento (trae inscripción + check-in reales).
  async function submitOnsiteCharge(mode: 'pending' | 'verified') {
    if (!cobroTarget || cobroSubmitting) return
    const target = cobroTarget
    setCobroSubmitting(mode)
    try {
      const res = await fetch(`/api/events/${id}/onsite-charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: target.id, mode, method: target.method }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null
        setScanMsg({ kind: 'error', text: data?.error ?? 'No se pudo registrar el cobro' })
        return
      }
      setCobroTarget(null)
      setQuery('')
      await refetch()
      const msg = mode === 'verified'
        ? `✓ ${target.name}: pago verificado y check-in`
        : `✓ ${target.name}: cobro enviado y check-in`
      setScanMsg({ kind: 'ok', text: msg })
      setTimeout(() => setScanMsg(m => (m?.text === msg ? null : m)), 3500)
    } catch {
      setScanMsg({ kind: 'error', text: 'Error al registrar el cobro' })
    } finally {
      setCobroSubmitting(null)
    }
  }

  // Al elegir un miembro existente: si tiene familia, ofrecer registrar a todos.
  async function handleSelectMember(member: {
    id: string; name: string; birth_md?: string | null
    falta_contacto?: { email: boolean; phone: boolean }
  }) {
    // Ya registrado: se muestra el estado y no se intenta de nuevo. El servidor
    // igual devuelve el 409 informativo si el estado local está viejo.
    const ya = checkinPorMiembro.get(member.id)
    if (ya) { setYaRegistrado({ nombre: member.name, checkin: ya }); return }
    try {
      const res = await fetch(`/api/members/${member.id}/family`)
      const family = res.ok ? await res.json() : []
      if (Array.isArray(family) && family.length > 0) {
        setFamilyCheckin({ member, family })
        return
      }
    } catch { /* si falla, seguimos al flujo individual */ }
    setSelectedMember(member)
  }

  /** Deshace el check-in del panel. Borrado duro: es corrección operativa
   *  inmediata, no historial (mismo criterio que el botón de la lista). */
  async function deshacerCheckin() {
    if (!yaRegistrado) return
    setDeshaciendo(true)
    try {
      const res = await fetch(
        `/api/events/${id}/checkins?checkinId=${encodeURIComponent(yaRegistrado.checkin.id)}`,
        { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setCheckins(prev => prev.filter(c => c.id !== yaRegistrado.checkin.id))
      setYaRegistrado(null)
      setConfirmarDeshacer(false)
      setQuery('')
    } catch {
      setScanMsg({ kind: 'error', text: 'No se pudo deshacer el check-in.' })
    } finally {
      setDeshaciendo(false)
    }
  }

  async function handleConfirm(type: AttendanceType) {
    if (!selectedMember) return
    const member = selectedMember
    // FIN-2 (3): ¿le faltaba documento? Se resuelve ANTES de limpiar la
    // búsqueda, que es de donde viene el dato.
    const fila = memberResults.find(m => m.id === member.id)
    const faltaDocumento = fila?.pedir_documento === true
    // CHK-5: mismo momento y mismo criterio que el documento.
    const faltaContacto = fila?.falta_contacto
    const menorSolo = fila?.menor_sin_adulto === true
    setSelectedMember(null)
    setQuery('')
    const r = await persistCheckin(member, type)
    if (r === 'not_registered') requestCobro(member)
    // Captura al vuelo, opcional y después del registro: el check-in nunca se
    // bloquea ni se retrasa por esto.
    if (faltaDocumento && r === 'ok') setDocCapture(member)
    // El documento tiene prioridad si faltan los dos: es un panel a la vez,
    // porque la fila sigue avanzando y dos formularios apilados la trancan.
    if (r === 'ok' && menorSolo) {
      // DAT-12 va aunque falte el documento: es lo más grave de los dos.
      encolarContacto([{ id: member.id, name: member.name, tipo: 'menor_sin_adulto' }])
    } else if (!faltaDocumento && r === 'ok' && faltaContacto) {
      encolarContacto([{ ...member, pedir: faltaContacto }])
    }
  }

  // Registra varios miembros (familia) al evento. Cada entrada lleva su subevento.
  // Los no inscritos de un evento pago se reportan (mismo gate que los otros
  // métodos) — el cobro en sitio es por persona, no en lote.
  async function registerFamily(
    entries: Array<{ id: string; name: string; sub_event_id: string | null; tipo: AttendanceType }>,
  ) {
    if (!familyCheckin) return
    setCheckingFamily(true)
    const notRegistered: string[] = []
    // CHK-5: a quiénes se les va a pedir el contacto. Se arma ANTES de limpiar
    // `familyCheckin`, que es de donde sale el dato de cada familiar.
    const faltantes = new Map<string, { email: boolean; phone: boolean }>()
    const menoresSolos = new Set<string>()
    for (const f of familyCheckin.family) {
      if (f.falta_contacto) faltantes.set(f.member_id, f.falta_contacto)
      if (f.menor_sin_adulto) menoresSolos.add(f.member_id)
    }
    // El titular no está en `family` —esa lista son los OTROS—, así que su
    // bandera sale del resultado de la búsqueda.
    const titular = memberResults.find(m => m.id === familyCheckin.member.id)
    if (titular?.falta_contacto) faltantes.set(familyCheckin.member.id, titular.falta_contacto)
    if (titular?.menor_sin_adulto) menoresSolos.add(familyCheckin.member.id)
    const registrados: PendienteDeContacto[] = []
    for (const e of entries) {
      // La calidad viaja POR PERSONA: a una mamá servidora con dos hijos
      // participantes hay que poder marcarla como lo que es. Antes este modal
      // registraba a todos como 'participant' sin preguntar, y por eso 231 de
      // los 497 servidores activos —los que tienen familia— no podían quedar
      // como servidores nunca (reportado 2026-09-18).
      const r = await persistCheckin({ id: e.id, name: e.name }, e.tipo, 'manual', e.sub_event_id)
      if (r === 'not_registered') notRegistered.push(e.name)
      // Solo a quien SÍ quedó registrado: el endpoint exige check-in de hoy.
      if (r !== 'ok') continue
      if (menoresSolos.has(e.id)) {
        registrados.push({ id: e.id, name: e.name, tipo: 'menor_sin_adulto' })
        continue
      }
      const pedir = faltantes.get(e.id)
      if (pedir) registrados.push({ id: e.id, name: e.name, pedir })
    }
    setCheckingFamily(false)
    setFamilyCheckin(null)
    setQuery('')
    encolarContacto(registrados)
    if (notRegistered.length > 0) {
      setScanMsg({ kind: 'error', text: `Sin inscripción en este evento pago: ${notRegistered.join(', ')}. Cobralos por separado.` })
    }
  }

  // Elimina un check-in (basurero). Confirmación corta vía modal.
  async function confirmDelete() {
    if (!toDelete || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/events/${id}/checkins?checkinId=${encodeURIComponent(toDelete.id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setCheckins(prev => prev.filter(c => c.id !== toDelete.id))
      setToDelete(null)
    } catch (e) {
      console.error('No se pudo eliminar el check-in:', e)
    } finally {
      setDeleting(false)
    }
  }

  // Crea un miembro nuevo (primera visita) y lo deja seleccionado para el check-in.
  async function handlePersonCreated(member: { id: string; name: string }) {
    setShowNewPerson(false)
    setMemberResults([])
    setSelectedMember(member)
    setQuery(member.name)
  }

  const subName = (subId: string | null) => event.sub_events.find(s => s.id === subId)?.name ?? null
  const hasSubs = event.sub_events.length > 0
  // Con subeventos, el contador y la lista reflejan el destino activo (targetSub);
  // sin subeventos, todos los check-ins del evento.
  const visibleCheckins = [...checkins]
    .filter(c => !hasSubs || c.sub_event_id === targetSub)
    .sort((a, b) => (b.checked_at ?? '').localeCompare(a.checked_at ?? ''))
  const targetLabel = targetSub ? (subName(targetSub) ?? event.name) : event.name
  // La regla (y el estado "todavía no sé", que antes se callaba) vive en
  // lib/events/puerta-de-servidor, compartida con el modal de familia.
  const serverGate = puertaDeServidor(serverInfo)

  // Eventos pagos: el gate "solo inscritos" vive en persistCheckin (choke point)
  // y en el server; un no inscrito cae en requestCobro (cobro en sitio, Fase 2).
  // Fecha mostrada: la de la ocurrencia (?date=) si viene, si no la del evento.
  const eventDate = diaOcurrencia ? new Date(`${diaOcurrencia}T12:00:00`) : new Date(event.start_at)
  const headerDate = isNaN(eventDate.getTime())
    ? ''
    : eventDate.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  // ¿Se está registrando en una fecha distinta a la del evento? (registro tardío)
  const dateMismatch = !isNaN(eventDate.getTime()) && toYmdLocal(eventDate) !== toYmdLocal(new Date())

  return (
    <div className="min-h-screen bg-surface-low flex flex-col font-body">
      {/* Header */}
      <div className="bg-surface-card border-b border-[var(--outline-variant)] px-4 py-3 sm:px-6 sm:py-4 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={`/eventos/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-navy-light/80 hover:text-navy transition-colors"
          >
            <ChevronLeft size={16} /> Volver
          </Link>
          <span className="hidden sm:inline-flex text-navy-light/80"><Clock /></span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-extrabold text-navy tracking-[-0.02em] truncate">
              {event.name}
            </h1>
            <p className="text-sm text-navy-light/80 font-body capitalize">{headerDate}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-4xl sm:text-5xl font-extrabold text-coral tabular-nums font-display leading-none">
              {visibleCheckins.length}
            </p>
            <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display mt-1">
              {hasSubs ? 'en este subevento' : 'registrados'}
            </p>
          </div>
        </div>
        {/* Selector de evento/subevento destino del check-in */}
        {event.sub_events.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {[{ id: null as string | null, name: 'Evento general' }, ...event.sub_events.map(se => ({ id: se.id as string | null, name: se.name }))].map(opt => (
              <button
                key={opt.id ?? 'parent'}
                onClick={() => setTargetSub(opt.id)}
                className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium font-body transition-colors',
                  targetSub === opt.id ? 'bg-coral text-white' : 'bg-surface-low text-navy-light/80 hover:bg-surface-low/70')}
              >
                {opt.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        <PageContainer width="work" className="p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start">
            {/* Columna izquierda: acciones (escanear + buscar) */}
            <div className="space-y-4">
          {/* Aviso: registro en fecha distinta a la del evento */}
          {dateMismatch && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2.5" role="alert">
              <span className="text-amber-600 text-base leading-none mt-0.5">⚠️</span>
              <p className="text-[13px] text-amber-800 font-body">
                Estás registrando asistencia en una fecha distinta a la del evento ({headerDate}). El check-in quedará con la fecha de hoy.
              </p>
            </div>
          )}

          {/* Acción principal: escanear QR */}
          <button
            onClick={() => setScanOn(s => !s)}
            className={cn('w-full inline-flex items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold font-body transition-colors min-h-[56px] shadow-[var(--shadow-sm)]',
              scanOn ? 'bg-navy text-white hover:bg-navy/90' : 'bg-coral text-white hover:bg-coral-deep')}
          >
            {scanOn ? <X size={18} /> : <Camera size={18} />}
            {scanOn ? 'Cerrar cámara' : 'Escanear QR'}
          </button>

          {scanOn && (
            <div className="space-y-2">
              <QrScanner onResult={handleScan} className="w-full aspect-square max-h-[340px]" />
              {scanMsg && (
                <div className={cn('rounded-xl px-4 py-3 text-sm font-medium font-body text-center',
                  scanMsg.kind === 'ok' ? 'bg-teal-soft/40 text-teal-deep'
                  : scanMsg.kind === 'dup' ? 'bg-amber-50 text-amber-700'
                  : 'bg-coral/10 text-coral')}>
                  {scanMsg.text}
                </div>
              )}
              <p className="text-navy-light/80 text-[13px] text-center font-body">Apuntá al pase digital. La cámara sigue abierta para el siguiente.</p>
            </div>
          )}

          {/* FIN-2 (3): captura opcional de documento, ya registrado el
              check-in. Es un panel al costado de la fila: se puede cerrar y
              seguir registrando gente sin llenarlo. */}
          {docCapture && (
            <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-sm)]">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] text-navy-light/80 font-body">
                  <span className="font-medium text-navy">{docCapture.name}</span> no tiene documento
                  registrado. Si lo tenés a mano, podés agregarlo — es opcional.
                </p>
                <button
                  onClick={() => setDocCapture(null)}
                  aria-label="Cerrar captura de documento"
                  className="shrink-0 rounded-lg p-1 text-navy-light/80 transition-colors hover:bg-navy/5 hover:text-navy"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
              <div className="mt-3">
                <DocumentCapture
                  memberId={docCapture.id}
                  eventId={id}
                  idPrefix="checkin-doc"
                  submitLabel="Guardar documento"
                  onSaved={() => {
                    setMemberResults(prev => prev.map(m => (
                      m.id === docCapture.id ? { ...m, has_document: true, pedir_documento: false } : m
                    )))
                    setDocCapture(null)
                  }}
                />
              </div>
            </div>
          )}

          {/* El panel de la puerta. Dos avisos distintos, uno a la vez:
              · CHK-5 — adulto sin correo: se le pide y se guarda acá mismo.
              · DAT-12 — menor sin ningún adulto asociado: solo se AVISA.
                Vincular familias es trabajo de padrón y necesita otro permiso;
                lo que hace falta es que alguien consiga el dato mientras la
                persona todavía está enfrente.
              A quién le toca cuál lo decide el servidor: acá solo se pinta. */}
          {contactCapture && (
            <div className={cn(
              'rounded-2xl p-4 shadow-[var(--shadow-sm)]',
              contactCapture.tipo === 'menor_sin_adulto' ? 'bg-coral/5 ring-1 ring-coral/30' : 'bg-surface-card',
            )}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] text-navy-light/80 font-body">
                  {colaDeContacto.length > 1 && (
                    <span className="mr-1.5 rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-display tracking-wide text-navy">
                      1 de {colaDeContacto.length}
                    </span>
                  )}
                  <span className="font-medium text-navy">{contactCapture.name}</span>{' '}
                  {contactCapture.tipo === 'menor_sin_adulto'
                    ? MENSAJE_MENOR_SIN_ADULTO
                    : contactCapture.pedir.email && contactCapture.pedir.phone
                      ? 'no tiene correo ni teléfono registrados. Si los tenés a mano, aprovechá — es opcional.'
                      : contactCapture.pedir.email
                        ? 'no tiene correo registrado. Sin correo no puede entrar al sistema — pedíselo si podés.'
                        : 'no tiene teléfono registrado. Si lo tenés a mano, podés agregarlo — es opcional.'}
                </p>
                <button
                  onClick={siguienteContacto}
                  aria-label="Cerrar aviso"
                  className="shrink-0 rounded-lg p-1 text-navy-light/80 transition-colors hover:bg-navy/5 hover:text-navy"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
              {contactCapture.tipo === 'menor_sin_adulto' ? (
                <button
                  type="button"
                  onClick={siguienteContacto}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-coral px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-coral-deep font-body"
                >
                  Entendido
                </button>
              ) : (
                <div className="mt-3">
                  <ContactCapture
                    memberId={contactCapture.id}
                    eventId={id}
                    pedir={contactCapture.pedir}
                    idPrefix="checkin-contacto"
                    onSaved={guardado => {
                      setMemberResults(prev => prev.map(m => (m.id === contactCapture.id
                        ? { ...m, falta_contacto: {
                            email: (m.falta_contacto?.email ?? false) && !guardado.email,
                            phone: (m.falta_contacto?.phone ?? false) && !guardado.phone,
                          } }
                        : m)))
                      siguienteContacto()
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Búsqueda manual */}
          <input
            className="w-full rounded-2xl bg-surface-card px-5 py-4 text-base text-navy placeholder-navy-light/60 outline-none focus:ring-2 focus:ring-coral/30 shadow-[var(--shadow-sm)] font-body"
            placeholder="Buscar por nombre o cédula…"
            aria-label="Buscar por nombre o cédula"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedMember(null) }}
          />

          {/* Selección de miembro / resultados de búsqueda */}
          {selectedMember ? (
            <div className="flex justify-center">
              <CheckinCard
                member={selectedMember}
                cumple={avisoDeCumple(selectedMember.birth_md)}
                onConfirm={handleConfirm}
                onCancel={() => { setSelectedMember(null); setQuery('') }}
                targetLabel={targetLabel}
                puerta={serverGate}
              />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleSelectMember(r)}
                  className="w-full flex items-center gap-4 rounded-2xl bg-surface-card px-4 py-3 text-left hover:bg-surface-low transition-colors shadow-[var(--shadow-sm)] min-h-[60px]"
                >
                  <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0', avatarColor(r.name))}>
                    {getInitials(r.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-navy font-medium font-body truncate">
                      {/* CHK-2: se ve ANTES de marcar, igual que la marca de
                          "ya registrado" — en la fila, enterarse después es
                          enterarse tarde. El emoji va con texto alternativo:
                          solo no dice nada a quien usa lector de pantalla. */}
                      {avisoDeCumple(r.birth_md) && (
                        <>
                          <span aria-hidden className="mr-1">🎂</span>
                          <span className="sr-only">Cumple años esta semana. </span>
                        </>
                      )}
                      {r.name}
                    </p>
                    <p className="text-navy-light/80 text-[13px] font-body">
                      {registeredIds.has(r.id) ? 'Inscrito' : 'Miembro'}
                      {r.pedir_documento === true && (
                        <span className="ml-2 rounded-md bg-navy/5 px-1.5 py-0.5 text-[11px] text-navy-light/80">
                          sin documento
                        </span>
                      )}
                    </p>
                    {/* Quien YA tiene check-in sale marcado acá, antes de que el
                        operador toque: en la fila, saberlo después es tarde. */}
                    {marcaEnLaBusqueda(checkinPorMiembro.get(r.id)) && (
                      <p className="text-teal-deep text-[13px] font-semibold font-body">
                        {marcaEnLaBusqueda(checkinPorMiembro.get(r.id))}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : query.trim().length >= 2 && searching ? (
            <div className="rounded-2xl bg-surface-card p-6 text-center shadow-[var(--shadow-sm)]">
              <p className="text-navy-light/80 text-sm font-body">Buscando…</p>
            </div>
          ) : query.trim().length >= 2 ? (
            <div className="rounded-2xl bg-surface-card p-6 text-center shadow-[var(--shadow-sm)]">
              <p className="text-navy-light/80 text-sm font-body">No se encontró nadie con ese nombre.</p>
            </div>
          ) : null}

          {/* Ya registrado: estado y salida, no un error. Va sobre la lista
              porque es la respuesta a lo que el operador acaba de tocar. */}
          {yaRegistrado && (
            <div className="rounded-2xl bg-teal-soft/20 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <UserCheck size={18} className="text-teal-deep shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0">
                  <p className="text-navy font-medium font-body">{yaRegistrado.nombre}</p>
                  <p className="text-[13px] text-navy-light font-body">
                    {textoYaRegistrado(yaRegistrado.checkin)}
                  </p>
                </div>
              </div>
              {confirmarDeshacer ? (
                <div className="space-y-2">
                  <p className="text-[13px] text-coral-deep font-body">
                    {textoDeshacer(yaRegistrado.nombre)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={deshacerCheckin}
                      disabled={deshaciendo}
                      className="flex-1 rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white hover:bg-coral-deep transition-colors disabled:opacity-60 font-body min-h-[44px]"
                    >
                      {deshaciendo ? 'Quitando…' : 'Sí, quitar el check-in'}
                    </button>
                    <button
                      onClick={() => setConfirmarDeshacer(false)}
                      disabled={deshaciendo}
                      className="rounded-xl border border-navy/20 px-4 py-2.5 text-sm text-navy hover:bg-navy/5 transition-colors font-body min-h-[44px]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setYaRegistrado(null); setQuery('') }}
                    className="flex-1 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-ink transition-colors font-body min-h-[44px]"
                  >
                    Entendido
                  </button>
                  {canCheckin && (
                    <button
                      onClick={() => setConfirmarDeshacer(true)}
                      className="rounded-xl border border-coral/40 px-4 py-2.5 text-sm text-coral hover:bg-coral/5 transition-colors font-body min-h-[44px]"
                    >
                      Deshacer check-in
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Persona nueva: botón FIJO. Antes solo aparecía después de escribir
              un nombre y esperar a que la búsqueda no encontrara nada — tres
              pasos para lo que en la fila es lo primero que se sabe: que la
              persona no está. Cuando ya hay algo escrito, arrastra el nombre al
              formulario para no volver a teclearlo. */}
          <button
            onClick={() => setShowNewPerson(true)}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors font-body min-h-[52px]',
              // Cuando la búsqueda YA encontró a alguien, lo que hay que hacer es
              // tocar a esa persona: el alta baja a secundaria para no competir
              // con el resultado. Sin resultados, es la acción principal.
              searchResults.length > 0
                ? 'border border-dashed border-coral/50 text-coral hover:bg-coral/5'
                : 'bg-coral text-white hover:bg-coral-deep',
            )}
          >
            <UserPlus size={17} />
            {query.trim().length >= 2
              ? `Agregar a «${query.trim()}» como persona nueva`
              : 'Agregar persona nueva'}
          </button>
            </div>

            {/* Columna derecha: registrados */}
            <div className="space-y-4">
          {/* Lista de registrados */}
          <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--outline-variant)] flex items-center justify-between gap-3">
              <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display truncate">
                Registrados{hasSubs ? ` · ${targetLabel}` : ''}
              </p>
              <span className="text-[13px] text-navy-light/80 font-body tabular-nums shrink-0">{visibleCheckins.length}</span>
            </div>
            {visibleCheckins.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-navy-light/80 font-body">Aún nadie registrado. Escaneá un QR o buscá por nombre.</p>
            ) : visibleCheckins.map(ci => (
              <div key={ci.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--outline-variant)] last:border-0">
                <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0', avatarColor(ci.member_name))}>
                  {getInitials(ci.member_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-navy text-sm truncate font-body">{ci.member_name}</p>
                  <p className="text-navy-light/80 text-[13px] font-body">
                    {(() => { const d = new Date(ci.checked_at); return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }) })()}
                    {subName(ci.sub_event_id) ? ` · ${subName(ci.sub_event_id)}` : ''}
                  </p>
                </div>
                <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium shrink-0',
                  ci.attendance_type === 'server' ? 'bg-coral/10 text-coral' : 'bg-teal-soft/30 text-teal-deep')}>
                  {ci.attendance_type === 'server' ? 'Servidor' : 'Participante'}
                </span>
                {canCheckin && (
                  <button
                    onClick={() => setToDelete(ci)}
                    aria-label={`Eliminar check-in de ${ci.member_name}`}
                    title="Eliminar check-in"
                    className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-navy-light/80 hover:text-coral hover:bg-coral/5 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
            </div>
          </div>
        </PageContainer>
      </div>

      {showNewPerson && (
        <NewPersonModal
          eventId={id}
          initialName={query.trim()}
          onClose={() => setShowNewPerson(false)}
          onCreated={handlePersonCreated}
          onCheckedIn={() => { setShowNewPerson(false); setQuery('') }}
          persistCheckin={persistCheckin}
        />
      )}

      {familyCheckin && (
        <FamilyCheckinModal
          eventId={id}
          member={familyCheckin.member}
          family={familyCheckin.family}
          subEvents={event.sub_events}
          defaultSub={targetSub}
          busy={checkingFamily}
          onRegister={registerFamily}
          onClose={() => setFamilyCheckin(null)}
        />
      )}

      {/* Cobro en sitio de un no inscrito en evento pago (Fase 2, 2 caminos). */}
      {cobroTarget && (
        <Modal onClose={() => !cobroSubmitting && setCobroTarget(null)} titleId="cobro-title" width={460}>
          <div className="p-6 space-y-5">
            <div className="space-y-1.5">
              <h3 id="cobro-title" className="text-base font-bold text-navy font-display">
                Cobro en sitio — {cobroTarget.name}
              </h3>
              <p className="text-sm text-navy-light/80 font-body">
                No tiene inscripción en este evento pago. Registrá el cobro y le hacés
                check-in de una vez.
                {event.payment_amount != null && event.payment_amount > 0 && (
                  <> Monto del evento: <strong className="text-navy">{formatMoney(event.payment_amount, event.currency)}</strong>.</>
                )}
              </p>
            </div>

            <div className="space-y-3">
              {/* Camino 1 — enviar cobro a la persona */}
              <button
                onClick={() => submitOnsiteCharge('pending')}
                disabled={!!cobroSubmitting}
                className="w-full text-left rounded-xl border border-[var(--outline-variant)] p-4 hover:border-coral/60 hover:bg-surface-low transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="text-sm font-semibold text-navy font-body">
                  {cobroSubmitting === 'pending' ? 'Registrando…' : 'Enviar cobro a la persona'}
                </p>
                <p className="text-[13px] text-navy-light/80 font-body mt-1">
                  Inscribe con pago pendiente, le llega un correo para subir el comprobante
                  y hace check-in ya. Queda en la cola de finanzas.
                </p>
              </button>

              {/* Camino 2 — pago verificado en sitio */}
              <button
                onClick={() => submitOnsiteCharge('verified')}
                disabled={!!cobroSubmitting}
                className="w-full text-left rounded-xl border border-coral bg-coral/5 p-4 hover:bg-coral/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="text-sm font-semibold text-coral-deep font-body">
                  {cobroSubmitting === 'verified' ? 'Registrando…' : 'Marcar pago verificado en sitio'}
                </p>
                <p className="text-[13px] text-navy-light/80 font-body mt-1">
                  Ya viste el comprobante en su teléfono. Registra el pago como aprobado
                  (con tu nombre y la hora) y hace check-in.
                </p>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => { setCobroTarget(null); setQuery('') }}
                disabled={!!cobroSubmitting}
                className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors font-body disabled:opacity-40"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmar eliminación de check-in */}
      {toDelete && (
        <Modal onClose={() => !deleting && setToDelete(null)} titleId="del-checkin-title" width={380}>
          <div className="p-5 space-y-4">
            <h2 id="del-checkin-title" className="text-base font-display font-extrabold text-navy">
              ¿Eliminar el check-in de {toDelete.member_name}?
            </h2>
            <p className="text-sm text-navy-light/80 font-body">
              Quita su registro de asistencia a este evento. Se puede volver a registrar.
            </p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setToDelete(null)} disabled={deleting} className="flex-1 rounded-full border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body disabled:opacity-40">Cancelar</button>
              <button onClick={confirmDelete} disabled={deleting} className="flex-1 rounded-full bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body disabled:opacity-50">{deleting ? 'Eliminando…' : 'Eliminar'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Modal: check-in en familia (miembro existente con familia) ──────────────────

function FamilyCheckinModal({ eventId, member, family, subEvents, defaultSub, busy, onRegister, onClose }: {
  eventId: string
  member: { id: string; name: string }
  family: { member_id: string; name: string; relation: string }[]
  subEvents: { id: string; name: string }[]
  defaultSub: string | null
  busy: boolean
  onRegister: (entries: Array<{ id: string; name: string; sub_event_id: string | null; tipo: AttendanceType }>) => void
  onClose: () => void
}) {
  const hasSubs = subEvents.length > 0
  const everyone = useMemo(() => [
    { member_id: member.id, name: member.name, relation: 'Titular' as const },
    ...family,
  ], [member.id, member.name, family])
  // El titular arranca seleccionado; los familiares deseleccionados (solo se
  // registra a quien se marque). Cada quien con el subevento por defecto.
  const [selected, setSelected] = useState<Set<string>>(new Set([member.id]))
  const [subById, setSubById] = useState<Record<string, string | null>>(
    () => Object.fromEntries(everyone.map(p => [p.member_id, defaultSub])),
  )
  /**
   * Quién de los que llegaron puede marcarse como SERVIDOR. Se pregunta por
   * cada uno al mismo endpoint que usa la tarjeta normal —la regla no se
   * duplica— y en paralelo, que son dos o tres personas.
   */
  const [puertas, setPuertas] = useState<Record<string, InfoDeServidor | null>>({})
  const [tipoPorPersona, setTipoPorPersona] = useState<Record<string, AttendanceType>>({})
  useEffect(() => {
    let vivo = true
    void Promise.all(everyone.map(async p => {
      const r = await fetch(`/api/events/${eventId}/server-check?member_id=${p.member_id}`).catch(() => null)
      const d = r?.ok ? await r.json().catch(() => null) : null
      return [p.member_id, d ? { hasCommittees: !!d.hasCommittees, isServer: !!d.isServer } : null] as const
    })).then(pares => { if (vivo) setPuertas(Object.fromEntries(pares)) })
    return () => { vivo = false }
  }, [eventId, everyone])

  function toggle(id: string) {
    if (id === member.id) return // el titular siempre va
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function setSub(id: string, sub: string | null) {
    setSubById(prev => ({ ...prev, [id]: sub }))
  }

  function buildEntries(ids: string[]) {
    return ids.map(id => {
      const p = everyone.find(x => x.member_id === id)!
      return {
        id, name: p.name,
        sub_event_id: hasSubs ? (subById[id] ?? null) : defaultSub,
        // Por omisión participante: es lo que era antes y lo que corresponde a
        // la mayoría. Solo cambia si alguien lo marca a propósito.
        tipo: tipoPorPersona[id] ?? ('participant' as AttendanceType),
      }
    })
  }

  const subLabel = (id: string | null) => id === null ? 'Evento general' : (subEvents.find(s => s.id === id)?.name ?? 'Evento general')

  return (
    <Modal onClose={onClose} titleId="family-checkin-title" width={480} tone="dark">
      <div className="p-6 space-y-4">
        <h3 id="family-checkin-title" className="text-lg font-extrabold text-white font-display">
          {member.name} viene con familia
        </h3>
        <p className="text-sm text-white/80 font-body">
          {hasSubs ? '¿Quién llegó y a qué subevento va cada uno?' : '¿Quién más llegó?'}
        </p>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {everyone.map(p => {
            const isTitular = p.member_id === member.id
            const on = selected.has(p.member_id)
            return (
              <div key={p.member_id} className={cn('rounded-xl px-3 py-2.5', isTitular ? 'bg-white/10' : 'bg-white/5')}>
                <div className="flex items-center gap-3">
                  {isTitular ? (
                    <span className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <input type="checkbox" checked={on} onChange={() => toggle(p.member_id)} className="accent-coral h-4 w-4 shrink-0" aria-label={`Incluir a ${p.name}`} />
                  )}
                  <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0', isTitular ? 'bg-coral' : 'bg-navy-light')}>{getInitials(p.name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate font-body">{p.name}</p>
                    <p className="text-[13px] text-white/80">{p.relation}</p>
                  </div>
                </div>
                {on && ofreceServidor(puertaDeServidor(puertas[p.member_id])) && (
                  <div className="mt-2 pl-7 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Cómo asiste ${p.name}`}>
                    {([['participant', 'Participante'], ['server', 'Servidor']] as const).map(([valor, texto]) => {
                      const checked = (tipoPorPersona[p.member_id] ?? 'participant') === valor
                      return (
                        <button
                          key={valor}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          onClick={() => setTipoPorPersona(prev => ({ ...prev, [p.member_id]: valor }))}
                          className={cn('rounded-full px-3 py-1 text-[13px] font-body transition-colors',
                            checked ? 'bg-teal-deep text-white' : 'bg-white/10 text-white/80 hover:bg-white/15')}
                        >
                          {texto}
                        </button>
                      )
                    })}
                  </div>
                )}
                {hasSubs && on && (
                  <div className="mt-2 pl-7 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Subevento de ${p.name}`}>
                    {[{ id: null as string | null, name: 'Evento general' }, ...subEvents.map(se => ({ id: se.id as string | null, name: se.name }))].map(opt => {
                      const checked = (subById[p.member_id] ?? null) === opt.id
                      return (
                        <button
                          key={opt.id ?? 'general'}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          onClick={() => setSub(p.member_id, opt.id)}
                          className={cn('rounded-full px-3 py-1 text-[13px] font-body transition-colors',
                            checked ? 'bg-coral text-white' : 'bg-white/10 text-white/80 hover:bg-white/15')}
                        >
                          {opt.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onRegister(buildEntries([member.id]))}
            disabled={busy}
            className="flex-1 rounded-2xl border border-white/15 py-3 text-sm font-medium text-white/80 hover:bg-white/10 transition-colors disabled:opacity-50 font-body"
          >
            Solo {member.name.split(' ')[0]}{hasSubs ? ` (${subLabel(subById[member.id] ?? null)})` : ''}
          </button>
          <button
            onClick={() => onRegister(buildEntries(Array.from(selected)))}
            disabled={busy}
            className="flex-1 rounded-2xl bg-coral py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-colors disabled:opacity-50 font-body"
          >
            {busy ? 'Registrando…' : `Registrar ${selected.size}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Modal: agregar persona nueva (primera visita) ──────────────────────────────

function NewPersonModal({ eventId, initialName, onClose, onCreated, onCheckedIn, persistCheckin }: {
  /** El alta va por el endpoint del evento, que es el que le da permiso al
   *  equipo de check-in sin abrirle el padrón. */
  eventId: string
  initialName: string
  onClose: () => void
  onCreated: (member: { id: string; name: string }) => void
  onCheckedIn: () => void
  persistCheckin: (m: { id: string; name: string }, type: AttendanceType) => Promise<'ok' | 'dup' | 'error' | 'not_registered'>
}) {
  const parts = initialName.split(' ')
  const [firstName, setFirstName] = useState(parts[0] ?? '')
  const [lastName, setLastName] = useState(parts.slice(1).join(' '))
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [cedula, setCedula] = useState('')
  const [documentType, setDocumentType] = useState<string>('cedula')
  const [birthDate, setBirthDate] = useState('')
  // EVE-12 · Menor con datos protegidos (España): de esta ficha solo se
  // guardan nombre y fecha de nacimiento, no se le crea cuenta, y cuelga de la
  // familia del adulto que lo trajo.
  const [menorProtegido, setMenorProtegido] = useState(false)
  const [familiar, setFamiliar] = useState<{ id: string; nombre: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [familyDrafts, setFamilyDrafts] = useState<FamilyDraft[]>([])
  const [showFamily, setShowFamily] = useState(false)
  const [tocado, setTocado] = useState(false)
  // Persona que YA tiene esa cédula. En vez de solo bloquear, se ofrece hacerle
  // el check-in a ella: es lo que resuelve la fila y lo que evita el duplicado.
  const [yaExiste, setYaExiste] = useState<{ id: string; name: string } | null>(null)

  // exigirCorreo: en el check-in la persona está enfrente, es la única
  // oportunidad de pedirle el correo — y sin correo no se le puede crear la
  // cuenta de acceso. Los menores de 12 quedan fuera: no llevan cuenta (AUTH-1).
  const chequeo = validarAltaDePersona({
    first_name: firstName, last_name: lastName, cedula, email,
    birth_date: birthDate, document_type: documentType, exigirCorreo: true,
  })
  const esCedulaCR = documentType === 'cedula'
  // Un menor protegido no pasa por validarAltaDePersona: esa función exige
  // correo y documento, que son justo lo que de él no se guarda. Su regla
  // vive en menor-protegido.ts y el servidor la vuelve a aplicar.
  const impedimentoMenor = menorProtegido
    ? motivoQueImpideCrear({
        datos: { first_name: firstName, last_name: lastName, birth_date: birthDate },
        familiarId: familiar?.id ?? null,
      })
    : null
  const valid = menorProtegido ? impedimentoMenor === null : chequeo.ok

  /** Al salir del campo: ¿esta cédula ya es de alguien? El lookup busca por
   *  cédula además de por nombre, así que sirve tal cual. */
  async function buscarDuplicado() {
    const n = normalizeCedula(cedula)
    if (!n) { setYaExiste(null); return }
    try {
      const res = await fetch(`/api/members/lookup?search=${encodeURIComponent(n)}&pageSize=5`)
      if (!res.ok) return
      const d = await res.json() as { members?: Array<{ id: string; first_name: string; last_name: string; cedula?: string | null; document_type?: string | null }> }
      // El documento dedupea por PAREJA (tipo, número) — INT-1: un pasaporte
      // AB123456 y una cédula AB123456 no son la misma persona.
      const hit = (d.members ?? []).find(m =>
        normalizeCedula(String(m.cedula ?? '')).toUpperCase() === n.toUpperCase() &&
        (m.document_type ?? 'cedula') === documentType)
      setYaExiste(hit ? { id: hit.id, name: `${hit.first_name} ${hit.last_name}`.trim() } : null)
    } catch {
      // Si la consulta falla no se frena el alta: el POST /api/members igual
      // devuelve 409 por duplicado y ahí se avisa.
    }
  }

  /** El alta va por el endpoint del EVENTO, no por /api/members: ese exige roles
   *  de padrón que encargado_eventos no tiene —el rol que atiende la fila—, así
   *  que crear a alguien nuevo devolvía 403 (bug 2026-09-09). El endpoint
   *  acotado acepta solo datos básicos y no le abre el padrón al rol. */
  async function createMember(payload: Record<string, unknown>): Promise<{ id: string; name: string }> {
    const res = await fetch(`/api/events/${eventId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      // El 409 dice A QUIÉN pertenece el documento: en la fila lo más común es
      // que la persona sí exista y no se la haya encontrado, y saber el nombre
      // es lo que permite usar esa ficha en vez de crear el duplicado.
      if (data?.code === 'duplicate' && data?.member?.first_name) {
        const dup = `${data.member.first_name} ${data.member.last_name ?? ''}`.trim()
        setYaExiste({ id: data.member.id as string, name: dup })
        throw new Error(`Ese documento o correo ya es de ${dup}. Buscala por su nombre y hacele el check-in.`)
      }
      // El mensaje del servidor primero: dice qué pasó de verdad (documento con
      // formato inválido, campo no permitido) en vez de un genérico.
      throw new Error(data?.error || `No se pudo crear a ${payload.first_name}.`)
    }
    return { id: data.id as string, name: `${payload.first_name} ${payload.last_name}` }
  }

  async function submit() {
    if (saving) return
    if (!valid) { setTocado(true); return }
    setSaving(true)
    setError(null)
    try {
      if (menorProtegido) {
        const menor = await createMember({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          birth_date: birthDate || null,
          datos_protegidos: true,
          familiar_id: familiar?.id ?? null,
        })
        onCreated(menor)
        return
      }

      const principal = await createMember({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        cedula: cedula.trim() || null,
        document_type: documentType,
        birth_date: birthDate || null,
        // La invitación la dispara el endpoint cuando hay correo: cada ficha
        // nueva sale con su cuenta para que la persona ponga contraseña.
      })

      // Sin familia → flujo de una persona (el operador elige participante/servidor).
      if (familyDrafts.length === 0) {
        onCreated(principal)
        return
      }

      // Con familia → crear integrantes, armar familia y check-in de todos.
      const entries: Array<{ member_id: string; relation: string }> = [{ member_id: principal.id, relation: 'Titular' }]
      const toCheckin: Array<{ id: string; name: string }> = [principal]
      for (const d of familyDrafts) {
        if (d.kind === 'linked') {
          entries.push({ member_id: d.member_id, relation: d.relation })
          toCheckin.push({ id: d.member_id, name: `${d.first_name} ${d.last_name}` })
        } else {
          const created = await createMember({
            first_name: d.first_name,
            last_name: d.last_name || lastName.trim(),
            cedula: d.cedula,
            document_type: d.document_type,
            birth_date: d.birth_date,
            phone: d.phone,
            email: d.email,
          })
          entries.push({ member_id: created.id, relation: d.relation })
          toCheckin.push(created)
        }
      }
      // Por el endpoint del evento, no /api/families: ese exige roles de
      // padrón y dejaba la familia sin armar DESPUÉS de haber creado a todos.
      const famRes = await fetch(`/api/events/${eventId}/families`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Familia ${lastName.trim()}`, members: entries }),
      })
      if (!famRes.ok) throw new Error('Se crearon los miembros pero falló la creación de la familia.')

      // Evento pago: los recién creados no están inscritos → el gate los frena.
      // Se reporta (el cobro en sitio es individual, no en este alta en lote).
      const notReg: string[] = []
      for (const m of toCheckin) {
        const r = await persistCheckin(m, 'participant')
        if (r === 'not_registered') notReg.push(m.name)
      }
      if (notReg.length > 0) {
        setError(`Evento pago: falta inscribir/cobrar a ${notReg.join(', ')} desde el check-in individual.`)
        return
      }
      onCheckedIn()
    } catch (err) {
      console.error('Error creando persona/familia:', err)
      setError(err instanceof Error ? err.message : 'No se pudo crear. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const fieldCls = 'w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-coral/40'
  const fieldStyle = { background: 'rgba(255,255,255,0.08)', fontFamily: 'var(--font-body)' } as const
  const labelStyle = { fontFamily: 'var(--font-body)' } as const
  const labelCls = 'text-[13px] text-white/80 block'

  return (
    <Modal onClose={onClose} titleId="new-person-title" width={448} tone="dark">
      <div className="p-6 space-y-4">
        <h3 id="new-person-title" className="text-lg font-extrabold text-white font-display">Persona nueva</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="np-first" className={labelCls} style={labelStyle}>Nombre *</label>
            <input id="np-first" className={fieldCls} style={fieldStyle} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Nombre" />
          </div>
          <div className="space-y-1">
            <label htmlFor="np-last" className={labelCls} style={labelStyle}>Apellidos *</label>
            <input id="np-last" className={fieldCls} style={fieldStyle} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Apellidos" />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="np-birth" className={labelCls} style={labelStyle}>
            Fecha de nacimiento {menorProtegido ? '*' : ''}
          </label>
          <input id="np-birth" type="date" className={fieldCls} style={fieldStyle} value={birthDate} onChange={e => setBirthDate(e.target.value)} />
        </div>

        {/* EVE-12 · España: de un menor con datos protegidos no se puede
            guardar más que su nombre y su fecha de nacimiento. */}
        <label className="flex items-start gap-2.5 rounded-xl p-3 cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <input
            type="checkbox"
            checked={menorProtegido}
            onChange={e => { setMenorProtegido(e.target.checked); setError(null) }}
            className="mt-0.5 accent-coral shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-white font-body">Menor con datos protegidos</span>
            <span className="block text-[13px] text-white/80 font-body">
              Solo se guardan nombre y fecha de nacimiento. No se le crea cuenta y su ficha queda con la familia.
            </span>
          </span>
        </label>

        {menorProtegido ? (
          <div className="space-y-1">
            <label htmlFor="np-familiar" className={labelCls} style={labelStyle}>¿Con quién viene? *</label>
            {familiar ? (
              <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                <span className="flex-1 text-sm text-white font-body">{familiar.nombre}</span>
                <button
                  type="button"
                  onClick={() => setFamiliar(null)}
                  className="text-[13px] text-white/80 hover:text-white font-body"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <MemberCombobox
                onSelect={m => setFamiliar({ id: m.id, nombre: `${m.first_name} ${m.last_name}`.trim() })}
                placeholder="Buscar a la mamá, el papá o el familiar…"
              />
            )}
            {tocado && impedimentoMenor && (
              <p className="text-[13px] text-coral-soft font-body" role="alert">{impedimentoMenor.mensaje}</p>
            )}
          </div>
        ) : (
        <>
        <div className="space-y-1">
          <label htmlFor="np-phone" className={labelCls} style={labelStyle}>Teléfono</label>
          <input id="np-phone" className={fieldCls} style={fieldStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="8888-8888" />
        </div>
        <div className="space-y-1">
          <label htmlFor="np-email" className={labelCls} style={labelStyle}>
            Correo {chequeo.exigeCorreo ? '*' : '(opcional para menores de 12)'}
          </label>
          <input
            id="np-email" type="email" className={fieldCls} style={fieldStyle}
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            aria-invalid={tocado && !!chequeo.errores.email}
            aria-describedby={chequeo.errores.email ? 'np-email-err' : undefined}
          />
          {tocado && chequeo.errores.email && (
            <p id="np-email-err" className="text-[13px] text-coral-soft font-body" role="alert">
              {chequeo.errores.email}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="np-doctype-x" className={labelCls} style={labelStyle}>Tipo de documento</label>
            <select
              id="np-doctype-x" className={fieldCls} style={fieldStyle}
              value={documentType}
              onChange={e => { setDocumentType(e.target.value); setYaExiste(null) }}
            >
              {DOCUMENT_TYPES.map(t => (
                // El desplegable nativo lo pinta el sistema, no el modal: sin
                // color propio, las opciones salen blanco sobre blanco.
                <option key={t} value={t} style={{ color: '#161440', background: '#FFFFFF' }}>
                  {DOCUMENT_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="np-cedula" className={labelCls} style={labelStyle}>
            {esCedulaCR ? 'Cédula' : 'Número de documento'}
            {/* Opcional para todos desde 2026-09-09: FIN-2 lo reclama después
                y no se traba la fila del evento por el documento. */}
            {' (opcional)'}
          </label>
          <input
            id="np-cedula" className={fieldCls} style={fieldStyle}
            value={cedula}
            onChange={e => { setCedula(e.target.value); setYaExiste(null) }}
            onBlur={buscarDuplicado}
            placeholder={esCedulaCR ? '1-2345-6789' : documentType === 'dni_nie' ? '12345678Z' : 'AB123456'}
            aria-invalid={tocado && !!chequeo.errores.cedula}
            aria-describedby={chequeo.errores.cedula ? 'np-cedula-err' : undefined}
          />
        </div>

        {tocado && chequeo.errores.cedula && (
          <p id="np-cedula-err" className="text-[13px] text-coral-soft font-body" role="alert">
            {chequeo.errores.cedula}
          </p>
        )}
        </>
        )}

        {/* La cédula ya es de alguien: se ofrece registrar a esa persona en vez
            de crear un duplicado. */}
        {yaExiste && (
          <div className="rounded-xl bg-white/10 px-3 py-3 space-y-2" role="alert">
            <p className="text-[13px] text-white font-body">
              Esa cédula ya es de <span className="font-semibold">{yaExiste.name}</span>. No hay que
              crearle otra ficha.
            </p>
            <button
              type="button"
              onClick={() => { onCreated(yaExiste); }}
              className="w-full rounded-xl bg-white/15 py-2 text-[13px] font-medium text-white hover:bg-white/25 transition-colors font-body"
            >
              Hacerle el check-in a {yaExiste.name.split(' ')[0]}
            </button>
          </div>
        )}

        {/* Familia */}
        <div className="space-y-2">
          {familyDrafts.map((d, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <div className="h-7 w-7 rounded-full bg-navy-light flex items-center justify-center text-[11px] font-bold text-white">{getInitials(`${d.first_name} ${d.last_name}`)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate font-body">{d.first_name} {d.last_name}</p>
                <p className="text-[13px] text-white/80">{d.relation} · {d.kind === 'linked' ? 'existente' : 'nuevo'}</p>
              </div>
              <button onClick={() => setFamilyDrafts(prev => prev.filter((_, j) => j !== i))} className="text-white/80 hover:text-coral"><X size={14} /></button>
            </div>
          ))}
          <button
            onClick={() => setShowFamily(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-2.5 text-[13px] text-white/80 hover:text-white hover:border-white/30 transition-colors font-body"
          >
            <UserPlus size={14} /> Agregar familia
          </button>
        </div>

        {error && <p className="text-[13px] text-coral-soft font-body" role="alert">{error}</p>}

        {tocado && (chequeo.errores.first_name || chequeo.errores.last_name) && (
          <p className="text-[13px] text-coral-soft font-body" role="alert">
            {chequeo.errores.first_name ?? chequeo.errores.last_name}
          </p>
        )}

        <p className="text-[13px] text-white/80 font-body">
          Se le enviará una invitación al correo para que active su cuenta y complete su perfil.
        </p>

        <button
          onClick={submit}
          disabled={saving || !!yaExiste}
          className="w-full rounded-2xl bg-coral py-3 text-sm font-semibold text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
        >
          {saving ? 'Creando…' : familyDrafts.length > 0 ? `Crear familia y check-in (${familyDrafts.length + 1})` : 'Crear y hacer check-in'}
        </button>
      </div>

      {showFamily && (
        <FamilyMemberModal
          defaultLastName={lastName.trim()}
          existingIds={familyDrafts.filter((f): f is Extract<FamilyDraft, { kind: 'linked' }> => f.kind === 'linked').map(f => f.member_id)}
          onAdd={d => { setFamilyDrafts(prev => [...prev, d]); setShowFamily(false) }}
          onClose={() => setShowFamily(false)}
        />
      )}
    </Modal>
  )
}
