'use client'

import { useEffect, useState, useMemo } from 'react'
import { MapPin, Clock, Users, Search, Briefcase } from 'lucide-react'
import { PublicApplyButton } from '@/components/servers/PublicApplyButton'

type PublicVacancy = {
  id: string
  title: string
  position: string
  committee_name: string
  area: string
  description: string
  functions: string[]
  schedule: string
  commitment: string
  location: string | null
  slots_total: number
  slots_filled: number
  position_description: string | null
  position_functions: string | null
  position_profile: string | null
  position_study_requirement: string | null
  is_featured: boolean
}

export default function VacantesPublicasPage() {
  const [vacancies, setVacancies] = useState<PublicVacancy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [areaFilter, setAreaFilter] = useState('all')

  useEffect(() => {
    setLoading(true); setError(null)
    fetch('/api/public/vacancies')
      .then(r => { if (!r.ok) throw new Error('No se pudieron cargar las vacantes'); return r.json() })
      .then((d: { items: PublicVacancy[] }) => setVacancies(d.items ?? []))
      .catch(e => setError(e instanceof Error ? e.message : 'Error desconocido'))
      .finally(() => setLoading(false))
  }, [])

  const areaOptions = useMemo(
    () => Array.from(new Set(vacancies.map(v => v.area).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [vacancies],
  )

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return vacancies.filter(v =>
      (query === '' || v.title.toLowerCase().includes(query) || v.committee_name.toLowerCase().includes(query)) &&
      (areaFilter === 'all' || v.area === areaFilter),
    )
  }, [vacancies, q, areaFilter])

  return (
    <div className="min-h-screen bg-surface-low">
      {/* Encabezado público */}
      <header className="bg-navy text-white">
        <div className="mx-auto max-w-5xl px-5 py-10">
          <p className="text-[13px] font-medium text-white/60 font-body">Theos Place</p>
          <h1 className="mt-1 text-2xl font-bold font-display sm:text-3xl">Oportunidades de servicio</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70 font-body">
            Estos son los puestos disponibles para servir. Explorá las vacantes y aplicá a la que te interese
            — para aplicar te pediremos iniciar sesión.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        {/* Filtros */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-navy/10 focus-within:ring-navy/25">
            <Search size={16} className="shrink-0 text-navy-light/60" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar por puesto o comité…"
              aria-label="Buscar vacantes"
              className="flex-1 bg-transparent text-sm text-navy outline-none placeholder-navy-light/50 font-body"
            />
          </div>
          {areaOptions.length > 0 && (
            <select
              value={areaFilter}
              onChange={e => setAreaFilter(e.target.value)}
              aria-label="Filtrar por área"
              className="rounded-xl bg-white px-3 py-2.5 text-sm text-navy ring-1 ring-navy/10 outline-none focus:ring-navy/25 font-body"
            >
              <option value="all">Todas las áreas</option>
              {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>

        {loading && <p className="py-16 text-center text-sm text-navy-light/60 font-body">Cargando vacantes…</p>}
        {error && <p className="py-16 text-center text-sm text-coral-deep font-body">{error}</p>}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Briefcase size={28} className="text-navy-light/40" aria-hidden />
            <p className="text-sm text-navy-light/60 font-body">
              {vacancies.length === 0 ? 'No hay vacantes disponibles por ahora.' : 'No hay vacantes que coincidan con tu búsqueda.'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map(v => {
            const cupos = Math.max(0, v.slots_total - v.slots_filled)
            const desc = v.description || v.position_description || ''
            return (
              <article key={v.id} className="flex flex-col rounded-2xl bg-white p-5 ring-1 ring-navy/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-navy font-display">{v.title}</h2>
                    <p className="mt-0.5 text-[13px] text-navy-light/70 font-body">
                      {v.committee_name}{v.area ? ` · ${v.area}` : ''}
                    </p>
                  </div>
                  {v.is_featured && (
                    <span className="shrink-0 rounded-full bg-coral/10 px-2.5 py-1 text-[11px] font-medium text-coral-deep font-body">Destacado</span>
                  )}
                </div>

                {desc && <p className="mt-3 text-sm text-navy-light/80 font-body line-clamp-4">{desc}</p>}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-navy-light/70 font-body">
                  {v.schedule && <span className="inline-flex items-center gap-1.5"><Clock size={13} aria-hidden />{v.schedule}</span>}
                  {v.location && <span className="inline-flex items-center gap-1.5"><MapPin size={13} aria-hidden />{v.location}</span>}
                  {cupos > 0 && <span className="inline-flex items-center gap-1.5"><Users size={13} aria-hidden />{cupos} cupo{cupos === 1 ? '' : 's'}</span>}
                </div>

                <div className="mt-4 pt-1">
                  <PublicApplyButton vacancyId={v.id} />
                </div>
              </article>
            )
          })}
        </div>
      </main>
    </div>
  )
}
