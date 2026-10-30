'use client'

import { Modal } from '@/components/shared/Modal'
import { Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Modal presentacional para guardar una lista de miembros. Extraído de
// miembros/page.tsx (auditoría 2026-06: archivos gigantes). El estado vive en la
// página; acá solo recibe valores + callbacks.
interface Props {
  name: string
  onName: (v: string) => void
  desc: string
  onDesc: (v: string) => void
  tags: string
  onTags: (v: string) => void
  dynamic: boolean
  onDynamic: (v: boolean) => void
  saving: boolean
  /** Total de miembros que se guardarían (para el snapshot y el resumen). */
  total: number
  /** Etiqueta del segmento (buildSegmentLabel) para el resumen. */
  summaryLabel: string
  onClose: () => void
  onSave: () => void
  /** PAR-9 · Se llegó a Miembros desde «Editar filtros» de una lista. */
  edicion?: {
    nombreOriginal: string
    /** Cuántas personas tiene hoy la lista. */
    antes: number
    /** Comunicados programados que la usan (avisoDeImpacto), o null. */
    aviso: string | null
    modo: 'actualizar' | 'nueva'
    onModo: (m: 'actualizar' | 'nueva') => void
    confirmado: boolean
    onConfirmado: (v: boolean) => void
  }
}

export function SaveListModal({
  name, onName, desc, onDesc, tags, onTags, dynamic, onDynamic,
  saving, total, summaryLabel, onClose, onSave, edicion,
}: Props) {
  const actualizando = edicion?.modo === 'actualizar'
  const falta = actualizando && !!edicion?.aviso && !edicion.confirmado
  return (
    <Modal onClose={onClose} titleId="guardar-lista-title" width={384}>
      <div className="p-6 space-y-4">
        <p id="guardar-lista-title" className="text-base font-bold text-navy font-display">
          {edicion ? 'Guardar cambios de la lista' : 'Guardar lista de miembros'}
        </p>

        {edicion && (
          <div className="space-y-2" role="radiogroup" aria-label="Qué hacer con la búsqueda">
            {([
              { val: 'actualizar', label: `Actualizar «${edicion.nombreOriginal}»`, desc: 'Misma lista, mismo nombre: sigue sirviendo en todo lo que la usa' },
              { val: 'nueva', label: 'Guardar como lista nueva', desc: 'La original queda como está' },
            ] as const).map(opt => (
              <button
                key={opt.val}
                type="button"
                role="radio"
                aria-checked={edicion.modo === opt.val}
                onClick={() => edicion.onModo(opt.val)}
                className={`flex items-start gap-3 w-full text-left rounded-xl border p-3 transition-all ${edicion.modo === opt.val ? 'border-navy bg-navy/4' : 'border-outline'}`}
              >
                <div className={cn('mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0', edicion.modo === opt.val ? 'border-coral bg-coral' : 'border-navy-light/40')}>
                  {edicion.modo === opt.val && <Check size={9} className="text-white" strokeWidth={3} />}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-navy font-body">{opt.label}</p>
                  <p className="text-[13px] text-navy-light/80 mt-0.5 font-body">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="nombre-de-la-lista" className="text-[13px] uppercase tracking-widest text-navy-light/80 font-display">
              Nombre de la lista *
            </label>
            <input id="nombre-de-la-lista"
              autoFocus
              className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              placeholder="Ej. Donantes Heredia..."
              value={name}
              onChange={e => onName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="descripcion-opcional" className="text-[13px] uppercase tracking-widest text-navy-light/80 font-display">
              Descripción (opcional)
            </label>
            <input id="descripcion-opcional"
              className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              placeholder="Para qué sirve esta lista..."
              value={desc}
              onChange={e => onDesc(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="tags-separados-por-coma" className="text-[13px] uppercase tracking-widest text-navy-light/80 font-display">
              Tags (separados por coma)
            </label>
            <input id="tags-separados-por-coma"
              className="w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              placeholder="donantes, heredia..."
              value={tags}
              onChange={e => onTags(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <span className="text-[13px] uppercase tracking-widest text-navy-light/80 font-display">
              Tipo de lista
            </span>
            {[
              { val: true,  label: 'Dinámica', desc: 'Se recalcula con los filtros actuales cada vez que la abrís' },
              { val: false, label: 'Snapshot', desc: `Guarda los ${total.toLocaleString('es-CR')} miembros exactos de ahora` },
            ].map(opt => (
              <button
                key={String(opt.val)}
                type="button"
                onClick={() => onDynamic(opt.val)}
                className={`flex items-start gap-3 w-full text-left rounded-xl border p-3 transition-all ${dynamic === opt.val ? 'border-navy bg-navy/4' : 'border-outline'}`}
              >
                <div className={cn('mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0', dynamic === opt.val ? 'border-coral bg-coral' : 'border-navy-light/30')}>
                  {dynamic === opt.val && <Check size={9} className="text-white" strokeWidth={3} />}
                </div>
                <div>
                  <p className="text-[13px] font-medium text-navy font-body">{opt.label}</p>
                  <p className="text-[13px] text-navy-light/80 mt-0.5 font-body">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div
          className="rounded-xl px-3 py-2.5 text-[13px] text-navy-light/80 bg-surface-low font-body"
        >
          {actualizando ? (
            <>Hoy tiene <strong className="text-navy">{edicion!.antes.toLocaleString('es-CR')}</strong>; con el cambio, <strong className="text-navy">{total.toLocaleString('es-CR')} miembros</strong></>
          ) : (
            <>Resumen: <strong className="text-navy">{total.toLocaleString('es-CR')} miembros</strong></>
          )}
          {' · '}{summaryLabel}
        </div>

        {actualizando && edicion?.aviso && (
          <div className="rounded-xl px-3 py-2.5 bg-amber-50 border border-amber-200 space-y-2">
            <p className="flex items-start gap-2 text-[13px] text-amber-800 font-body">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden />
              {edicion.aviso}
            </p>
            <label className="flex items-center gap-2 text-[13px] text-amber-800 font-body">
              <input type="checkbox" checked={edicion.confirmado} onChange={e => edicion.onConfirmado(e.target.checked)} />
              Entiendo, actualizar igual
            </label>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--outline-variant)] py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={!name.trim() || saving || falta}
            className="flex-1 rounded-xl bg-navy py-2.5 text-sm text-white hover:bg-navy/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-body"
          >
            {saving ? 'Guardando…' : actualizando ? 'Actualizar lista' : edicion ? 'Guardar como nueva' : 'Guardar lista'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
