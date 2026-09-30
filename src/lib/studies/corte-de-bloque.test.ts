import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  NIVELES_QUE_CIERRAN_BLOQUE, hayCorteAlCerrar, motivoQueImpideCerrar, creaSucesor,
  asuntoDelCorte, lineasDelCorte,
  BLOQUES_DE_NIVELES, bloqueDe, esInicioDeBloque, esContinuacionDeBloque,
  nivelesACobrar, montoDelBloque, folletosQuePide,
  ventanaDelCorte, DIAS_DE_VENTANA_DEL_CORTE,
} from './corte-de-bloque'
import { FOLLETO_NEXT_LEVEL } from './folletos'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const RUTA = 'src/app/api/studies/groups/[id]/close/route.ts'
const PANTALLA = 'src/app/(admin)/estudios/grupos/[id]/cierre/page.tsx'

/**
 * EST-14 · El corte entre bloques.
 *
 * Los niveles se leen en pares: N1+N2 y N3+N4. Dentro de un bloque la cadena
 * sigue sola; ENTRE bloques el dirigente decide.
 */
describe('dónde hay corte', () => {
  it('solo al cerrar N2, hoy', () => {
    expect(hayCorteAlCerrar('N2')).toBe(true)
    expect([...NIVELES_QUE_CIERRAN_BLOQUE]).toEqual(['N2'])
  })

  it('N1 y N3 NO cortan: siguen dentro de su bloque', () => {
    expect(hayCorteAlCerrar('N1')).toBe(false)
    expect(hayCorteAlCerrar('N3')).toBe(false)
  })

  it('ni las capacitaciones ni nada más', () => {
    for (const c of ['N4', 'DIS1', 'DIS2', 'DIS3', 'PREMAT', 'CDEB', null, undefined, '']) {
      expect(hayCorteAlCerrar(c), String(c)).toBe(false)
    }
  })

  it('el corte cae donde la cadena de folletos SÍ sigue', () => {
    // N2→N3 existe en FOLLETO_NEXT_LEVEL: el corte no es que no haya
    // siguiente, es que deja de ser automático. Si esto se cae, alguien
    // cortó donde la cadena ya terminaba y el corte no significa nada.
    for (const n of NIVELES_QUE_CIERRAN_BLOQUE) {
      expect(FOLLETO_NEXT_LEVEL[n], n).toBeTruthy()
    }
  })
})

describe('la respuesta es OBLIGATORIA y no tiene default', () => {
  it('sin responder, no se cierra', () => {
    /**
     * Ni `undefined` ni `null` pasan. Un default —aunque fuera «sí»—
     * reproduce el problema que este ítem resuelve: hoy el sucesor se crea
     * SIEMPRE, y por eso aparecen grupos de N3 que nadie pidió con gente
     * matriculada y cobrada.
     */
    expect(motivoQueImpideCerrar('N2', undefined)).toContain('si el grupo continúa')
    expect(motivoQueImpideCerrar('N2', null)).toBeTruthy()
  })

  it('con sí o con no, se cierra', () => {
    expect(motivoQueImpideCerrar('N2', true)).toBeNull()
    expect(motivoQueImpideCerrar('N2', false)).toBeNull()
  })

  it('donde no hay corte, no se pregunta nada', () => {
    for (const c of ['N1', 'N3', 'N4', 'DIS1']) {
      expect(motivoQueImpideCerrar(c, undefined), c).toBeNull()
    }
  })
})

describe('quién crea el grupo siguiente', () => {
  it('fuera de un corte, el comportamiento de siempre', () => {
    // El llamador decide con `isFolletoEligible`; acá no se estorba.
    expect(creaSucesor('N1', undefined)).toBe(true)
    expect(creaSucesor('N3', undefined)).toBe(true)
    expect(creaSucesor('DIS1', undefined)).toBe(true)
  })

  it('en el corte manda el dirigente', () => {
    expect(creaSucesor('N2', true)).toBe(true)
    expect(creaSucesor('N2', false)).toBe(false)
  })

  it('y sin respuesta NO crea nada', () => {
    // Defensa en profundidad: aunque el guard de arriba fallara, el default
    // es no crear. Crear de más es peor — deja gente cobrada.
    expect(creaSucesor('N2', undefined)).toBe(false)
    expect(creaSucesor('N2', null)).toBe(false)
  })
})

