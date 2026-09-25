import { describe, it, expect } from 'vitest'
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
