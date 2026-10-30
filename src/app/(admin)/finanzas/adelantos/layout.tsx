// QA-1/N4 · Layout de servidor mínimo: la página es client component y no
// puede exportar `metadata`. El título de la pestaña sale de acá.
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Presupuestos de sedes' }
export default function Layout({ children }: { children: React.ReactNode }) { return children }