describe('el aviso al comité cuando la cohorte no sigue', () => {
  const aviso = {
    grupo: 'Nivel 2. Hilda Díaz. Agosto 2026',
    dirigente: 'Hilda Díaz',
    zona: 'Cartago',
    horario: '7:00 pm',
    estudiantes: 5,
  }

  it('el asunto dice qué grupo y qué pasó', () => {
    expect(asuntoDelCorte(aviso)).toBe('El grupo Nivel 2. Hilda Díaz. Agosto 2026 no continúa a Nivel 3')
  })

  it('el cuerpo trae los datos para DECIDIR, no solo el aviso', () => {
    // Quien lo recibe tiene que poder armar el grupo sin ir a buscar nada.
    const t = lineasDelCorte(aviso).join(' ')
    expect(t).toContain('Hilda Díaz')
    expect(t).toContain('Cartago')
    expect(t).toContain('7:00 pm')
    expect(t).toContain('5 estudiantes')
  })

  it('con un solo estudiante no dice «1 estudiantes»', () => {
    expect(lineasDelCorte({ ...aviso, estudiantes: 1 }).join(' ')).toContain('1 estudiante</strong>')
    expect(lineasDelCorte({ ...aviso, estudiantes: 1 }).join(' ')).not.toContain('1 estudiantes')
  })

  it('sin zona ni horario no deja frases colgando', () => {
    const t = lineasDelCorte({ ...aviso, zona: null, horario: null })
    expect(t.join(' ')).not.toContain('Se reunía en')
    expect(t.every(l => l.trim().length > 0)).toBe(true)
  })

  it('sin dirigente tampoco', () => {
    expect(lineasDelCorte({ ...aviso, dirigente: null }).join(' ')).not.toContain('Dirigente:')
  })
})

describe('el servidor decide, no la pantalla', () => {
  const api = sinComentarios(RUTA)

  it('el endpoint exige la respuesta ANTES de cerrar', () => {
    /**
     * El cierre es irreversible. Si se validara después, el grupo ya estaría
     * finalizado cuando se descubre que falta la respuesta — y no habría
     * forma de pedirla de nuevo. Es el mismo razonamiento que EST-16 dejó
     * escrito para la fecha del sucesor.
     */
    expect(api).toContain('motivoQueImpideCerrar(sourceCode, body.continua_el_grupo)')
    expect(api.indexOf('motivoQueImpideCerrar')).toBeLessThan(api.indexOf('await closeGroup('))
  })

  it('y la auto-matrícula queda detrás de la respuesta', () => {
    expect(api).toContain('const habraSucesor = creaSucesor(sourceCode, body.continua_el_grupo)')
    expect(api).toContain('if (habraSucesor) {')
    const bloque = api.slice(api.indexOf('if (habraSucesor) {'))
    expect(bloque.slice(0, 400)).toContain('autoEnrollApprovedToNextLevel')
  })

  it('sin sucesor no se piden folletos ni se exige el lugar', () => {
    // No hay a quién entregárselos, y exigir el campo trabaría el cierre.
    expect(api).toContain('isFolletoEligible(sourceCode) && aprobados > 0 && habraSucesor')
  })

  it('el «no» dispara el aviso, y es best-effort', () => {
    expect(api).toContain('notificarCorteSinSucesor')
    const bloque = api.slice(api.indexOf('if (hayCorteAlCerrar(sourceCode) && !habraSucesor)'))
    expect(bloque.slice(0, 200)).toContain('try {')
  })
})

