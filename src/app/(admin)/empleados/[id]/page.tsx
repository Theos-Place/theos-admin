'use client'

import { useMemo, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { MOCK_EMPLOYEES, type Employee, type VacationRecordType } from '@/data/mock-employees'
import { cn } from '@/lib/utils'
import {
  FileText,
  Calendar,
  History,
  Briefcase,
  User,
  DollarSign,
  Check,
} from 'lucide-react'

import { EmployeeHeader } from './_components/EmployeeHeader'
import { TabResumen } from './_components/TabResumen'
import { TabContrato } from './_components/TabContrato'
import { TabVacaciones } from './_components/TabVacaciones'
import { TabDocumentos } from './_components/TabDocumentos'
import { TabHistorial } from './_components/TabHistorial'
import { ModalAjusteSalarial } from './_components/ModalAjusteSalarial'
import { ModalDarDeBaja } from './_components/ModalDarDeBaja'
import { ModalVacaciones } from './_components/ModalVacaciones'

type Tab = 'resumen' | 'contrato' | 'vacaciones' | 'documentos' | 'historial'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'resumen',    label: 'Resumen',    icon: User      },
  { key: 'contrato',   label: 'Contrato',   icon: Briefcase },
  { key: 'vacaciones', label: 'Vacaciones', icon: Calendar  },
  { key: 'documentos', label: 'Documentos', icon: FileText  },
  { key: 'historial',  label: 'Historial',  icon: History   },
]

const VACATION_TYPE_LABELS: Record<VacationRecordType, string> = {
  vacaciones:          'Vacaciones',
  permiso_con_goce:    'Permiso con goce',
  permiso_sin_goce:    'Permiso sin goce',
  incapacidad:         'Incapacidad',
}

const STATUS_COLORS: Record<string, string> = {
  aprobado:  'bg-teal-soft/30 text-teal-deep',
  pendiente: 'bg-amber-100 text-amber-700',
  rechazado: 'bg-coral/10 text-coral',
}

