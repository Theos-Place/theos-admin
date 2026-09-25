import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  PREGUNTAS, IGLESIA_EVANGELICA, QUIERE_SEGUIR_EN_SU_IGLESIA,
  OPCIONES_ASISTE_A_IGLESIA, OPCIONES_QUE_TE_MOTIVA,
  debeExplorarOtrasOpciones, faltaResponder, veredicto, camposDelCuestionario,
  type RespuestasDelCuestionario, type IdsDelCuestionario,
} from './cuestionario-de-matricula'
import { campoVisible } from '@/lib/forms/logica-condicional'

const r = (o: Partial<Record<string, string>> = {}): RespuestasDelCuestionario => ({
  [PREGUNTAS.comoEscuchaste]: 'Amigos',
  ...o,
})

describe('EST-15 · a quién se le ofrece el estudio', () => {
  it('evangélico que quiere seguir en su iglesia → exploramos otras opciones', () => {
    const resp = r({
      [PREGUNTAS.asisteAIglesia]: IGLESIA_EVANGELICA,
      [PREGUNTAS.queTeMotiva]: QUIERE_SEGUIR_EN_SU_IGLESIA,
    })
    expect(debeExplorarOtrasOpciones(resp)).toBe(true)
    expect(veredicto(resp).estado).toBe('otras_opciones')
  })

  it('evangélico que está considerando unirse a Theos → SÍ se matricula', () => {
    // El caso que la lectura con «o» habría roto: le saldría el mensaje de
    // despedida a quien justamente se está acercando.
    const resp = r({
      [PREGUNTAS.asisteAIglesia]: IGLESIA_EVANGELICA,
      [PREGUNTAS.queTeMotiva]: 'Estoy considerando unirme a Theos',
    })
    expect(debeExplorarOtrasOpciones(resp)).toBe(false)
    expect(veredicto(resp).estado).toBe('puede_matricular')
  })

  it('evangélico cuya iglesia no da discipulado → SÍ se matricula', () => {
    expect(veredicto(r({
      [PREGUNTAS.asisteAIglesia]: IGLESIA_EVANGELICA,
      [PREGUNTAS.queTeMotiva]: 'Mi iglesia no da ningún curso de Discipulado',
    })).estado).toBe('puede_matricular')
  })

  it('las demás respuestas de iglesia nunca bloquean', () => {
    for (const opcion of OPCIONES_ASISTE_A_IGLESIA.filter(o => o !== IGLESIA_EVANGELICA)) {
      expect(veredicto(r({ [PREGUNTAS.asisteAIglesia]: opcion })).estado, opcion)
        .toBe('puede_matricular')
    }
  })

  it('«quiero seguir en mi iglesia» sin ser evangélico NO bloquea', () => {
    // No debería poder pasar —la pregunta solo aparece para evangélicos—, pero
    // la regla no se apoya en eso: es la diferencia entre «Y» y «o».
    expect(debeExplorarOtrasOpciones(r({
      [PREGUNTAS.asisteAIglesia]: 'Sí, Católica',
      [PREGUNTAS.queTeMotiva]: QUIERE_SEGUIR_EN_SU_IGLESIA,
    }))).toBe(false)
  })
})

describe('qué falta contestar', () => {
  it('sin nada, faltan las dos que siempre se ven', () => {
    expect(faltaResponder({})).toEqual([PREGUNTAS.comoEscuchaste, PREGUNTAS.asisteAIglesia])
  })

  it('al evangélico se le pide además la motivación', () => {
    expect(faltaResponder(r({ [PREGUNTAS.asisteAIglesia]: IGLESIA_EVANGELICA })))
      .toEqual([PREGUNTAS.queTeMotiva])
  })

  it('al que NO es evangélico no se le pide: no ve esa pregunta', () => {
    // Pedirla lo dejaría trabado en un campo que la pantalla no dibuja.
    expect(faltaResponder(r({ [PREGUNTAS.asisteAIglesia]: 'No, ninguna' }))).toEqual([])
  })

  it('incompleto gana sobre el mensaje de despedida', () => {
    // Con la motivación en blanco todavía no se sabe nada; mostrar el mensaje
    // ahí sería adelantarse.
    const v = veredicto(r({ [PREGUNTAS.asisteAIglesia]: IGLESIA_EVANGELICA }))
    expect(v.estado).toBe('incompleto')
  })
})

