import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  FORMULARIOS_RESERVADOS, reservaDelFormulario, bloqueoPorReserva,
} from './formularios-reservados'
import { SURVEY_FORM_TITLE } from '@/lib/studies/study-survey'
import { EVALUATION_ROLES } from '@/lib/auth/roles'

/**
 * RET-1 · Quién ve lo que un estudiante escribió sobre su dirigente.
 *
 * Medido el 2026-09-25, antes de cerrar: 25 personas podían leerlo, por DOS
 * caminos —el endpoint del grupo, abierto a todo `STUDY_ADMIN_ROLES`, y el
 * módulo de formularios, porque la encuesta es un formulario común—. Cerrar uno
 * solo no cerraba nada.
 */
describe('la encuesta de satisfacción está reservada', () => {
  it('es uno de los formularios reservados', () => {
    expect(reservaDelFormulario(SURVEY_FORM_TITLE)).toBeTruthy()
    expect(reservaDelFormulario(SURVEY_FORM_TITLE)!.roles).toEqual(EVALUATION_ROLES)
  })

  it('quien revisa evaluaciones la abre', () => {
    for (const rol of EVALUATION_ROLES) {
      expect(bloqueoPorReserva(SURVEY_FORM_TITLE, [rol]), rol).toBeNull()
    }
  })

  it('el módulo de formularios NO alcanza', () => {
    // Era el segundo camino, y el menos visible: no parece parte de estudios.
    for (const rol of ['forms', 'comunicaciones', 'encargado_staff']) {
      expect(bloqueoPorReserva(SURVEY_FORM_TITLE, [rol]), rol).toBeTruthy()
    }
  })

  it('coordinación de estudios y dirección tampoco', () => {
    // No es un olvido: `EVALUATION_ROLES` los deja fuera a propósito y lo dice
    // en su comentario. La retro de un dirigente no se hereda por jerarquía.
    for (const rol of ['coordinador_estudios', 'direccion']) {
      expect(bloqueoPorReserva(SURVEY_FORM_TITLE, [rol]), rol).toBeTruthy()
    }
  })

  it('sin roles, no', () => {
    expect(bloqueoPorReserva(SURVEY_FORM_TITLE, [])).toBeTruthy()
    expect(bloqueoPorReserva(SURVEY_FORM_TITLE, null)).toBeTruthy()
  })

  it('un formulario cualquiera no se ve afectado', () => {
    // La reserva no puede volverse un muro para el resto del módulo.
    expect(bloqueoPorReserva('Preinscripción a CDEB', ['forms'])).toBeNull()
    expect(bloqueoPorReserva(null, ['forms'])).toBeNull()
  })

  it('se identifica por TÍTULO, no por un uuid', () => {
    // El formulario lo crea un seed y su uuid cambia entre ambientes: un id
    // fijo andaría en producción y fallaría en silencio en staging, que es la
    // peor forma de fallar para una regla de acceso.
    for (const f of FORMULARIOS_RESERVADOS) {
      expect(f.titulo).not.toMatch(/^[0-9a-f]{8}-/)
    }
  })
})

describe('los CUATRO caminos a las respuestas quedaron censados', () => {
  const lee = (p: string) => readFileSync(p, 'utf8')

  it('el endpoint del grupo usa EVALUATION_ROLES, no STUDY_ADMIN_ROLES', () => {
    const s = lee('src/app/api/studies/groups/[id]/leader-feedback/route.ts')
    expect(s).toContain('EVALUATION_ROLES')
    // Solo puede quedar en el comentario que explica el cambio.
    const codigo = s.split('\n').filter(l => !/^\s*(\*|\/\/)/.test(l)).join('\n')
    expect(codigo).not.toContain('STUDY_ADMIN_ROLES')
  })

  it('la tabla de respuestas del módulo de formularios comprueba la reserva', () => {
    expect(lee('src/app/api/forms/[id]/responses/route.ts')).toContain('bloqueoPorReserva')
  })

  it('y el EXPORT también', () => {
    // Cerrar la tabla y dejar el Excel abierto es no cerrar nada. Este tenía el
    // gate idéntico y apareció censando las cuatro rutas, no las dos obvias.
    expect(lee('src/app/api/forms/[id]/responses/export/route.ts')).toContain('bloqueoPorReserva')
  })

  it('el puesto de retroalimentación otorga el rol solo', () => {
    // Al cerrar el acceso quedaban solo los admin, y quien hace este trabajo se
    // habría quedado afuera de su propia tarea.
    const s = lee('src/lib/servers/position-roles.ts')
    expect(s).toContain("role: 'evaluaciones'")
    expect(s).toContain('esComiteDirigentes(ctx.areaName)')
  })
})

/**
 * RET-1 parte 3 · Compartir manda un correo al dirigente y no se deshace.
 *
 * El botón enviaba de una, y así se le mandó una retroalimentación a Fernando
 * Gutiérrez por accidente en una reunión (2026-09-25).
 */
describe('compartir la retroalimentación pide confirmación y deja rastro', () => {
  const panel = readFileSync('src/components/studies/LeaderFeedbackPanel.tsx', 'utf8')
  const ruta = readFileSync('src/app/api/studies/groups/[id]/leader-feedback/route.ts', 'utf8')

  it('el botón ya NO envía en el onClick', () => {
    expect(panel).not.toContain("onClick={() => accion({ action: 'compartir' })}")
    expect(panel).toContain('setConfirmarEnvio(true)')
  })

  it('la confirmación dice A QUIÉN se le manda', () => {
    // «¿Estás seguro?» sin el nombre no evita el accidente: quien aprieta ya
    // cree saber a quién le está enviando.
    expect(panel).toContain('data.group?.leader_name')
  })

  it('y avisa que no se puede deshacer', () => {
    expect(panel).toContain('no se puede deshacer')
  })

  it('el servidor registra quién compartió y cuándo', () => {
    // `feedback_released_by` guarda el ESTADO ACTUAL y se pisa si alguien
    // vuelve a compartir; el envío es irreversible, así que el rastro tiene que
    // sobrevivir a la siguiente escritura.
    expect(ruta).toContain("op: 'compartir_retroalimentacion'")
    expect(ruta).toContain('actor_member_id: auth.ctx.memberId')
  })

  it('y anota si el correo salió o no', () => {
    // `sent` en cero con la retro marcada como compartida es justo el caso que
    // después nadie puede explicar.
    expect(ruta).toContain('correos_enviados: sent')
  })
})
