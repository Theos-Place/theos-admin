'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ALL_COMMITTEES, AREAS } from '@/data/mock-committees'
import { cn } from '@/lib/utils'
import { ChevronLeft, Check } from 'lucide-react'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

export default function NuevoPuestoPage() {
  const router = useRouter()
  const [saved, setSaved] = useState(false)

  const [name, setName]                     = useState('')
  const [committee, setCommittee]           = useState('')
  const [description, setDescription]       = useState('')
  const [contractType, setContractType]     = useState<'planilla' | 'servicios_profesionales'>('planilla')
  const [salaryMin, setSalaryMin]           = useState('')
  const [salaryMax, setSalaryMax]           = useState('')
  const [isActive, setIsActive]             = useState(true)

  function canSave() {
    return name.trim() !== '' && committee !== ''
  }

  if (saved) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <Check size={24} className="text-teal-deep" />
          </div>
          <p className="text-xl font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Puesto creado
          </p>
          <Link
            href="/empleados/puestos"
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Ver todos los puestos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 rounded-2xl px-5 py-3 flex items-center justify-between gap-3"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/empleados/puestos"
            className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <ChevronLeft size={16} />
            Puestos
          </Link>
          <span className="text-navy-light/20">|</span>
          <span className="text-sm font-semibold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Nuevo puesto
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/empleados/puestos"
            className="rounded-full border px-3.5 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors"
            style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
          >
            Cancelar
          </Link>
          <button
            type="button"
            onClick={() => setSaved(true)}
            disabled={!canSave()}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-[12px] text-white transition-colors',
              canSave() ? 'bg-coral hover:bg-coral-deep' : 'bg-navy-light/20 cursor-not-allowed'
            )}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Guardar puesto
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-5 space-y-5" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        {/* Nombre */}
        <div className="space-y-1">
          <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Nombre del puesto <span className="text-coral">*</span>
          </label>
          <input
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
            placeholder="Ej: Coordinador de Estudios Bíblicos"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        {/* Comité */}
        <div className="space-y-1">
          <label className="text-[11px] tracking-widest uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
            Comité asociado <span className="text-coral">*</span>
          </label>
          <select
            className={inputCls}
            style={{ fontFamily: 'var(--font-body)' }}
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

        {/* Descripción */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Descripción de funciones
            </label>
            <span className="text-[10px] text-navy-light/40" style={{ fontFamily: 'var(--font-mono)' }}>
              {description.length}/600
            </span>
          </div>
          <textarea
            className={cn(inputCls, 'resize-none')}
            style={{ fontFamily: 'var(--font-body)' }}
            rows={4}
            maxLength={600}
            placeholder="Describe las responsabilidades y funciones del puesto..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        {/* Tipo de contrato */}
        <div className="space-y-2">
          <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
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
                <span className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Rango salarial */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[11px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
              Rango salarial aprobado
            </label>
            <span
              className="rounded-full bg-navy/10 px-2 py-0.5 text-[9px] font-semibold text-navy-light/50"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Confidencial
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-mono)' }}>₡</span>
              <input
                type="number"
                className={cn(inputCls, 'pl-7')}
                style={{ fontFamily: 'var(--font-body)' }}
                placeholder="Desde"
                value={salaryMin}
                onChange={e => setSalaryMin(e.target.value)}
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-mono)' }}>₡</span>
              <input
                type="number"
                className={cn(inputCls, 'pl-7')}
                style={{ fontFamily: 'var(--font-body)' }}
                placeholder="Hasta"
                value={salaryMax}
                onChange={e => setSalaryMax(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Toggle activo */}
        <div
          className="flex items-center justify-between pt-4 border-t"
          style={{ borderColor: 'var(--outline-variant)' }}
        >
          <div>
            <p className="text-sm font-medium text-navy" style={{ fontFamily: 'var(--font-body)' }}>Puesto activo</p>
            <p className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
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
