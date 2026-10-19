import { describe, it, expect } from 'vitest'
import {
  grupoEnMarcha, matriculaVigente, textoDeEstudio, estaEnEstudio, mesYAnio,
  ultimoLlevadoODado, estudioCuentaParaElCompromiso,
  estudiosQueCursa,
  type EstudioDeLaPersona, estudiosEnMarcha, SUFIJO_EN_MATRICULA } from './estudio-actual'

const AHORA = new Date('2026-10-19T12:00:00Z')

const e = (x: Partial<EstudioDeLaPersona> = {}): EstudioDeLaPersona => ({
  llevando: [], dando: [], ultimo: null, ...x,
})

describe('qué cuenta como "ahora"', () => {
  it('manda el estado del GRUPO, no el de la matrícula', () => {
    // 675 matrículas 'enrolled' contra 68 grupos 'en_curso': mirar solo la
    // matrícula diría que media iglesia está estudiando.
    expect(grupoEnMarcha('en_curso')).toBe(true)
    expect(grupoEnMarcha('en_matricula')).toBe(true)
    expect(grupoEnMarcha('finalizado')).toBe(false)
    expect(grupoEnMarcha(null)).toBe(false)
  })

  it('quien salió del grupo no cuenta', () => {
    for (const s of ['dropped', 'cancelada', 'transferred']) expect(matriculaVigente(s), s).toBe(false)
    for (const s of ['enrolled', 'pendiente_de_pago', 'en_revision']) expect(matriculaVigente(s), s).toBe(true)
  })
})

describe('textoDeEstudio', () => {
  it('las tres formas empiezan con una palabra que dice qué son', () => {
    // "Nivel 2" a secas no dice si lo está llevando o si ya lo dio, y al lado de
    // "Último: …" la asimetría confunde.
    expect(textoDeEstudio(e({ llevando: ['X'] }))).toMatch(/^Cursando: /)
    expect(textoDeEstudio(e({ dando: ['X'] }))).toMatch(/^Dirige: /)
    expect(textoDeEstudio(e({ ultimo: { nombre: 'X', fecha: null } }))).toMatch(/^Llevó: /)
    expect(textoDeEstudio(e({ ultimoDado: { nombre: 'X', fecha: null } }))).toMatch(/^Dio: /)
  })

  it('llevando dice cuál, con la palabra adelante', () => {
    expect(textoDeEstudio(e({ llevando: ['Nivel 2'] }))).toBe('Cursando: Nivel 2')
  })

  it('dando lleva la palabra Dirige', () => {
    expect(textoDeEstudio(e({ dando: ['SCJ'] }))).toBe('Dirige: SCJ')
  })

  it('llevando y dando a la vez, los dos', () => {
    expect(textoDeEstudio(e({ llevando: ['Nivel 3'], dando: ['Nivel 1'] })))
      .toBe('Cursando: Nivel 3 · Dirige: Nivel 1')
  })

  it('varios a la vez se listan', () => {
    expect(textoDeEstudio(e({ llevando: ['Nivel 2', 'SCJ'] }))).toBe('Cursando: Nivel 2, SCJ')
  })

  it('sin estudio ahora, muestra el último con su mes', () => {
    expect(textoDeEstudio(e({ ultimo: { nombre: 'Nivel 3', fecha: '2026-03-18' } }), AHORA))
      .toBe('Llevó: Nivel 3 · mar 2026')
  })

  it('el último NO se muestra si está llevando algo: la columna se vuelve ilegible', () => {
    expect(textoDeEstudio(e({ llevando: ['Nivel 2'], ultimo: { nombre: 'Nivel 1', fecha: '2025-06-01' } })))
      .toBe('Cursando: Nivel 2')
  })

  it('último sin fecha no inventa una', () => {
    expect(textoDeEstudio(e({ ultimo: { nombre: 'Nivel 1', fecha: null } }))).toBe('Llevó: Nivel 1')
  })

  it('nunca llevó ninguno queda vacío', () => {
    expect(textoDeEstudio(e())).toBe('')
  })

  /**
   * 2026-10-19 · Consejo Dirección: Gustavo Zamora CUMPLÍA (dio «Sirviendo
   * como Jesús», cerró el 24-ago-2026) y la columna decía «Último: Precampaña ·
   * abr 2025», porque solo mostraba lo que llevó como estudiante.
   */
  it('muestra lo MÁS reciente entre lo que llevó y lo que dio', () => {
    const gustavo = e({
      ultimo: { nombre: 'Precampaña Transformados', fecha: '2025-04-29' },
      ultimoDado: { nombre: 'Sirviendo como Jesús', fecha: '2026-08-24' },
    })
    expect(textoDeEstudio(gustavo, AHORA)).toBe('Dio: Sirviendo como Jesús · ago 2026')
    expect(estudioCuentaParaElCompromiso(gustavo, AHORA)).toBe(true)
    expect(ultimoLlevadoODado(gustavo)?.tipo).toBe('dio')
  })

  it('si lo último tiene más de un año, lo dice y no cuenta', () => {
    const benjamin = e({ ultimo: { nombre: 'Precampaña Transformados', fecha: '2025-04-29' } })
    expect(textoDeEstudio(benjamin, AHORA)).toBe('Llevó: Precampaña Transformados · abr 2025 · hace más de un año')
    expect(estudioCuentaParaElCompromiso(benjamin, AHORA)).toBe(false)
  })

  it('el corte es a los 12 meses exactos', () => {
    expect(estudioCuentaParaElCompromiso(e({ ultimo: { nombre: 'X', fecha: '2025-10-19' } }), AHORA)).toBe(true)
    expect(estudioCuentaParaElCompromiso(e({ ultimo: { nombre: 'X', fecha: '2025-10-18' } }), AHORA)).toBe(false)
  })
})

