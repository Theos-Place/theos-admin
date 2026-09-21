import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { EVENT_CHECKIN_ROLES } from '@/lib/auth/roles'
import {
  CAMPOS_ALTA_CHECKIN, CAMPOS_CORRECCION_CHECKIN,
} from '@/lib/members/alta-desde-checkin'

/**
 * Los endpoints acotados del check-in tienen que seguir siendo acotados. Estos
 * tests leen el archivo y fijan las tres propiedades que importan: quién entra,
 * qué campos pasan, y que el padrón general NO se le abrió al rol.
 *
 * Se lee el fuente en vez de invocar el handler porque el handler exige sesión
 * de Supabase; lo que se quiere blindar acá es la DECLARACIÓN del permiso, que
 * es justo lo que alguien podría aflojar sin darse cuenta.
 */
const ALTA = readFileSync('src/app/api/events/[id]/members/route.ts', 'utf8')
const CORRECCION = readFileSync('src/app/api/events/[id]/members/[memberId]/route.ts', 'utf8')
const PADRON = readFileSync('src/app/api/members/route.ts', 'utf8')
const PERFIL = readFileSync('src/app/api/members/[id]/route.ts', 'utf8')

describe('alta desde el check-in', () => {
  it('está gateada POR EVENTO (EVE-12), no por rol suelto', () => {
    // Hasta el 2026-09-17 era requireRoles(...EVENT_CHECKIN_ROLES): el rol
    // bastaba y abría CUALQUIER evento. Ahora el guard mira si el evento es de
    // un comité de la persona. Si alguien lo devuelve a requireRoles, esto cae.
    expect(ALTA).toContain('requireEventAccess(eventId')
    expect(ALTA).not.toContain('requireRoles(')
    // CHK-4: y como es PUERTA, el alcance cuenta también el comité del
    // subevento. Sin `puerta`, la bienvenida de Youth no puede dar de alta a
    // alguien en la charla de la sede donde está su estación.
    expect(ALTA).toContain('{ puerta: true }')
  })

  it('construye el payload SOLO con la lista de campos permitidos', () => {
    expect(ALTA).toContain('CAMPOS_ALTA_CHECKIN')
    expect(ALTA).toContain('camposRechazados')
  })

  it('responde 409 con la ficha existente, para poder usarla en vez de duplicar', () => {
    expect(ALTA).toContain("code: 'duplicate'")
    expect(ALTA).toContain('findMemberByCedulaOrEmail')
  })

  it('no exige documento: el alta pasa sin cédula', () => {
    // Si alguien vuelve a poner .min(1) sobre cedula, la fila se traba de nuevo.
    expect(ALTA).toMatch(/cedula:\s*z\.string\(\)\.trim\(\)\.nullish\(\)/)
  })
})

describe('corrección desde el check-in', () => {
  it('está gateada POR EVENTO (EVE-12), no por rol suelto', () => {
    expect(CORRECCION).toContain('requireEventAccess(eventId')
    expect(CORRECCION).not.toContain('requireRoles(')
    expect(CORRECCION).toContain('{ puerta: true }')
  })

  it('solo documento y teléfono', () => {
    expect(CORRECCION).toContain('CAMPOS_CORRECCION_CHECKIN')
    expect([...CAMPOS_CORRECCION_CHECKIN]).not.toContain('email')
  })

  it('dedupea antes de guardar', () => {
    expect(CORRECCION).toContain("code: 'duplicate'")
  })
})

