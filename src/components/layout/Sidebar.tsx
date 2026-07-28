'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard,
  Users,
  Calendar,
  BookOpen,
  UsersRound,
  Briefcase,
  DollarSign,
  MessageCircle,
  FileText,
  X,
  ChevronDown,
  LayoutList,
  BookText,
  UserCheck,
  QrCode,
  ArrowLeftRight,
  Inbox,
  BarChart2,
  Plus,
  Tag,
  Bookmark,
  ClipboardList,
  Send,
  Settings,
  LogOut,
  Heart,
  CreditCard,
  GraduationCap,
  Shield,
  Wrench,
  CalendarRange,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'

type SubItem = { href: string; label: string; icon: LucideIcon; badge?: number }
type NavModule = { href: string; label: string; icon: LucideIcon; subs: SubItem[]; module: string | null; summaryLabel?: string; badge?: number }

const EVENTOS_SUB: SubItem[] = [
  { href: '/eventos/nuevo',  label: 'Crear evento',     icon: Plus },
  { href: '/eventos/tipos',  label: 'Tipos de evento',  icon: Tag  },
]

const EMPLEADOS_SUB: SubItem[] = [
  { href: '/empleados/puestos', label: 'Puestos pagados', icon: Tag },
]


const FINANZAS_SUB: SubItem[] = [
  { href: '/finanzas/donaciones',  label: 'Donaciones',   icon: Heart           },
  { href: '/finanzas/pagos',       label: 'Pagos',        icon: CreditCard      },
  { href: '/finanzas/devoluciones',label: 'Devoluciones', icon: ArrowLeftRight  },
  { href: '/finanzas/reportes',    label: 'Reportes',     icon: BarChart2       },
  { href: '/finanzas/solicitudes', label: 'Solicitudes',  icon: Inbox           },
]

const COMUNICACIONES_SUB: SubItem[] = [
  { href: '/comunicaciones/nueva',        label: 'Nueva comunicación', icon: Send     },
  { href: '/comunicaciones/plantillas',   label: 'Plantillas',         icon: FileText },
  { href: '/comunicaciones/configuracion',label: 'Configuración',      icon: Settings },
]

const SERVIDORES_SUB: SubItem[] = [
  { href: '/servidores/vacantes',     label: 'Puestos de Servicio', icon: Bookmark      },
  { href: '/servidores/aplicaciones', label: 'Solicitudes',         icon: ClipboardList },
]

// Roles que ven la página de mantenimiento (áreas/comités/puestos).
const SERVICE_ADMIN = ['encargado_staff', 'coordinador_servidores', 'direccion', 'admin']

