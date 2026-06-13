import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  sortKey: string
  currentSortKey: string | null
  currentSortDir: 'asc' | 'desc'
  onSort: (key: string) => void
}

export function SortableHeader({ label, sortKey, currentSortKey, currentSortDir, onSort }: Props) {
  const isActive = currentSortKey === sortKey

  return (
    <th
      onClick={() => onSort(sortKey)}
      className="cursor-pointer select-none whitespace-nowrap"
    >
      <div className="flex items-center gap-1.5 px-4 py-3.5">
        <span
          className={cn(
            'font-display text-[10px] tracking-widest uppercase transition-colors duration-120',
            isActive ? 'font-bold text-navy' : 'font-semibold text-navy-light/60'
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'flex items-center transition-colors duration-120',
            isActive ? 'text-coral' : 'text-navy-light/60'
          )}
        >
          {isActive
            ? currentSortDir === 'asc'
              ? <ArrowUp size={12} strokeWidth={2.5} />
              : <ArrowDown size={12} strokeWidth={2.5} />
            : <ArrowUpDown size={11} strokeWidth={2} />
          }
        </span>
      </div>
    </th>
  )
}
