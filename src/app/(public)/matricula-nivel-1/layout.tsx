// EST-20 · Las páginas de este segmento son client components y no pueden
// exportar `metadata`. El título de la pestaña sale de acá, mismo patrón que
// el layout de /puestos.
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Matrícula de Nivel 1',
  description: 'Grupos de Nivel 1 con matrícula abierta en Theos Place.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
