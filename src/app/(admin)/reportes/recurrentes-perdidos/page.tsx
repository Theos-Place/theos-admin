'use client'

/**
 * REP-14 · «Recurrentes que se fueron».
 *
 * Gente que venía seguido —20 charlas o más en todo su histórico— y lleva
 * seis meses sin aparecer. Medido en producción el 2026-10-05: 644 personas,
 * y el peor año fue 2025 con 235.
 *
 * AGRUPADO POR AÑO DE ABANDONO, que es la pregunta que el reporte contesta:
 * «¿en qué año perdimos a más recurrentes?». Dentro de cada año, la gente.
 *
 * Quien asistió en varios años lo muestra en su fila —no se duplica la
 * persona en cada año—: duplicarla haría que el total de arriba y la suma de
 * los grupos no cuadraran, y en un reporte eso destruye la confianza en todo
 * lo demás. El dato de «en cuántos años vino» va en su columna.
 */

import { useState, useEffect, Suspense } from 'react'
import { Download, Loader2, UserMinus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTituloDePantalla } from '@/hooks/useTituloDePantalla'
import { useToast } from '@/components/shared/Toast'
import { Button } from '@/components/shared/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { PageContainer } from '@/components/layout/PageContainer'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'

type Persona = {
  member_id: string
  nombre: string
  telefono: string | null
  email: string | null
  sede: string
  totalAsistencias: number
  ultimoCheckin: string
  anios: number[]
  anioEnQueDejoDeIr: number | null
  llevoEstudio: boolean
  ultimoEstudio: string | null
  dirigente: string | null
}

type Respuesta = {
  minimoCheckins: number
  mesesSinVenir: number
  personas: Persona[]
}

