'use client'
import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import type { MockEvent } from '@/data/mock-events'
import { useEvents } from '@/hooks/useEvents'
import { Modal } from '@/components/shared/Modal'

// Inner component that reads searchParams
function CalendarioWidget() {
  const searchParams = useSearchParams()
  const view = (searchParams.get('view') || 'monthly') as 'monthly' | 'weekly' | 'list'
  const typesParam = searchParams.get('types')
  const types = typesParam ? typesParam.split(',') : ['charla', 'campamento', 'social', 'capacitacion']
  const primary = searchParams.get('primary') || '#161440'
  const accent = searchParams.get('accent') || '#EF5554'
  const bg = searchParams.get('bg') || '#FFFFFF'
  const showDesc = searchParams.get('showDesc') !== 'false'
  const showLoc = searchParams.get('showLoc') !== 'false'
  const showBtn = searchParams.get('showBtn') !== 'false'

  const { events: allEvents } = useEvents()
  const events = useMemo(() =>
    allEvents.filter(e =>
      e.status !== 'cancelled' && e.status !== 'archived' && types.includes(e.event_type)
    ).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  , [allEvents, types])

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [selectedEvent, setSelectedEvent] = useState<MockEvent | null>(null)

  function formatEventTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', hour12: true })
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
        <span className="text-[rgba(255,255,255,0.6)] text-xs">{events.length} eventos</span>
      </div>

      {/* List view */}
      {view === 'list' && (
        <div className="p-5 flex flex-col gap-3">
          {events.map(ev => {
            const { day, month, dow } = formatDate(ev.start_at)
            return (
              <div key={ev.id} className="flex gap-4 p-4 rounded-xl border border-[rgba(0,0,0,0.08)] bg-white cursor-pointer"
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
                {showBtn && (
                  <div className="flex items-center">
                    <div className="text-white rounded-lg py-1.5 px-3 text-xs font-semibold whitespace-nowrap" style={{ background: accent }}>
                      Inscribirse
                    </div>
                  </div>
                )}
              </div>
            )
          })}
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
            const monthEvents = events.filter(e => {
              const d = new Date(e.start_at)
              return d.getMonth() === currentMonth && d.getFullYear() === currentYear
            })
            return (
              <div className="grid grid-cols-[repeat(7,1fr)] gap-0.5">
                {cells.map((day, i) => {
                  const dayEvents = day ? monthEvents.filter(e => new Date(e.start_at).getDate() === day) : []
                  const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear()
                  return (
                    <div key={i} className="min-h-[64px] rounded-lg p-1" style={{ background: day ? 'rgba(255,255,255,0.8)' : 'transparent', border: isToday ? `2px solid ${accent}` : '1px solid rgba(0,0,0,0.06)' }}>
                      {day && (
                        <>
                          <div className="text-[11px] mb-0.5" style={{ fontWeight: isToday ? 700 : 400, color: isToday ? accent : primary }}>{day}</div>
                          {dayEvents.slice(0, 2).map(ev => (
                            <div key={ev.id} onClick={() => setSelectedEvent(ev)}
                              className="text-[9px] text-white rounded py-px px-1 mb-px cursor-pointer overflow-hidden whitespace-nowrap text-ellipsis" style={{ background: accent }}>
                              {ev.flyer_url ? '🖼 ' : ''}{ev.name}
                            </div>
                          ))}
                          {dayEvents.length > 2 && <div className="text-[9px] text-[rgba(0,0,0,0.4)]">+{dayEvents.length - 2} más</div>}
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
      {view === 'weekly' && (
        <div className="p-5">
          <div className="grid grid-cols-[repeat(7,1fr)] gap-2">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date()
              d.setDate(d.getDate() + i)
              const dayEvents = events.filter(e => new Date(e.start_at).toDateString() === d.toDateString())
              return (
                <div key={i} className="bg-white rounded-xl p-3 border border-[rgba(0,0,0,0.08)]">
                  <div className="text-[10px] uppercase text-[rgba(0,0,0,0.4)] mb-1">
                    {d.toLocaleDateString('es-CR', { weekday: 'short' })}
                  </div>
                  <div className="text-xl font-bold mb-2" style={{ color: primary }}>{d.getDate()}</div>
                  {dayEvents.map(ev => (
                    <div key={ev.id} className="rounded-lg py-1.5 px-2 mb-1.5 cursor-pointer" style={{ background: `${accent}18`, border: `1px solid ${accent}40` }}
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
      )}

      {/* Event detail modal */}
      {selectedEvent && (
        <Modal onClose={() => setSelectedEvent(null)} titleId="evento-detalle-title" width={400}>
          <div className="p-6">
            {selectedEvent.flyer_url && <img src={selectedEvent.flyer_url} alt={`Flyer de ${selectedEvent.name}`} className="w-full h-[140px] object-cover rounded-lg mb-3" />}
            <h3 id="evento-detalle-title" className="font-extrabold text-lg mb-2" style={{ color: primary }}>{selectedEvent.name}</h3>
            {showDesc && <p className="text-[13px] text-[rgba(0,0,0,0.55)] mb-2">{selectedEvent.description}</p>}
            {showLoc && <p className="text-xs text-[rgba(0,0,0,0.4)] mb-1">📍 {selectedEvent.location}</p>}
            <p className="text-xs text-[rgba(0,0,0,0.4)] mb-3">🕐 {formatEventTime(selectedEvent.start_at)}</p>
            <div className="flex gap-2">
              {showBtn && <div className="flex-1 text-white rounded-lg py-2.5 text-center font-semibold text-[13px] cursor-pointer" style={{ background: accent }}>Inscribirse</div>}
              <div className="flex-1 border border-[rgba(0,0,0,0.15)] rounded-lg py-2.5 text-center text-[13px] cursor-pointer text-[rgba(0,0,0,0.5)]" onClick={() => setSelectedEvent(null)}>Cerrar</div>
            </div>
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
