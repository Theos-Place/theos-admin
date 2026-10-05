'use client'

import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { usePermissions } from '@/hooks/usePermissions'
import { puedeVerReporte, type SlugDeReporte } from '@/lib/reports/acceso-por-reporte'
import { BarChart2, ChevronRight, Users, TrendingUp, UserCheck, UserPlus, UserMinus, HeartHandshake, BookOpen, type LucideIcon } from 'lucide-react'

// Catálogo de reportes disponibles. Para agregar uno nuevo: sumar una entrada acá
// y crear su página en /reportes/<slug>. El índice no necesita rediseño.
type ReportTile = {
  slug: SlugDeReporte
  href: string; title: string; description: string; icon: LucideIcon; ready: boolean
}

/**
 * REP-11 · QUIÉN VE CADA TARJETA YA NO SE DECIDE ACÁ.
 *
 * Esto tenía su propia lista de roles por tarjeta, y era la tercera copia de
 * la regla —la pantalla del reporte tenía la suya y el endpoint la suya—. Las
 * tres se podían contradecir, y de hecho lo hacían: el de Dirigentes no
 * filtraba nada acá y el endpoint se conformaba con el módulo.
 *
 * Ahora la única fuente es `ACCESO_POR_REPORTE`, y esta pantalla solo
 * pregunta. El `slug` es lo que la ata a esa tabla.
 */

const REPORTS: ReportTile[] = [
  {
    slug: 'asistencia',
    href: '/reportes/asistencia',
    title: 'Crecimiento y Asistencia',
    description: 'Personas nuevas por sede y mes, y asistencia a charlas por sede/semana con comparativos por año.',
    icon: BarChart2,
    ready: true,
  },
  {
    slug: 'personas-nuevas',
    href: '/reportes/personas-nuevas',
    title: 'Personas nuevas',
    description: 'Quién llegó y por dónde entró (charla, estudio o evento), con edad, y si volvió o se matriculó después.',
    icon: UserPlus,
    ready: true,
  },
  {
    slug: 'discipulos',
    href: '/reportes/discipulos',
    title: 'Discípulos Multiplicadores',
    description: 'Personas que asisten comprometidas, sirven y donan. Traslape de criterios, tiempo a hitos y foto por cohorte.',
    icon: Users,
    ready: true,
  },
  {
    slug: 'retencion',
    href: '/reportes/retencion',
    title: 'Retención y Transición',
    description: 'Asistentes por grupo etario, retención año a año, flujo al cambiar de grupo (transición/dropout) y proyección a 2030.',
    icon: TrendingUp,
    ready: true,
  },
  {
    slug: 'estudios',
    href: '/reportes/estudios',
    title: 'Estudios',
    description: 'Grupos, estudiantes y dirigentes por tipo de estudio y por año, con cuántos finalizaron, edad y género.',
    icon: BookOpen,
    ready: true,
  },
  {
    slug: 'servidores',
    href: '/reportes/servidores',
    title: 'Servidores y compromisos',
    description: 'Cuántos servidores asisten, están en estudios y donan — global, por área o por comité, con el detalle de quién.',
    icon: HeartHandshake,
    ready: true,
  },
  {
    slug: 'exalumnos-perdidos',
    href: '/reportes/exalumnos-perdidos',
    title: 'Los que no volvieron',
    description: 'Tus exalumnos que dejaron de venir, con su teléfono listo para escribirles por WhatsApp y dónde anotar cómo te fue.',
    icon: HeartHandshake,
    ready: true,
  },
  {
    slug: 'recurrentes-perdidos',
    href: '/reportes/recurrentes-perdidos',
    title: 'Recurrentes que se fueron',
    description: 'Gente que venía seguido —20 charlas o más— y lleva seis meses sin aparecer, agrupada por el año en que dejó de ir.',
    icon: UserMinus,
    ready: true,
  },
  {
    slug: 'dirigentes',
    href: '/reportes/dirigentes',
    title: 'Dirigentes',
    description: 'Cuántos dirigentes hay y cuántos están dando estudio, capacidad por tipo de estudio y por zona, con evolución a 3 y 6 meses.',
    icon: UserCheck,
    ready: true,
  },
]

export default function ReportesIndexPage() {
  const { user } = useAuth()
  const { can } = usePermissions()
  const quien = {
    roles: user?.roles ?? [],
    tieneModulo: can('reportes', 'view'),
    porPuesto: user?.abre_reportes_por_puesto === true,
    // DIR-7 · Un dirigente ve la tarjeta de «Los que no volvieron» aunque no
    // tenga ningún rol de reportes: entra a lo suyo.
    esDirigente: user?.es_dirigente === true,
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">Reportes</h1>
        <p className="mt-1 text-sm text-navy-light/80 font-body">
          Reportes analíticos del sistema en vivo. Reemplazan los tableros externos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.filter(r => r.ready && puedeVerReporte(r.slug, quien)).map(r => {
          const Icon = r.icon
          return (
            <Link
              key={r.href}
              href={r.href}
              className="group rounded-2xl bg-surface-card p-5 shadow-[var(--shadow-md)] hover:bg-surface-low transition-colors flex flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="h-11 w-11 rounded-xl bg-coral/10 flex items-center justify-center shrink-0">
                  <Icon size={20} className="text-coral" />
                </div>
                <ChevronRight size={18} className="text-navy-light/40 group-hover:text-navy-light/80 transition-colors mt-1" />
              </div>
              <h2 className="mt-3 text-base font-bold text-navy font-display">{r.title}</h2>
              <p className="mt-1 text-[13px] text-navy-light/80 font-body leading-relaxed">{r.description}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
