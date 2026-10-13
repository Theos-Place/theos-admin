'use client'

/**
 * LINT-1 · Volcar datos cargados a un formulario, sin `useEffect`.
 *
 * Reemplaza el patrón:
 *
 *     useEffect(() => {
 *       if (yaCargue || cargando) return
 *       setNombre(x.nombre); setCategoria(x.categoria); …
 *       setYaCargue(true)
 *     }, [cargando, x, yaCargue])
 *
 * por:
 *
 *     usePrecarga(x?.id, () => { setNombre(x!.nombre); setCategoria(x!.categoria) })
 *
 * POR QUÉ NO ES SOLO APAGAR UN AVISO. El efecto corre DESPUÉS de pintar, así
 * que el formulario aparece un instante vacío y salta a sus valores; con
 * conexión lenta se ve. Ajustar durante el render —lo que React documenta
 * como «adjusting state when props change»— re-renderiza ANTES de pintar: no
 * hay parpadeo y no hay efecto que mantener sincronizado.
 *
 * La decisión vive en `lib/hooks/precarga-una-vez`, con tests.
 *
 * CUÁNDO NO USARLO: si lo que hay que hacer al llegar el dato no es llenar
 * estado —pedir otra cosa, enfocar un input, medir el DOM— eso SÍ es un
 * efecto y debe seguir siéndolo.
 */
import { useState } from 'react'
import { hayQueVolcar } from '@/lib/hooks/precarga-una-vez'

export function usePrecarga(clave: string | null | undefined, volcar: () => void): void {
  const [yaVolcado, setYaVolcado] = useState<string | null>(null)
  if (hayQueVolcar(clave, yaVolcado)) {
    // Los dos durante el render, a propósito: React procesa esta tanda y
    // vuelve a renderizar antes de pintar. `setYaVolcado` primero para que,
    // si `volcar` reventara, no quede en bucle infinito.
    setYaVolcado(clave as string)
    volcar()
  }
}
