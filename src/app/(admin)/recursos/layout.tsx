import type { Metadata } from 'next'
// La página es client component y no puede exportar `metadata`.
export const metadata: Metadata = { title: 'Recursos' }
export default function Layout({ children }: { children: React.ReactNode }) { return children }
