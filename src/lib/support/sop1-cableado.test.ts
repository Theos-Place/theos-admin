/**
 * SOP-1 · Lo que no se prueba sin leer el código: que las tres puertas (API,
 * guard de módulo, sidebar) digan lo mismo, que solo la puerta levante
 * tiquetes, y que el rol de soporte abra EXACTAMENTE lo que necesita.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ROLES, hasModulePermission } from '@/lib/auth/roles'

const sin = (ruta: string) => readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
const API = 'src/app/api/support-tickets/route.ts'
const API_ID = 'src/app/api/support-tickets/[id]/route.ts'

function rutasBajo(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...rutasBajo(p))
    else if (e === 'route.ts') out.push(p)
  }
  return out
}

describe('SOP-1 · quién levanta y quién resuelve', () => {
  it('levantar pregunta por el MISMO permiso que abre el check-in', () => {
    expect(sin(API)).toContain('puedeLevantarTiquete(auth.ctx.roles)')
    expect(sin('src/lib/support/tiquete.ts')).toContain("hasModulePermission(roles as RoleId[], 'eventos', 'edit')")
    expect(sin('src/app/(admin)/eventos/checkin/page.tsx')).toContain("can('eventos', 'edit')")
  })

  it('la cola y las acciones son solo de soporte', () => {
    expect(sin(API)).toContain('requireRoles(...SOPORTE_ROLES)')
    expect(sin(API_ID)).toContain('requireRoles(...SOPORTE_ROLES)')
  })

  it('la puerta tiene el botón en la pantalla de check-in', () => {
    expect(sin('src/app/(admin)/eventos/[id]/checkin/page.tsx')).toContain('<CrearTiqueteDeSoporte eventId={id} />')
  })
})

describe('SOP-1 · el rol abre exactamente los tres módulos', () => {
  const rol = ROLES.find(r => r.id === 'soporte_tecnico')!

  it('existe y tiene soporte + miembros, nada más', () => {
    expect(rol).toBeTruthy()
    expect(rol.permissions.map(p => p.module).sort()).toEqual(['miembros', 'soporte'])
  })

  it('edita miembros (perfiles, familias, correo) y NO crea ni borra', () => {
    expect(hasModulePermission(['soporte_tecnico'], 'miembros', 'edit')).toBe(true)
    expect(hasModulePermission(['soporte_tecnico'], 'miembros', 'create')).toBe(false)
    expect(hasModulePermission(['soporte_tecnico'], 'miembros', 'delete')).toBe(false)
  })

  it('NO ve finanzas, reportes ni estudios', () => {
    for (const m of ['finanzas', 'reportes', 'estudios', 'eventos', 'servidores', 'empleados', 'accesos']) {
      expect(hasModulePermission(['soporte_tecnico'], m, 'view'), m).toBe(false)
    }
  })

  it('el censo de requireRoles: el rol aparece solo en familias y activación de cuenta', () => {
    // El fallo que esto ataja: alguien lo agrega a un handler de finanzas
    // «porque lo pidió un tiquete». Cada nombre acá es una decisión.
    const permitidos = new Set([
      'src/app/api/families/route.ts',
      'src/app/api/members/[id]/family/route.ts',
      'src/app/api/members/[id]/resend-activation/route.ts',
    ])
    // Por el literal y no por «requireRoles(...)»: en families va dentro de
    // una constante (FAMILY_EDIT_ROLES) que el guard desparrama.
    const conElRol = rutasBajo('src/app/api').filter(r => /'soporte_tecnico'/.test(sin(r)))
    expect(conElRol.sort()).toEqual([...permitidos].sort())
  })

  it('el correo de acceso lo cambia por ACCESS_EMAIL_ROLES, que la ficha y el endpoint comparten', () => {
    expect(sin('src/lib/auth/access-email.ts')).toMatch(/ACCESS_EMAIL_ROLES: RoleId\[\] = \['gestor_accesos', 'soporte_tecnico'\]/)
  })
})

describe('SOP-1 · las tres puertas de la página', () => {
  it('sidebar, guard de módulo y layout conocen /soporte', () => {
    expect(sin('src/components/layout/Sidebar.tsx')).toContain("{ href: '/soporte',        label: 'Soporte',        icon: LifeBuoy,        subs: [],                 module: 'soporte' }")
    const layout = sin('src/app/(admin)/layout.tsx')
    expect(layout).toContain("'/soporte':        'soporte'")
    expect(layout).toContain("'/soporte':        'Soporte'")
    expect(sin('src/app/(admin)/soporte/page.tsx')).toContain("can('soporte', 'view')")
  })

  it('la migración cierra las tablas (SEC-3) y abre el CHECK del rol', () => {
    const m = readFileSync('supabase/migrations/20261014200000_sop1_tiquetes_de_soporte.sql', 'utf8')
    expect(m).toContain('alter table public.support_tickets enable row level security;')
    expect(m).toContain('alter table public.support_ticket_status_history enable row level security;')
    expect(m).toContain("''soporte_tecnico''::text]))")
  })
})
