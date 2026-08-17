'use client'

// EVE-4 · Selector del formulario de inscripción de un evento.
//
// La inscripción SIGUE siendo event_registrations —es lo que maneja cupo, pago y
// check-in— y la respuesta de este formulario se le enlaza como información
// adicional (decisión confirmada con TI, 2026-08-06). Por eso es opcional y
// quitarlo no deshace ninguna inscripción.
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'

export function RegistrationFormPicker({ value, onChange }: {
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [forms, setForms] = useState<Array<{ id: string; label: string }>>([])

  useEffect(() => {
    let vivo = true
    fetch('/api/forms')
      .then(r => (r.ok ? r.json() : []))
      .then((rows: Array<{ id: string; title?: string; name?: string; is_active?: boolean }>) => {
        if (!vivo || !Array.isArray(rows)) return
        setForms(rows.filter(f => f.is_active !== false).map(f => ({ id: f.id, label: f.title ?? f.name ?? 'Sin nombre' })))
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <label className="text-[12px] text-navy-light/70 font-display mb-1 block" htmlFor="registration-form">
            Formulario de inscripción (opcional)
          </label>
          <select
            id="registration-form"
            className={inputCls}
            value={value ?? ''}
            onChange={e => onChange(e.target.value || null)}
          >
            <option value="">Sin formulario</option>
            {forms.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <a href="/formularios/nuevo" target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
          <Plus size={13} /> Crear formulario
        </a>
      </div>
      <p className="text-[12px] text-navy-light/70 font-body">
        Se le pide al inscribirse. La inscripción vale igual aunque no lo llene: el cupo y el
        pago no dependen del formulario.
      </p>
    </div>
  )
}