describe('los textos son los de Ari, sin retoques', () => {
  it('la opción evangélica conserva su acento tal como está en el formulario', () => {
    // Dice «Evángelica», no «Evangélica». La comparación es por texto exacto:
    // corregirlo acá sin corregir la opción dejaría la regla sin efecto.
    expect(IGLESIA_EVANGELICA).toBe('Sí, Evángelica')
  })

  it('las opciones están completas y en orden', () => {
    expect([...OPCIONES_ASISTE_A_IGLESIA]).toEqual([
      'Asisto a Theos Place', 'Sí, Evángelica', 'Sí, Católica',
      'Sí, de otra religión', 'No, ninguna',
    ])
    expect(OPCIONES_QUE_TE_MOTIVA).toHaveLength(3)
    expect([...OPCIONES_QUE_TE_MOTIVA]).toContain(QUIERE_SEGUIR_EN_SU_IGLESIA)
  })
})

/**
 * La ramificación, corrida contra el MOTOR DE VERDAD.
 *
 * Esto es lo que Ari pidió mirar con cuidado («las limitaciones de mostrar la
 * pregunta solamente cuando…»). No se comprueba que el JSON tenga las llaves
 * esperadas: se le pasan respuestas a `campoVisible`, la misma función que
 * decide en pantalla, y se mira qué preguntas quedan a la vista.
 */
