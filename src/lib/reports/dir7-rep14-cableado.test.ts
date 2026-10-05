import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { puedeVerReporte } from '@/lib/reports/acceso-por-reporte'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const RUTA_DIR7 = 'src/app/api/reports/exalumnos-perdidos/route.ts'
const RUTA_CONTACTO = 'src/app/api/reports/exalumnos-perdidos/contacto/route.ts'
const RUTA_REP14 = 'src/app/api/reports/recurrentes-perdidos/route.ts'
const MIGRACION = 'supabase/migrations/20261005120000_dir7_rep14_no_volvieron.sql'
const QUERIES = 'src/lib/supabase/queries/no-volvieron.ts'

describe('DIR-7 · quién entra', () => {
  it('un dirigente SIN ningún rol de reportes entra igual', () => {
    expect(puedeVerReporte('exalumnos-perdidos', {
      roles: [], tieneModulo: false, esDirigente: true,
    })).toBe(true)
  })

  it('y alguien que no es dirigente ni tiene rol, no', () => {
    expect(puedeVerReporte('exalumnos-perdidos', {
      roles: [], tieneModulo: false, esDirigente: false,
    })).toBe(false)
  })

  it('el módulo `reportes` a secas NO alcanza: la lista trae teléfonos', () => {
    expect(puedeVerReporte('exalumnos-perdidos', {
      roles: [], tieneModulo: true, esDirigente: false,
    })).toBe(false)
  })

  it('REP-14 no se abre por ser dirigente: no es de nadie en particular', () => {
    expect(puedeVerReporte('recurrentes-perdidos', {
      roles: [], tieneModulo: false, esDirigente: true,
    })).toBe(false)
    expect(puedeVerReporte('recurrentes-perdidos', {
      roles: ['direccion'], tieneModulo: false,
    })).toBe(true)
  })
})

describe('DIR-7 · el recorte por dirigente', () => {
  it('el id del dirigente sale de la SESIÓN, no del request', () => {
    // Es el corazón del reporte: si saliera del request, cualquier dirigente
    // pediría la lista de otro cambiando un parámetro.
    const src = sinComentarios(RUTA_DIR7)
    expect(src).toMatch(/const leaderId = esAmplio \? pedido : miId/)
  })

  it('el ?dirigente= de un dirigente se DESCARTA, no se valida', () => {
    // Validar que coincida invita a que mañana alguien afloje la comparación.
    // Descartarlo no tiene cómo fallar.
    const src = sinComentarios(RUTA_DIR7)
    expect(src).not.toMatch(/pedido === miId|pedido !== miId/)
  })

  it('sin dirigente elegido, el rol amplio NO recibe la lista', () => {
    // Abrir la pantalla no debe volcar 2 071 teléfonos. Mismo criterio de SRV-6.
    const src = sinComentarios(RUTA_DIR7)
    expect(src).toMatch(/if \(esAmplio && !leaderId\)/)
    expect(src).toMatch(/exalumnos: null/)
  })
})

