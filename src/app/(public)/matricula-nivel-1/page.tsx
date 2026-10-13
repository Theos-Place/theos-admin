'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapPin, Clock, Users, Search, CalendarDays, GraduationCap } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/shared/Button'
import { fechaCR } from '@/lib/fecha-cr'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * EST-20 · La página PÚBLICA de matrícula de Nivel 1.
 *
 * Sin login, para compartir en redes y WhatsApp. Solo Nivel 1, solo en
 * matrícula, solo con campo — el filtro vive en `lib/studies/grupos-publicos`
 * y es un subconjunto del de la matrícula interna, porque si acá aparece un
 * grupo que adentro no se ofrece, esa persona creó una cuenta para nada.
 *
 * EL PRECIO SALE DE LA MISMA FUNCIÓN QUE COBRA. Nivel 1 cuesta 0 en el
 * catálogo porque en el esquema nuevo lo que se cobra es el par N1+N2; leer
 * el costo del plan habría puesto «gratis» en tres de los grupos abiertos.
 *
 * SIN iframe por ahora (decidido 2026-10-01): no toca EMBED_ALLOWED_ORIGINS.
 */
type GrupoPublico = {
  id: string
  /** Puede faltar: durante un despliegue el cache corto todavía sirve la
   *  respuesta vieja, sin este campo. Una página pública no se cae por eso. */
  sede?: string | null
  zona: string | null
  ubicacion: string | null
  dias: string
  hora: string | null
  dirigente: string
  cupos: number
  capacidad: number
  llena: number
  inicio: string | null
  edad: string | null
  costo: number
  moneda: string
  gratis: boolean
}

const DIA_LARGO: Record<string, string> = {
  L: 'Lunes', K: 'Martes', M: 'Martes', X: 'Miércoles', J: 'Jueves',
  V: 'Viernes', S: 'Sábado', D: 'Domingo',
}

/**
 * El nombre de la sede, con el código como respaldo.
 *
 * El servidor lo resuelve, pero durante un despliegue el cache corto todavía
 * sirve la respuesta anterior —sin el campo— y la página se caía entera al
 * ordenar. Una página que se comparte en redes no puede romperse por un
 * campo que todavía no llegó.
 */
function nombreDeSede(g: { sede?: string | null; zona: string | null }): string {
  return g.sede || g.zona || 'Sede por definir'
}

function diasLegibles(dias: string): string {
  return dias.split('/').filter(Boolean).map(d => DIA_LARGO[d] ?? d).join(' y ')
}