describe('las dos pantallas pintan el estudio con la regla del servidor', () => {
  it('Mi comité y el reporte de servidores usan llevandoEstudio || dandoEstudio', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('src/app/(admin)/servidores/mi-comite/page.tsx', 'utf8')).toContain('<Marca ok={f.llevandoEstudio || f.dandoEstudio} titulo="Estudio" />')
    expect(readFileSync('src/app/(admin)/reportes/servidores/page.tsx', 'utf8')).toContain('aria-label="Estudio: cumple"')
    expect(readFileSync('src/lib/supabase/queries/mi-comite.ts', 'utf8')).toContain('e.ultimoDado = { nombre: nombreDelEstudio(g.plan, g.name), fecha }')
  })
})

describe('estaEnEstudio', () => {
  it('el último estudio es información, no cumplimiento', () => {
    expect(estaEnEstudio(e({ ultimo: { nombre: 'Nivel 3', fecha: '2026-03-18' } }))).toBe(false)
  })

  it('llevar o dar cumple', () => {
    expect(estaEnEstudio(e({ llevando: ['Nivel 1'] }))).toBe(true)
    expect(estaEnEstudio(e({ dando: ['Nivel 1'] }))).toBe(true)
  })
})

describe('mesYAnio', () => {
  it('usa "set" y no "sep", como el resto del sistema', () => {
    expect(mesYAnio('2026-09-18')).toBe('set 2026')
  })
  it('sin fecha, vacío', () => {
    expect(mesYAnio(null)).toBe('')
    expect(mesYAnio('cualquier cosa')).toBe('')
  })
})

