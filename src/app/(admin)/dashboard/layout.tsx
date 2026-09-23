// QA-1/N4 · Layout de servidor mínimo: las páginas de este segmento son client
// components y no pueden exportar `metadata`. El título de la pestaña sale de
// acá. Mismo patrón que los layouts de módulo de B13.
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Inicio' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
