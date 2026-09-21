'use client'

import { useMemo, useState } from 'react'
import { Loader2, PhoneOff, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { ExportButton } from '@/components/shared/ExportButton'
import { type ColumnDef } from '@/components/shared/ColumnSelector'
import { useCargaRemota } from '@/hooks/useCargaRemota'
import { SEMANAS_DE_CORTE } from '@/lib/reports/abandonos'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

type Persona = {
  member_id: string
  nombre: string
  sede: string
  telefono: string | null
  email: string | null
  volvioEl?: string | null
}

type Respuesta = {
  semana: string
  etiqueta: string
  puedeVerContacto: boolean
  asistentes: Persona[]
  abandono:
    | { evaluable: true; hasta: string; personas: Persona[] }
    | { evaluable: false; faltanSemanas: number; hasta: string }
}

type Pestana = 'asistieron' | 'dejaron'

function columnas(conContacto: boolean, conRegreso: boolean): ColumnDef<Persona>[] {
  const base: ColumnDef<Persona>[] = [
    { key: 'nombre', label: 'Nombre', defaultVisible: true },
    { key: 'sede', label: 'Sede', defaultVisible: true },
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
 * REP-5 · Las dos listas de una semana: quiénes vinieron y quiénes dejaron de
 * venir después.
 *
 * La segunda es la que se usa: se baja para llamar por teléfono. Por eso los
 * que NO han vuelto van primero y el "volvió el" es una columna propia — a
 * quien ya regresó no hay que llamarlo.
 */
export function ListasDeLaSemana({ clave }: { clave: string | null }) {
  const [pestana, setPestana] = useState<Pestana>('asistieron')

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

  const abandono = datos?.abandono
  const personas = useMemo<Persona[]>(() => {
    if (!datos) return []
    if (pestana === 'asistieron') return datos.asistentes
    return abandono?.evaluable ? abandono.personas : []
  }, [datos, pestana, abandono])

  const cols = useMemo(
    () => columnas(datos?.puedeVerContacto ?? false, pestana === 'dejaron'),
    [datos?.puedeVerContacto, pestana],
  )

  if (!clave) return null

  return (
    <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {([
            ['asistieron', `Asistieron${datos ? ` (${datos.asistentes.length.toLocaleString('es-CR')})` : ''}`],
            ['dejaron', `Dejaron de venir${abandono?.evaluable ? ` (${abandono.personas.length.toLocaleString('es-CR')})` : ''}`],
          ] as Array<[Pestana, string]>).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPestana(id)}
              aria-pressed={pestana === id}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[13px] transition-colors font-body border',
                pestana === id
                  ? 'bg-navy text-white border-navy'
                  : 'border-[var(--outline-variant)] text-navy-light hover:bg-surface-low',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {personas.length > 0 && (
          <ExportButton<Persona>
            data={personas}
            columns={cols}
            allColumns={cols}
            filename={`${pestana === 'dejaron' ? 'dejaron-de-venir' : 'asistentes'}-${datos?.semana ?? ''}`}
          />
        )}
      </div>

      {!datos?.puedeVerContacto && datos && (
        <p className="flex items-start gap-1.5 text-[13px] text-navy-light/80 font-body">
          <PhoneOff size={13} className="mt-0.5 shrink-0" aria-hidden />
          Tu rol ve el reporte pero no el directorio, así que la descarga va sin teléfonos ni correos.
        </p>
      )}

      {cargando ? (
        <div className="flex items-center gap-2 py-8 justify-center text-navy-light/80">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          <span className="text-sm font-body">Cargando las listas…</span>
        </div>
      ) : error ? (
        <p className="text-[13px] text-coral-deep font-body py-4" role="alert">{error}</p>
      ) : pestana === 'dejaron' && abandono && !abandono.evaluable ? (
        // Una lista a medias que cambia sola es peor que decir cuánto falta:
        // con esta lista se llama por teléfono.
        <EmptyState
          icon={Users}
          title={`Todavía no se puede calcular`}
          description={`Hacen falta ${SEMANAS_DE_CORTE} semanas completas después de esta para saber quién cortó. Faltan ${abandono.faltanSemanas} ${abandono.faltanSemanas === 1 ? 'semana' : 'semanas'}: la respuesta está el ${formatDate(abandono.hasta)}.`}
        />
      ) : personas.length === 0 ? (
        <EmptyState
          icon={Users}
          title={pestana === 'dejaron' ? 'Nadie cortó cinco semanas' : 'Nadie hizo check-in esa semana'}
        />
      ) : (
        <div className="overflow-x-auto">
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
                  {pestana === 'dejaron' && (
                    <td className="px-3 py-2 text-[13px] font-body whitespace-nowrap">
                      {p.volvioEl
                        ? <span className="text-teal-deep">{formatDate(p.volvioEl)}</span>
                        : <span className="text-navy-light/80">No ha vuelto</span>}
                    </td>
                  )}
                  {datos?.puedeVerContacto && (
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
      )}
    </div>
  )
}
