'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Clock, Users, Search, Briefcase, GraduationCap, FilePlus2 } from 'lucide-react'
import { PublicApplyButton } from '@/components/servers/PublicApplyButton'
import { PageContainer } from '@/components/layout/PageContainer'
import { Modal } from '@/components/shared/Modal'

/**
 * SRV-13 · La cartelera PÚBLICA de puestos de servicio.
 *
 * Sin login, y embebible por iframe en theosplace.org (ver `lib/embed`).
 * Muestra lo que publicó la última corrida mensual de SRV-12.
 *
 * EL DETALLE MUESTRA SOLO DOS COSAS: la descripción y el requisito de
 * estudios. Las funciones y el perfil son la descripción interna del puesto
 * —lo que se le exige a quien sirve— y no van en una página abierta. No se
 * ocultan con CSS: no viajan en el payload, porque un campo que llega al
 * navegador es público aunque no se pinte.
 */

type PublicVacancy = {
  id: string
  title: string
  position: string
  committee_name: string
  area: string
  description: string
  schedule: string
  commitment: string
  location: string | null
  slots_total: number
  slots_filled: number
  position_description: string | null
  position_study_requirement: string | null
  is_featured: boolean
}

function VacantesPublicasContent() {
  const params = useSearchParams()
  const [vacancies, setVacancies] = useState<PublicVacancy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [comiteFilter, setComiteFilter] = useState('all')
  const [ubicacionFilter, setUbicacionFilter] = useState('all')
  const [abierto, setAbierto] = useState<PublicVacancy | null>(null)

  /**
   * `?puesto=<id>` abre ese puesto. Es el regreso del login: quien aplicó sin
   * sesión vuelve al puesto que estaba mirando y no a la lista, donde tendría
   * que buscarlo de nuevo entre treinta.
   */
  const puestoEnURL = params.get('puesto')
  const [yaAbrio, setYaAbrio] = useState(false)

  useEffect(() => {
    setLoading(true); setError(null)
    fetch('/api/public/vacancies')
      .then(r => { if (!r.ok) throw new Error('No se pudieron cargar los puestos'); return r.json() })
      .then((d: { items: PublicVacancy[] }) => setVacancies(d.items ?? []))
      .catch(e => setError(e instanceof Error ? e.message : 'Error desconocido'))
      .finally(() => setLoading(false))
  }, [])

  // Se abre una sola vez y después de que carguen: antes de eso el puesto no
  // existe todavía en memoria.
  if (puestoEnURL && !yaAbrio && vacancies.length > 0) {
    setYaAbrio(true)
    const v = vacancies.find(x => x.id === puestoEnURL)
    if (v) setAbierto(v)
  }

  const comiteOptions = useMemo(
    () => Array.from(new Set(vacancies.map(v => v.committee_name).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'es')),
    [vacancies],
  )
  const ubicacionOptions = useMemo(
    () => Array.from(new Set(vacancies.map(v => v.location ?? '').filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'es')),
    [vacancies],
  )

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return vacancies.filter(v =>
      (query === '' || v.title.toLowerCase().includes(query) || v.committee_name.toLowerCase().includes(query))
      && (comiteFilter === 'all' || v.committee_name === comiteFilter)
      && (ubicacionFilter === 'all' || (v.location ?? '') === ubicacionFilter),
    )
  }, [vacancies, q, comiteFilter, ubicacionFilter])

  return (
    <div className="min-h-screen bg-surface-low">
      {/* Encabezado público */}
      <header className="bg-navy text-white">
        <PageContainer width="work" className="px-5 py-10">
          <p className="text-[13px] font-medium text-white/80 font-body">Theos Place</p>
          <h1 className="mt-1 text-2xl font-bold font-display sm:text-3xl">Oportunidades de servicio</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/80 font-body">
            Estos son los puestos disponibles para servir. Mirá la lista y aplicá al que te interese
            — para aplicar te pediremos iniciar sesión.
          </p>
        </PageContainer>
      </header>

      <main><PageContainer width="work" className="px-5 py-8">
        {/* Filtros */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-navy/10 focus-within:ring-navy/25">
            <Search size={16} className="shrink-0 text-navy-light/80" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar por puesto o comité…"
              aria-label="Buscar puestos"
              className="flex-1 bg-transparent text-sm text-navy outline-none placeholder-navy-light/50 font-body"
            />
          </div>
          {comiteOptions.length > 0 && (
            <select
              value={comiteFilter}
              onChange={e => setComiteFilter(e.target.value)}
              aria-label="Filtrar por comité"
              className="rounded-xl bg-white px-3 py-2.5 text-sm text-navy ring-1 ring-navy/10 outline-none focus:ring-navy/25 font-body"
            >
              <option value="all">Todos los comités</option>
              {comiteOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          {ubicacionOptions.length > 0 && (
            <select
              value={ubicacionFilter}
              onChange={e => setUbicacionFilter(e.target.value)}
              aria-label="Filtrar por ubicación"
              className="rounded-xl bg-white px-3 py-2.5 text-sm text-navy ring-1 ring-navy/10 outline-none focus:ring-navy/25 font-body"
            >
              <option value="all">Todas las ubicaciones</option>
              {ubicacionOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>

        {loading && <p className="py-16 text-center text-sm text-navy-light/80 font-body">Cargando puestos…</p>}
        {error && <p className="py-16 text-center text-sm text-coral-deep font-body">{error}</p>}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Briefcase size={28} className="text-navy-light/40" aria-hidden />
            <p className="text-sm text-navy-light/80 font-body">
              {vacancies.length === 0 ? 'No hay puestos disponibles por ahora.' : 'No hay puestos que coincidan con tu búsqueda.'}
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
                    <p className="mt-0.5 text-[13px] text-navy-light/80 font-body">
                      {v.committee_name}{v.area ? ` · ${v.area}` : ''}
                    </p>
                  </div>
                  {v.is_featured && (
                    <span className="shrink-0 rounded-full bg-coral/10 px-2.5 py-1 text-[13px] font-medium text-coral-deep font-body">Destacado</span>
                  )}
                </div>

                {desc && <p className="mt-3 text-sm text-navy-light/80 font-body line-clamp-4">{desc}</p>}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-navy-light/80 font-body">
                  {v.schedule && <span className="inline-flex items-center gap-1.5"><Clock size={13} aria-hidden />{v.schedule}</span>}
                  {v.location && <span className="inline-flex items-center gap-1.5"><MapPin size={13} aria-hidden />{v.location}</span>}
                  {cupos > 0 && <span className="inline-flex items-center gap-1.5"><Users size={13} aria-hidden />{cupos} cupo{cupos === 1 ? '' : 's'}</span>}
                </div>

                <div className="mt-4 pt-1 flex flex-wrap items-center gap-2">
                  <PublicApplyButton vacancyId={v.id} volverA={`/vacantes?puesto=${v.id}`} />
                  <button
                    type="button"
                    onClick={() => setAbierto(v)}
                    className="rounded-full border border-navy/15 px-4 py-2 text-sm text-navy hover:bg-navy/5 transition-colors font-body"
                  >
                    Ver detalle
                  </button>
                </div>
              </article>
            )
          })}
        </div>
        {/* SRV-13 · Para lo que NO está en la lista. Enlaza a la pantalla que
            ya existe de pedir un puesto nuevo, y lo dice explícito para que
            nadie la use para «quiero este puesto que sí está». */}
        <p className="mt-8 text-center text-[13px] text-navy-light/80 font-body">
          <FilePlus2 size={13} className="inline mr-1" aria-hidden />
          ¿No ves el puesto que necesitás?{' '}
          <Link href="/servidores/puestos/solicitar" className="text-coral-deep underline">
            Sugerinos uno nuevo
          </Link>
          {' '}— es para puestos que todavía no existen.
        </p>
      </PageContainer></main>

      {/* El detalle. SOLO descripción y requisito de estudios: las funciones y
          el perfil son la descripción interna del puesto y ni siquiera viajan
          al navegador (ver el comentario de la whitelist en el API). */}
      {abierto && (
        <Modal onClose={() => setAbierto(null)} titleId="puesto-publico-title">
          <div className="p-6 space-y-4">
            <div>
              <h2 id="puesto-publico-title" className="text-lg font-semibold text-navy font-display">
                {abierto.title}
              </h2>
              <p className="mt-0.5 text-[13px] text-navy-light/80 font-body">
                {abierto.committee_name}{abierto.area ? ` · ${abierto.area}` : ''}
              </p>
            </div>

            {(abierto.description || abierto.position_description) && (
              <p className="text-sm text-navy font-body whitespace-pre-line">
                {abierto.description || abierto.position_description}
              </p>
            )}

            {abierto.position_study_requirement && (
              <p className="inline-flex items-start gap-1.5 text-sm text-navy-light/80 font-body">
                <GraduationCap size={14} className="mt-0.5 shrink-0" aria-hidden />
                Requisito de estudios: {abierto.position_study_requirement}
              </p>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-navy-light/80 font-body">
              {abierto.schedule && <span className="inline-flex items-center gap-1.5"><Clock size={13} aria-hidden />{abierto.schedule}</span>}
              {abierto.location && <span className="inline-flex items-center gap-1.5"><MapPin size={13} aria-hidden />{abierto.location}</span>}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setAbierto(null)}
                className="rounded-xl border border-navy/15 px-4 py-2 text-sm text-navy-light hover:bg-navy/5 transition-colors font-body"
              >
                Cerrar
              </button>
              <PublicApplyButton vacancyId={abierto.id} volverA={`/vacantes?puesto=${abierto.id}`} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default function VacantesPublicasPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-navy-light/80 font-body">Cargando…</p>}>
      <VacantesPublicasContent />
    </Suspense>
  )
}
