'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'

const pageTitles: Record<string, string> = {
  '/dashboard':      'Dashboard',
  '/miembros':       'Miembros',
  '/eventos':        'Eventos',
  '/estudios':       'Estudios',
  '/voluntarios':    'Voluntarios y Comités',
  '/dirigentes':     'Dirigentes',
  '/empleados':      'Empleados',
  '/finanzas':       'Finanzas',
  '/comunicaciones': 'Comunicaciones',
  '/formularios':    'Formularios',
}

function getTitle(pathname: string): string {
  const match = Object.keys(pageTitles)
    .sort((a, b) => b.length - a.length)
    .find(key => pathname === key || pathname.startsWith(key + '/'))
  return match ? pageTitles[match] : 'Admin'
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const title = getTitle(pathname)

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content — offset for the fixed sidebar on desktop */}
      <div className="lg:pl-60 flex flex-col min-h-screen">
        <Topbar title={title} onMenuToggle={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
