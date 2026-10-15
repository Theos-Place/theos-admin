'use client'

/**
 * DIR-9 · Qué puede dar cada sede (el ejercicio de Liberia).
 *
 * EL CERO ES EL DATO. Esta tabla se abre para encontrar huecos —«en el este
 * sobran de Sirviendo como Jesús y no hay de Panorama»—, así que la celda
 * vacía se marca y no se deja en blanco entre números.
 *
 * Scroll horizontal con la columna de sede fija: son 26 estudios y en un
 * portátil no caben, pero perder de vista de qué sede es la fila convierte
 * la tabla en ruido.
 */
import { useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { cn } from '@/lib/utils'
import type { CruceSedeFormacion as Datos } from '@/lib/reports/cruce-sede-formacion'

type Abierta = { titulo: string; miembros: string[] }

export function CruceSedeFormacion({
  datos, nombres,
}: {
  datos: Datos
  nombres: Record<string, string>
}) {
  const [abierta, setAbierta] = useState<Abierta | null>(null)

  /**
   * Sin NINGUNA sede, la tabla no tiene filas — pero callarse entero
   * esconde el motivo. Si hay gente sin sede, eso es justamente lo que hay
   * que decir: la sede sale de a cuál charla asiste cada quien, así que
   * «ninguna sede» significa que nadie tiene check-ins, no que no haya
   * dirigentes.
   */
  if (datos.filas.length === 0) {
    if (datos.sinSede === 0) return null
    return (
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <h3 className="text-base text-navy font-display font-extrabold tracking-[-0.02em]">
          Qué puede dar cada sede
        </h3>
        <p className="mt-1 text-[13px] text-navy-light/80 font-body">
          Todavía no se puede armar: {datos.sinSede === 1
            ? 'el único dirigente activo no tiene'
            : `ninguno de los ${datos.sinSede} dirigentes activos tiene`} sede calculada.
          La sede sale de a cuál charla asiste cada quien, así que aparece cuando
          empiecen a registrarse sus check-ins.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
      <h3 className="text-base text-navy font-display font-extrabold tracking-[-0.02em]">
        Qué puede dar cada sede
      </h3>
      <p className="mt-0.5 text-[13px] text-navy-light/80 font-body">
        Dirigentes activos formados en cada estudio. Las casillas marcadas son estudios
        que esa sede no puede dar hoy.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-[13px] font-body">
          <caption className="sr-only">
            Dirigentes activos formados en cada estudio, por sede
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface-card px-2 py-2 text-left text-[11px] uppercase tracking-wider text-navy-light/80 font-display">
                Sede
              </th>
              <th scope="col" className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-navy-light/80 font-display">
                Activos
              </th>
              {datos.estudios.map(e => (
                <th
                  key={e.code}
                  scope="col"
                  title={e.name}
                  className="px-2 py-2 text-center text-[11px] uppercase tracking-wider text-navy-light/80 font-display"
                >
                  {e.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.filas.map(f => (
              <tr key={f.sede} className="border-t border-navy/10">
                <th scope="row" className="sticky left-0 z-10 bg-surface-card px-2 py-2 text-left text-navy font-body font-medium whitespace-nowrap">
                  {f.sede}
                </th>
                <td className="px-2 py-2 text-right text-navy-light/80">{f.dirigentes}</td>
                {f.celdas.map(c => {
                  const estudio = datos.estudios.find(e => e.code === c.code)
                  return (
                    <td key={c.code} className="px-1 py-1 text-center">
                      {c.total === 0 ? (
                        <span
                          className="inline-block w-7 rounded bg-coral/10 py-1 text-coral-deep"
                          title={`${f.sede} no tiene a nadie formado en ${estudio?.name ?? c.code}`}
                        >
                          0
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAbierta({
                            titulo: `${estudio?.name ?? c.code} · ${f.sede}`,
                            miembros: c.miembros,
                          })}
                          className={cn(
                            'inline-block w-7 rounded py-1 text-navy',
                            'hover:bg-teal/25 focus:outline-none focus:ring-2 focus:ring-coral/40',
                            'bg-teal/15',
                          )}
                          aria-label={`${c.total} en ${estudio?.name ?? c.code}, ${f.sede}. Ver quiénes son`}
                        >
                          {c.total}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {datos.sinSede > 0 && (
        <p className="mt-3 text-[13px] text-navy-light/80 font-body">
          {datos.sinSede} dirigente{datos.sinSede === 1 ? '' : 's'} activo{datos.sinSede === 1 ? '' : 's'}{' '}
          no aparece{datos.sinSede === 1 ? '' : 'n'} en la tabla: no tienen sede calculada,
          que sale de a cuál charla asisten. No se reparten en una sede inventada.
        </p>
      )}

      {abierta && (
        <Modal onClose={() => setAbierta(null)} titleId="cruce-titulo" width={520}>
          <div className="p-6">
            <h2 id="cruce-titulo" className="text-lg text-navy font-display font-extrabold tracking-[-0.02em]">
              {abierta.titulo}
            </h2>
            <ul className="mt-4 max-h-[60vh] overflow-y-auto divide-y divide-navy/10">
              {abierta.miembros
                .map(id => ({ id, nombre: nombres[id] ?? 'Sin nombre' }))
                .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                .map(p => (
                  <li key={p.id} className="py-2">
                    <a
                      href={`/estudios/dirigentes/${p.id}`}
                      className="text-sm text-navy hover:text-coral-deep font-body focus:outline-none focus:ring-2 focus:ring-coral/40 rounded"
                    >
                      {p.nombre}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        </Modal>
      )}
    </div>
  )
}