describe('la pantalla pregunta y no deja cerrar sin respuesta', () => {
  const pag = sinComentarios(PANTALLA)

  it('arranca SIN respuesta elegida', () => {
    expect(pag).toContain('useState<boolean | null>(null)')
  })

  it('el botón de cerrar queda bloqueado hasta responder', () => {
    expect(pag).toContain('!!faltaRespuestaDeCorte')
  })

  it('las dos opciones dicen QUÉ VA A PASAR, no solo sí y no', () => {
    // Quien responde está decidiendo si se crea un grupo y si se le cobra a
    // su gente: eso se dice antes, no después.
    expect(pag).toContain('quedan matriculados con su cobro')
    expect(pag).toContain('Le avisamos a coordinación')
  })

  it('y la respuesta viaja al servidor', () => {
    expect(pag).toContain('continua_el_grupo: continuaElGrupo')
  })
})

/**
 * EL COBRO SE MUEVE, LOS PRECIOS NO (Floriana, 2026-09-30).
 *
 * `study_plans.cost` queda intacto y lo que cambia es cuándo se cobra: al
 * entrar al bloque, no a cada nivel. El monto se SUMA del catálogo, así que
 * da los números de la spec sin duplicar precios en ningún lado.
 */
describe('EST-14 · el cobro es por bloque', () => {
  /** Los costos reales de producción, medidos el 2026-09-30. */
  const CATALOGO = { N1: 0, N2: 5000, N3: 5000, N4: 5000 }

  it('los bloques son N1+N2 y N3+N4', () => {
    expect(BLOQUES_DE_NIVELES.map(b => [...b])).toEqual([['N1', 'N2'], ['N3', 'N4']])
  })

  it('entrar a N1 cobra ₡5.000 — el par entero', () => {
    expect(montoDelBloque('N1', CATALOGO)).toBe(5000)
  })

  it('entrar a N3 cobra ₡10.000', () => {
    expect(montoDelBloque('N3', CATALOGO)).toBe(10000)
  })

  it('pasar a N2 o a N4 NO cobra: ya se pagó al entrar', () => {
    expect(montoDelBloque('N2', CATALOGO)).toBe(0)
    expect(montoDelBloque('N4', CATALOGO)).toBe(0)
    expect(nivelesACobrar('N2')).toEqual([])
    expect(nivelesACobrar('N4')).toEqual([])
  })

  it('el total de la cadena no cambia: ₡15.000', () => {
    // Lo que se mueve es CUÁNDO se paga, no cuánto. Si esto se cae, alguien
    // cambió lo que la gente paga sin querer.
    const total = ['N1', 'N2', 'N3', 'N4']
      .reduce((t, c) => t + montoDelBloque(c, CATALOGO), 0)
    expect(total).toBe(5000 + 5000 + 5000)
  })

  it('el monto se SUMA del catálogo, no está escrito', () => {
    // Si mañana suben Nivel 4, el bloque sube solo. Un ₡10.000 a mano se
    // quedaría viejo sin que nadie lo note.
    expect(montoDelBloque('N3', { N3: 5000, N4: 8000 })).toBe(13000)
  })

  it('un nivel que falte en el catálogo cuenta 0, no rompe', () => {
    expect(montoDelBloque('N3', { N3: 5000 })).toBe(5000)
  })

  it('LO QUE NO ES UN NIVEL SIGUE COBRÁNDOSE IGUAL', () => {
    /**
     * El modo de fallo más caro de este cambio: si `nivelesACobrar`
     * devolviera [] para lo que no está en un bloque, las capacitaciones, el
     * prematrimonial y los discípulos se volverían GRATIS de un día para
     * otro — y nadie lo notaría hasta que finanzas cuadre el mes.
     */
    for (const c of ['DIS1', 'DIS2', 'DIS3', 'PREMAT', 'CDEB', 'HER', 'SCJ']) {
      expect(nivelesACobrar(c), c).toEqual([c])
      expect(montoDelBloque(c, { [c]: 20000 }), c).toBe(20000)
    }
  })

  it('quién es inicio y quién continuación', () => {
    expect(esInicioDeBloque('N1')).toBe(true)
    expect(esInicioDeBloque('N3')).toBe(true)
    expect(esInicioDeBloque('N2')).toBe(false)
    expect(esContinuacionDeBloque('N2')).toBe(true)
    expect(esContinuacionDeBloque('N4')).toBe(true)
    expect(esContinuacionDeBloque('N1')).toBe(false)
    // Lo que no es nivel no es ninguna de las dos cosas.
    expect(esInicioDeBloque('DIS1')).toBe(false)
    expect(esContinuacionDeBloque('DIS1')).toBe(false)
    expect(bloqueDe('DIS1')).toBeNull()
  })

  it('el corte cae al FINAL de un bloque, no en el medio', () => {
    // N2 cierra el primer par. Si el corte cayera en N1 o N3 estaría
    // partiendo un bloque al medio, que es lo contrario de la idea.
    for (const n of NIVELES_QUE_CIERRAN_BLOQUE) {
      expect(esContinuacionDeBloque(n), n).toBe(true)
    }
  })
})