const ESTUDIOS_SUB: SubItem[] = [
  { href: '/estudios/grupos',      label: 'Grupos',               icon: LayoutList },
  { href: '/estudios/plan',        label: 'Plan de Estudios',     icon: BookText   },
  { href: '/estudios/analisis',    label: 'Análisis de estudios', icon: BarChart2  },
  { href: '/estudios/dirigentes',  label: 'Dirigentes',           icon: UserCheck  },
  { href: '/estudios/solicitudes', label: 'Solicitudes',          icon: Inbox      },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

// Nombres bonitos desde la fuente de verdad (ROLES): el mapa manual anterior
// solo cubría 3 roles y el resto veía su slug crudo (p. ej. coordinador_estudios).
import { ROLES } from '@/lib/auth/roles'
const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.id, r.name]))

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()
  const { can, getScope } = usePermissions()

  // Conteos de solicitudes abiertas para los badges. Los endpoints exigen rol:
  // con 403 simplemente no hay badge.
  const [openRequests, setOpenRequests] = useState(0)
  const [openFinanceRequests, setOpenFinanceRequests] = useState(0)
  useEffect(() => {
    let alive = true
    fetch('/api/studies/requests?count=open')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setOpenRequests(d.count ?? 0) })
      .catch(() => {})
    fetch('/api/finance/requests?count=open')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d) setOpenFinanceRequests(d.count ?? 0) })
      .catch(() => {})
    return () => { alive = false }
  }, [pathname])

  const userName  = user?.name ?? ''
  const userRole  = user?.role ?? ''
  const userRoles = user?.roles ?? []

  // coordinador_estudios entra a accesos para gestionar solo sus permisos delegados.
  const canViewAccesos = userRoles.some(r => ['admin', 'coordinador_estudios'].includes(r))
  const canViewListas = userRoles.some(r => ['admin', 'direccion', 'comunicaciones'].includes(r))
  const canViewDuplicados = userRoles.some(r => ['admin', 'editor_perfiles'].includes(r))

  // Submenú de Miembros según rol.
  const miembrosSub: SubItem[] = [
    ...(canViewListas ? [{ href: '/miembros/listas', label: 'Listas guardadas', icon: Bookmark }] : []),
    ...(canViewDuplicados ? [{ href: '/miembros/duplicados', label: 'Duplicados', icon: Users }] : []),
  ]

  const estudiosSub: SubItem[] = [
    ...ESTUDIOS_SUB.map(s => s.href === '/estudios/solicitudes' ? { ...s, badge: openRequests } : s),
    // Bloques de capacitación: solo coordinador de estudios y admin.
    ...(userRoles.some(r => ['coordinador_estudios', 'admin'].includes(r))
      ? [{ href: '/estudios/bloques', label: 'Bloques', icon: CalendarRange }] : []),
    // Folletos: quienes tienen el permiso folletos (dentro del módulo Estudios).
    ...(can('folletos', 'view') ? [{ href: '/estudios/folletos', label: 'Folletos', icon: FileText }] : []),
  ]
  const finanzasSub: SubItem[] = [
    // Suite completa de finanzas: solo con el módulo 'finanzas' (becas/revision_pagos
    // solas NO destapan donaciones/pagos/devoluciones/reportes/solicitudes).
    ...(can('finanzas', 'view')
      ? FINANZAS_SUB.map(s => s.href === '/finanzas/solicitudes' ? { ...s, badge: openFinanceRequests } : s)
      : []),
    // Revisión de pagos: quienes tienen el permiso revision_pagos (dentro de Finanzas).
    ...(can('revision_pagos', 'view') ? [{ href: '/pagos/revision', label: 'Revisión de pagos', icon: CreditCard }] : []),
    // Becas: quienes tienen el permiso becas (dentro de Finanzas, aunque no tengan el módulo completo).
    ...(can('becas', 'view') ? [{ href: '/finanzas/becas', label: 'Becas', icon: GraduationCap }] : []),
  ]

  // Mantenimiento de áreas/comités/puestos: solo para roles de admin de servidores.
  const canServiceAdmin = userRoles.some(r => SERVICE_ADMIN.includes(r))
  const servidoresSub: SubItem[] = canServiceAdmin
    ? [...SERVIDORES_SUB, { href: '/servidores/admin', label: 'Áreas y comités', icon: Wrench }]
    : SERVIDORES_SUB

  // Formularios vive dentro de Comunicaciones (sub-ítem), no como módulo aparte.
  const comunicacionesSub: SubItem[] = can('formularios', 'view')
    ? [{ href: '/formularios', label: 'Formularios', icon: FileText }, ...COMUNICACIONES_SUB]
    : COMUNICACIONES_SUB

  // "Crear evento"/"Tipos de evento" son de gestión — ocultos si no se tiene
  // el módulo, aunque el ítem padre "Eventos" sí se muestre a todos.
  const eventosSub: SubItem[] = can('eventos', 'view') ? EVENTOS_SUB : []

  // Cada módulo se muestra solo si el rol tiene 'view' sobre él (can combina
  // múltiples roles: coordinador_estudios + comunicaciones ve comunicaciones).
  const ALL_NAV: NavModule[] = [
    { href: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard, subs: [],                 module: null },
    { href: '/miembros',       label: 'Miembros',       icon: Users,           subs: miembrosSub,        module: 'miembros', summaryLabel: 'Buscar miembros' },
    { href: '/matricula',      label: 'Matrícula',      icon: GraduationCap,   subs: [],                 module: 'estudios' },
    // Eventos es visible para cualquier autenticado: sin el permiso del módulo,
    // la propia página muestra solo la inscripción a eventos (antes vivía
    // aparte en /mis-eventos); "Crear evento"/"Tipos de evento" siguen ocultos.
    { href: '/eventos',        label: 'Eventos',        icon: Calendar,        subs: eventosSub,        module: 'eventos' },
    // PAG-1: pagos pendientes propios (y de la familia) — cualquier sesión con
    // perfil de miembro; el endpoint gatea a self/familia/staff.
    { href: '/mis-pagos',      label: 'Mis pagos',      icon: CreditCard,      subs: [],                 module: null },
    { href: '/estudios',       label: 'Estudios',       icon: BookOpen,        subs: estudiosSub,        module: 'estudios' },
    { href: '/servidores',     label: 'Servidores',     icon: UsersRound,      subs: servidoresSub,      module: 'servidores' },
    { href: '/empleados',      label: 'Empleados',      icon: Briefcase,       subs: EMPLEADOS_SUB,      module: 'empleados' },
    { href: '/finanzas',       label: 'Finanzas',       icon: DollarSign,      subs: finanzasSub,        module: 'finanzas' },
    { href: '/comunicaciones', label: 'Comunicaciones', icon: MessageCircle,   subs: comunicacionesSub,  module: 'comunicaciones' },
    { href: '/reportes',       label: 'Reportes',       icon: BarChart2,       subs: [],                 module: 'reportes' },
  ]
  // El padrón (listado de miembros) exige alcance más allá de 'own' — el rol
  // base 'miembro' ve su perfil, no el listado (espejo del guard de la API).
  // Estudios/Finanzas también se muestran si el usuario tiene un permiso que vive
  // adentro (folletos → Estudios; revision_pagos → Finanzas), aunque no tenga el módulo.
  const NAV = ALL_NAV.filter(m => {
    if (!m.module) return true
    if (m.href === '/estudios') return can('estudios', 'view') || can('folletos', 'view')
    if (m.href === '/finanzas') return can('finanzas', 'view') || can('revision_pagos', 'view') || can('becas', 'view')
    if (m.href === '/miembros') return can('miembros', 'view') && getScope('miembros') !== 'own'
    // Eventos: visible para cualquier autenticado (auto-inscripción), aunque
    // no tenga el módulo de gestión.
    if (m.href === '/eventos') return true
    return can(m.module, 'view')
  })

  // Item destacado de Check-in (encargado_eventos, dirección, admin). Para el
  // encargado_eventos puro es el ítem MÁS prominente (arriba de todo).
  const roles = user?.roles ?? []
  const canCheckin = roles.some(r => ['encargado_eventos', 'direccion', 'admin'].includes(r))
  const onlyEncargado = roles.filter(r => r !== 'miembro').length === 1 && roles.includes('encargado_eventos')
  if (canCheckin) {
    const checkinItem: NavModule = { href: '/eventos/checkin', label: 'Check-in', icon: QrCode, subs: [], module: null }
    if (onlyEncargado) NAV.unshift(checkinItem)
    else NAV.splice(1, 0, checkinItem) // tras Dashboard
  }

  // ── Acordeón exclusivo (mobile y desktop) ──
  const moduleOfPath = NAV.find(m => m.subs.length > 0 && (pathname === m.href || pathname.startsWith(m.href + '/')))?.href ?? null
  const [expandedModule, setExpandedModule] = useState<string | null>(moduleOfPath)
  // Al abrir el menú (mobile) o navegar arranca expandido el módulo de la ruta
  // actual (ajuste de estado durante render — el patrón de React, sin effects).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setExpandedModule(moduleOfPath)
  }
  const [prevPath, setPrevPath] = useState(pathname)
  if (pathname !== prevPath) {
    setPrevPath(pathname)
    setExpandedModule(moduleOfPath)
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  function SubLink({ sub, exactActive }: { sub: SubItem; exactActive?: boolean }) {
    const subActive = exactActive ?? (pathname === sub.href)
    const SubIcon = sub.icon
    return (
      <Link
        href={sub.href}
        onClick={onClose}
        className={cn(
          'group flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-all duration-150 min-h-[44px] lg:min-h-0',
          subActive ? 'bg-white/15 text-white' : 'text-white/55 hover:bg-white/10 hover:text-white',
        )}
      >
        <SubIcon
          size={14}
          strokeWidth={1.75}
          className={cn('shrink-0', subActive ? 'text-white' : 'text-white/70 group-hover:text-white')}
        />
        <span className="flex-1 font-body font-light">{sub.label}</span>
        {(sub.badge ?? 0) > 0 && (
          <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-coral px-1 text-[9px] font-bold text-white font-display">
            {sub.badge}
          </span>
        )}
      </Link>
    )
  }

  function ModuleSection({ mod }: { mod: NavModule }) {
    const Icon = mod.icon
    const moduleActive = pathname === mod.href || pathname.startsWith(mod.href + '/')
    const expanded = expandedModule === mod.href

    const headerCls = cn(
      'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-left transition-all duration-150 min-h-[44px] lg:min-h-0',
      moduleActive ? 'bg-coral text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
    )
    const headerContent = (chevronOpen: boolean) => (
      <>
        <Icon
          size={18}
          strokeWidth={1.75}
          className={cn('shrink-0 transition-colors', moduleActive ? 'text-white' : 'text-white/70 group-hover:text-white')}
        />
        <span className="flex-1 truncate font-body font-light">{mod.label}</span>
        <ChevronDown
          size={14}
          className={cn('transition-transform duration-200', chevronOpen ? 'rotate-180' : 'rotate-0', moduleActive ? 'text-white' : 'text-white/70')}
        />
      </>
    )

    // El módulo NO navega — expande/colapsa su submenú (acordeón exclusivo,
    // mismo comportamiento en mobile y desktop). El primer sub-item ("Resumen")
    // es el acceso a la página principal del módulo.
    return (
      <div>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpandedModule(prev => (prev === mod.href ? null : mod.href))}
          className={headerCls}
        >
          {headerContent(expanded)}
        </button>
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out',
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden min-h-0">
            <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-3 pb-1">
              <SubLink
                sub={{ href: mod.href, label: mod.summaryLabel ?? 'Resumen', icon: Icon }}
                exactActive={pathname === mod.href}
              />
              {mod.subs.map(sub => <SubLink key={sub.href} sub={sub} />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-navy-ink/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-full w-60 flex flex-col bg-navy transition-transform duration-300 ease-out',
          'lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/logo-theos-white.png"
              alt="Theos Place"
              width={120}
              height={32}
              className="object-contain"
              priority
            />
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden rounded-md p-1 text-white/60 hover:text-white transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-white/10" />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV.map(mod => {
            if (mod.subs.length === 0) {
              // Sin subpáginas: navega directo y cierra el menú (igual en mobile).
              const active = pathname === mod.href || pathname.startsWith(mod.href + '/')
              const Icon = mod.icon
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 min-h-[44px] lg:min-h-0',
                    active ? 'bg-coral text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.75}
                    className={cn('shrink-0 transition-colors', active ? 'text-white' : 'text-white/70 group-hover:text-white')}
                  />
                  <span className="flex-1 truncate font-body font-light">{mod.label}</span>
                  {(mod.badge ?? 0) > 0 && (
                    <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-coral px-1 text-[9px] font-bold text-white font-display">
                      {mod.badge}
                    </span>
                  )}
                </Link>
              )
            }
            return <ModuleSection key={mod.href} mod={mod} />
          })}
        </nav>

        {/* Accesos — solo admin/direccion */}
        {canViewAccesos && (
          <div className="px-3 pb-2">
            <div className="h-px bg-white/10 mb-2" />
            <Link
              href="/accesos"
              onClick={onClose}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 min-h-[44px] lg:min-h-0',
                pathname === '/accesos' || pathname.startsWith('/accesos/')
                  ? 'bg-coral text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Shield
                size={18}
                strokeWidth={1.75}
                className={cn(
                  'shrink-0 transition-colors',
                  pathname === '/accesos' || pathname.startsWith('/accesos/')
                    ? 'text-white'
                    : 'text-white/70 group-hover:text-white'
                )}
              />
              <span className="font-body font-light">Accesos</span>
            </Link>
          </div>
        )}

        {/* Footer — usuario + logout */}
        <div className="px-4 py-4 border-t border-white/10">
          {userName && (
            <div className="flex items-center gap-3 px-2 py-2 mb-2">
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white bg-[rgba(255,255,255,0.15)] font-display"
              >
                {userName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white truncate font-body font-normal">
                  {userName}
                </p>
                <p className="text-[11px] text-white/70 truncate font-body">
                  {ROLE_LABELS[userRole] ?? userRole}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-white/70 hover:bg-white/10 hover:text-white transition-all font-body"
          >
            <LogOut size={14} className="shrink-0" />
            Cerrar sesión
          </button>
          <Link
            href="/terminos"
            className="mt-1 block px-3 py-1 text-[12px] text-white/70 hover:text-white transition-colors font-body"
          >
            Términos y Condiciones
          </Link>
        </div>
      </aside>
    </>
  )
}
