// Ancho de página. TRES anchos para toda la app — ver
// "Theos Place Design System/layout.md". Las pantallas no vuelven a escribir
// max-w-* a mano en su contenedor raíz.
//
//   · reading (768px) → prosa: guías de /ayuda, /terminos, textos largos.
//   · form    (896px) → wizards y el detalle/edición de UN objeto.
//   · work   (1600px) → tablas, listados, dashboards, calendarios, colas.
//
// El AppShell ya aplica `work` a todo el admin, así que una pantalla de gestión
// NO necesita envolver nada: solo las de lectura y las de formulario declaran
// su ancho con este componente. Fuera del AppShell (páginas públicas) se usa
// con `padded` para que traiga también el padding.
//
// Los max-w-xs/sm/md/[400px] DENTRO de un componente (un input, una tarjeta,
// un párrafo de ayuda) no son esto y se quedan como están.
import { cn } from '@/lib/utils'

export type PageWidth = 'reading' | 'form' | 'work'

/** Único lugar donde viven los números. */
export const PAGE_WIDTH: Record<PageWidth, string> = {
  reading: 'max-w-3xl',
  form: 'max-w-4xl',
  work: 'max-w-[1600px]',
}

export function PageContainer({
  width = 'work',
  padded = false,
  className,
  children,
}: {
  width?: PageWidth
  /** Agrega el padding horizontal/vertical. Solo fuera del AppShell, que ya lo pone. */
  padded?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full min-w-0',
        PAGE_WIDTH[width],
        padded && 'px-4 py-6 sm:px-5',
        className,
      )}
    >
      {children}
    </div>
  )
}