function calcularDiasHabiles(desde: string, hasta: string): number {
  const start = new Date(desde + 'T00:00:00')
  const end   = new Date(hasta  + 'T00:00:00')
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export default function EmpleadoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const employee = useMemo(() => MOCK_EMPLOYEES.find(e => e.id === id), [id])

  const [tab, setTab] = useState<Tab>('resumen')

  // Salary raise modal
  const [showRaiseModal, setShowRaiseModal]         = useState(false)
  const [raiseAmount, setRaiseAmount]               = useState('')
  const [raiseReason, setRaiseReason]               = useState('')
  const [raiseDate, setRaiseDate]                   = useState('')
  const [raiseSaved, setRaiseSaved]                 = useState(false)

  // Terminate modal
  const [showTerminateModal, setShowTerminateModal] = useState(false)
  const [terminateConfirm, setTerminateConfirm]     = useState('')
  const [terminateDate, setTerminateDate]           = useState('')
  const [terminateReason, setTerminateReason]       = useState('')

  // Vacation request modal
  const [showVacModal, setShowVacModal]             = useState(false)
  const [vacType, setVacType]                       = useState<VacationRecordType>('vacaciones')
  const [vacFrom, setVacFrom]                       = useState('')
  const [vacTo, setVacTo]                           = useState('')
  const [vacNotes, setVacNotes]                     = useState('')
  const [vacSaved, setVacSaved]                     = useState(false)

  // Documents
  const [extraDocs, setExtraDocs]                   = useState<{ name: string; type: 'otro' }[]>([])
  const uploadRef = useRef<HTMLInputElement | null>(null)

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          Empleado no encontrado.
        </p>
      </div>
    )
  }

  const vacDiasDisponibles = employee.vacation_days_total - employee.vacation_days_used
  const diasHabilesModal   = vacFrom && vacTo ? calcularDiasHabiles(vacFrom, vacTo) : 0

  const allDocs = [
    ...employee.documents,
    ...extraDocs.map((d, i) => ({
      id: `extra-${i}`,
      name: d.name,
      type: 'otro' as const,
      uploaded_at: new Date().toISOString().slice(0, 10),
      url: '#',
    })),
  ]

  // Full timeline items
  const timeline = [
    ...employee.salary_history.map(s => ({
      date: s.date,
      type: 'salary' as const,
      label: `Ajuste salarial: ₡${s.previous_salary.toLocaleString('es-CR')} → ₡${s.new_salary.toLocaleString('es-CR')}`,
      sub:   s.reason,
      icon:  DollarSign,
      color: 'bg-teal-soft/30 text-teal-deep',
    })),
    ...employee.position_history.map(p => ({
      date: p.start_date,
      type: 'position' as const,
      label: `Cambio de puesto: ${p.position_name}`,
      sub:   `Hasta ${p.end_date ?? 'hoy'}`,
      icon:  Briefcase,
      color: 'bg-navy/10 text-navy-light',
    })),
    ...employee.vacation_records.map(v => ({
      date: v.start_date,
      type: 'vacation' as const,
      label: `${VACATION_TYPE_LABELS[v.type]}: ${v.days} día${v.days !== 1 ? 's' : ''}`,
      sub:   v.notes,
      icon:  Calendar,
      color: STATUS_COLORS[v.status] ?? 'bg-navy/5 text-navy-light',
    })),
    {
      date:  employee.start_date,
      type:  'start' as const,
      label: 'Inicio de relación laboral',
      sub:   employee.position_name,
      icon:  Check,
      color: 'bg-coral/10 text-coral',
    },
  ].sort((a, b) => b.date.localeCompare(a.date))

  function handleDeleteDocument(docId: string) {
    if (docId.startsWith('extra-')) {
      const extraIdx = parseInt(docId.replace('extra-', '')) - employee!.documents.length
      setExtraDocs(prev => prev.filter((_, i) => i !== extraIdx))
    }
  }

  return (
    <div className="page">

      <EmployeeHeader
        employee={employee}
        id={id}
        onTerminate={() => setShowTerminateModal(true)}
      />

      {/* Tabs */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="flex overflow-x-auto border-b" style={{ borderColor: 'var(--outline-variant)' }}>
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                  tab === t.key
                    ? 'border-coral text-coral'
                    : 'border-transparent text-navy-light/50 hover:text-navy'
                )}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <Icon size={13} />
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="p-5">
          {tab === 'resumen' && (
            <TabResumen
              employee={employee}
              vacDiasDisponibles={vacDiasDisponibles}
            />
          )}

          {tab === 'contrato' && (
            <TabContrato
              employee={employee}
              onOpenRaiseModal={() => { setShowRaiseModal(true); setRaiseSaved(false) }}
            />
          )}

          {tab === 'vacaciones' && (
            <TabVacaciones
              employee={employee}
              vacDiasDisponibles={vacDiasDisponibles}
              onOpenVacModal={() => { setShowVacModal(true); setVacSaved(false) }}
            />
          )}

          {tab === 'documentos' && (
            <TabDocumentos
              allDocs={allDocs}
              uploadRef={uploadRef}
              onFileChange={e => {
                const file = e.target.files?.[0]
                if (file) setExtraDocs(prev => [...prev, { name: file.name, type: 'otro' }])
              }}
              onDelete={handleDeleteDocument}
            />
          )}

          {tab === 'historial' && (
            <TabHistorial timeline={timeline} />
          )}
        </div>
      </div>

      {showRaiseModal && (
        <ModalAjusteSalarial
          currentSalary={employee.current_salary}
          raiseAmount={raiseAmount}
          raiseReason={raiseReason}
          raiseDate={raiseDate}
          raiseSaved={raiseSaved}
          onClose={() => setShowRaiseModal(false)}
          onRaiseAmountChange={setRaiseAmount}
          onRaiseReasonChange={setRaiseReason}
          onRaiseDateChange={setRaiseDate}
          onSave={() => setRaiseSaved(true)}
        />
      )}

      {showTerminateModal && (
        <ModalDarDeBaja
          memberName={employee.member_name}
          terminateConfirm={terminateConfirm}
          terminateDate={terminateDate}
          terminateReason={terminateReason}
          onClose={() => { setShowTerminateModal(false); setTerminateConfirm('') }}
          onTerminateConfirmChange={setTerminateConfirm}
          onTerminateDateChange={setTerminateDate}
          onTerminateReasonChange={setTerminateReason}
          onConfirm={() => { setShowTerminateModal(false); setTerminateConfirm('') }}
        />
      )}

      {showVacModal && (
        <ModalVacaciones
          vacType={vacType}
          vacFrom={vacFrom}
          vacTo={vacTo}
          vacNotes={vacNotes}
          vacSaved={vacSaved}
          diasHabilesModal={diasHabilesModal}
          onClose={() => setShowVacModal(false)}
          onVacTypeChange={setVacType}
          onVacFromChange={setVacFrom}
          onVacToChange={setVacTo}
          onVacNotesChange={setVacNotes}
          onSave={() => setVacSaved(true)}
        />
      )}
    </div>
  )
}