describe('qué preguntas se ven, según lo que va contestando', () => {
  const ID: IdsDelCuestionario = {
    comoEscuchaste: 'f-como', asisteAIglesia: 'f-iglesia', queTeMotiva: 'f-motiva',
    otrasOpciones: 'f-otras', ofreceCasa: 'f-casa', ubicacion: 'f-ubicacion',
  }
  let n = 0
  const campos = camposDelCuestionario(ID, () => `r${n++}`)
  const porId = new Map(campos.map(c => [c.id, c]))

  /** Qué campos dibuja la pantalla con estas respuestas (por id de campo). */
  const visibles = (resp: Record<string, string>) =>
    campos.filter(c => campoVisible({ logic_rules: c.conditions as never }, resp)).map(c => c.id)

  it('al abrir, solo las dos que no dependen de nada', () => {
    expect(visibles({})).toEqual([ID.comoEscuchaste, ID.asisteAIglesia, ID.ofreceCasa])
    // `ofreceCasa` aparece de una porque su condición es `neq` sobre una
    // respuesta en blanco. Es correcto —a quien no es evangélico hay que
    // preguntarle igual— y por eso está escrito en el test: si alguien lo ve y
    // piensa «esto está mal», que encuentre acá que no lo está.
  })

  it('«Sí, Evángelica» abre la pregunta de motivación', () => {
    const v = visibles({ [ID.asisteAIglesia]: IGLESIA_EVANGELICA })
    expect(v).toContain(ID.queTeMotiva)
    expect(v).not.toContain(ID.otrasOpciones)
  })

  it('cualquier otra respuesta de iglesia NO la abre', () => {
    for (const o of OPCIONES_ASISTE_A_IGLESIA.filter(x => x !== IGLESIA_EVANGELICA)) {
      expect(visibles({ [ID.asisteAIglesia]: o }), o).not.toContain(ID.queTeMotiva)
    }
  })

  it('evangélico + «continuar en mi iglesia» → aparece el mensaje y DESAPARECE lo de ofrecer casa', () => {
    const v = visibles({
      [ID.asisteAIglesia]: IGLESIA_EVANGELICA,
      [ID.queTeMotiva]: QUIERE_SEGUIR_EN_SU_IGLESIA,
    })
    expect(v).toContain(ID.otrasOpciones)
    expect(v).not.toContain(ID.ofreceCasa)
    expect(v).not.toContain(ID.ubicacion)
  })

  it('evangélico que se está acercando a Theos: NI mensaje, y sí le preguntan por la casa', () => {
    // El caso que la lectura con «o» habría arruinado.
    const v = visibles({
      [ID.asisteAIglesia]: IGLESIA_EVANGELICA,
      [ID.queTeMotiva]: 'Estoy considerando unirme a Theos',
    })
    expect(v).not.toContain(ID.otrasOpciones)
    expect(v).toContain(ID.ofreceCasa)
  })

  it('la ubicación solo si ofrece la casa', () => {
    const base = { [ID.asisteAIglesia]: 'No, ninguna' }
    expect(visibles({ ...base, [ID.ofreceCasa]: 'No' })).not.toContain(ID.ubicacion)
    expect(visibles({ ...base, [ID.ofreceCasa]: 'Sí' })).toContain(ID.ubicacion)
  })

  it('la sección de despedida lleva UNA regla con dos condiciones, no dos reglas', () => {
    // Con dos reglas el motor las resuelve con «o» —gana la primera que se
    // cumple— y el mensaje le saldría a todo evangélico. Es la única cosa que
    // las capturas dejaban ambigua.
    const seccion = porId.get(ID.otrasOpciones)!
    expect(seccion.conditions).toHaveLength(1)
    expect(seccion.conditions![0].condition_operator).toBe('AND')
    expect(seccion.conditions![0].conditions).toHaveLength(2)
  })

  it('el veredicto y la pantalla dicen lo mismo', () => {
    // Que el mensaje se dibuje y que el botón se oculte salen de dos caminos
    // distintos —`campoVisible` y `veredicto`—; si se separaran, alguien vería
    // el mensaje con el botón todavía puesto.
    const resp = {
      [PREGUNTAS.comoEscuchaste]: 'Amigos',
      [PREGUNTAS.asisteAIglesia]: IGLESIA_EVANGELICA,
      [PREGUNTAS.queTeMotiva]: QUIERE_SEGUIR_EN_SU_IGLESIA,
    }
    const porCampo = visibles({
      [ID.asisteAIglesia]: IGLESIA_EVANGELICA,
      [ID.queTeMotiva]: QUIERE_SEGUIR_EN_SU_IGLESIA,
    }).includes(ID.otrasOpciones)
    expect(veredicto(resp).estado === 'otras_opciones').toBe(porCampo)
  })
})

/**
 * TODA matrícula a Nivel 1 lleva su cuestionario.
 *
 * El bug que esto ataja (staging, 2026-09-24): mi primera versión no preguntaba
 * cuando el staff matriculaba a otra persona, con el argumento de que
 * preguntarle al staff por SU iglesia guardaría la respuesta a nombre
 * equivocado. El argumento estaba bien y la conclusión mal — había que arreglar
 * A NOMBRE DE QUIÉN se guarda, no dejar de preguntar—. Resultado: una matrícula
 * a N1 hecha por un admin quedó con CERO respuestas.
 */
describe('el cuestionario no se puede saltar', () => {
  const pantalla = readFileSync('src/app/(admin)/matricula/page.tsx', 'utf8')
  const modal = readFileSync('src/components/studies/CuestionarioNivel1.tsx', 'utf8')
  const endpoint = readFileSync('src/app/api/studies/cuestionario-nivel-1/route.ts', 'utf8')

  it('la pantalla NO condiciona el paso a quién matricula', () => {
    expect(pantalla).toContain("if (result.study_code === PLAN_CON_CUESTIONARIO) {")
    expect(pantalla).not.toContain('PLAN_CON_CUESTIONARIO && !selectedMember')
  })

  it('haber contestado antes ya NO saltea el paso', () => {
    expect(modal).not.toContain('d.ya_respondio')
    // Lo único que lo saltea es que el formulario no exista o esté apagado, que
    // es una falla de datos y no puede volverse un muro.
    expect(modal).toContain('if (!d.disponible) { onPuedeMatricular(); return }')
  })

  it('la respuesta se guarda a nombre de QUIEN SE MATRICULA', () => {
    expect(endpoint).toContain('member_id: destino.memberId')
    expect(endpoint).not.toContain('member_id: auth.ctx.memberId')
  })

  it('y con el control anti-suplantación de siempre', () => {
    // Sin esto, cualquiera con sesión podría contestar por otra ficha mandando
    // un member_id en el body.
    expect(endpoint).toContain('resolveOnBehalf(auth.ctx, body?.member_id, STUDY_ON_BEHALF_ROLES)')
    expect(endpoint).toContain('destino.denegado')
  })

  it('queda el rastro de quién lo digitó', () => {
    expect(endpoint).toContain('recorded_by: destino.recordedBy')
  })
})

