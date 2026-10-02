import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { motivoParaRechazarInicio, avisoDeAnticipacion } from './successor-dates'
import { ventanaDelCorte, DIAS_MINIMOS_HASTA_EL_INICIO } from './corte-de-bloque'
import { estadoVisible } from './estado-visible'

/**
 * EST-23 · El grupo que nace del corte necesita tiempo por delante.
 *
 * Dos semanas como mínimo hasta el arranque, y la matrícula abierta hasta
 * una semana antes. La cuenta no es arbitraria: una semana para imprimir los
 * folletos del par y una para que alcance a entrar alguien nuevo.
 */
const PAGINA = 'src/app/(admin)/estudios/grupos/[id]/cierre/page.tsx'
const RUTA = 'src/app/api/studies/groups/[id]/close/route.ts'
const sinComentarios = (f: string) =>
  readFileSync(f, 'utf8').split('\n')
    .filter(l => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*') && !l.trimStart().startsWith('/*'))
    .join('\n')

describe('el mínimo de dos semanas', () => {
  it('rechaza una fecha más cercana', () => {
    expect(motivoParaRechazarInicio('2026-10-10', '2026-10-01', 14)).toContain('2 semanas')
    expect(motivoParaRechazarInicio('2026-10-14', '2026-10-01', 14)).not.toBeNull()
  })

  it('acepta justo el día catorce', () => {
    expect(motivoParaRechazarInicio('2026-10-15', '2026-10-01', 14)).toBeNull()
  })

  it('SIN mínimo, el pasado se sigue aceptando', () => {
    /**
     * La mitad que importa. Los otros cierres registran algo que pudo haber
     * pasado ya —el campo dice «si ya arrancaron, poné el día que
     * arrancaron»—, así que aplicarles el mínimo trabaría un cierre sin que
     * nadie gane nada.
     */
    expect(motivoParaRechazarInicio('2026-09-01', '2026-10-01')).toBeNull()
    expect(motivoParaRechazarInicio('2026-09-01', '2026-10-01', 0)).toBeNull()
  })

  it('el aviso dice el número que de verdad se exige', () => {
    // Texto y número salen del mismo lugar: si mañana son tres semanas, el
    // aviso cambia solo en vez de quedar mintiendo.
    expect(avisoDeAnticipacion(14)).toContain('2 semanas')
    expect(avisoDeAnticipacion(21)).toContain('3 semanas')
    expect(avisoDeAnticipacion(7)).toContain('1 semana')
  })
})

describe('el candado no es solo el calendario', () => {
  it('la pantalla BLOQUEA las fechas, no solo las pinta en rojo', () => {
    expect(sinComentarios(PAGINA)).toContain('min={minimoDias')
  })

  it('y el mínimo solo aplica al corte con continuación', () => {
    expect(sinComentarios(PAGINA)).toContain('const exigeAnticipacion = hayCorte && continuaElGrupo === true')
  })

  it('el servidor valida igual, y ANTES de cerrar', () => {
    // El cierre es irreversible: validar después sería pedir un dato que ya
    // no se puede volver a pedir.
    const src = sinComentarios(RUTA)
    // Se afirma el USO, no el nombre: el `import` también lo contiene, y con
    // un `toContain` suelto el cebo de poner 0 en la expresión NO mordía.
    expect(src).toContain('? DIAS_MINIMOS_HASTA_EL_INICIO')
    // Y la llamada tiene que pasarle el mínimo, no quedarse con el default.
    expect(src).toContain('motivoParaRechazarInicio(inicioElegido, ymdCR(), minimoDias)')
    const cuerpo = src.slice(src.indexOf('export async function POST'))
    expect(cuerpo.indexOf('motivoParaRechazarInicio(inicioElegido'))
      .toBeLessThan(cuerpo.indexOf('await closeGroup('))
  })

  it('el servidor distingue el corte, no aplica el mínimo a todos', () => {
    expect(sinComentarios(RUTA)).toContain('hayCorteAlCerrar(sourceCode) && body.continua_el_grupo === true')
  })
})

describe('la ventana y el estado «Por iniciar»', () => {
  it('cierra una semana antes del arranque', () => {
    const v = ventanaDelCorte({ planOrigen: 'N2', planDestino: 'N3', hoy: '2026-10-01', inicio: '2026-11-05' })
    expect(v?.enrollment_end_date).toBe('2026-10-29')
  })

  it('y con eso el grupo se muestra «Por iniciar» esa última semana, SIN estado nuevo', () => {
    /**
     * El pedido hablaba de que el grupo «pase a por iniciar». No hizo falta
     * ni una columna ni un cron: `estadoVisible` ya deriva ese rótulo de un
     * grupo en matrícula con la ventana cerrada. Agregar un estado a la base
     * habría tocado el CHECK y las 54 pantallas que miran el estado.
     */
    const g = { status: 'en_matricula', enrollment_end_date: '2026-10-29' }
    expect(estadoVisible(g, '2026-10-28')).toBe('en_matricula')
    expect(estadoVisible(g, '2026-10-30')).toBe('por_iniciar')
  })

  it('el mínimo garantiza que siempre quede al menos una semana de matrícula', () => {
    // Con el mínimo de 14 días y el cierre 7 antes, el piso es una semana
    // abierta. Si alguien bajara el mínimo a 7, la ventana sería de cero.
    expect(DIAS_MINIMOS_HASTA_EL_INICIO).toBeGreaterThan(7)
  })
})
