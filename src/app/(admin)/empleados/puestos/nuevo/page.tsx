'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useOrg } from '@/lib/org'
import { cn } from '@/lib/utils'
import { ChevronLeft, Check } from 'lucide-react'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

export default function NuevoPuestoPage() {
  const { areas: AREAS, adminCommittees } = useOrg()
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const [name, setName]                     = useState('')
  const [committee, setCommittee]           = useState('')
  const [description, setDescription]       = useState('')
  const [contractType, setContractType]     = useState<'planilla' | 'servicios_profesionales'>('planilla')
  const [salaryMin, setSalaryMin]           = useState('')
  const [salaryMax, setSalaryMax]           = useState('')
  const [isActive, setIsActive]             = useState(true)

  function canSave() {
    return name.trim() !== '' && committee !== '' && !saving
  }

  async function handleSave() {
    const committee_id = adminCommittees.find(c => c.name === committee)?.id ?? null
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/employees/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          committee_id,
          description: description.trim() || null,
          contract_type: contractType,
          salary_min: salaryMin ? Number(salaryMin) : null,
          salary_max: salaryMax ? Number(salaryMax) : null,
          is_active: isActive,
        }),
      })
      if (!res.ok) throw new Error('No se pudo crear el puesto')
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <Check size={24} className="text-teal-deep" />
          </div>
          <p className="text-xl font-bold text-navy font-display">
            Puesto creado
          </p>
          <Link
            href="/empleados/puestos"
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
          >
            Ver todos los puestos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 rounded-2xl px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 bg-surface-card shadow-[var(--shadow-md)]"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/empleados/puestos"
            className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body shrink-0"
          >
            <ChevronLeft size={16} />
            Puestos
          </Link>
          <span className="text-navy-light/80 hidden sm:inline">|</span>
          <span className="text-sm font-semibold text-navy font-display truncate hidden sm:inline">
            Nuevo puesto
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/empleados/puestos"
            className="rounded-full border border-[var(--outline-variant)] px-3.5 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            Cancelar
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave()}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[13px] text-white transition-colors font-body',
              canSave() ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
            )}
          >
            {saving ? 'Guardando...' : 'Guardar puesto'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-coral font-body">{error}</p>
      )}

      <div className="rounded-2xl p-5 space-y-5 bg-surface-card shadow-[var(--shadow-md)]">
        {/* Nombre + Comité */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="nombre-del-puesto" className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
              Nombre del puesto <span className="text-coral">*</span>
            </label>
            <input id="nombre-del-puesto"
              className={cn(inputCls, 'font-body')}
              placeholder="Ej: Coordinador de Estudios Bíblicos"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="comite-asociado" className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
              Comité asociado <span className="text-coral">*</span>
            </label>
            <select id="comite-asociado"
              className={cn(inputCls, 'font-body')}
              value={committee}
              onChange={e => setCommittee(e.target.value)}
            >
              <option value="">Seleccionar comité...</option>
              {AREAS.map(area => (
                <optgroup key={area.code} label={area.name}>
                  {area.committees.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Descripción */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
              Descripción de funciones
            </label>
            <span className="text-[11px] text-navy-light/80 font-mono">
              {description.length}/600
            </span>
          </div>
          <textarea
            className={cn(inputCls, 'resize-none font-body')}
            rows={4}
            maxLength={600}
            placeholder="Describe las responsabilidades y funciones del puesto..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Tipo de contrato + Rango salarial */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
              Tipo de contrato
            </label>
            <div className="flex gap-4">
              {([['planilla', 'Planilla'], ['servicios_profesionales', 'Servicios profesionales']] as const).map(([val, label]) => (
                <label key={val} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    className="accent-coral"
                    value={val}
                    checked={contractType === val}
                    onChange={() => setContractType(val)}
                  />
                  <span className="text-sm text-navy font-body">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
                Rango salarial aprobado
              </label>
              <span
                className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-semibold text-navy-light/80 font-display"
              >
                Confidencial
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/80 font-mono">₡</span>
                <input
                  type="number"
                  className={cn(inputCls, 'pl-7 font-body')}
                  placeholder="Desde"
                  value={salaryMin}
                  onChange={e => setSalaryMin(e.target.value)}
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/80 font-mono">₡</span>
                <input
                  type="number"
                  className={cn(inputCls, 'pl-7 font-body')}
                  placeholder="Hasta"
                  value={salaryMax}
                  onChange={e => setSalaryMax(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Toggle activo */}
        <div
          className="flex items-center justify-between pt-4 border-t border-[var(--outline-variant)]"
        >
          <div>
            <p className="text-sm font-medium text-navy font-body">Puesto activo</p>
            <p className="text-[13px] text-navy-light/80 font-body">
              Los puestos inactivos no aparecen en el proceso de contratación
            </p>
          </div>
          <div
            onClick={() => setIsActive(v => !v)}
            className={cn(
              'relative h-6 w-11 rounded-full transition-all duration-200 cursor-pointer shrink-0',
              isActive ? 'bg-coral' : 'bg-navy-light/20'
            )}
          >
            <div className={cn(
              'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
              isActive ? 'translate-x-5' : 'translate-x-0'
            )} />
          </div>
        </div>
      </div>
    </div>
  )
}
