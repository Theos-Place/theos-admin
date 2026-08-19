'use client'

import { cn } from '@/lib/utils'
import { STUDY_CATALOG, type StudyStage } from '@/data/study-catalog'

// Color por ETAPA (no por lista de códigos suelta, que dejaba estudios de etapa
// inicial fuera, en coral). La etapa sale del catálogo; para códigos que solo
// viven en la BD (charlas/planes archivados) hay un override explícito.
const STAGE_BY_CODE: Record<string, StudyStage> = Object.fromEntries(STUDY_CATALOG.map(s => [s.code, s.stage]))
const STAGE_OVERRIDE: Record<string, StudyStage> = {
  BUS: 'inicial', TEOAT: 'inicial', PLANDANIEL: 'inicial', LECTPROP: 'inicial', PAREJAS: 'inicial', QEJ: 'inicial',
  CAMP: 'campaña', PRETRANS: 'campaña', REDESC: 'campaña',
}
const STAGE_COLOR: Record<StudyStage, string> = {
  niveles:    'bg-navy/10 text-navy',
  inicial:    'bg-teal-soft/30 text-teal-deep', // etapa inicial = verde/teal
  intermedia: 'bg-coral/10 text-coral',
  avanzada:   'bg-amber-50 text-amber-700', // EST-5: solo por invitación
  campaña:    'bg-purple-100 text-purple-700',
}

interface StudyTypeBadgeProps {
  code: string
  name?: string
  size?: 'sm' | 'md'
  /** Etapa explícita (opcional). Si no se pasa, se resuelve por código. */
  stage?: StudyStage
  className?: string
}

export function StudyTypeBadge({ code, name, size = 'md', stage, className }: StudyTypeBadgeProps) {
  const resolvedStage = stage ?? STAGE_OVERRIDE[code] ?? STAGE_BY_CODE[code] ?? 'intermedia'
  const colorClass = STAGE_COLOR[resolvedStage]

  const sizeClass = size === 'sm'
    ? 'px-1.5 py-0.5 text-[11px]'
    : 'px-2 py-0.5 text-[13px]'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-semibold tracking-wide font-display',
        colorClass,
        sizeClass,
        className
      )}
    >
      {code}
      {name && (
        <span className="font-normal opacity-70">
          {name}
        </span>
      )}
    </span>
  )
}