describe('PAR-5 · estudios que cursa AHORA', () => {
  const m = (status: string, grupoStatus: string | null, planNombre: string | null) =>
    ({ status, grupo: grupoStatus === null ? null : { status: grupoStatus, planNombre } })

  it('solo cuenta el grupo EN CURSO, no el que está en matrícula', () => {
    // La diferencia real: 666 con matrícula vigente contra 431 cursando.
    expect(estudiosQueCursa([m('enrolled', 'en_curso', 'Nivel 1')])).toEqual(['Nivel 1'])
    expect(estudiosQueCursa([m('enrolled', 'en_matricula', 'Nivel 1')])).toEqual([])
    expect(estudiosQueCursa([m('enrolled', 'finalizado', 'Nivel 1')])).toEqual([])
  })

  it('DEVUELVE LOS DOS cuando lleva dos: antes mostraba solo el primero', () => {
    expect(estudiosQueCursa([
      m('enrolled', 'en_curso', 'Nivel 2'),
      m('enrolled', 'en_curso', 'Discípulos 1'),
    ])).toEqual(['Discípulos 1', 'Nivel 2'])
  })

  it('cuenta las matrículas vigentes, no solo «enrolled»', () => {
    // pendiente_de_pago vuelve a escribirse desde el 2026-09-01: quien está en
    // el grupo cursando, cursa, aunque le falte el comprobante.
    expect(estudiosQueCursa([m('pendiente_de_pago', 'en_curso', 'Nivel 3')])).toEqual(['Nivel 3'])
    expect(estudiosQueCursa([m('en_revision', 'en_curso', 'Nivel 3')])).toEqual(['Nivel 3'])
  })

  it('no cuenta a quien ya salió', () => {
    for (const s of ['dropped', 'cancelada', 'transferred', 'completed']) {
      expect(estudiosQueCursa([m(s, 'en_curso', 'Nivel 1')]), s).toEqual([])
    }
  })

  it('sin grupo, sin nombre de plan o sin nada: lista vacía, nunca undefined', () => {
    expect(estudiosQueCursa([])).toEqual([])
    expect(estudiosQueCursa([m('enrolled', null, 'Nivel 1')])).toEqual([])
    expect(estudiosQueCursa([m('enrolled', 'en_curso', null)])).toEqual([])
  })

  it('no repite si hay dos matrículas del mismo plan', () => {
    expect(estudiosQueCursa([
      m('enrolled', 'en_curso', 'Nivel 1'), m('enrolled', 'en_curso', 'Nivel 1'),
    ])).toEqual(['Nivel 1'])
  })
})

/**
 * La columna «Nivel actual» debe incluir lo que está en matrícula (pedido de
 * Floriana, 2026-09-25): con la versión estricta salía VACÍA para quien está
 * inscrito en un grupo que todavía no empieza.
 */
describe('estudiosEnMarcha · lo que lleva ahora, incluso si no arrancó', () => {
  const m = (planNombre: string, estadoGrupo: string, estadoMatricula = 'enrolled') =>
    ({ status: estadoMatricula, grupo: { status: estadoGrupo, planNombre } })

  it('trae los que ya arrancaron, sin marca', () => {
    expect(estudiosEnMarcha([m('Nivel 1', 'en_curso')])).toEqual(['Nivel 1'])
  })

  it('trae los que NO arrancaron, marcados', () => {
    expect(estudiosEnMarcha([m('Nivel 2', 'en_matricula')])).toEqual([`Nivel 2${SUFIJO_EN_MATRICULA}`])
  })

  it('la marca importa: sin ella la columna diría que ya lo está llevando', () => {
    // Es exactamente el error que PAR-5 vino a arreglar; volver a mezclarlos
    // sin distinguir sería deshacerlo.
    const [uno] = estudiosEnMarcha([m('Nivel 2', 'en_matricula')])
    expect(uno).not.toBe('Nivel 2')
    expect(uno).toContain('matrícula')
  })

  it('primero lo que ya está pasando', () => {
    expect(estudiosEnMarcha([m('Nivel 3', 'en_matricula'), m('Nivel 1', 'en_curso')]))
      .toEqual(['Nivel 1', `Nivel 3${SUFIJO_EN_MATRICULA}`])
  })

  it('un grupo finalizado no cuenta', () => {
    expect(estudiosEnMarcha([m('Nivel 4', 'finalizado')])).toEqual([])
  })

  it('una matrícula que ya salió no cuenta, aunque el grupo esté abierto', () => {
    for (const salida of ['dropped', 'cancelada', 'transferred']) {
      expect(estudiosEnMarcha([m('Nivel 1', 'en_curso', salida)]), salida).toEqual([])
    }
  })

  it('si el mismo estudio está en curso Y en matrícula, no se repite', () => {
    // Pasa al reinscribirse en el siguiente ciclo del mismo plan; mostrarlo dos
    // veces —una marcada y otra no— se lee como un error de datos.
    expect(estudiosEnMarcha([m('Nivel 1', 'en_curso'), m('Nivel 1', 'en_matricula')]))
      .toEqual(['Nivel 1'])
  })

  it('el FILTRO estricto no se movió', () => {
    // `estudiosQueCursa` sigue siendo solo lo que arrancó: la columna informa,
    // el filtro responde una pregunta precisa, y son cosas distintas.
    expect(estudiosQueCursa([m('Nivel 2', 'en_matricula')])).toEqual([])
    expect(estudiosQueCursa([m('Nivel 1', 'en_curso')])).toEqual(['Nivel 1'])
  })
})