describe('DIR-7 · registrar un contacto', () => {
  it('un dirigente solo puede marcar sobre su PROPIA lista', () => {
    // No alcanza con ser dirigente: hay que ser el dirigente DE ESA PERSONA.
    // Sin esto, cualquiera marcaría «no quiere volver» sobre el exalumno de
    // otro y la lista del otro cambiaría sola.
    const src = sinComentarios(RUTA_CONTACTO)
    expect(src).toContain('const mios = await getExalumnosPerdidos(miId)')
    expect(src).toMatch(/!mios\.some\(e => e\.member_id === body\.member_id\)/)
  })

  it('se INSERTA siempre: el historial es el punto', () => {
    // «Le escribí y no contestó» seguido de «quiere volver» es la historia
    // que importa; guardar solo lo último la borraría.
    const src = sinComentarios(QUERIES)
    expect(src).toContain("from('contact_followups').insert(")
    expect(src).not.toMatch(/from\('contact_followups'\)[\s\S]{0,80}\.update\(/)
  })

  it('los campos condicionales se guardan solo con su estado', () => {
    // Una iglesia colgando de un «no quiere volver» sería un dato que nadie
    // escribió.
    const src = sinComentarios(QUERIES)
    expect(src).toMatch(/estado === 'quiere_volver' \? \(input\.aQueVuelve \?\? null\) : null/)
    expect(src).toMatch(/estado === 'cambio_de_iglesia' \?/)
  })

  it('el cuerpo se valida con zod y los estados son un enum cerrado', () => {
    const src = sinComentarios(RUTA_CONTACTO)
    expect(src).toContain('z.enum(ESTADOS_DE_CONTACTO)')
    expect(src).toContain('.strict()')
  })
})

describe('REP-14 · el export', () => {
  it('queda registrado: salen 644 nombres con teléfono y correo', () => {
    const src = sinComentarios(RUTA_REP14)
    expect(src).toContain('logAudit')
    expect(src).toMatch(/action: 'EXPORT'/)
  })

  it('el teléfono va como TEXTO en la hoja', () => {
    // Si no, Excel se come el cero de adelante.
    expect(sinComentarios(RUTA_REP14)).toMatch(/getColumn\(2\)\.numFmt = '@'/)
  })
})

describe('DIR-7/REP-14 · la migración', () => {
  const sql = readFileSync(MIGRACION, 'utf8')

  it('las dos funciones quedan CERRADAS a la llave pública (SEC-3)', () => {
    // Una función nueva en `public` nace con EXECUTE para PUBLIC y PostgREST
    // la publica en /rest/v1/rpc/. Sin esto, cualquiera con la llave del
    // bundle pediría la lista con teléfonos, sin sesión.
    for (const f of ['report_exalumnos_perdidos', 'report_recurrentes_perdidos']) {
      expect(sql, f).toMatch(
        new RegExp(`revoke execute on function public\\.${f}\\([^)]*\\) from public, anon, authenticated`))
      expect(sql, f).toMatch(
        new RegExp(`grant\\s+execute on function public\\.${f}\\([^)]*\\) to service_role`))
    }
  })

  it('y con search_path fijo', () => {
    expect(sql.match(/set search_path to 'public'/g)?.length).toBe(2)
  })

  it('la tabla de seguimiento también está cerrada', () => {
    expect(sql).toContain('enable row level security')
    expect(sql).toMatch(/revoke all on table public\.contact_followups from anon, authenticated/)
  })

  it('el estado es un CHECK cerrado, no texto libre', () => {
    expect(sql).toMatch(/check \(estado in \(/)
  })

  it('la ventana de meses entra como PARÁMETRO, no escrita en el SQL', () => {
    // Si el número viviera también acá, habría dos verdades sobre «dejó de
    // venir» y los dos reportes podrían contradecirse.
    expect(sql).toContain('p_meses')
    expect(sql).toMatch(/make_interval\(months => p_meses\)/)
  })
})

describe('DIR-7 · el resultado del cierre', () => {
  it('traduce los estados que EXISTEN, no los que uno supondría', () => {
    // Medidos en producción el 2026-10-05. La primera versión tenía `failed`,
    // `withdrawn` y `active` —que no existen— y los 693 `enrolled` habrían
    // salido como «Sin resultado».
    const src = readFileSync('src/app/(admin)/reportes/exalumnos-perdidos/page.tsx', 'utf8')
    for (const real of [
      'completed', 'enrolled', 'en_revision', 'reprobado',
      'dropped', 'cancelada', 'transferred', 'pendiente_de_pago',
    ]) expect(src, real).toMatch(new RegExp(`^\\s*${real}: '`, 'm'))
    // Y no los inventados.
    for (const falso of ['failed:', 'withdrawn:', 'active:']) {
      expect(src, falso).not.toContain(`  ${falso}`)
    }
  })
})

describe('REP-14 · la sede se unifica como el resto de los reportes', () => {
  it('con sedeFromTitle en TS, no con un diccionario repetido en SQL', () => {
    const src = sinComentarios(QUERIES)
    expect(src).toContain("import { sedeFromTitle } from '@/lib/reports/charla-attendance'")
    expect(src).toMatch(/sedeFromTitle\(r\.sede_titulo as string\)/)
    // El SQL devuelve el título crudo a propósito.
    expect(readFileSync(MIGRACION, 'utf8')).toContain('sede_titulo')
  })
})
