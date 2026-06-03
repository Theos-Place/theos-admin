'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { mockMembers, type Member } from '@/data/mock-members'
import { MOCK_PAID_POSITIONS, MOCK_EMPLOYEES, type ContractType } from '@/data/mock-employees'
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

const alreadyHiredIds = new Set(
  MOCK_EMPLOYEES.filter(e => e.status === 'active').map(e => e.member_id)
)

export default function NuevoEmpleadoPage() {
  const router = useRouter()

  const [step, setStep]                 = useState(1)
  const [query, setQuery]               = useState('')
  const [selected, setSelected]         = useState<Member | null>(null)

  const [positionId, setPositionId]     = useState('')
  const [contractType, setContractType] = useState<ContractType>('planilla')
  const [salary, setSalary]             = useState('')
  const [startDate, setStartDate]       = useState('')
  const [notes, setNotes]               = useState('')

  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({})
  const [done, setDone]                 = useState(false)

  const activePositions = useMemo(
    () => MOCK_PAID_POSITIONS.filter(p => p.is_active),
    []
  )

  const selectedPosition = useMemo(
    () => activePositions.find(p => p.id === positionId) ?? null,
    [positionId, activePositions]
  )

  const salaryNum = parseFloat(salary) || 0
  const salaryOutOfRange =
    selectedPosition !== null &&
    salaryNum > 0 &&
    (salaryNum < selectedPosition.salary_min || salaryNum > selectedPosition.salary_max)

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return mockMembers
      .filter(m => m.is_active && !alreadyHiredIds.has(m.id))
      .filter(
        m =>
          `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
          (m.email?.toLowerCase().includes(q) ?? false) ||
          (m.cedula ?? '').includes(q)
      )
      .slice(0, 8)
  }, [query])

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

  if (done) {
    return <SuccessScreen selected={selected} />
  }

  const canAdvanceCurrent = step === 1 ? canAdvanceStep1() : step === 2 ? canAdvanceStep2() : canFinish()

  return (
    <div className="max-w-2xl space-y-4">
      <TopBar
        step={step}
        totalSteps={STEPS.length}
        canAdvance={canAdvanceCurrent}
        onNext={() => setStep(s => s + 1)}
        onFinish={() => setDone(true)}
      />

      <StepProgress steps={STEPS} currentStep={step} />

      {step === 1 && (
        <StepPersonSearch
          query={query}
          onQueryChange={setQuery}
          searchResults={searchResults}
          selected={selected}
          onSelect={m => { setSelected(m); setQuery('') }}
          onClear={() => { setSelected(null); setQuery('') }}
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
          className="flex items-center gap-1.5 text-sm text-navy-light/50 hover:text-navy transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <ChevronLeft size={15} />
          Volver al paso anterior
        </button>
      )}
    </div>
  )
}