describe('EST-14 · la matrícula usa el monto del bloque', () => {
  it('el cobro sale de `montoDelBloque`, no de `plan.cost`', () => {
    const q = sinComentarios('src/lib/supabase/queries/studies.ts')
    expect(q).toContain('montoDelBloque(plan?.code, costos)')
    expect(q).toContain('const delBloque = nivelesACobrar(plan?.code)')
  })

  it('y solo se desvía del catálogo cuando ES un nivel', () => {
    // El resto de los planes no puede pasar por ese camino.
    const q = sinComentarios('src/lib/supabase/queries/studies.ts')
    expect(q).toContain('const esBloqueDeNiveles = !!bloqueDe(plan?.code)')
    expect(q).toContain('if (esBloqueDeNiveles) {')
  })
})

describe('EST-14 · el paso automático tampoco cobra dos veces', () => {
  it('la auto-matrícula usa el monto del BLOQUE', () => {
    /**
     * EL ERROR MÁS CARO DE ESTE CAMBIO, y no se veía leyendo el cierre: el
     * cobro del paso automático se genera en `payments.ts`, no en el
     * endpoint. Con `np.cost` a secas, pasar de N1 a N2 cobraba ₡5.000 POR
     * SEGUNDA VEZ — el bloque ya se había pagado al entrar a N1.
     */
    const q = sinComentarios('src/lib/supabase/queries/payments.ts')
    expect(q).toContain('const amount = montoDelBloque(next, costosDelBloque)')
    expect(q).not.toContain('const amount = Number(np.cost ?? 0)')
  })

  it('y para lo que no es nivel sigue dando el costo del plan', () => {
    // DIS1→DIS2 y compañía: `montoDelBloque` devuelve el costo propio.
    expect(montoDelBloque('DIS2', { DIS2: 15000 })).toBe(15000)
  })
})

/**
 * EST-14 fase 3 · FOLLETOS EN PARES.
 *
 * Los folletos de un bloque se entregan juntos al empezarlo. Lo lindo del
 * diseño es que el CIERRE no cambió: ya pedía los folletos del grupo
 * SUCESOR, y como el sucesor de N1 es un N2 —que no pide nada— el pedido por
 * cierre desaparece solo para 1→2 y 3→4.
 */
