import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InfoDelEncabezado } from '@/components/shared/InfoDelEncabezado'

type Props = {
  label: string
  sortKey: string
  currentSortKey: string | null
  currentSortDir: 'asc' | 'desc'
  onSort: (key: string) => void
  /** Qué significa la columna. Solo cuando el título no alcanza: dos columnas
   *  pueden llamarse igual y venir de datos distintos. */
  info?: string
}

export function SortableHeader({ label, sortKey, currentSortKey, currentSortDir, onSort, info }: Props) {
  const isActive = currentSortKey === sortKey

  return (
    <th
      onClick={() => onSort(sortKey)}
      className="cursor-pointer select-none whitespace-nowrap"
    >
      <div className="flex items-center gap-1.5 px-4 py-3.5">
        <span
          className={cn(
            'font-display text-[11px] tracking-widest uppercase transition-colors duration-120',
            isActive ? 'font-bold text-navy' : 'font-semibold text-navy-light/80'
          )}
        >
          {label}
        </span>
        {/* El ícono NO ordena: leer la explicación y reordenar la tabla son dos
            intenciones distintas, y el `th` entero es el que ordena. */}
        {info && (
          <span onClick={e => e.stopPropagation()} className="cursor-default">
            <InfoDelEncabezado texto={info} />
          </span>
        )}
        <span
          className={cn(
            'flex items-center transition-colors duration-120',
            isActive ? 'text-coral' : 'text-navy-light/80'
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
