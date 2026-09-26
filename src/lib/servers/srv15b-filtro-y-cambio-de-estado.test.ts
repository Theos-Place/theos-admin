import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  TRANSICIONES_A_MANO, estadosDestinoAMano, motivoQueImpideCambiar,
  ACCION_HACIA, CONSECUENCIA_HACIA,
} from './cambio-de-estado-de-solicitud'
import { VACANCY_STATES } from './vacancy-states'
import {
  FILTROS, FILTRO_POR_DEFECTO, FILTRO_TODAS, FILTRO_LABEL,
  filtroDesde, solicitudesConEstado, conteoPorFiltro, vacioSegunFiltro,
} from './filtro-de-solicitudes'

const sinComentarios = (r: string) =>
  readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

const s = (id: string, estado: string) => ({ id, estado })

describe('SRV-15b · mover una solicitud a mano', () => {
  it('NUNCA se puede publicar a mano, desde ningún estado', () => {
    // Es la regla de SRV-15 y la única que no puede tener excepciones:
    // publicar sella `published_at`, y una publicada sin fecha la baja la
    // corrida siguiente — el atajo sale a la calle y se cae solo.
    for (const desde of VACANCY_STATES) {
      expect(estadosDestinoAMano(desde), desde).not.toContain('publicada')
      expect(motivoQueImpideCambiar(desde, 'publicada'), desde).toBeTruthy()
    }
  })

  it('una bajada y una denegada se pueden DEVOLVER a la cola', () => {
    // El pedido que originó esto: sin vuelta atrás, el único camino era pedir
    // el puesto de nuevo y perder de quién era y desde cuándo.
    expect(motivoQueImpideCambiar('despublicada', 'lista_para_publicar')).toBeNull()
    expect(motivoQueImpideCambiar('denegado', 'lista_para_publicar')).toBeNull()
  })

  it('una publicada se baja, pero no vuelve derecho a la cola', () => {
    expect(motivoQueImpideCambiar('publicada', 'despublicada')).toBeNull()
    // Mientras esté publicada la gente la ve y puede aplicar; devolverla sin
    // bajarla dejaría una fila publicada que dice «espera publicación», y la
    // corrida del mes la publicaría encima de sí misma.
    expect(motivoQueImpideCambiar('publicada', 'lista_para_publicar')).toBeTruthy()
  })

  it('no se puede «mover» a donde ya está', () => {
    for (const e of VACANCY_STATES) {
      expect(motivoQueImpideCambiar(e, e), e).toBeTruthy()
    }
  })

  it('un estado desconocido no habilita nada', () => {
    // Una fila que quedó con un nombre viejo por un script o un rollback a
    // medias: se reporta, no se adivina a dónde puede ir.
    for (const viejo of ['creado', 'aprobado', 'cerrada', '']) {
      expect(estadosDestinoAMano(viejo), viejo).toEqual([])
      expect(motivoQueImpideCambiar(viejo, 'denegado'), viejo).toBeTruthy()
    }
  })

  it('cada destino posible tiene verbo y consecuencia', () => {
    const destinos = new Set(Object.values(TRANSICIONES_A_MANO).flat())
    for (const d of destinos) {
      expect(ACCION_HACIA[d], d).toBeTruthy()
      expect(CONSECUENCIA_HACIA[d], d).toBeTruthy()
    }
  })

  it('desde todo estado del ciclo hay al menos una salida', () => {
    // Sin esto, una fila puede quedar encerrada: es exactamente lo que pasaba
    // antes de este cambio con las denegadas.
    for (const e of VACANCY_STATES) {
      expect(estadosDestinoAMano(e).length, e).toBeGreaterThan(0)
    }
  })
})