describe('EST-14 · qué folletos pide cada grupo', () => {
  it('un grupo de N1 pide el par 1+2', () => {
    expect(folletosQuePide('N1')).toEqual(['N1', 'N2'])
  })

  it('un grupo de N3 pide el par 3+4', () => {
    expect(folletosQuePide('N3')).toEqual(['N3', 'N4'])
  })

  it('N2 y N4 NO piden: su gente ya los tiene del bloque', () => {
    /**
     * Esto es lo que hace desaparecer el pedido por cierre de 1→2 y 3→4 sin
     * tocar el endpoint: el sucesor es un N2 o un N4, y no pide nada.
     */
    expect(folletosQuePide('N2')).toEqual([])
    expect(folletosQuePide('N4')).toEqual([])
  })

  it('lo que no es nivel pide SU folleto, como siempre', () => {
    // Si devolviera [], los discípulos se quedarían sin folletos.
    for (const c of ['DIS1', 'DIS2', 'DIS3', 'PREMAT']) {
      expect(folletosQuePide(c), c).toEqual([c])
    }
  })

  it('el cierre 2→3 sí pide, porque el sucesor es un N3', () => {
    // Cuando el dirigente dice que la cohorte sigue, el grupo que se crea es
    // de N3 y pide el par 3+4 — la otra regla del ítem, también sola.
    expect(folletosQuePide('N3').length).toBe(2)
  })
})

describe('EST-14 · el generador crea un tiquete por folleto', () => {
  const q = sinComentarios('src/lib/supabase/queries/folletos.ts')

  it('recorre el par en vez de insertar uno solo', () => {
    expect(q).toContain('const aPedir = folletosQuePide(code)')
    expect(q).toContain('for (const nivel of aPedir)')
    expect(q).toContain('target_level_code: nivel')
  })

  it('un grupo que ya los tiene no pide nada', () => {
    expect(q).toContain("return { created: false, reason: 'ya_los_tiene_del_bloque' }")
  })

  it('el choque de duplicado mira el FOLLETO, no solo el grupo', () => {
    // El índice único pasó a (source_group_id, target_level_code): si el
    // rescate siguiera buscando solo por grupo, el segundo folleto del par se
    // habría tratado como «ya existe» y el grupo se quedaba sin él.
    expect(q).toContain(".eq('target_level_code', nivel)")
  })

  it('manda UN aviso que nombra a los dos', () => {
    // Dos correos iguales del mismo grupo entrenan a ignorarlos.
    expect(q).toContain('const etiquetaDelPar = aPedir.map(n => levelLabel(n))')
    expect(q).toContain('Son ${aPedir.length} folletos por persona')
  })
})

describe('EST-14 · la migración del índice', () => {
  const sql = readFileSync('supabase/migrations/20260930190000_est14_folletos_por_par.sql', 'utf8')

  it('el único pasa a incluir el nivel', () => {
    /**
     * Sin esto el segundo tiquete del par chocaba con 23505 y el código lo
     * trataba como «ya existe»: el grupo se quedaba con el folleto de N1 y
     * sin el de N2, EN SILENCIO.
     */
    expect(sql).toContain('(source_group_id, target_level_code)')
  })

  it('y la idempotencia se conserva donde importa', () => {
    // Un grupo sigue sin poder pedir DOS VECES el mismo folleto por la vía
    // automática, que es lo que el índice cuidaba.
    expect(sql).toContain('create unique index')
    expect(sql).toContain("where tipo in ('cupo_lleno', 'fin_matricula', 'cierre')")
  })
})

/**
 * EST-14 · La ventana de dos semanas del corte.
 *
 * SOLO en 2→3. El 2026-08-27 se decidió que el sucesor naciera `en_curso`
 * porque `en_matricula` lo dejaba «esperando una ventana que nunca se
 * define»; EST-14 la define, así que acá sí corresponde — y solo acá.
 */
