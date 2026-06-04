'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { ContractType } from '@/types/employee'
import { useEmployees } from '@/hooks/useEmployees'
import { Check } from 'lucide-react'

const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: 'planilla', label: 'Planilla' },
  { value: 'servicios_profesionales', label: 'Servicios profesionales' },
]

export default function EditarPuestoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { positions, loading } = useEmployees()
  const position = useMemo(() => positions.find(p => p.id === id), [positions, id])

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [area, setArea]               = useState('')
  const [contractType, setContractType] = useState<ContractType>('planilla')
  const [salaryMin, setSalaryMin]     = useState('')
  const [salaryMax, setSalaryMax]     = useState('')
  const [isActive, setIsActive]       = useState(true)
  const [saved, setSaved]             = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    if (!position) return
    setName(position.name)
    setDescription(position.description)
    setArea(position.area)
    setContractType(position.contract_type)
    setSalaryMin(String(position.salary_min ?? ''))
    setSalaryMax(String(position.salary_max ?? ''))
    setIsActive(position.is_active)
  }, [position])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/employees/positions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          contract_type: contractType,
          salary_min: salaryMin ? Number(salaryMin) : null,
          salary_max: salaryMax ? Number(salaryMax) : null,
          is_active: isActive,
        }),
      })
      if (!res.ok) throw new Error('No se pudieron guardar los cambios')
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !position) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>Cargando puesto...</p>
      </div>
    )
  }

  if (!position) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          Puesto no encontrado.
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
          <p className="text-xl font-bold text-navy" style={{ fontFamily: 'var(--font-display)' }}>
            Cambios guardados
          </p>
          <button
            onClick={() => router.push(`/empleados/puestos/${id}`)}
            className="inline-block rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Ver puesto
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="ph">
        <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/empleados/puestos/${id}`)} style={{ marginBottom: 10 }}>
          ← Volver al puesto
        </button>
        <div className="ph-row">
          <div>
            <div className="ptitle">Editar puesto</div>
            <div className="psub">{position.committee_name}</div>
          </div>
          <div className="ph-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/empleados/puestos/${id}`)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-coral" style={{ fontFamily: 'var(--font-body)', marginBottom: 8 }}>{error}</p>
      )}

      {/* Form card */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nombre del puesto</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Área</label>
              <input className="form-input" value={area} onChange={e => setArea(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-textarea" rows={3} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de contrato</label>
            <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
              {CONTRACT_TYPES.map(({ value, label }) => (
                <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="radio" className="accent-coral" checked={contractType === value} onChange={() => setContractType(value)} />
                  <span style={{ fontSize: 14, fontFamily: 'var(--font-body)', color: '#161440' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Salario mínimo (₡)</label>
              <input type="number" className="form-input" value={salaryMin} onChange={e => setSalaryMin(e.target.value)} placeholder="550000" />
            </div>
            <div className="form-group">
              <label className="form-label">Salario máximo (₡)</label>
              <input type="number" className="form-input" value={salaryMax} onChange={e => setSalaryMax(e.target.value)} placeholder="750000" />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--surface-low)' }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontFamily: 'var(--font-body)', color: '#161440' }}>Puesto activo</p>
              <p style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: 'rgba(41,54,92,0.5)', marginTop: 2 }}>Los puestos inactivos no aparecen al contratar</p>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              <div className="toggle-track" />
            </label>
          </div>

        </div>
      </div>
    </div>
  )
}
