// Server layout mínimo del segmento: las páginas son client components y no
// pueden exportar metadata — el título de la pestaña sale de acá (B13).
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Matrícula' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
