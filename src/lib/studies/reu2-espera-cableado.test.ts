import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ESTADOS_MOVIBLES, estadosDestino } from './request-status-change'
import { ESTADO_EN_ESPERA } from './request-wait'

/**
 * REU-2 · El cable: pausar y despertar tienen que llegar de verdad.
 *
 * Las reglas puras ya están probadas en request-wait.test.ts. Lo que acá se
 * cuida es lo que ningún módulo puro atrapa: que la pantalla pida la acción,
 * que la ruta la reciba, que el cron exista y esté registrado, y —la parte que
 * se olvida— que el vencimiento lea `reactivated_at`. Un cable cortado ahí no
 * rompe nada visible: la solicitud vuelve a la cola, se ve bien, y muere
 * semanas después en otro módulo.
 *
 * Se lee el código SIN comentarios: un guard que se satisface con la palabra
 * que aparece en su propia explicación no guarda nada.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const RUTA = 'src/app/api/studies/requests/[id]/route.ts'
const CRON_DESPERTAR = 'src/app/api/cron/study-requests-wake/route.ts'
const CRON_VENCER = 'src/app/api/cron/study-requests-expire/route.ts'
const TABLERO = 'src/components/shared/RequestBoard.tsx'
const COLA = 'src/app/(admin)/estudios/solicitudes/page.tsx'

describe('REU-2 · pausar llega al servidor', () => {
  it('el tablero manda action: wait con las semanas', () => {
    const src = sinComentarios(TABLERO)
    expect(src).toContain("action: 'wait'")
    expect(src).toMatch(/weeks:\s*semanas/)
  })

  it('el tablero NO calcula la fecha: la calcula el servidor', () => {
    // Si la calculara el cliente, el día de vuelta dependería del reloj del
    // navegador de quien pausó, y el cron corre con el de Costa Rica.
    const src = sinComentarios(TABLERO)
    expect(src).not.toContain('fechaDeReactivacion')
  })

  it('la ruta valida con la MISMA regla que usa la pantalla', () => {
    expect(sinComentarios(RUTA)).toContain('motivoQueImpideEsperar')
    expect(sinComentarios(COLA)).toContain('motivoQueImpideEsperar')
  })

  it('la ruta calcula la fecha y la guarda junto al estado', () => {
    const src = sinComentarios(RUTA)
    expect(src).toContain('fechaDeReactivacion(ymdCR()')
    // En el MISMO update que el estado: `en_espera` sin `wait_until` sería una
    // solicitud dormida sin despertador.
    expect(src).toMatch(/wait_until:\s*fechaDeReactivacion/)
  })
})

describe('REU-2 · despertar', () => {
  it('el cron existe y está registrado en vercel.json', () => {
    const crons = JSON.parse(readFileSync('vercel.json', 'utf8')).crons as Array<{ path: string; schedule: string }>
    const c = crons.find(x => x.path === '/api/cron/study-requests-wake')
    expect(c).toBeDefined()
    // Semanal, como pidió la reunión: día de la semana fijo, día del mes libre.
    expect(c!.schedule.split(' ')[2]).toBe('*')
    expect(c!.schedule.split(' ')[4]).not.toBe('*')
  })

  it('el cron devuelve la solicitud a open y sella la vuelta', () => {
    const src = sinComentarios(CRON_DESPERTAR)
    expect(src).toContain('solicitudesADespertar')
    expect(src).toContain("status: 'open'")
    expect(src).toContain('parcheAlDespertar')
  })

  it('también se puede despertar a mano, y eso apaga el despertador igual', () => {
    expect(ESTADOS_MOVIBLES).toContain(ESTADO_EN_ESPERA)
    expect(sinComentarios(RUTA)).toMatch(/fila\.status === ESTADO_EN_ESPERA \? parcheAlDespertar/)
  })

  it('pero DORMIRLA no se ofrece en el selector de estados: falta la fecha', () => {
    for (const tipo of ['relocation', 'study_interest']) {
      expect(estadosDestino(tipo), tipo).not.toContain(ESTADO_EN_ESPERA)
    }
  })
})

describe('REU-2 · la que durmió no la mata el vencimiento', () => {
  it('el cron de vencer trae reactivated_at DE LA BASE, no solo en el tipo', () => {
    // Primera versión de este guard: buscaba 'reactivated_at' en el archivo y
    // pasaba con la columna borrada del select, porque el nombre seguía vivo en
    // la anotación de tipo. Un cast no trae datos. Ahora se mira el select.
    const select = sinComentarios(CRON_VENCER).match(/\.select\('([^']*)'\)/g) ?? []
    expect(select.some(s => s.includes('reactivated_at'))).toBe(true)
  })

  it('y la regla de vencer mira esa fecha, no created_at a secas', () => {
    const src = sinComentarios('src/lib/studies/request-expiry.ts')
    expect(src).toContain('fechaDeReferencia')
    // bloqueQueLaAtiende nunca recibe created_at directo: ese era el bug.
    expect(src).not.toMatch(/bloqueQueLaAtiende\(\s*s(olicitud)?\.created_at/)
  })
})
