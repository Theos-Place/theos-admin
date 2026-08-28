'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, MapPin, Video, Ticket, Users } from 'lucide-react'
import { loginRedirectTo, registerDestination } from '@/lib/events/public-register-link'
import { formatDateLong, formatMoney } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'

/**
 * Página PÚBLICA de un evento: lo que ve quien llega por el link compartido o
 * escaneando el QR, sin haber entrado nunca al sistema.
 *
 * Por qué existe y no se comparte /eventos directo: un QR lo escanea gente que
 * quizá no tiene cuenta. Mandarla a una pantalla de login sin decirle a qué se
 * está inscribiendo es la forma más rápida de perderla. Acá ve el evento,
 * decide, y recién entonces entra.
 *
 * Muestra solo lo que ya está en el flyer — la API pública es una whitelist y no
 * manda inscritos ni check-ins. El cupo llega como bandera, no como número: de
 * afuera hace falta saber si se puede entrar, no cuánta gente hay adentro.
 *
 * Al tocar "Inscribirme" reusa el login-gate de EVE-1, así que después de entrar
 * el modal de inscripción se abre solo y la elegibilidad se valida server-side,
 * igual que en el flujo normal.
 */
type EventoPublico = {
  id: string
  title: string
  description: string | null
  starts_at: string | null
  location: string | null
  location_url: string | null
  is_virtual: boolean
  requires_registration: boolean
  requires_payment: boolean
  payment_amount: number | null
  currency: string
  flyer_url: string | null
  cupo_lleno: boolean
  inscripcion_cerrada: boolean
}

export default function EventoPublicoPage() {
  const { id } = useParams<{ id: string }>()
  const [evento, setEvento] = useState<EventoPublico | null>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'no-existe'>('cargando')

  useEffect(() => {
    if (!id) return
    let vivo = true
    fetch(`/api/public/events/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => { if (vivo) { setEvento(d); setEstado('listo') } })
      .catch(() => { if (vivo) setEstado('no-existe') })
    return () => { vivo = false }
  }, [id])

  const router = useRouter()

  /** Con sesión se va DIRECTO al deep link; sin sesión, por el login. Mismo
   *  patrón que /calendario (la lista). Mandar SIEMPRE al login era el bug: el
   *  proxy botaba el ?redirect= de quien ya tenía sesión y lo soltaba en su
   *  pantalla de inicio, así que el botón parecía no hacer nada. El proxy ya
   *  quedó arreglado; esto evita además la vuelta innecesaria. */
  async function irAInscribirse() {
    if (!evento) return
    // Con formulario, el destino ES el formulario (ver registerDestination).
    const dest = registerDestination(evento)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      router.push(session ? dest : loginRedirectTo(dest))
    } catch {
      router.push(loginRedirectTo(dest))
    }
  }

  if (estado === 'cargando') {
    return <p className="p-8 text-center text-sm text-navy-light/80 font-body">Cargando…</p>
  }
  // Un link viejo no anuncia que el evento se canceló: simplemente no está.
  if (estado === 'no-existe' || !evento) {
    return (
      <main className="mx-auto max-w-[560px] px-5 py-16 text-center space-y-3">
        <h1 className="text-xl font-bold text-navy font-display">Este evento no está disponible</h1>
        <p className="text-sm text-navy-light/80 font-body">
          Puede que ya haya pasado o que el enlace no sea correcto.
        </p>
        <Link href="/calendario" className="inline-block text-sm text-coral underline decoration-dotted font-body">
          Ver todos los eventos
        </Link>
      </main>
    )
  }

  /** Lo decide el servidor (`inscripcion_cerrada`), no esta pantalla: el reloj
   *  del visitante puede estar mal y `Date.now()` en render es impuro. Sin esto
   *  la página seguía ofreciendo "Inscribirme" para un evento que la app ya no
   *  acepta: la persona entraba, no pasaba nada, y no sabía por qué. */
  const yaEmpezo = evento.inscripcion_cerrada === true
  const precio = evento.requires_payment && evento.payment_amount
    ? formatMoney(evento.payment_amount, evento.currency)
    : null

  return (
    <main className="mx-auto max-w-[560px] px-5 py-10 space-y-6">
      {evento.flyer_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={evento.flyer_url}
          alt={`Flyer de ${evento.title}`}
          className="w-full rounded-2xl"
        />
      )}

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-navy font-display text-balance">{evento.title}</h1>
        {evento.description && (
          <p className="text-sm text-navy-light/80 font-body whitespace-pre-line">{evento.description}</p>
        )}
      </div>

      <dl className="space-y-2.5 rounded-2xl bg-surface-low p-4">
        <Dato icono={<CalendarDays size={16} aria-hidden="true" />} etiqueta="Cuándo">
          {formatDateLong(evento.starts_at)}
        </Dato>
        <Dato
          icono={evento.is_virtual ? <Video size={16} aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />}
          etiqueta={evento.is_virtual ? 'Modalidad' : 'Dónde'}
        >
          {evento.is_virtual ? 'Virtual' : (evento.location || 'Por confirmar')}
        </Dato>
        {precio && (
          <Dato icono={<Ticket size={16} aria-hidden="true" />} etiqueta="Costo">{precio}</Dato>
        )}
      </dl>

      {yaEmpezo ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-outline bg-surface-low px-4 py-3.5">
          <CalendarDays size={18} className="mt-0.5 shrink-0 text-navy-light/40" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy font-body">La inscripción ya cerró</p>
            <p className="text-[13px] text-navy-light/80 font-body">
              Este evento ya empezó. Escribinos si necesitás algo.
            </p>
          </div>
        </div>
      ) : !evento.requires_registration ? (
        <p className="text-sm text-navy-light/80 font-body">
          Este evento no necesita inscripción: te esperamos.
        </p>
      ) : evento.cupo_lleno ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-coral/30 bg-coral/[0.06] px-4 py-3.5">
          <Users size={18} className="mt-0.5 shrink-0 text-coral-deep" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-navy font-body">Ya no hay cupo</p>
            <p className="text-[13px] text-navy-light/80 font-body">
              Se llenaron los lugares para este evento. Escribinos si querés quedar en lista de espera.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={irAInscribirse}
            className="block w-full rounded-xl bg-coral px-5 py-3 text-center text-sm font-medium text-white hover:bg-coral-deep transition-colors font-body"
          >
            Inscribirme
          </button>
          <p className="text-[13px] text-navy-light/80 font-body text-center">
            Para inscribirte necesitás entrar con tu cuenta. Después de entrar,
            la inscripción se abre sola.
          </p>
        </div>
      )}
    </main>
  )
}

function Dato({ icono, etiqueta, children }: {
  icono: React.ReactNode; etiqueta: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-navy-light/40">{icono}</span>
      <div>
        <dt className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">{etiqueta}</dt>
        <dd className="text-sm text-navy font-body">{children}</dd>
      </div>
    </div>
  )
}
