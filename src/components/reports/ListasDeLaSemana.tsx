'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, PhoneOff, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ExportButton } from '@/components/shared/ExportButton'
import { InfoDelEncabezado } from '@/components/shared/InfoDelEncabezado'
import { type ColumnDef } from '@/components/shared/ColumnSelector'
import { useCargaRemota } from '@/hooks/useCargaRemota'
import { INFO_ASISTIERON, INFO_DEJARON, SEMANAS_DE_CORTE } from '@/lib/reports/abandonos'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

type Persona = {
  member_id: string
  nombre: string
  sede: string
  visitas: number
  telefono: string | null
  email: string | null
  volvioEl?: string | null
}

type Respuesta = {
  semana: string
  etiqueta: string
  puedeVerContacto: boolean
  checkins: number
  asistentes: Persona[]
  dejaron: { etiqueta: string; personas: Persona[] }
}

function columnas(conContacto: boolean, conRegreso: boolean): ColumnDef<Persona>[] {
  const base: ColumnDef<Persona>[] = [
    { key: 'nombre', label: 'Nombre', defaultVisible: true },
    { key: 'sede', label: 'Sede', defaultVisible: true },
    { key: 'visitas', label: 'Veces que ha venido', defaultVisible: true, exportValue: p => String(p.visitas) },
  ]
  if (conRegreso) {
    base.push({
      key: 'volvioEl', label: 'Volvió el', defaultVisible: true,
      exportValue: p => (p.volvioEl ? formatDate(p.volvioEl) : 'No ha vuelto'),
    })
  }
  // Teléfono y correo solo si el permiso los dejó pasar: el servidor ya los
  // manda en null, y ofrecer columnas siempre vacías se lee como un error.
  if (conContacto) {
    base.push(
      { key: 'telefono', label: 'Teléfono / WhatsApp', defaultVisible: true, exportValue: p => p.telefono ?? '' },
      { key: 'email', label: 'Email', defaultVisible: true, exportValue: p => p.email ?? '' },
    )
  }
  return base
}

/**
 * Una de las dos listas, colapsada por defecto (REP-8).
 *
 * ARRANCAN CERRADAS a propósito: son cientos de filas y, abiertas, empujaban
 * los gráficos fuera de la pantalla al elegir una semana. El conteo —que es lo
 * que se mira de reojo— y la descarga quedan afuera, así que bajar el archivo
 * no obliga a desplegar nada.
 */
