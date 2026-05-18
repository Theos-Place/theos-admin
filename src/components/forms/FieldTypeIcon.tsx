import {
  AlignLeft,
  AlignJustify,
  Hash,
  Calendar,
  ChevronDown,
  Circle,
  CheckSquare,
  ToggleLeft,
  Star,
  Minus,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import type { FieldType } from '@/data/mock-forms'

const ICON_MAP: Record<FieldType, LucideIcon> = {
  text:       AlignLeft,
  textarea:   AlignJustify,
  number:     Hash,
  date:       Calendar,
  select:     ChevronDown,
  radio:      Circle,
  checkbox:   CheckSquare,
  yes_no:     ToggleLeft,
  scale:      Star,
  section:    Minus,
  page_break: FileText,
}

interface FieldTypeIconProps {
  type: FieldType
  size?: number
  className?: string
}

export function FieldTypeIcon({ type, size = 14, className }: FieldTypeIconProps) {
  const Icon = ICON_MAP[type]
  return <Icon size={size} className={className} />
}
