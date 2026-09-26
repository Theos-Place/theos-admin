import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resumenDeEvaluaciones, type TiqueteParaElResumen } from './digest-de-evaluaciones'

const HOY = new Date('2026-09-25T12:00:00Z')
const t = (o: Partial<TiqueteParaElResumen> = {}): TiqueteParaElResumen =>
  ({ creado: '2026-09-25', respuestas: 1, escalado: false, ...o })

/**
 * RET-1 parte 6 · Al 2026-09-25 había 8 tiquetes, los 8 sin atender, el más
 * viejo de hace 34 días, y nadie había recibido un aviso.
 */
describe('el resumen quincenal de evaluaciones', () => {
  it('SIN PENDIENTES no dice nada', () => {
    // Un resumen que llega cada quince días diciendo «cero» enseña a archivarlo
    // sin leer, y el día que traiga ocho también se archiva.
    expect(resumenDeEvaluaciones([], HOY)).toBeNull()
  })

  it('con uno, habla en singular', () => {
    const r = resumenDeEvaluaciones([t()], HOY)!
    expect(r.titulo).toBe('1 evaluación espera revisión')
  })

  it('con varios, en plural', () => {
    expect(resumenDeEvaluaciones([t(), t(), t()], HOY)!.titulo)
      .toBe('3 evaluaciones esperan revisión')
  })

  it('el dato que va adelante es la MÁS VIEJA', () => {
    // Es lo que dice si esto se está atendiendo o se está acumulando.
    const r = resumenDeEvaluaciones([
      t({ creado: '2026-09-24' }),
      t({ creado: '2026-08-22' }),
    ], HOY)!
    expect(r.diasDelMasViejo).toBe(34)
    expect(r.cuerpo).toContain('34 días')
  })

  it('«entraron hoy» cuando ninguna lleva un día', () => {
    expect(resumenDeEvaluaciones([t({ creado: '2026-09-25' })], HOY)!.cuerpo)
      .toContain('Entraron hoy')
  })

  it('las escaladas se cuentan aparte: alguien ya las marcó como delicadas', () => {
    const r = resumenDeEvaluaciones([t({ escalado: true }), t()], HOY)!
    expect(r.escalados).toBe(1)
    expect(r.cuerpo).toContain('delicada')
  })

  it('avisa de las que no tienen NINGUNA respuesta', () => {
    // Sin respuestas no hay nada que compartir, pero igual hay que decidir: son
    // las que se quedan en la cola para siempre si nadie las cierra.
    expect(resumenDeEvaluaciones([t({ respuestas: 0 })], HOY)!.cuerpo)
      .toContain('no tiene ninguna respuesta')
  })

  it('NO lleva el contenido de ninguna respuesta', () => {
    // Es un recordatorio de que hay trabajo, no el trabajo. Una notificación se
    // reenvía, y el acceso a esas respuestas se acaba de cerrar con llave.
    const fuente = readFileSync('src/lib/studies/digest-de-evaluaciones.ts', 'utf8')
    expect(fuente).not.toMatch(/comments|score|comentario/i)
  })

  it('una fecha inválida no rompe el resumen', () => {
    // El aviso no puede caerse por un dato sucio: es justamente cuando hay algo
    // raro que conviene que llegue.
    expect(resumenDeEvaluaciones([t({ creado: 'vaya uno a saber' })], HOY)!.total).toBe(1)
  })
})

describe('el cron del resumen', () => {
  const ruta = readFileSync('src/app/api/cron/evaluation-digest/route.ts', 'utf8')

  it('corre el 1 y el 15', () => {
    const vercel = readFileSync('vercel.json', 'utf8')
    expect(vercel).toContain('/api/cron/evaluation-digest')
    expect(vercel).toContain('0 13 1,15 * *')
  })

  it('lo puede disparar a mano quien revisa, para ver qué diría', () => {
    expect(ruta).toContain('requireRoles(...EVALUATION_ROLES)')
  })

  it('y tiene su healthcheck, como los otros crones', () => {
    expect(ruta).toContain("pingHealthcheck('HEALTHCHECK_URL_EVALUATION_DIGEST')")
  })
})