export default function MatriculaNivel1Publica() {
  const [grupos, setGrupos] = useState<GrupoPublico[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [zona, setZona] = useState('todas')

  useEffect(() => {
    let vivo = true
    fetch('/api/public/study-groups')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('No se pudieron cargar los grupos.'))))
      .then(d => { if (vivo) setGrupos(d.items ?? []) })
      .catch((e: Error) => { if (vivo) setError(e.message) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [])

  // Las sedes salen del propio listado y con su nombre ya resuelto por el
  // servidor: acá no hay caché de sedes que consultar.
  const zonas = useMemo(
    () => [...new Map(grupos.filter(g => g.zona).map(g => [g.zona as string, nombreDeSede(g)])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'es')),
    [grupos],
  )

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return grupos.filter(g => {
      if (zona !== 'todas' && g.zona !== zona) return false
      if (!q) return true
      return [nombreDeSede(g), g.ubicacion ?? '', g.dirigente, diasLegibles(g.dias)]
        .join(' ').toLowerCase().includes(q)
    })
  }, [grupos, busqueda, zona])

  return (
    <main className="min-h-screen bg-surface py-10">
      <PageContainer width="work">
        <header className="space-y-2">
          <p className="text-[11px] tracking-widest uppercase text-coral-deep font-display">
            Theos Place
          </p>
          <h1 className="text-3xl font-extrabold text-navy font-display">
            Matrícula de Nivel 1
          </h1>
          <p className="text-sm text-navy-light/80 font-body max-w-2xl">
            Estos son los grupos de Nivel 1 con campo disponible. Elegí el que mejor te
            quede por horario y lugar; para apartar tu campo vas a necesitar una cuenta,
            y si no tenés te ayudamos a crearla en el momento.
          </p>
        </header>

        {cargando ? (
          <p className="mt-10 text-sm text-navy-light/80 font-body">Buscando grupos…</p>
        ) : error ? (
          <p className="mt-10 text-sm text-coral-deep font-body" role="alert">{error}</p>
        ) : grupos.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-surface-card p-8 text-center shadow-[var(--shadow-md)]">
            <GraduationCap size={28} className="mx-auto text-navy-light/80" aria-hidden="true" />
            <p className="mt-3 text-base font-bold text-navy font-display">
              Ahora mismo no hay matrícula abierta
            </p>
            <p className="mt-1 text-[13px] text-navy-light/80 font-body">
              Los grupos de Nivel 1 abren cada pocos meses. Escribinos y te avisamos
              cuando se abra el siguiente.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/80" aria-hidden="true" />
                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por lugar, día o dirigente…"
                  aria-label="Buscar grupos"
                  className="w-full rounded-xl border border-[var(--outline-variant)] bg-surface-card pl-9 pr-3 py-2 text-sm font-body"
                />
              </div>
              <select
                value={zona}
                onChange={e => setZona(e.target.value)}
                aria-label="Filtrar por sede"
                className="rounded-xl border border-[var(--outline-variant)] bg-surface-card px-3 py-2 text-sm text-navy font-body"
              >
                <option value="todas">Todas las sedes</option>
                {zonas.map(([code, nombre]) => <option key={code} value={code}>{nombre}</option>)}
              </select>
            </div>

            <p className="mt-3 text-[13px] text-navy-light/80 font-body">
              {visibles.length === grupos.length
                ? `${grupos.length} ${grupos.length === 1 ? 'grupo' : 'grupos'} con campo`
                : `${visibles.length} de ${grupos.length}`}
            </p>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {visibles.map(g => (
                <article key={g.id} className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-navy font-display">
                        {nombreDeSede(g)}
                      </h2>
                      <p className="text-[13px] text-navy-light/80 font-body">
                        Con {g.dirigente}
                      </p>
                    </div>
                    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-display tracking-wide',
                      g.gratis ? 'bg-teal/15 text-navy' : 'bg-coral/15 text-coral-deep')}>
                      {g.gratis ? 'Gratis' : formatMoney(g.costo, g.moneda)}
                    </span>
                  </div>

                  <dl className="space-y-1.5 text-[13px] text-navy-light/80 font-body">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="shrink-0 text-navy-light/80" aria-hidden="true" />
                      <dt className="sr-only">Horario</dt>
                      <dd>{diasLegibles(g.dias)}{g.hora ? ` a las ${g.hora}` : ''}</dd>
                    </div>
                    {g.ubicacion && (
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="shrink-0 text-navy-light/80" aria-hidden="true" />
                        <dt className="sr-only">Lugar</dt>
                        <dd>{g.ubicacion}</dd>
                      </div>
                    )}
                    {g.inicio && (
                      <div className="flex items-center gap-2">
                        <CalendarDays size={14} className="shrink-0 text-navy-light/80" aria-hidden="true" />
                        <dt className="sr-only">Inicia</dt>
                        <dd>Inicia el {fechaCR(g.inicio, 'larga-2d')}</dd>
                      </div>
                    )}
                    {g.edad && (
                      <div className="flex items-center gap-2">
                        <Users size={14} className="shrink-0 text-navy-light/80" aria-hidden="true" />
                        <dt className="sr-only">Edades</dt>
                        <dd>{g.edad}</dd>
                      </div>
                    )}
                  </dl>

                  <div>
                    <div className="h-1.5 w-full rounded-full bg-surface-low overflow-hidden" aria-hidden="true">
                      <div
                        className={cn('h-full rounded-full', g.llena > 0.8 ? 'bg-coral' : 'bg-teal-deep')}
                        style={{ width: `${Math.round(g.llena * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[13px] text-navy-light/80 font-body">
                      {g.cupos === 1 ? 'Queda 1 campo' : `Quedan ${g.cupos} campos`} de {g.capacidad}
                    </p>
                  </div>

                  {/* El ?redirect= del proxy: quien no tiene sesión pasa por el
                      login (o crea su cuenta) y vuelve a la matrícula con ESTE
                      grupo ya elegido. */}
                  <Button href={`/matricula?grupo=${g.id}`} ancho="full" className="justify-center">
                    Apartar mi campo
                  </Button>
                </article>
              ))}
            </div>

            {visibles.length === 0 && (
              <p className="mt-6 text-[13px] text-navy-light/80 font-body">
                Ningún grupo con esos filtros. Probá con otra sede o limpiá la búsqueda.
              </p>
            )}
          </>
        )}

        <p className="mt-10 text-[13px] text-navy-light/80 font-body">
          ¿Dudas? Escribinos y con gusto te ayudamos a escoger el grupo que mejor te quede.
        </p>
      </PageContainer>
    </main>
  )
}