describe('el padrón general NO se abrió', () => {
  it('el POST de /api/members sigue exigiendo roles de padrón, sin encargado_eventos', () => {
    const linea = PADRON.split('\n').find(l => l.includes("requireRoles('editor_perfiles'"))
    expect(linea).toBeTruthy()
    expect(linea).not.toContain('encargado_eventos')
    expect(linea).not.toContain('EVENT_CHECKIN_ROLES')
  })

  it('el GET del padrón sigue exigiendo el módulo miembros con alcance total', () => {
    expect(PADRON).toContain("requireModuleView('miembros', { beyondOwn: true })")
    expect(PADRON).toContain("moduleScope(auth.ctx.roles, 'miembros') !== 'all'")
  })

  it('el PATCH del perfil completo sigue sin encargado_eventos', () => {
    const linea = PERFIL.split('\n').find(l => l.includes('const STAFF_ROLES'))
    expect(linea).toBeTruthy()
    expect(linea).not.toContain('encargado_eventos')
  })

  it('los roles de check-in son los tres esperados y nada más', () => {
    expect([...EVENT_CHECKIN_ROLES].sort()).toEqual(['admin', 'direccion', 'encargado_eventos'])
  })

  it('el alta acotada no puede tocar campos de gestión', () => {
    for (const p of ['is_active', 'is_donor', 'is_system']) {
      expect(CAMPOS_ALTA_CHECKIN as readonly string[]).not.toContain(p)
    }
  })
})

/**
 * Guardia de regresión. El bug de hoy no fue uno: fueron CINCO llamadas de la
 * misma pantalla a endpoints del padrón —QR, alta, corrección, familia y
 * búsqueda de familiar—, descubiertas de a una según la gente las iba pisando.
 * Peor: varias se tragan el error con `{ members: [] }` o un catch vacío, así
 * que fallan calladas y parecen "no hay nadie" en vez de "no tenés permiso".
 *
 * Este test recorre el flujo de check-in y exige que todo lo que llame vaya a
 * /api/events/... o al lookup mínimo. Si alguien vuelve a pegarle al padrón
 * desde acá, se cae en CI y no en la fila de un miércoles.
 */
describe('el flujo de check-in nunca llama al padrón', () => {
  const ARCHIVOS = [
    'src/app/(admin)/eventos/[id]/checkin/page.tsx',
    'src/components/members/DocumentCapture.tsx',
    'src/components/members/FamilyMemberModal.tsx',
  ]

  // /api/members/[id]/family es la excepción legítima: desde 2026-08-04 ese
  // endpoint contempla explícitamente a quien registra asistencia (eventos:edit),
  // así que sí responde al rol de check-in. Verificado, no supuesto.
  const EXCEPCIONES = ['/api/members/${member.id}/family']

  it('todas las llamadas van a /api/events/... o a /api/members/lookup', () => {
    const ofensores: string[] = []
    for (const archivo of ARCHIVOS) {
      const texto = readFileSync(archivo, 'utf8')
      for (const linea of texto.split('\n')) {
        const m = linea.match(/fetch\(`?([^`,)]*)/)
        if (!m) continue
        const url = m[1]
        if (!url.startsWith('/api')) continue // fetch(url) con variable: se revisa aparte
        const permitida = url.startsWith('/api/events/')
          || url.startsWith('/api/members/lookup')
          || EXCEPCIONES.includes(url)
        if (!permitida) ofensores.push(`${archivo}: ${url}`)
      }
    }
    expect(ofensores).toEqual([])
  })

  it('DocumentCapture arma la URL del evento cuando está en un check-in', () => {
    // Es el único que usa fetch(url) con variable, así que se verifica su origen.
    const texto = readFileSync('src/components/members/DocumentCapture.tsx', 'utf8')
    expect(texto).toContain('`/api/events/${eventId}/members/${memberId}`')
  })

  it('la pantalla de check-in le pasa el evento a DocumentCapture', () => {
    const texto = readFileSync('src/app/(admin)/eventos/[id]/checkin/page.tsx', 'utf8')
    expect(texto).toContain('eventId={id}')
  })

  it('las familias del check-in van por el endpoint del evento', () => {
    const ruta = readFileSync('src/app/api/events/[id]/families/route.ts', 'utf8')
    expect(ruta).toContain('requireEventAccess(eventId')
    expect(ruta).not.toContain('requireRoles(')
    expect(ruta).toContain('{ puerta: true }')
    // Agrupa fichas existentes; no puede crear ni modificar personas.
    expect(ruta).not.toContain('createMember')
    expect(ruta).not.toContain('updateMember')
  })
})