function Lista({
  titulo, info, personas, conContacto, conRegreso, nombreArchivo, vacio,
}: {
  titulo: string
  info: string
  personas: Persona[]
  conContacto: boolean
  conRegreso: boolean
  nombreArchivo: string
  vacio: string
}) {
  const [abierta, setAbierta] = useState(false)
  const cols = useMemo(() => columnas(conContacto, conRegreso), [conContacto, conRegreso])

  return (
    <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between gap-3 flex-wrap p-4">
        <button
          type="button"
          onClick={() => setAbierta(a => !a)}
          aria-expanded={abierta}
          className="flex items-center gap-2 text-left bg-transparent border-0 cursor-pointer"
        >
          {abierta ? <ChevronDown size={16} className="text-navy-light/80" aria-hidden /> : <ChevronRight size={16} className="text-navy-light/80" aria-hidden />}
          <span className="text-base font-bold text-navy font-display">
            {titulo} <span className="tabular-nums">({personas.length.toLocaleString('es-CR')})</span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <InfoDelEncabezado texto={info} />
          {personas.length > 0 && (
            <ExportButton<Persona>
              data={personas} columns={cols} allColumns={cols} filename={nombreArchivo}
            />
          )}
          {!abierta && personas.length > 0 && (
            <button
              type="button"
              onClick={() => setAbierta(true)}
              className="rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
            >
              Mostrar lista
            </button>
          )}
        </div>
      </div>

      {abierta && (
        personas.length === 0 ? (
          <div className="px-4 pb-4"><EmptyState icon={Users} title={vacio} /></div>
        ) : (
          <div className="overflow-x-auto border-t border-[var(--outline-variant)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--outline-variant)]">
                  {cols.map(c => (
                    <th key={String(c.key)} className="px-3 py-2 text-left text-[11px] uppercase tracking-widest text-navy-light/80 font-display whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personas.map((p, i) => (
                  <tr key={p.member_id} className={cn(i % 2 === 1 ? 'bg-surface-low/40' : '')}>
                    <td className="px-3 py-2 text-[13px] text-navy font-body whitespace-nowrap">{p.nombre}</td>
                    <td className="px-3 py-2 text-[13px] text-navy-light/80 font-body">{p.sede}</td>
                    <td className="px-3 py-2 text-[13px] text-navy-light/80 font-body tabular-nums">{p.visitas}</td>
                    {conRegreso && (
                      <td className="px-3 py-2 text-[13px] font-body whitespace-nowrap">
                        {p.volvioEl
                          ? <span className="text-teal-deep">{formatDate(p.volvioEl)}</span>
                          : <span className="text-navy-light/80">No ha vuelto</span>}
                      </td>
                    )}
                    {conContacto && (
                      <>
                        <td className="px-3 py-2 text-[13px] text-navy-light/80 font-body whitespace-nowrap">{p.telefono ?? '—'}</td>
                        <td className="px-3 py-2 text-[13px] text-navy-light/80 font-body">{p.email ?? '—'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

/**
 * REP-5 / REP-8 · Las dos listas de una semana.
 *
 * "Asistieron" son los de ESTA semana con al menos dos visitas; "dejaron de
 * venir" son los de hace cinco semanas que no han vuelto. Las dos definiciones
 * y el porqué están en `lib/reports/abandonos.ts`.
 */
export function ListasDeLaSemana({ clave }: { clave: string | null }) {
  const { datos, cargando, error } = useCargaRemota<Respuesta>(
    clave ? `semana-listas:${clave}` : '',
    async () => {
      if (!clave) return null as unknown as Respuesta
      const r = await fetch(`/api/reports/semana-asistentes?semana=${encodeURIComponent(clave)}`)
      if (!r.ok) {
        const b = await r.json().catch(() => null) as { error?: string } | null
        throw new Error(b?.error ?? 'No se pudieron cargar las listas de la semana.')
      }
      return r.json()
    },
    { generico: 'No se pudieron cargar las listas de la semana.' },
  )

  if (!clave) return null

  if (cargando) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-navy-light/80">
        <Loader2 size={16} className="animate-spin" aria-hidden />
        <span className="text-sm font-body">Cargando las listas…</span>
      </div>
    )
  }
  if (error) return <p className="text-[13px] text-coral-deep font-body py-4" role="alert">{error}</p>
  if (!datos) return null

  const dejaron = datos.dejaron.personas.length
  const sinVolver = datos.dejaron.personas.filter(p => !p.volvioEl).length

  return (
    /* Un bloque APARTE, con su borde y su fondo: las dos listas no son otro
       gráfico de la semana, son la tarea que sale del reporte. Mezcladas con lo
       demás se leían como un apéndice. */
    <section
      aria-label="Seguimiento de la semana"
      className="rounded-2xl border border-[var(--outline-variant)] bg-surface-low/50 p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-navy font-display">Seguimiento de la semana</h2>
          <p className="text-[13px] text-navy-light/80 font-body">
            Quiénes vinieron y quiénes dejaron de venir. La segunda lista es la de llamar.
          </p>
        </div>
        {/* Los tres números que resumen el bloque. Check-ins y asistentes NO son
            lo mismo, y la diferencia son los que vinieron por primera vez. */}
        <div className="flex items-center gap-5">
          {[
            { n: datos.checkins, t: 'check-ins' },
            { n: datos.asistentes.length, t: 'asistentes' },
            { n: dejaron, t: 'dejaron de venir', alerta: true },
          ].map(k => (
            <div key={k.t} className="text-right">
              <p className={cn('text-xl font-extrabold tabular-nums font-display leading-none',
                k.alerta && k.n > 0 ? 'text-coral-deep' : 'text-navy')}>
                {k.n.toLocaleString('es-CR')}
              </p>
              <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display mt-1">{k.t}</p>
            </div>
          ))}
        </div>
      </div>

      {dejaron > 0 && (
        <p className="text-[13px] text-navy-light/80 font-body">
          De los {dejaron.toLocaleString('es-CR')} que cumplen {SEMANAS_DE_CORTE} semanas sin venir,{' '}
          <strong className="text-navy">{sinVolver.toLocaleString('es-CR')}</strong> no han vuelto todavía —
          esos son los que vale la pena llamar.
        </p>
      )}

      <Lista
        titulo="Asistieron esta semana"
        info={INFO_ASISTIERON}
        personas={datos.asistentes}
        conContacto={datos.puedeVerContacto}
        conRegreso={false}
        nombreArchivo={`asistentes-${datos.semana}`}
        vacio="Nadie con dos o más visitas hizo check-in esa semana"
      />

      <Lista
        titulo={`Dejaron de venir · vinieron el ${datos.dejaron.etiqueta}`}
        info={INFO_DEJARON}
        personas={datos.dejaron.personas}
        conContacto={datos.puedeVerContacto}
        conRegreso
        nombreArchivo={`dejaron-de-venir-${datos.semana}`}
        vacio="Nadie cumple cinco semanas sin venir esta semana"
      />

      {!datos.puedeVerContacto && (
        <p className="flex items-start gap-1.5 text-[13px] text-navy-light/80 font-body">
          <PhoneOff size={13} className="mt-0.5 shrink-0" aria-hidden />
          Tu rol ve el reporte pero no el directorio, así que la descarga va sin teléfonos ni correos.
        </p>
      )}
    </section>
  )
}