describe('EST-14 · la matrícula abierta del corte', () => {
  const base = { hoy: '2026-10-01', inicio: null }

  it('el corte 2→3 abre catorce días', () => {
    expect(ventanaDelCorte({ ...base, planOrigen: 'N2', planDestino: 'N3' }))
      .toEqual({ enrollment_start_date: '2026-10-01', enrollment_end_date: '2026-10-15' })
    expect(DIAS_DE_VENTANA_DEL_CORTE).toBe(14)
  })

  it('1→2 y 3→4 NO abren: la cohorte avanza junta', () => {
    /**
     * Esta es la mitad que importa de la decisión. Abrirlo en los cuatro
     * habría reintroducido el problema de agosto en tres de ellos: grupos
     * apareciendo con cupo disponible en las pantallas de matrícula.
     */
    expect(ventanaDelCorte({ ...base, planOrigen: 'N1', planDestino: 'N2' })).toBeNull()
    expect(ventanaDelCorte({ ...base, planOrigen: 'N3', planDestino: 'N4' })).toBeNull()
  })

  it('exige que el ORIGEN cierre bloque, no solo que el destino lo abra', () => {
    /**
     * Las dos condiciones no son la misma, aunque hoy la segunda tape a la
     * primera para 1→2 y 3→4. Este caso —salir de N1 hacia N3— no ocurre en
     * la realidad, pero es el único que las distingue: sin la guarda del
     * origen, un salto raro abriría matrícula sin que haya habido corte.
     *
     * Se agregó porque el cebo de quitar esa guarda NO mordía, y un guard que
     * no se puede romper es un guard que no se está probando.
     */
    expect(ventanaDelCorte({ ...base, planOrigen: 'N1', planDestino: 'N3' })).toBeNull()
  })

  it('ni las capacitaciones', () => {
    expect(ventanaDelCorte({ ...base, planOrigen: 'DIS1', planDestino: 'DIS2' })).toBeNull()
    expect(ventanaDelCorte({ ...base, planOrigen: 'PREMAT', planDestino: 'X' })).toBeNull()
  })

  it('la ventana NO se pasa del arranque del grupo', () => {
    // Matricular a alguien en un grupo que ya empezó es meterlo tarde, y el
    // dirigente puede haber elegido arrancar antes de los catorce días.
    expect(ventanaDelCorte({ planOrigen: 'N2', planDestino: 'N3', hoy: '2026-10-01', inicio: '2026-10-08' }))
      .toEqual({ enrollment_start_date: '2026-10-01', enrollment_end_date: '2026-10-08' })
  })

  it('si el arranque cae después, valen los catorce días', () => {
    expect(ventanaDelCorte({ planOrigen: 'N2', planDestino: 'N3', hoy: '2026-10-01', inicio: '2026-11-01' })?.enrollment_end_date)
      .toBe('2026-10-15')
  })

  it('cruza el fin de mes sin romperse', () => {
    expect(ventanaDelCorte({ planOrigen: 'N2', planDestino: 'N3', hoy: '2026-10-25', inicio: null })?.enrollment_end_date)
      .toBe('2026-11-08')
  })
})

describe('EST-14 · y el grupo nace abierto de verdad', () => {
  const q = sinComentarios('src/lib/supabase/queries/payments.ts')

  it('el status sale del MISMO lugar que la ventana', () => {
    /**
     * BUG QUE SE INTRODUJO Y SE CORRIGIÓ EN EL ACTO: el `status: 'en_curso'`
     * estaba suelto y el objeto lo ponía DESPUÉS del spread, así que pisaba
     * al `en_matricula` del corte y la ventana no hacía nada — sin que
     * fallara ningún tipo ni ningún test de los que había.
     *
     * Ahora el status se decide en el mismo return que la ventana, así que
     * no hay dos lugares que puedan contradecirse.
     */
    expect(q).toContain("{ ...fechas, ...ventana, status: 'en_matricula' as const }")
    expect(q).toContain("{ ...fechas, status: 'en_curso' as const }")
  })

  it('y no quedó ningún `status` suelto que lo pise', () => {
    const insert = q.slice(q.indexOf("from('study_groups')\n    .insert("))
    expect(insert.slice(0, 2000)).not.toMatch(/^\s{6}status: 'en_curso',$/m)
  })
})