describe('SRV-15b · el filtro de la pantalla', () => {
  it('abre en «listas para publicar», no en todas', () => {
    expect(FILTRO_POR_DEFECTO).toBe('lista_para_publicar')
  })

  it('están los cuatro estados más «Todas»', () => {
    expect(FILTROS).toEqual([...VACANCY_STATES, FILTRO_TODAS])
    for (const f of FILTROS) expect(FILTRO_LABEL[f], f).toBeTruthy()
  })

  it('un filtro que no se entiende cae en el de por defecto, no en un error', () => {
    for (const malo of [null, undefined, '', 'aprobado', 'cualquier-cosa']) {
      expect(filtroDesde(malo)).toBe(FILTRO_POR_DEFECTO)
    }
  })

  it('filtra por estado, y «Todas» no filtra', () => {
    const items = [s('a', 'lista_para_publicar'), s('b', 'publicada'), s('c', 'publicada')]
    expect(solicitudesConEstado(items, 'publicada').map(i => i.id)).toEqual(['b', 'c'])
    expect(solicitudesConEstado(items, FILTRO_TODAS)).toHaveLength(3)
  })

  it('el conteo de «Todas» incluye las de estado desconocido; los otros chips no', () => {
    // La diferencia entre «Todas» y la suma de los demás es la única señal de
    // que hay una fila que ningún filtro muestra.
    const c = conteoPorFiltro([s('a', 'publicada'), s('b', 'cerrada')])
    expect(c.publicada).toBe(1)
    expect(c[FILTRO_TODAS]).toBe(2)
    const suma = VACANCY_STATES.reduce((t, e) => t + c[e], 0)
    expect(c[FILTRO_TODAS] - suma).toBe(1)
  })

  it('el mensaje de lista vacía dice cuál filtro está puesto', () => {
    // «Todavía no hay solicitudes» es falso cuando lo que pasa es que no hay
    // denegadas, y manda a buscar un problema que no existe.
    expect(vacioSegunFiltro('denegado').titulo).toContain('denegadas')
    expect(vacioSegunFiltro(FILTRO_TODAS).titulo).not.toContain('denegadas')
  })
})

describe('SRV-15b · cableado', () => {
  const PANTALLA = sinComentarios('src/app/(admin)/servidores/vacantes/solicitudes/page.tsx')
  const LISTA = sinComentarios('src/app/api/servers/vacancies/requests/route.ts')
  const PATCH = sinComentarios('src/app/api/servers/vacancies/requests/[id]/route.ts')
  const QUERIES = sinComentarios('src/lib/supabase/queries/servers.ts')

  it('el plan se calcula sobre TODAS, no sobre lo filtrado', () => {
    // La mitad del plan son las publicadas que hay que bajar, y en la vista
    // por defecto ninguna de esas está a la vista: con el plan filtrado el
    // botón diría que no baja nada y después bajaría cinco.
    const llamada = LISTA.slice(LISTA.indexOf('planDePublicacion('))
    expect(llamada.slice(0, 200)).toContain('todas.map')
    expect(llamada.slice(0, 200)).not.toContain('items.map')
  })

  it('la pantalla dibuja las opciones con la tabla de transiciones', () => {
    expect(PANTALLA).toContain('estadosDestinoAMano(')
    // Y no con una lista escrita a mano: si la hubiera, el día que cambie la
    // tabla la pantalla ofrecería algo que el servidor rechaza.
    expect(PANTALLA).not.toContain("'denegado', 'despublicada'")
  })

  it('el servidor valida la transición contra la base, no contra el body', () => {
    const fn = QUERIES.slice(QUERIES.indexOf('export async function cambiarEstadoDeSolicitud'))
    const cuerpo = fn.slice(0, 1600)
    expect(cuerpo).toContain('motivoQueImpideCambiar(anterior, status)')
    // Y solo escribe si nadie la movió mientras tanto.
    expect(cuerpo).toContain(".eq('status', anterior)")
    expect(PATCH).toContain('cambiarEstadoDeSolicitud(')
  })

  it('el cambio queda firmado con el estado del que venía', () => {
    const audit = PATCH.slice(PATCH.indexOf('logAudit('))
    expect(audit.slice(0, 400)).toContain('status: r.anterior')
  })

  it('el Excel baja lo mismo que se está viendo', () => {
    expect(PANTALLA).toContain('formato=xlsx&estado=')
    const excel = LISTA.slice(LISTA.indexOf("=== 'xlsx'"))
    expect(excel.slice(0, 300)).toContain('construirExcelDeSolicitudes(items)')
  })

  it('ya nadie manda el estado viejo «cerrada»', () => {
    // Los dos botones de «Cerrar puesto» seguían mandándolo por el PUT
    // genérico después del renombre de SRV-15: el enum del schema lo aceptaba
    // y la fila quedaba invisible para todos los filtros.
    for (const r of [
      'src/app/(admin)/servidores/vacantes/page.tsx',
      'src/app/(admin)/servidores/vacantes/[id]/page.tsx',
      'src/app/api/servers/vacancies/schema.ts',
    ]) {
      expect(sinComentarios(r), r).not.toContain("'cerrada'")
    }
  })

  it('el estado no se puede cambiar por el PUT de edición del puesto', () => {
    // Una sola puerta: la que valida la transición.
    const schema = sinComentarios('src/app/api/servers/vacancies/schema.ts')
    expect(schema).not.toContain('status:')
  })
})