function Contenido() {
  // Se espera a `loaded` antes de decidir nada: sin esto la pantalla pinta
  // «Acceso restringido» por un instante mientras cargan los roles, y el
  // parpadeo le dice a alguien autorizado que no lo está.
  const { loaded } = useAuth()
  useTituloDePantalla('Recurrentes que se fueron', 'Reportes')
  const toast = useToast()
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [denegado, setDenegado] = useState(false)
  const [anioAbierto, setAnioAbierto] = useState<number | null>(null)

  useEffect(() => {
    let vivo = true
    fetch('/api/reports/recurrentes-perdidos')
      .then(async r => {
        if (r.status === 403) { if (vivo) setDenegado(true); return null }
        return r.ok ? r.json() : Promise.reject(new Error())
      })
      .then(d => { if (vivo && d) setDatos(d as Respuesta) })
      .catch(() => { if (vivo) toast('No se pudo cargar el reporte.', 'error') })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [toast])

  if (!loaded || cargando) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-navy-light/80" /></div>
  }
  if (denegado) return <AccessDenied />

  const personas = datos?.personas ?? []
  // Una persona en UN año: el de su última señal.
  const porAnio = new Map<number, Persona[]>()
  for (const p of personas) {
    const a = p.anioEnQueDejoDeIr ?? 0
    porAnio.set(a, [...(porAnio.get(a) ?? []), p])
  }
  const anios = [...porAnio.keys()].sort((a, b) => b - a)
  const peor = anios.reduce<{ anio: number; n: number } | null>((max, a) => {
    const n = porAnio.get(a)?.length ?? 0
    return !max || n > max.n ? { anio: a, n } : max
  }, null)
  const maximo = peor?.n ?? 1

  return (
    <PageContainer width="work">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
              Recurrentes que se fueron
            </h1>
            <p className="mt-1 text-sm text-navy-light/80 font-body">
              Personas con {datos?.minimoCheckins ?? 20} asistencias o más a charlas en todo su
              histórico, que llevan {datos?.mesesSinVenir ?? 6} meses sin venir. No aparecen
              quienes están sirviendo.
            </p>
          </div>
          {personas.length > 0 && (
            <Button
              href="/api/reports/recurrentes-perdidos?export=1"
              variante="navy" tamano="sm" className="shrink-0"
            >
              <Download size={13} aria-hidden="true" />
              Descargar XLSX
            </Button>
          )}
        </div>

        {personas.length === 0 ? (
          <EmptyState icon={UserMinus} title="No hay recurrentes perdidos" />
        ) : (
          <>
            <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
              <p className="text-sm text-navy font-body">
                <strong>{personas.length} personas</strong> que venían seguido y dejaron de venir.
                {peor && peor.anio > 0 && (
                  <> El peor año fue <strong>{peor.anio}</strong>, con {peor.n}.</>
                )}
              </p>
              {/* Las barras son el reporte: la pregunta es en qué año se fue
                  más gente, y eso se ve antes de leer un solo nombre. */}
              <ul className="mt-4 space-y-1.5">
                {anios.map(a => {
                  const n = porAnio.get(a)?.length ?? 0
                  return (
                    <li key={a}>
                      <button
                        onClick={() => setAnioAbierto(v => (v === a ? null : a))}
                        className="flex w-full items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-surface-low transition-colors text-left"
                      >
                        <span className="w-12 shrink-0 text-[13px] text-navy font-body tabular-nums">
                          {a > 0 ? a : '—'}
                        </span>
                        <span className="h-4 rounded bg-coral/70" style={{ width: `${Math.max(2, (n / maximo) * 100)}%` }} />
                        <span className="shrink-0 text-[13px] text-navy-light/80 font-body tabular-nums">{n}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-3 text-[13px] text-navy-light/80 font-body">
                Tocá un año para ver quiénes son.
              </p>
            </div>

            {anios.filter(a => anioAbierto === null || anioAbierto === a).map(a => (
              <div key={a} className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--outline-variant)]">
                  <h2 className="text-sm font-bold text-navy font-display">
                    {a > 0 ? `Dejaron de venir en ${a}` : 'Sin fecha registrada'}
                    <span className="ml-2 font-normal text-navy-light/80">
                      ({porAnio.get(a)?.length ?? 0})
                    </span>
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {['Nombre', 'Sede', 'Asistencias', 'Último check-in', 'Años', 'Estudio', 'Dirigente', 'Contacto'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(porAnio.get(a) ?? []).map((p, i) => (
                        <tr key={p.member_id} className={cn('align-top', i % 2 === 1 ? 'bg-surface-low/40' : '')}>
                          <td className="px-4 py-2.5 text-[13px] text-navy font-body font-medium">{p.nombre}</td>
                          <td className="px-4 py-2.5 text-[13px] text-navy-light/80 font-body whitespace-nowrap">{p.sede}</td>
                          <td className="px-4 py-2.5 text-[13px] text-navy font-body tabular-nums">{p.totalAsistencias}</td>
                          <td className="px-4 py-2.5 text-[13px] text-navy-light/80 font-body whitespace-nowrap">
                            {formatDate(p.ultimoCheckin)}
                          </td>
                          <td className="px-4 py-2.5 text-[13px] text-navy-light/80 font-body">
                            {/* En cuántos años vino, y cuáles. Se muestra acá
                                en vez de repetir la persona en cada año: si
                                se duplicara, el total de arriba y la suma de
                                los grupos no cuadrarían. */}
                            {p.anios.length > 1
                              ? `${p.anios.length} años · ${p.anios.join(', ')}`
                              : (p.anios[0] ?? '—')}
                          </td>
                          <td className="px-4 py-2.5 text-[13px] text-navy-light/80 font-body">
                            {p.llevoEstudio ? (p.ultimoEstudio ?? 'Sí') : 'No llevó'}
                          </td>
                          <td className="px-4 py-2.5 text-[13px] text-navy-light/80 font-body">{p.dirigente ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[13px] text-navy-light/80 font-body whitespace-nowrap">
                            {p.telefono ?? '—'}
                            {p.email && <span className="block">{p.email}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </PageContainer>
  )
}

export default function RecurrentesPerdidosPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-navy-light/80 font-body">Cargando…</div>}>
      <Contenido />
    </Suspense>
  )
}