/**
 * EVE-12 · Ningún endpoint de UN evento puede autorizar con el rol a secas.
 *
 * El inventario de la etapa 1 encontró seis que lo hacían —checkins, families,
 * members, members/[memberId], onsite-charge y server-check— y por eso quien
 * hace el check-in de su sede podía borrar asistencias de otra. Este test
 * recorre el directorio en vez de listarlos: una ruta NUEVA bajo [id] que use
 * requireRoles se cae acá sola.
 */
describe('los endpoints de UN evento autorizan por evento', () => {
  const DIR = 'src/app/api/events/[id]'

  /** Rutas que a propósito NO usan el guard por evento, con su razón. */
  const EXENTAS: Record<string, string> = {
    'route.ts': 'GET público del detalle, PATCH de cancelación (solo dirección) y DELETE: no son operación del evento',
    'managers/route.ts': 'nombrar encargados es de quien ADMINISTRA eventos; el encargado recibe el permiso, no lo reparte',
    'register/route.ts': 'inscripción propia: solo exige sesión',
    'duplicate/route.ts': 'crear un evento nuevo, no operar este',
  }

  const rutas = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? rutas(`${dir}/${e.name}`) : e.name === 'route.ts' ? [`${dir}/${e.name}`] : [])

  it('ninguna ruta nueva se cuela con requireRoles', () => {
    const ofensoras: string[] = []
    for (const ruta of rutas(DIR)) {
      const rel = ruta.slice(DIR.length + 1)
      if (EXENTAS[rel]) continue
      if (readFileSync(ruta, 'utf8').includes('requireRoles(')) ofensoras.push(rel)
    }
    expect(ofensoras).toEqual([])
  })

  it('las seis que se migraron usan requireEventAccess', () => {
    for (const rel of ['checkins/route.ts', 'families/route.ts', 'members/route.ts',
      'members/[memberId]/route.ts', 'onsite-charge/route.ts', 'server-check/route.ts']) {
      expect(readFileSync(`${DIR}/${rel}`, 'utf8'), rel).toContain('requireEventAccess(')
    }
  })
})

/**
 * CHK-4 (2026-09-21) · Las rutas de PUERTA miden el alcance sobre la familia
 * del evento (evento + subeventos); las demás, solo sobre los comités del
 * evento.
 *
 * El default de `requireEventAccess` es el ANGOSTO a propósito: olvidarse de
 * `puerta` deja a alguien sin poder marcar —se reporta en el momento, como pasó
 * con la bienvenida de Youth— mientras que un default ancho abriría la edición
 * del evento de otra sede en silencio. Esta lista es el candado.
 */
describe('CHK-4 · qué rutas son de puerta', () => {
  const DE_PUERTA = [
    'events/[id]/checkins/route.ts',
    'events/[id]/families/route.ts',
    'events/[id]/server-check/route.ts',
    'events/[id]/members/route.ts',
    'events/[id]/members/[memberId]/route.ts',
    'events/[id]/onsite-charge/route.ts',
  ]
  /** Operar la puerta no es editar el evento ni llevarse su reporte. */
  const NO_SON_DE_PUERTA = [
    'events/[id]/route.ts',
    'events/[id]/attendees/export/route.ts',
    'events/[id]/registrations/route.ts',
    'events/[id]/volunteers/route.ts',
  ]

  for (const rel of DE_PUERTA) {
    it(`${rel} pasa { puerta: true }`, () => {
      expect(readFileSync(`src/app/api/${rel}`, 'utf8'), rel).toContain('{ puerta: true }')
    })
  }

  for (const rel of NO_SON_DE_PUERTA) {
    it(`${rel} NO lo pasa`, () => {
      expect(readFileSync(`src/app/api/${rel}`, 'utf8'), rel).not.toContain('{ puerta: true }')
    })
  }
})