/**
 * EL FILTRO ES UN FILTRO, no un mensaje.
 *
 * «Cuando la persona escoge esa opción, la matrícula no se da» (Floriana,
 * 2026-09-25). Con el bloqueo solo en el modal, cerrarlo y volver a confirmar
 * —o llamar al endpoint a mano— creaba la matrícula igual.
 */
describe('el filtro vive donde se CREA la matrícula', () => {
  const ruta = readFileSync('src/app/api/studies/groups/[id]/enrollments/route.ts', 'utf8')
  const consulta = readFileSync('src/lib/supabase/queries/cuestionario-n1.ts', 'utf8')

  it('el endpoint de matrícula lo comprueba antes de crear', () => {
    expect(ruta).toContain('bloqueaElCuestionarioDeN1(targetMemberId)')
    expect(ruta).toContain('cuestionario_n1_no_aplica')
    // Antes de `enrollMember`, no después: si no, la matrícula ya existe.
    expect(ruta.indexOf('bloqueaElCuestionarioDeN1')).toBeLessThan(ruta.indexOf('await enrollMember('))
  })

  it('NI SIQUIERA el staff lo saltea', () => {
    // Los otros dos bloqueos de esa ruta —pago pendiente y restricción de
    // grupo— sí tienen override explícito, porque son administrativos. Este no:
    // es a quién están dirigidos los estudios.
    //
    // Se miran SOLO las líneas de código: el comentario de arriba del bloque
    // explica justamente que no hay override, y sin quitarlo el test se
    // aprobaba a sí mismo leyendo la palabra. Ya pasó una vez con otro guard.
    const bloque = ruta.slice(ruta.indexOf('EST-15'), ruta.indexOf('await enrollMember('))
    const soloCodigo = bloque
      .split('\n')
      .filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l))
      .join('\n')
    expect(soloCodigo).not.toMatch(/isStaff|override/)
  })

  it('solo aplica a Nivel 1, y el código del plan sale de UN lugar', () => {
    expect(ruta).toContain('codigoDelPlan === PLAN_CON_CUESTIONARIO')
    expect(ruta).toContain("from '@/lib/studies/cuestionario-de-matricula'")
    const pantalla = readFileSync('src/app/(admin)/matricula/page.tsx', 'utf8')
    expect(pantalla).toContain("from '@/lib/studies/cuestionario-de-matricula'")
    // Si cada lado tuviera su constante, uno preguntaría y el otro no filtraría.
    expect(pantalla).not.toContain("const PLAN_CON_CUESTIONARIO = 'N1'")
  })

  it('mira la respuesta MÁS NUEVA, no la primera', () => {
    // Cada matrícula deja la suya: una vieja no puede dejar a alguien bloqueado
    // para siempre.
    expect(consulta).toContain("order('submitted_at', { ascending: false })")
  })

  it('sin respuesta NO bloquea', () => {
    // La pantalla ya obliga a contestar. Exigirlo también acá rompería los
    // caminos que no pasan por ahí —import, transferencia, corrección a mano—
    // y volvería una falla de datos en gente que no se puede matricular.
    expect(consulta).toContain('if (!resp) return false')
  })

  it('usa la MISMA regla pura que la pantalla', () => {
    expect(consulta).toContain("veredicto(respuestas).estado === 'otras_opciones'")
  })
})
