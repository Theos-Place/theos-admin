'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { Users, Star, Check, X } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ExportButton } from '@/components/shared/ExportButton'
import { type ColumnDef } from '@/components/shared/ColumnSelector'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '@/hooks/useAuth'
import { useUrlFilter } from '@/hooks/useUrlFilter'
import { useCargaRemota } from '@/hooks/useCargaRemota'
import { SERVICE_ADMIN_ROLES } from '@/lib/auth/roles'
import { SelectorDeComite } from '@/components/servers/SelectorDeComite'
import { formatDate, formatBirthday } from '@/lib/format'
import { InfoDelEncabezado } from '@/components/shared/InfoDelEncabezado'
import { ATTENDANCE_GENERAL_TOOLTIP } from '@/lib/attendance'
import { explicacionDeDonantes } from '@/lib/finance/ventana-de-donante'
import { cn } from '@/lib/utils'
import { leFaltaAlgo, faltantes, type Compromisos } from '@/lib/servers/compromisos'
import { textoDeEstudio, type EstudioDeLaPersona } from '@/lib/studies/estudio-actual'

type Fila = Compromisos & {
  member_id: string
  nombre: string
  puestos: string[]
  encargado: boolean
  telefono: string | null
  email: string | null
  cumpleanos: string | null
  estudio: EstudioDeLaPersona
}
type Comite = { id: string; nombre: string; filas: Fila[] }

/** Columnas del export. La pantalla los pinta con íconos; el archivo va en
 *  palabras — un ✓ en una celda de Excel no se puede filtrar ni contar. */
const COLUMNAS: ColumnDef<Fila>[] = [
  { key: 'nombre',    label: 'Nombre',        defaultVisible: true },
  { key: 'puestos',   label: 'Puesto(s)',     defaultVisible: true, exportValue: f => f.puestos.join(' · ') },
  { key: 'encargado', label: 'Encargado',     defaultVisible: true, exportValue: f => (f.encargado ? 'Sí' : '') },
  { key: 'asistencia',label: 'Asistencia',    defaultVisible: true, exportValue: f => (f.asistencia ? 'Cumple' : 'No cumple') },
  // SRV-7: dos columnas en el archivo y no una. "Nivel 2" y "Último: Nivel 3 ·
  // mar 2026" responden preguntas distintas, y en una sola celda hay que leer
  // el prefijo para saber cuál de las dos te están diciendo.
  { key: 'estudioActual', label: 'Estudio actual', defaultVisible: true,
    exportValue: f => [f.estudio.llevando.join(', '), f.estudio.dando.length ? `Dirige: ${f.estudio.dando.join(', ')}` : ''].filter(Boolean).join(' · ') },
  { key: 'ultimoEstudio', label: 'Último estudio', defaultVisible: true,
    exportValue: f => (f.estudio.llevando.length || f.estudio.dando.length || !f.estudio.ultimo)
      ? '' : `${f.estudio.ultimo.nombre}${f.estudio.ultimo.fecha ? ` (${f.estudio.ultimo.fecha})` : ''}` },
  { key: 'donante',   label: 'Donante activo',defaultVisible: true, exportValue: f => (f.donante ? 'Sí' : 'No') },
  { key: 'ultimo',    label: 'Último check-in', defaultVisible: true, exportValue: f => f.ultimoCheckin ?? '' },
  { key: 'falta',     label: 'Le falta',      defaultVisible: true, exportValue: f => faltantes(f).join(', ') },
  // Contacto: va en el ARCHIVO y no en la tabla. La lista se baja para llamar a
  // quien tiene algo pendiente, y en pantalla esas tres columnas solo apretarían
  // lo que sí se mira. Mismas etiquetas y mismo formato que el export de
  // /servidores, para que los dos archivos se lean igual.
  { key: 'phone',     label: 'Teléfono / WhatsApp', defaultVisible: true, exportValue: f => f.telefono ?? '' },
  { key: 'email',     label: 'Email del servidor',  defaultVisible: true, exportValue: f => f.email ?? '' },
  {
    key: 'birth_date', label: 'Fecha de cumpleaños', defaultVisible: true,
    exportValue: f => formatBirthday(f.cumpleanos),
  },
]

/** Los criterios se leen de donde VIVEN, no se escriben a mano: el de
 *  asistencia se arma con las constantes de `lib/attendance` y el de donante
 *  con la ventana real de `refresh_donor_flags()`, que además pone el mes. */
