'use client'
import { useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MOCK_EVENTS } from '@/data/mock-events'

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

  const events = useMemo(() =>
    MOCK_EVENTS.filter(e =>
      e.status !== 'cancelled' && e.status !== 'archived' && types.includes(e.event_type)
    ).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
  , [types])

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [selectedEvent, setSelectedEvent] = useState<(typeof MOCK_EVENTS)[0] | null>(null)

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
    <div style={{ '--cal-primary': primary, '--cal-accent': accent, '--cal-bg': bg, background: bg, minHeight: '100vh', fontFamily: 'system-ui, sans-serif' } as React.CSSProperties}>
      {/* Header */}
      <div style={{ background: primary, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Theos Place — Eventos</span>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{events.length} eventos</span>
      </div>

      {/* List view */}
      {view === 'list' && (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {events.map(ev => {
            const { day, month, dow } = formatDate(ev.start_at)
            return (
              <div key={ev.id} style={{ display: 'flex', gap: 16, padding: 16, borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', cursor: 'pointer' }}
                onClick={() => setSelectedEvent(ev)}>
                <div style={{ textAlign: 'center', minWidth: 44, paddingTop: 2 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: primary, lineHeight: 1 }}>{day}</div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>{month}</div>
                  <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.3)', marginTop: 1 }}>{dow}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: primary, marginBottom: 4 }}>{ev.name}</div>
                  {showDesc && ev.description && (
                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)', marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'] }}>
                      {ev.description}
                    </div>
                  )}
                  {showLoc && ev.location && (
                    <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)' }}>📍 {ev.location}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>🕐 {formatEventTime(ev.start_at)}</div>
                </div>
                {showBtn && (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ background: accent, color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
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
        <div style={{ padding: 20 }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button onClick={() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y-1) } else setCurrentMonth(m => m-1) }}
              style={{ background: 'none', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 14, color: primary }}>
              ‹
            </button>
            <span style={{ fontWeight: 700, color: primary, fontSize: 15 }}>
              {new Date(currentYear, currentMonth).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y+1) } else setCurrentMonth(m => m+1) }}
              style={{ background: 'none', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 14, color: primary }}>
              ›
            </button>
          </div>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
            {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'rgba(0,0,0,0.4)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                {cells.map((day, i) => {
                  const dayEvents = day ? monthEvents.filter(e => new Date(e.start_at).getDate() === day) : []
                  const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear()
                  return (
                    <div key={i} style={{ minHeight: 64, borderRadius: 8, padding: 4, background: day ? 'rgba(255,255,255,0.8)' : 'transparent', border: isToday ? `2px solid ${accent}` : '1px solid rgba(0,0,0,0.06)' }}>
                      {day && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? accent : primary, marginBottom: 2 }}>{day}</div>
                          {dayEvents.slice(0, 2).map(ev => (
                            <div key={ev.id} onClick={() => setSelectedEvent(ev)}
                              style={{ fontSize: 9, background: accent, color: '#fff', borderRadius: 4, padding: '1px 4px', marginBottom: 1, cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                              {ev.flyer_url ? '🖼 ' : ''}{ev.name}
                            </div>
                          ))}
                          {dayEvents.length > 2 && <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.4)' }}>+{dayEvents.length - 2} más</div>}
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
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date()
              d.setDate(d.getDate() + i)
              const dayEvents = events.filter(e => new Date(e.start_at).toDateString() === d.toDateString())
              return (
                <div key={i} style={{ background: '#fff', borderRadius: 12, padding: 12, border: '1px solid rgba(0,0,0,0.08)' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', marginBottom: 4 }}>
                    {d.toLocaleDateString('es-CR', { weekday: 'short' })}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: primary, marginBottom: 8 }}>{d.getDate()}</div>
                  {dayEvents.map(ev => (
                    <div key={ev.id} style={{ background: `${accent}18`, border: `1px solid ${accent}40`, borderRadius: 8, padding: '6px 8px', marginBottom: 6, cursor: 'pointer' }}
                      onClick={() => setSelectedEvent(ev)}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: primary }}>{ev.name}</div>
                      <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>{formatEventTime(ev.start_at)}</div>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 }}
          onClick={() => setSelectedEvent(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%' }} onClick={e => e.stopPropagation()}>
            {selectedEvent.flyer_url && <img src={selectedEvent.flyer_url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 12 }} />}
            <h3 style={{ fontWeight: 800, fontSize: 18, color: primary, marginBottom: 8 }}>{selectedEvent.name}</h3>
            {showDesc && <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.55)', marginBottom: 8 }}>{selectedEvent.description}</p>}
            {showLoc && <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: 4 }}>📍 {selectedEvent.location}</p>}
            <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: 12 }}>🕐 {formatEventTime(selectedEvent.start_at)}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {showBtn && <div style={{ flex: 1, background: accent, color: '#fff', borderRadius: 8, padding: '10px 0', textAlign: 'center', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Inscribirse</div>}
              <div style={{ flex: 1, border: `1px solid rgba(0,0,0,0.15)`, borderRadius: 8, padding: '10px 0', textAlign: 'center', fontSize: 13, cursor: 'pointer', color: 'rgba(0,0,0,0.5)' }} onClick={() => setSelectedEvent(null)}>Cerrar</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CalendarioPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Cargando calendario...</div>}>
      <CalendarioWidget />
    </Suspense>
  )
}
