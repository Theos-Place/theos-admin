import {
  Image as ImageIcon,
  GraduationCap,
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
  Info,
  FileText,
  User,
  type LucideIcon,
} from 'lucide-react'
import type { FieldType } from '@/data/form-config'

const ICON_MAP: Record<FieldType, LucideIcon> = {
  text:          AlignLeft,
  textarea:      AlignJustify,
  number:        Hash,
  date:          Calendar,
  select:        ChevronDown,
  radio:         Circle,
  checkbox:      CheckSquare,
  yes_no:        ToggleLeft,
  scale:         Star,
  section:       Minus,
  info:          Info,
  page_break:    FileText,
  personal_data: User,
  image: ImageIcon,
  studies_done: GraduationCap,
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
