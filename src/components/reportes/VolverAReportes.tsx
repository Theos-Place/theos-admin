import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

/**
 * El "← Reportes" de arriba de cada reporte.
 *
 * Existe como componente porque estaba copiado en cuatro pantallas y faltaba en
 * las dos nuevas: sin él, la única salida de un reporte es el botón de atrás del
 * navegador o volver por el menú, que en un reporte al que se entró desde el
 * índice es un rodeo.
 */
export function VolverAReportes() {
  return (
    <Link
      href="/reportes"
      className="inline-flex items-center gap-1 text-[13px] text-navy-light/80 hover:text-navy transition-colors font-body"
    >
      <ChevronLeft size={15} aria-hidden /> Reportes
    </Link>
  )
}
