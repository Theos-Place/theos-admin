'use client'

// Campo de CALIFICACIÓN (escala numérica), en un solo lugar.
//
// El problema que resuelve (2026-08-08): los botones tenían ancho fijo y se
// amontonaban a la izquierda, mientras las etiquetas de las puntas se repartían
// con justify-between a lo ancho de TODO el contenedor. Resultado: el "5"
// quedaba a media pantalla y su etiqueta pegada al borde derecho, como si
// describieran cosas distintas.
//
// Ahora los números son un grid que ocupa el ancho completo y las etiquetas
// cuelgan de las columnas de las puntas, así cada una queda debajo de su número.
//
// Vive acá porque la misma escala se pinta en tres pantallas —el formulario que
// se llena, la vista previa del builder y la encuesta del dirigente— y cuando
// cada una tenía su copia, agregar el tipo 'scale' se olvidó en una y las
// preguntas desaparecieron.
import { cn } from '@/lib/utils'

export type ScaleFieldProps = {
  min?: number | null
  max?: number | null
  minLabel?: string | null
  maxLabel?: string | null
  /** Valor elegido. Se compara como número. */
  value?: string | number | null
  /** Sin onChange el campo es de solo lectura (vista previa del builder). */
  onChange?: (value: number) => void
  /** Texto para el lector de pantalla cuando el número solo no dice nada. */
  ariaLabel?: string
  size?: 'md' | 'sm'
}

export function ScaleField({
  min, max, minLabel, maxLabel, value, onChange, ariaLabel, size = 'md',
}: ScaleFieldProps) {
  const lo = min ?? 1
  const hi = max ?? 5
  if (hi <= lo) return null
  const nums = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  const elegido = value === null || value === undefined || value === '' ? null : Number(value)
  const readOnly = !onChange

  return (
    <div className="w-full space-y-1.5">
      <div
        className="grid w-full gap-1.5"
        style={{ gridTemplateColumns: `repeat(${nums.length}, minmax(0, 1fr))` }}
        role={readOnly ? undefined : 'group'}
        aria-label={readOnly ? undefined : ariaLabel}
      >
        {nums.map(n => {
          const activo = elegido === n
          const base = cn(
            'w-full rounded-xl border text-center font-semibold transition-colors font-mono',
            size === 'sm' ? 'h-8 text-[13px]' : 'h-11 text-sm',
          )
          if (readOnly) {
            return (
              <div
                key={n}
                aria-hidden
                className={cn(base, 'flex items-center justify-center border-[var(--outline-variant)] text-navy-light/70')}
              >
                {n}
              </div>
            )
          }
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              aria-pressed={activo}
              aria-label={`${n} de ${hi}`}
              className={cn(
                base,
                activo
                  ? 'border-coral bg-coral text-white'
                  : 'border-[var(--outline-variant)] text-navy-light hover:bg-surface-low',
              )}
            >
              {n}
            </button>
          )
        })}
      </div>

      {/* Ahora que los números ocupan TODO el ancho, las puntas del grid y las
          de esta fila coinciden: la etiqueta izquierda cae bajo el primer
          número y la derecha bajo el último. Cada una toma el ancho que
          necesita —"Con mucha sensibilidad" no entra en 1/5 de fila— sin
          pisarse gracias al tope del 45%. */}
      {(minLabel || maxLabel) && (
        <div className="flex w-full items-start justify-between gap-3">
          <span className="max-w-[45%] text-[12px] leading-tight text-navy-light/70 font-body">
            {minLabel}
          </span>
          <span className="max-w-[45%] text-[12px] leading-tight text-navy-light/70 font-body text-right">
            {maxLabel}
          </span>
        </div>
      )}
    </div>
  )
}
