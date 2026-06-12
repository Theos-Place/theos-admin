'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { type MemberHit } from '@/components/shared/MemberCombobox'
import { type ContractType } from '@/types/employee'
import { useEmployees } from '@/hooks/useEmployees'
import { useToast } from '@/components/shared/Toast'
import { ChevronLeft } from 'lucide-react'

import { TopBar } from './_components/TopBar'
import { StepProgress } from './_components/StepProgress'
import { StepPersonSearch } from './_components/StepPersonSearch'
import { StepContractForm } from './_components/StepContractForm'
import { StepDocuments } from './_components/StepDocuments'
import { SuccessScreen } from './_components/SuccessScreen'

const STEPS = [
  { num: 1, label: 'Seleccionar persona' },
  { num: 2, label: 'Definir contrato' },
  { num: 3, label: 'Confirmar y documentos' },
]

type DocKey = 'contrato' | 'cedula' | 'ccss'
const REQUIRED_DOCS: { key: DocKey }[] = [
  { key: 'contrato' },
  { key: 'cedula' },
  { key: 'ccss' },
]

export default function NuevoEmpleadoPage() {
  const router = useRouter()
  const { employees, positions } = useEmployees()
  const toast = useToast()

  const [step, setStep]                 = useState(1)
  const [selected, setSelected]         = useState<MemberHit | null>(null)

  const [positionId, setPositionId]     = useState('')
  const [contractType, setContractType] = useState<ContractType>('planilla')
  const [salary, setSalary]             = useState('')
  const [startDate, setStartDate]       = useState('')
  const [notes, setNotes]               = useState('')

  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({})
  const [done, setDone]                 = useState(false)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const alreadyHiredIds = useMemo(
    () => employees.filter(e => e.status === 'active').map(e => e.member_id),
    [employees]
  )

  const activePositions = useMemo(
    () => positions.filter(p => p.is_active),
    [positions]
  )

  const selectedPosition = useMemo(
    () => activePositions.find(p => p.id === positionId) ?? null,
    [positionId, activePositions]
  )

  const salaryNum = parseFloat(salary) || 0
  // Sin montos (rangos restringidos a rol finanzas) no se puede validar el rango.
  const salaryOutOfRange =
    selectedPosition !== null &&
    selectedPosition.salary_min != null && selectedPosition.salary_max != null &&
    salaryNum > 0 &&
    (salaryNum < selectedPosition.salary_min || salaryNum > selectedPosition.salary_max)

  function canAdvanceStep1() { return selected !== null }
  function canAdvanceStep2() { return positionId !== '' && salary !== '' && startDate !== '' }
  function canFinish() {
    return REQUIRED_DOCS.every(d => uploadedDocs[d.key])
  }

  function handleSelectPosition(id: string) {
    setPositionId(id)
    const pos = activePositions.find(p => p.id === id)
    if (pos) setContractType(pos.contract_type)
  }

  function simulateUpload(key: string, fileName: string) {
    setUploadedDocs(prev => ({ ...prev, [key]: fileName }))
  }

  function removeDoc(key: string) {
    setUploadedDocs(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function handleFinish() {
    if (saving || !selected) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: selected.id,
          position_id: positionId || null,
          position: selectedPosition?.name ?? null,
          contract_type: contractType,
          salary: salary ? Number(salary) : null,
          start_date: startDate,
          notes: notes.trim() || null,
          status: 'active',
        }),
      })
      if (!res.ok) throw new Error('No se pudo crear el empleado')
      toast('Empleado creado', 'success')
      setDone(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return <SuccessScreen selected={selected} />
  }

  const canAdvanceCurrent = step === 1 ? canAdvanceStep1() : step === 2 ? canAdvanceStep2() : canFinish()

  // Qué falta para avanzar (misma condición que deshabilita "Siguiente").
  const missingForStep: string[] = step === 1
    ? (selected ? [] : ['seleccionar una persona'])
    : step === 2
      ? [
          positionId === '' && 'el puesto',
          salary === '' && 'el salario',
          startDate === '' && 'la fecha de inicio',
        ].filter((x): x is string => Boolean(x))
      : REQUIRED_DOCS.filter(d => !uploadedDocs[d.key]).length > 0
        ? [`subir los documentos pendientes (${REQUIRED_DOCS.filter(d => !uploadedDocs[d.key]).map(d => ({ contrato: 'contrato', cedula: 'cédula', ccss: 'CCSS' }[d.key])).join(', ')})`]
        : []

  return (
    <div className="max-w-2xl space-y-4">
      <TopBar
        step={step}
        totalSteps={STEPS.length}
        canAdvance={canAdvanceCurrent && !saving}
        onNext={() => setStep(s => s + 1)}
        onFinish={handleFinish}
      />

      <StepProgress steps={STEPS} currentStep={step} />

      {!canAdvanceCurrent && missingForStep.length > 0 && (
        <p className="text-[12px] text-navy-light/70 font-body" role="status">
          Para continuar, falta {missingForStep.join(', ')}.
        </p>
      )}

      {error && (
        <p className="text-sm text-coral font-body">{error}</p>
      )}

      {step === 1 && (
        <StepPersonSearch
          excludeIds={alreadyHiredIds}
          selected={selected}
          onSelect={setSelected}
          onClear={() => setSelected(null)}
        />
      )}

      {step === 2 && (
        <StepContractForm
          activePositions={activePositions}
          positionId={positionId}
          onPositionChange={handleSelectPosition}
          selectedPosition={selectedPosition}
          contractType={contractType}
          onContractTypeChange={setContractType}
          salary={salary}
          onSalaryChange={setSalary}
          salaryOutOfRange={salaryOutOfRange}
          startDate={startDate}
          onStartDateChange={setStartDate}
          notes={notes}
          onNotesChange={setNotes}
        />
      )}

      {step === 3 && (
        <StepDocuments
          selected={selected}
          selectedPosition={selectedPosition}
          contractType={contractType}
          salary={salary}
          startDate={startDate}
          salaryOutOfRange={salaryOutOfRange}
          uploadedDocs={uploadedDocs}
          onUpload={simulateUpload}
          onRemoveDoc={removeDoc}
          canFinish={canFinish()}
        />
      )}

      {step > 1 && (
        <button
          type="button"
          onClick={() => setStep(s => s - 1)}
          className="flex items-center gap-1.5 text-sm text-navy-light/50 hover:text-navy transition-colors font-body"
        >
          <ChevronLeft size={15} />
          Volver al paso anterior
        </button>
      )}
    </div>
  )
}