const COLUMNAS_TABLA: Array<{ label: string; info?: string }> = [
  { label: 'Persona' },
  { label: 'Puesto' },
  { label: 'Asistencia', info: ATTENDANCE_GENERAL_TOOLTIP },
  { label: 'Estudio', info: 'Llevando = matriculada en un estudio en los últimos 12 meses. Dando = dirigente o co-dirigente de un grupo en los últimos 12 meses. Cumple con cualquiera de los dos.' },
  { label: 'Donante', info: explicacionDeDonantes(new Date()) },
  { label: 'Último check-in' },
]

function Marca({ ok, titulo }: { ok: boolean; titulo: string }) {
  return ok
    ? <Check size={15} strokeWidth={2.5} className="text-teal-deep" aria-label={`${titulo}: cumple`} />
    : <X size={15} strokeWidth={2.5} className="text-coral-deep" aria-label={`${titulo}: no cumple`} />
}

function MiComiteContenido() {
  const { loaded } = usePermissions()
  const { user } = useAuth()
  const roles = user?.roles ?? []
  // SRV-6: staff, coordinación de servidores, dirección y admin eligen cualquier
  // comité. El encargado sigue viendo los suyos y nada más — el servidor lo
  // vuelve a comprobar, esto solo decide si se dibuja el selector.
  const esAmplio = roles.some(r => (SERVICE_ADMIN_ROLES as string[]).includes(r))
  const esLider = roles.includes('lider_comite') || esAmplio
  const [comiteElegido, setComiteElegido] = useUrlFilter('comite')

  const [soloPendientes, setSoloPendientes] = useState(false)

  // LINT-1: la carga se DERIVA de la clave de la petición, en vez de encender y
  // apagar `cargando` dentro del efecto.
  const clave = loaded && esLider ? `mi-comite:${comiteElegido}` : ''
  const { datos, cargando, error } = useCargaRemota<{ comites: Comite[] }>(
    clave,
    async () => {
      if (!clave) return { comites: [] }
      const r = await fetch(`/api/servers/mi-comite${comiteElegido ? `?committee_id=${encodeURIComponent(comiteElegido)}` : ''}`)
      if (!r.ok) {
        const d = await r.json().catch(() => null) as { error?: string } | null
        throw new Error(d?.error ?? 'No se pudo cargar el comité.')
      }
      return r.json()
    },
    { generico: 'No se pudo cargar el comité.' },
  )
  const comites = useMemo(() => datos?.comites ?? [], [datos])

  const visibles = useMemo(
    () => comites.map(c => ({ ...c, filas: soloPendientes ? c.filas.filter(leFaltaAlgo) : c.filas })),
    [comites, soloPendientes],
  )

  // Hasta que carguen los roles no se sabe si tiene permiso: pintar "Acceso
  // restringido" antes deja un parpadeo rojo en cada carga (ver usePermissions).
  if (!loaded) return null
  if (!esLider) {
    return <EmptyState icon={Users} title="Acceso restringido" description="Esta pantalla es para los encargados de comité." />
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="ptitle">{esAmplio ? 'Comités' : 'Mi comité'}</h1>
        <p className="psub">
          {esAmplio
            ? 'Elegí un comité y vas a ver lo mismo que ve su encargado.'
            : 'Tu gente y cómo va cada quien con sus compromisos.'}
        </p>
      </div>

      {esAmplio && <SelectorDeComite value={comiteElegido || null} onChange={id => setComiteElegido(id ?? '')} />}

      {error && (
        <div className="card p-4 text-[13px] text-coral-deep font-body">{error}</div>
      )}

      {!error && !cargando && comites.length === 0 && (
        esAmplio
          ? <EmptyState icon={Users} title="Elegí un comité" description="Arriba están todos, agrupados por área." />
          : <EmptyState
              icon={Users}
              title="Todavía no sos encargada de ningún comité"
              description="La estrella de encargado la ponen staff o dirección en la lista de personas del comité."
            />
      )}

      {comites.length > 0 && (
        <label className="flex items-center gap-2 text-[13px] text-navy-light font-body">
          <input
            type="checkbox"
            checked={soloPendientes}
            onChange={e => setSoloPendientes(e.target.checked)}
            className="accent-coral"
          />
          Solo los que tienen algo pendiente
        </label>
      )}

      {visibles.map(c => (
        <div key={c.id} className="card w-full min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-[var(--outline-variant)]">
            <div>
              <p className="text-base font-bold text-navy font-display">{c.nombre}</p>
              <p className="text-[13px] text-navy-light/80 font-body">
                {c.filas.length.toLocaleString('es-CR')} {c.filas.length === 1 ? 'persona' : 'personas'}
                {soloPendientes ? ' con algo pendiente' : ''}
              </p>
            </div>
            <ExportButton<Fila>
              data={c.filas}
              columns={COLUMNAS}
              allColumns={COLUMNAS}
              filename={`mi-comite-${c.nombre.toLowerCase().replace(/\s+/g, '-')}`}
            />
          </div>

          {c.filas.length === 0 ? (
            <EmptyState icon={Users} title={soloPendientes ? 'Nadie tiene pendientes' : 'El comité no tiene gente activa'} />
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--outline-variant)]">
                      {COLUMNAS_TABLA.map(h => (
                        <th key={h.label} className="px-4 py-2.5 text-left text-[11px] uppercase tracking-widest text-navy-light/80 font-display whitespace-nowrap">
                          {h.label}
                          {/* Las dos columnas que marcan a alguien en rojo con
                              un criterio que no se adivina del título. */}
                          {h.info && <InfoDelEncabezado texto={h.info} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {c.filas.map((f, i) => (
                      <tr key={f.member_id} className={cn('transition-colors', i % 2 === 1 ? 'bg-surface-low/40' : '')}>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-navy font-body">
                            {f.nombre}
                            {f.encargado && <Star size={12} className="text-coral shrink-0" fill="currentColor" aria-label="Encargado del comité" />}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-navy-light/80 font-body">{f.puestos.join(' · ')}</td>
                        <td className="px-4 py-3"><Marca ok={f.asistencia} titulo="Asistencia" /></td>
                        <td className="px-4 py-3 text-[13px] font-body">
                          {/* SRV-7 · Dice CUÁL estudio. Si hoy no lleva ninguno,
                              el último va apagado: es historia, no cumplimiento. */}
                          {f.llevandoEstudio || f.dandoEstudio ? (
                            <span className="rounded-full bg-teal-deep/10 px-2 py-0.5 text-[11px] text-teal-deep font-semibold">
                              {textoDeEstudio(f.estudio)}
                            </span>
                          ) : f.estudio.ultimo ? (
                            <span className="text-[13px] text-navy-light/80">{textoDeEstudio(f.estudio)}</span>
                          ) : (
                            <X size={15} strokeWidth={2.5} className="text-coral-deep" aria-label="Estudio: nunca ha llevado ninguno" />
                          )}
                        </td>
                        <td className="px-4 py-3"><Marca ok={f.donante} titulo="Donante activo" /></td>
                        <td className="px-4 py-3 text-[13px] text-navy-light/80 whitespace-nowrap font-body">
                          {f.ultimoCheckin ? formatDate(f.ultimoCheckin) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <ul className="md:hidden">
                {c.filas.map((f, i) => (
                  <li key={f.member_id} className="px-4 py-3" style={i < c.filas.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-navy font-body">
                      {f.nombre}
                      {f.encargado && <Star size={12} className="text-coral shrink-0" fill="currentColor" aria-label="Encargado del comité" />}
                    </p>
                    <p className="text-[13px] text-navy-light/80 font-body">{f.puestos.join(' · ')}</p>
                    <p className="mt-1 text-[13px] font-body">
                      {faltantes(f).length
                        ? <span className="text-coral-deep">Le falta {faltantes(f).join(', ')}</span>
                        : <span className="text-teal-deep">Al día</span>}
                      <span className="text-navy-light/80">
                        {' · último check-in '}{f.ultimoCheckin ? formatDate(f.ultimoCheckin) : '—'}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ))}

      <p className="text-[13px] text-navy-light/80 font-body">
        ¿Alguien no debería estar en la lista? Eso se cambia en{' '}
        <Link href="/servidores" className="text-coral hover:underline">Servidores</Link>.
      </p>
    </div>
  )
}

/**
 * useUrlFilter usa useSearchParams, que en el App Router exige <Suspense>.
 */
export default function MiComitePage() {
  return (
    <Suspense fallback={null}>
      <MiComiteContenido />
    </Suspense>
  )
}
