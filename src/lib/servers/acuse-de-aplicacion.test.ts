import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * LOS DOS ACUSES AL APLICAR (Floriana, 2026-10-08).
 *
 * Karen Angamarca aplicó a las 15:10 y no salió ni un correo: ni ella supo
 * que su aplicación entró, ni el comité que había llegado. Aplicar no
 * disparaba nada — el primero salía recién cuando alguien movía el estado a
 * mano, y eso puede tardar días.
 */
const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const APLICAR = sinComentarios('src/app/api/servers/vacancies/[id]/apply/route.ts')
const CORREOS = readFileSync('src/lib/email/application-notify.ts', 'utf8')

describe('al aplicar salen los dos correos', () => {
  it('a quien aplicó y al comité, desde el endpoint de aplicar', () => {
    expect(APLICAR).toContain('notificarAcuseAlAplicante')
    expect(APLICAR).toContain('notificarAlEncargado')
    expect(APLICAR).toContain("momento: 'recibida'")
  })

  it('y NO tumban la aplicación si el correo falla', () => {
    /**
     * La aplicación ya está guardada y es lo que vale. Si esto pudiera tirar
     * el request, un problema de correo le haría creer a la persona que no
     * aplicó — y volvería a aplicar, o no lo haría.
     */
    const i = APLICAR.indexOf('notificarAcuseAlAplicante')
    const antes = APLICAR.slice(0, i)
    expect(antes.lastIndexOf('try {')).toBeGreaterThan(antes.lastIndexOf('} catch'))
    // Uno que falle no cancela al otro.
    expect(APLICAR).toContain('Promise.allSettled')
  })

  it('el acuse se manda DESPUÉS de crear, con el id real', () => {
    // Con un id inventado la ficha saldría vacía.
    expect(APLICAR).toMatch(/const \{ id: applicationId \} = await createApplication/)
    expect(APLICAR).toContain('getDetalleDeAplicante(applicationId)')
  })
})

describe('qué dice el correo a quien aplicó', () => {
  it('dice el plazo: DOS SEMANAS, que es lo que se pidió', () => {
    /**
     * «Recibimos tu aplicación» a secas deja a la persona preguntándose
     * cuándo le responden, que es justo la duda que el correo debería
     * cerrar.
     */
    const fn = CORREOS.slice(CORREOS.indexOf('export async function notificarAcuseAlAplicante'))
    expect(fn).toContain('aproximadamente dos semanas')
    expect(fn).toContain('El comité encargado la va a revisar')
  })

  it('va como «aproximadamente»: es una expectativa, no una fecha', () => {
    const fn = CORREOS.slice(CORREOS.indexOf('export async function notificarAcuseAlAplicante'))
    expect(fn).not.toMatch(/en 2 semanas exact|a más tardar|garantiz/i)
  })

  it('NO promete que la vayan a aceptar', () => {
    // Esa conversación la tiene el comité, no un correo automático.
    const fn = CORREOS.slice(CORREOS.indexOf('export async function notificarAcuseAlAplicante'))
    expect(fn).not.toMatch(/felicidades|aceptad|bienvenid/i)
  })

  it('sin correo no se intenta mandar nada', () => {
    const fn = CORREOS.slice(CORREOS.indexOf('export async function notificarAcuseAlAplicante'))
    expect(fn).toContain('if (!input.correo) return { enviado: false }')
  })

  it('es transaccional: quien aplica espera esta confirmación', () => {
    // Con `marketing` se la perdería quien se dio de baja del boletín.
    const fn = CORREOS.slice(CORREOS.indexOf('export async function notificarAcuseAlAplicante'))
    expect(fn).toContain("kind: 'transactional'")
  })
})

describe('qué cambia en el correo al comité', () => {
  it('el de «recién llegada» se distingue del de «enviada para revisión»', () => {
    // Son dos momentos distintos y el comité tiene que poder diferenciarlos.
    expect(CORREOS).toContain("const recienLlegada = input.momento === 'recibida'")
    expect(CORREOS).toContain('Nueva aplicación a ')
  })

  it('y le dice al comité el plazo que el sistema prometió en su nombre', () => {
    /**
     * Si el comité no sabe que a la persona le dijimos «dos semanas», el
     * plazo lo incumple alguien que nunca se enteró de que existía.
     */
    expect(CORREOS).toContain('aproximadamente dos semanas</strong>.</p>`')
  })

  it('sigue siendo UNA función para los dos momentos', () => {
    // Con dos, el día que se agregue un campo al detalle una se queda sin él.
    expect((CORREOS.match(/export async function notificarAlEncargado/g) ?? []).length).toBe(1)
  })
})
