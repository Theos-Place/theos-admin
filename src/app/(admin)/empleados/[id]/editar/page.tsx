'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { type ContractType } from '@/types/employee'
import { useEmployees } from '@/hooks/useEmployees'
import { useToast } from '@/components/shared/Toast'
import { cn } from '@/lib/utils'
import { ChevronLeft, Check } from 'lucide-react'

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

export default function EditarEmpleadoPage() {
  const { id } = useParams<{ id: string }>()
  const { employees, positions, loading } = useEmployees()
  const toast = useToast()
  const employee = useMemo(() => employees.find(e => e.id === id), [employees, id])
  const activePositions = useMemo(() => positions.filter(p => p.is_active), [positions])

  const [positionId, setPositionId]         = useState('')
  const [contractType, setContractType]     = useState<ContractType>('planilla')
  const [email, setEmail]                   = useState('')
  const [notes, setNotes]                   = useState('')
  const [vacationDays, setVacationDays]     = useState('15')
  const [saved, setSaved]                   = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  useEffect(() => {
    if (!employee) return
    setPositionId(employee.position_id ?? '')
    setContractType(employee.contract_type ?? 'planilla')
    setEmail(employee.member_email ?? '')
    setNotes(employee.notes ?? '')
    setVacationDays(String(employee.vacation_days_total ?? 15))
  }, [employee])

  async function handleSave() {
    if (saving || !employee) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position_id: positionId || null,
          contract_type: contractType,
          notes: notes.trim() || null,
          vacation_days_total: Number(vacationDays) || 0,
        }),
      })
      if (!res.ok) throw new Error('No se pudieron guardar los cambios')
      // El email pertenece al miembro: se persiste aparte (best-effort).
      if (employee.member_id && email !== (employee.member_email ?? '')) {
        await fetch(`/api/members/${employee.member_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() || null }),
        }).catch(() => {})
      }
      toast('Cambios guardados', 'success')
      setSaved(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !employee) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/80 font-body">Cargando empleado...</p>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/80 font-body">
          Empleado no encontrado.
        </p>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-teal-soft/30 flex items-center justify-center mx-auto">
            <Check size={24} className="text-teal-deep" />
          </div>
          <p className="text-xl font-bold text-navy font-display">
            Cambios guardados
          </p>
          <Link
            href={`/empleados/${id}`}
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body"
          >
            Ver expediente
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
            href={`/empleados/${id}`}
            className="flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body min-w-0"
          >
            <ChevronLeft size={16} className="shrink-0" />
            <span className="truncate">{employee.member_name}</span>
          </Link>
          <span className="text-navy-light/80 hidden sm:inline">|</span>
          <span className="text-sm font-semibold text-navy font-display shrink-0">
            Editar
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/empleados/${id}`}
            className="rounded-full border border-[var(--outline-variant)] px-3.5 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            Cancelar
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-coral px-3.5 py-1.5 text-[13px] text-white hover:bg-coral-deep transition-colors disabled:opacity-50 font-body"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-coral font-body">{error}</p>
      )}

      <div className="rounded-2xl p-5 space-y-5 bg-surface-card shadow-[var(--shadow-md)]">
        {/* Info no editable */}
        <div className="rounded-xl p-4 space-y-1 bg-surface-low">
          <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">Persona</p>
          <p className="text-sm font-semibold text-navy font-display">{employee.member_name}</p>
          <p className="text-[13px] text-navy-light/80 font-body">
            Inicio: {new Date(employee.start_date + 'T00:00:00').toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label htmlFor="correo-de-contacto" className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
            Correo de contacto
          </label>
          <input id="correo-de-contacto"
            type="email"
            className={cn(inputCls, 'font-body')}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        {/* Puesto */}
        <div className="space-y-1">
          <label htmlFor="puesto" className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
            Puesto
          </label>
          <select id="puesto"
            className={cn(inputCls, 'font-body')}
            value={positionId}
            onChange={e => setPositionId(e.target.value)}
          >
            {activePositions.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.committee_name}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de contrato */}
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

        {/* Días de vacaciones (solo planilla) */}
        {contractType === 'planilla' && (
          <div className="space-y-1">
            <label htmlFor="dias-de-vacaciones-por-ano" className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
              Días de vacaciones por año
            </label>
            <input id="dias-de-vacaciones-por-ano"
              type="number"
              min="0"
              max="30"
              className={cn(inputCls, 'font-body')}
              value={vacationDays}
              onChange={e => setVacationDays(e.target.value)}
            />
          </div>
        )}

        {/* Notas */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-[13px] tracking-widest uppercase text-navy-light/80 font-display">
              Notas internas
            </label>
            <span className="text-[11px] text-navy-light/80 font-mono">
              {notes.length}/500
            </span>
          </div>
          <textarea
            className={cn(inputCls, 'resize-none font-body')}
            rows={4}
            maxLength={500}
            placeholder="Observaciones, acuerdos, notas de evaluación..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
