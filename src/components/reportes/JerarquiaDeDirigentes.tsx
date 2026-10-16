'use client'

/**
 * DIR-9 · La jerarquía del reporte de dirigentes (el diagrama de Fabiola).
 *
 * Total → inactivos / activos → sus desgloses. Cada número abre la lista de
 * quiénes lo componen, porque el reporte se mira para ACTUAR: ver que hay 8
 * en pasantía no sirve si no se puede saber quiénes son.
 *
 * Los porcentajes son sobre el TOTAL y no sobre la rama, para que se puedan
 * comparar entre ramas. Lo dice la nota al pie, no se deja adivinar.
 */
import { useState } from 'react'
import { Download, Flag, Info, Users } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { cn } from '@/lib/utils'
import type { Celda, JerarquiaDeDirigentes as Datos } from '@/lib/reports/jerarquia-de-dirigentes'
import { NOTA_BANDERITA } from '@/lib/reports/jerarquia-de-dirigentes'

import type { CruceSedeFormacion as Cruce } from '@/lib/reports/cruce-sede-formacion'

export type Payload = Datos & {
  nombres: Record<string, string>
  actualizado: string
  cruce: Cruce
}

const fmt = (n: number) => n.toLocaleString('es-CR')

/** Un número clicable. Deshabilitado cuando es cero: no hay lista que abrir. */
function Numero({
  celda, onAbrir, tono = 'normal', grande = false,
}: {
  celda: Celda
  onAbrir: (c: Celda) => void
  tono?: 'normal' | 'activo' | 'inactivo' | 'alerta'
  grande?: boolean
}) {
  const vacia = celda.total === 0
  const color = tono === 'activo' ? 'text-teal-deep'
    : tono === 'inactivo' ? 'text-navy-light'
      : tono === 'alerta' ? 'text-coral-deep' : 'text-navy'
  return (
    <button
      type="button"
      disabled={vacia}
      onClick={() => onAbrir(celda)}
      className={cn(
        'w-full rounded-2xl bg-surface-card p-4 text-left shadow-[var(--shadow-md)]',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-coral/40',
        vacia ? 'cursor-default opacity-70' : 'hover:bg-surface-low',
      )}
      aria-label={vacia ? `${celda.etiqueta}: ninguno` : `${celda.etiqueta}: ${celda.total}. Ver quiénes son`}
    >
      <p className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">{celda.etiqueta}</p>
      <p className={cn(
        'mt-1 font-display font-extrabold tracking-[-0.02em]',
        grande ? 'text-3xl' : 'text-2xl', color,
      )}>
        {fmt(celda.total)}
        <span className="ml-1.5 text-[13px] font-body font-normal text-navy-light/80">{celda.pct}%</span>
      </p>
    </button>
  )
}

