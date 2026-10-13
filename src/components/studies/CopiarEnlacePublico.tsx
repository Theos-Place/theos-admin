'use client'

/**
 * EST-20 · El botón para compartir la página pública de Nivel 1.
 *
 * Existe para que el enlace no haya que recordarlo ni escribirlo a mano: se
 * copia y se pega en redes o en WhatsApp.
 *
 * SOLO admin y coordinación de estudios. No es un dato secreto —la página es
 * pública— pero sí una decisión de comunicación: quién difunde la matrícula
 * y cuándo. Que el botón aparezca en la pantalla de todos invita a que cada
 * quien lo mande por su lado.
 */
import { useState } from 'react'
import { Link2, Check } from 'lucide-react'
import { Button } from '@/components/shared/Button'

export const RUTA_PUBLICA = '/matricula-nivel-1'

export function CopiarEnlacePublico() {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    // `window.location.origin` y no una variable de entorno: así el enlace
    // que se copia es el del sitio donde se está mirando, y en staging no
    // sale uno de producción.
    const url = `${window.location.origin}${RUTA_PUBLICA}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de portapapeles —pasa en algunos navegadores sin HTTPS—
      // se muestra el enlace para copiarlo a mano en vez de no hacer nada.
      window.prompt('Copiá el enlace:', url)
    }
  }

  return (
    <Button
      onClick={copiar}
      variante="fantasma"
      tamano="sm"
      // Va sobre el encabezado de color, donde el fantasma normal no se ve.
      className="bg-white/15 text-white hover:bg-white/25 gap-1.5"
      title="Copia el enlace de la página pública de matrícula de Nivel 1, para compartirlo"
    >
      {copiado
        ? <><Check size={14} aria-hidden="true" /> Enlace copiado</>
        : <><Link2 size={14} aria-hidden="true" /> Copiar enlace público</>}
    </Button>
  )
}
