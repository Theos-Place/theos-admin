'use client'
import { useState, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registerDeepLink, loginRedirectTo } from '@/lib/events/public-register-link'
import type { AdminEvent } from '@/data/event-config'
import { usePublicEvents } from '@/hooks/useEvents'
import { monthEvents, eventsInRange } from '@/lib/events/event-views'
import { Modal } from '@/components/shared/Modal'

// Inner component that reads searchParams
function CalendarioWidget() {
  const searchParams = useSearchParams()
  const view = (searchParams.get('view') || 'monthly') as 'monthly' | 'weekly' | 'list' | 'grid'
  const typesParam = searchParams.get('types')
  // Sin ?types= → todos los tipos (equivalente a la BD); con param, solo esos.
  const types = typesParam ? typesParam.split(',') : null
  const primary = searchParams.get('primary') || '#161440'
  const accent = searchParams.get('accent') || '#EF5554'
  const bg = searchParams.get('bg') || '#FFFFFF'
  const showDesc = searchParams.get('showDesc') !== 'false'
  const showLoc = searchParams.get('showLoc') !== 'false'
  const showBtn = searchParams.get('showBtn') !== 'false'

  const { events: allEvents } = usePublicEvents()
  // Base: misma fuente que el interno, filtrada por tipo (si hay) y excluyendo
  // cancelados/archivados. La expansión de recurrentes se hace por vista.
  const baseEvents = useMemo(() =>
    allEvents.filter(e =>
      e.status !== 'cancelled' && e.status !== 'archived' && (!types || types.includes(e.event_type))
    )
  , [allEvents, types])

  // Lista y Grid: desde HOY hasta el fin del mes en curso, recurrentes expandidos.
  const rangedEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    return eventsInRange(baseEvents, today, endOfMonth)
  }, [baseEvents])

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  // Conteo del badge "este mes": TODO el mes en curso (no solo de hoy en
  // adelante), para que coincida con lo que muestra la vista mensual.
  const monthCount = useMemo(
    () => monthEvents(baseEvents, currentMonth, currentYear).length,
    [baseEvents, currentMonth, currentYear],
  )
  const [selectedEvent, setSelectedEvent] = useState<AdminEvent | null>(null)
  const [dayModal, setDayModal] = useState<{ date: number; events: AdminEvent[] } | null>(null)

  function formatEventTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  // EVE-1: fecha completa para el modal de detalle.
  function formatFullDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  const router = useRouter()
  // EVE-1: botón Inscribirse con login-gate (patrón de /vacantes). Sin sesión →
  // /login con redirect al deep link; con sesión → directo a /eventos?register=.
  async function goRegister(eventId: string) {
    const dest = registerDeepLink(eventId)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      router.push(session ? dest : loginRedirectTo(dest))
    } catch {
      router.push(loginRedirectTo(dest))
    }
  }
  function formatDate(iso: string) {
    const d = new Date(iso)
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    const days = ['dom','lun','mar','mié','jue','vie','sáb']
    return { day: d.getDate(), month: months[d.getMonth()], dow: days[d.getDay()], full: d }
  }

  return (
    <div className="min-h-screen font-[system-ui,sans-serif]" style={{ '--cal-primary': primary, '--cal-accent': accent, '--cal-bg': bg, background: bg } as React.CSSProperties}>
      {/* Header */}
      <div className="py-3 px-5 flex items-center justify-between" style={{ background: primary }}>
        <span className="text-white font-bold text-[15px]">Theos Place — Eventos</span>
        <span className="text-[rgba(255,255,255,0.6)] text-xs">{monthCount} este mes</span>
      </div>

      {/* List view */}
      {view === 'list' && (
        <div className="p-5 flex flex-col gap-3">
          {rangedEvents.map(ev => {
            const { day, month, dow } = formatDate(ev.start_at)
            return (
              <div key={`${ev.id}-${ev.start_at}`} className="flex gap-4 p-4 rounded-xl border border-[rgba(0,0,0,0.08)] bg-white cursor-pointer"
                onClick={() => setSelectedEvent(ev)}>
                <div className="text-center min-w-[44px] pt-0.5">
                  <div className="text-[28px] font-extrabold leading-none" style={{ color: primary }}>{day}</div>
                  <div className="text-[11px] uppercase text-[rgba(0,0,0,0.4)] mt-0.5">{month}</div>
                  <div className="text-[10px] text-[rgba(0,0,0,0.3)] mt-px">{dow}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm mb-1" style={{ color: primary }}>{ev.name}</div>
                  {showDesc && ev.description && (
                    <div className="text-xs text-[rgba(0,0,0,0.55)] mb-1 overflow-hidden line-clamp-2">
                      {ev.description}
                    </div>
                  )}
                  {showLoc && ev.location && (
                    <div className="text-[11px] text-[rgba(0,0,0,0.4)]">📍 {ev.location}</div>
                  )}
                  <div className="text-[11px] text-[rgba(0,0,0,0.4)] mt-0.5">🕐 {formatEventTime(ev.start_at)}</div>
                </div>
                {showBtn && ev.requires_registration && (
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); goRegister(ev.id) }}
                      className="text-white rounded-lg py-1.5 px-3 text-xs font-semibold whitespace-nowrap"
                      style={{ background: accent }}
                    >
                      Inscribirse
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {rangedEvents.length === 0 && (
            <p className="text-center text-sm py-8 text-[rgba(0,0,0,0.4)]">No hay eventos este mes.</p>
          )}
        </div>
      )}

      {/* Grid view */}
      {view === 'grid' && (
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rangedEvents.map(ev => {
            const { day, month } = formatDate(ev.start_at)
            return (
              <div key={`${ev.id}-${ev.start_at}`} onClick={() => setSelectedEvent(ev)}
                className="flex flex-col overflow-hidden rounded-xl border border-[rgba(0,0,0,0.08)] bg-white cursor-pointer">
                {ev.flyer_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ev.flyer_url} alt={`Flyer de ${ev.name}`} className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 w-full flex-col items-center justify-center" style={{ background: `${accent}14` }}>
                    <div className="text-[28px] font-extrabold leading-none" style={{ color: primary }}>{day}</div>
                    <div className="text-[11px] uppercase mt-0.5" style={{ color: `${primary}99` }}>{month}</div>
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <div className="font-bold text-sm" style={{ color: primary }}>{ev.name}</div>
                  {showDesc && ev.description && (
                    <div className="text-xs text-[rgba(0,0,0,0.55)] line-clamp-2">{ev.description}</div>
                  )}
                  <div className="mt-auto pt-1 space-y-0.5">
                    {showLoc && ev.location && (
                      <div className="text-[11px] text-[rgba(0,0,0,0.4)]">📍 {ev.location}</div>
                    )}
                    <div className="text-[11px] text-[rgba(0,0,0,0.4)]">🕐 {formatDate(ev.start_at).day} {formatDate(ev.start_at).month} · {formatEventTime(ev.start_at)}</div>
                  </div>
                </div>
              </div>
            )
          })}
          {rangedEvents.length === 0 && (
            <p className="col-span-full text-center text-sm py-8 text-[rgba(0,0,0,0.4)]">No hay eventos este mes.</p>
          )}
        </div>
      )}

      {/* Monthly view */}
      {view === 'monthly' && (
        <div className="p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y-1) } else setCurrentMonth(m => m-1) }}
              className="bg-none border border-[rgba(0,0,0,0.12)] rounded-lg py-1 px-2.5 cursor-pointer text-sm" style={{ color: primary }}>
              ‹
            </button>
            <span className="font-bold text-[15px]" style={{ color: primary }}>
              {new Date(currentYear, currentMonth).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y+1) } else setCurrentMonth(m => m+1) }}
              className="bg-none border border-[rgba(0,0,0,0.12)] rounded-lg py-1 px-2.5 cursor-pointer text-sm" style={{ color: primary }}>
              ›
            </button>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-[repeat(7,1fr)] gap-0.5 mb-1">
            {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => (
              <div key={d} className="text-center text-[10px] text-[rgba(0,0,0,0.4)] py-1 uppercase tracking-[0.05em]">{d}</div>
            ))}
          </div>
          {/* Days grid */}
          {(() => {
            const firstDay = new Date(currentYear, currentMonth, 1).getDay()
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
            const cells: (number | null)[] = []
            for (let i = 0; i < firstDay; i++) cells.push(null)
            for (let d = 1; d <= daysInMonth; d++) cells.push(d)
            while (cells.length % 7 !== 0) cells.push(null)
            const monthEvs = monthEvents(baseEvents, currentMonth, currentYear)
            return (
              <div className="grid grid-cols-[repeat(7,1fr)] gap-0.5">
                {cells.map((day, i) => {
                  const dayEvents = day ? monthEvs.filter(e => new Date(e.start_at).getDate() === day) : []
                  const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear()
                  return (
                    <div key={i} className="min-h-[64px] rounded-md p-1.5" style={{ background: day ? 'rgba(255,255,255,0.8)' : 'transparent', border: isToday ? `2px solid ${accent}` : '1px solid rgba(0,0,0,0.06)' }}>
                      {day && (
                        <>
                          <div className="text-[11px] mb-0.5 leading-none" style={{ fontWeight: isToday ? 700 : 400, color: isToday ? accent : primary }}>{day}</div>
                          {dayEvents.slice(0, 2).map(ev => (
                            <div key={`${ev.id}-${ev.start_at}`} onClick={() => setSelectedEvent(ev)}
                              className="text-[9px] text-white rounded py-px px-1 mb-px cursor-pointer overflow-hidden whitespace-nowrap text-ellipsis" style={{ background: accent }}>
                              {ev.flyer_url ? '🖼 ' : ''}{ev.name}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <button
                              onClick={() => setDayModal({ date: day, events: dayEvents })}
                              className="text-[9px] text-[rgba(0,0,0,0.5)] hover:underline"
                            >
                              +{dayEvents.length - 2} más
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Weekly view */}
      {view === 'weekly' && (() => {
        const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0)
        const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7)
        const weekEvs = eventsInRange(baseEvents, weekStart, weekEnd)
        return (
        <div className="p-5">
          <div className="grid grid-cols-[repeat(7,1fr)] gap-2">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date()
              d.setDate(d.getDate() + i)
              const dayEvents = weekEvs.filter(e => new Date(e.start_at).toDateString() === d.toDateString())
              return (
                <div key={i} className="bg-white rounded-xl p-3 border border-[rgba(0,0,0,0.08)]">
                  <div className="text-[10px] uppercase text-[rgba(0,0,0,0.4)] mb-1">
                    {d.toLocaleDateString('es-CR', { weekday: 'short' })}
                  </div>
                  <div className="text-xl font-bold mb-2" style={{ color: primary }}>{d.getDate()}</div>
                  {dayEvents.map(ev => (
                    <div key={`${ev.id}-${ev.start_at}`} className="rounded-lg py-1.5 px-2 mb-1.5 cursor-pointer" style={{ background: `${accent}18`, border: `1px solid ${accent}40` }}
                      onClick={() => setSelectedEvent(ev)}>
                      <div className="text-[11px] font-semibold" style={{ color: primary }}>{ev.name}</div>
                      <div className="text-[10px] text-[rgba(0,0,0,0.4)] mt-0.5">{formatEventTime(ev.start_at)}</div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
        )
      })()}

      {/* Event detail modal */}
      {selectedEvent && (
        <Modal onClose={() => setSelectedEvent(null)} titleId="evento-detalle-title" width={400}>
          <div className="p-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- flyer remoto dentro de un modal de detalle (no es LCP); next/image exigiría remotePatterns + dimensiones fijas para poco beneficio. */}
            {selectedEvent.flyer_url && <img src={selectedEvent.flyer_url} alt={`Flyer de ${selectedEvent.name}`} className="w-full h-[140px] object-cover rounded-lg mb-3" />}
            <h3 id="evento-detalle-title" className="font-extrabold text-lg mb-2" style={{ color: primary }}>{selectedEvent.name}</h3>
            {showDesc && <p className="text-[13px] text-[rgba(0,0,0,0.55)] mb-2">{selectedEvent.description}</p>}
            {showLoc && <p className="text-xs text-[rgba(0,0,0,0.4)] mb-1">📍 {selectedEvent.location}</p>}
            {/* EVE-1: fecha completa + costo + si requiere inscripción (el
                endpoint público ya exponía estos campos con whitelist). */}
            <p className="text-xs text-[rgba(0,0,0,0.4)] mb-1">📅 {formatFullDate(selectedEvent.start_at)} · 🕐 {formatEventTime(selectedEvent.start_at)}</p>
            {selectedEvent.requires_payment && (selectedEvent.payment_amount ?? 0) > 0 && (
              <p className="text-xs text-[rgba(0,0,0,0.55)] mb-1">💰 Costo: ₡{Number(selectedEvent.payment_amount).toLocaleString('es-CR')}</p>
            )}
            <p className="text-xs text-[rgba(0,0,0,0.4)] mb-3">
              {selectedEvent.requires_registration ? '📝 Requiere inscripción' : 'Entrada libre, sin inscripción'}
            </p>
            <div className="flex gap-2">
              {showBtn && selectedEvent.requires_registration && (
                <button
                  type="button"
                  onClick={() => goRegister(selectedEvent.id)}
                  className="flex-1 text-white rounded-lg py-2.5 text-center font-semibold text-[13px]"
                  style={{ background: accent }}
                >
                  Inscribirse
                </button>
              )}
              <div className="flex-1 border border-[rgba(0,0,0,0.15)] rounded-lg py-2.5 text-center text-[13px] cursor-pointer text-[rgba(0,0,0,0.5)]" onClick={() => setSelectedEvent(null)}>Cerrar</div>
            </div>
          </div>
        </Modal>
      )}

      {/* Day events modal (desde "+N más" del calendario mensual) */}
      {dayModal && (
        <Modal onClose={() => setDayModal(null)} titleId="dia-eventos-title" width={420}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(0,0,0,0.08)]">
            <p id="dia-eventos-title" className="font-bold text-sm" style={{ color: primary }}>
              {dayModal.date} de {new Date(currentYear, currentMonth).toLocaleDateString('es-CR', { month: 'long' })} · {dayModal.events.length} eventos
            </p>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {dayModal.events.map(ev => (
              <button key={`${ev.id}-${ev.start_at}`}
                onClick={() => { setSelectedEvent(ev); setDayModal(null) }}
                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-[rgba(0,0,0,0.03)]">
                <span className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ background: accent }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium" style={{ color: primary }}>{ev.flyer_url ? '🖼 ' : ''}{ev.name}</span>
                  <span className="text-[11px] text-[rgba(0,0,0,0.45)]">🕐 {formatEventTime(ev.start_at)}{ev.location ? ` · 📍 ${ev.location}` : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default function CalendarioPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[#666]">Cargando calendario...</div>}>
      <CalendarioWidget />
    </Suspense>
  )
}