export function JerarquiaDeDirigentes({ datos }: { datos: Payload }) {
  const [abierta, setAbierta] = useState<Celda | null>(null)

  const razonesConGente = datos.porRazonNoDisponible.filter(c => c.total > 0)
  const inactivosConRazon = datos.porRazonInactivo.filter(c => c.total > 0)

  return (
    <div className="space-y-5">
      {/*
        DIR-9 · UN archivo, no uno por número. El reporte tiene quince celdas
        clicables; quince endpoints darían quince archivos que no se pueden
        cruzar. Este trae una fila por dirigente con las columnas que definen
        cada celda, así que «los 8 en pasantía» es filtrar una columna.
      */}
      <div className="flex justify-end">
        <a
          href="/api/reports/leaders/export"
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-card px-4 py-2 text-[13px] text-navy shadow-[var(--shadow-md)] hover:bg-surface-low transition-colors font-body focus:outline-none focus:ring-2 focus:ring-coral/40"
        >
          <Download size={14} aria-hidden="true" />
          Bajar en Excel
        </a>
      </div>

      {/* Total */}
      <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)]">
        <p className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">
          Total de dirigentes
        </p>
        <p className="mt-1 text-4xl text-navy font-display font-extrabold tracking-[-0.02em]">
          {fmt(datos.total)}
        </p>
        <p className="mt-1 text-[13px] text-navy-light/80 font-body">
          Activos e inactivos. Todos los porcentajes de abajo son sobre este número,
          para que se puedan comparar entre sí.
        </p>
      </div>

      {/* Las dos ramas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* INACTIVOS */}
        <section className="space-y-3">
          <Numero celda={datos.inactivos} onAbrir={setAbierta} tono="inactivo" grande />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {inactivosConRazon.map(c => <Numero key={c.clave} celda={c} onAbrir={setAbierta} tono="inactivo" />)}
            {datos.inactivosSinRazon.total > 0 && (
              <Numero celda={datos.inactivosSinRazon} onAbrir={setAbierta} tono="inactivo" />
            )}
          </div>
          {datos.inactivosSinRazon.total > 0 && (
            <p className="text-[13px] text-navy-light/80 font-body">
              A {fmt(datos.inactivosSinRazon.total)} fichas nadie les registró por qué están
              inactivas. Se muestran aparte para que el desglose sume.
            </p>
          )}
        </section>

        {/* ACTIVOS */}
        <section className="space-y-3">
          <Numero celda={datos.activos} onAbrir={setAbierta} tono="activo" grande />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Numero celda={datos.disponibles} onAbrir={setAbierta} tono="activo" />
            <Numero celda={datos.noDisponibles} onAbrir={setAbierta} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {razonesConGente.map(c => <Numero key={c.clave} celda={c} onAbrir={setAbierta} />)}
          </div>
          {datos.derivadosADirigiendo.total > 0 && (
            <p className="text-[13px] text-navy-light/80 font-body">
              {fmt(datos.derivadosADirigiendo.total)} de ellos salen de su grupo abierto,
              no de algo que alguien escribiera: si tiene un grupo en curso, no está disponible.
              El prematrimonial no cuenta como ocupar.
            </p>
          )}
        </section>
      </div>

      {/* Banderita: solo si el permiso la dejó viajar */}
      {datos.enRevision && (
        <div className="rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] space-y-3">
          <div className="flex items-center gap-2">
            <Flag size={15} className="text-coral-deep" aria-hidden="true" />
            <p className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">
              Banderita de revisión
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* La etiqueta del encabezado ya dice «banderita»: repetirla en
                la tarjeta se leía dos veces seguidas. */}
            <Numero
              celda={{ ...datos.enRevision, etiqueta: 'En total' }}
              onAbrir={setAbierta}
              tono="alerta"
            />
            {/* DIR-14 · De dónde salieron: el cron o alguien a mano. */}
            {datos.revisionAutomaticas && <Numero celda={datos.revisionAutomaticas} onAbrir={setAbierta} tono="alerta" />}
            {datos.revisionManuales && <Numero celda={datos.revisionManuales} onAbrir={setAbierta} tono="alerta" />}
            {datos.porRazonDeRevision.filter(c => c.total > 0).map(c => (
              <Numero key={c.clave} celda={c} onAbrir={setAbierta} tono="alerta" />
            ))}
          </div>
          <p className="flex items-start gap-1.5 text-[13px] text-navy-light/80 font-body">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {NOTA_BANDERITA}
          </p>
        </div>
      )}

      {/* Inconsistencia: se muestra solo cuando existe */}
      {datos.inactivosConGrupo.total > 0 && (
        <div className="rounded-2xl bg-coral/10 p-4">
          <p className="text-[13px] text-coral-deep font-body">
            <strong className="font-display">{fmt(datos.inactivosConGrupo.total)}</strong>{' '}
            dirigentes figuran inactivos y aun así tienen un grupo abierto. Eso no debería
            pasar: o la ficha está mal o el grupo quedó sin cerrar.
          </p>
          <button
            type="button"
            onClick={() => setAbierta(datos.inactivosConGrupo)}
            className="mt-2 text-[13px] text-coral-deep underline font-body focus:outline-none focus:ring-2 focus:ring-coral/40 rounded"
          >
            Ver quiénes son
          </button>
        </div>
      )}

      <p className="text-[13px] text-navy-light/80 font-body">
        {/* Sin punto después de la hora: el locale es-CR ya cierra con uno
            («1:18 p. m.») y quedaban dos seguidos. */}
        Datos de {new Date(datos.actualizado).toLocaleString('es-CR', {
          day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })} — se calculan al abrir la pantalla, no de un resumen de anoche.
      </p>

      {abierta && (
        <Modal onClose={() => setAbierta(null)} titleId="drill-titulo" width={560}>
          <div className="p-6">
            <h2 id="drill-titulo" className="text-lg text-navy font-display font-extrabold tracking-[-0.02em]">
              {abierta.etiqueta}
            </h2>
            <p className="mt-0.5 text-[13px] text-navy-light/80 font-body">
              {fmt(abierta.total)} {abierta.total === 1 ? 'persona' : 'personas'}
            </p>
            <ul className="mt-4 max-h-[60vh] overflow-y-auto divide-y divide-navy/10">
              {abierta.miembros
                .map(id => ({ id, nombre: datos.nombres[id] ?? 'Sin nombre' }))
                .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                .map(p => (
                  <li key={p.id} className="py-2">
                    <a
                      href={`/miembros/${p.id}`}
                      className="text-sm text-navy hover:text-coral-deep font-body focus:outline-none focus:ring-2 focus:ring-coral/40 rounded"
                    >
                      {p.nombre}
                    </a>
                  </li>
                ))}
            </ul>
            {abierta.miembros.length === 0 && (
              <p className="mt-4 flex items-center gap-2 text-sm text-navy-light/80 font-body">
                <Users size={15} aria-hidden="true" /> Nadie en este grupo.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
