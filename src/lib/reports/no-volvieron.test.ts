import { describe, it, expect } from 'vitest'
import {
  MESES_SIN_VENIR, MINIMO_CHECKINS_RECURRENTE,
  restarMeses, fechaDeCorte, dejoDeVenir, anioEnQueDejoDeIr,
  mensajeParaWhatsApp, telefonoParaWhatsApp, enlaceDeWhatsApp, PLANTILLA_WHATSAPP,
  situacionDeFila, resumenDeContactos, esEstadoDeContacto, esAQueVuelve,
} from '@/lib/reports/no-volvieron'

const HOY = '2026-10-05'

describe('DIR-7/REP-14 · la ventana de seis meses', () => {
  it('el corte son seis meses atrás', () => {
    expect(fechaDeCorte(HOY)).toBe('2026-04-05')
  })

  it('restar meses no desborda cuando el día no existe en el mes destino', () => {
    // El `setMonth` de JS convierte el 31 de agosto menos 6 en el 3 de marzo.
    expect(restarMeses('2026-08-31', 6)).toBe('2026-02-28')
    expect(restarMeses('2024-08-31', 6)).toBe('2024-02-29') // bisiesto
  })

  it('y cruza el año bien', () => {
    expect(restarMeses('2026-02-10', 6)).toBe('2025-08-10')
    expect(restarMeses('2026-01-15', 12)).toBe('2025-01-15')
  })

  it('actividad hace CINCO meses: no dejó de venir', () => {
    expect(dejoDeVenir('2026-05-10', HOY)).toBe(false)
  })

  it('actividad hace SIETE meses: sí dejó de venir', () => {
    expect(dejoDeVenir('2026-03-10', HOY)).toBe(true)
  })

  it('justo en el límite todavía cuenta como presente', () => {
    // El corte es exclusivo: venir el día del corte es venir.
    expect(dejoDeVenir('2026-04-05', HOY)).toBe(false)
    expect(dejoDeVenir('2026-04-04', HOY)).toBe(true)
  })

  it('nunca haber venido CUENTA como que no viene', () => {
    // En DIR-7 es el exalumno que terminó el estudio y jamás apareció por una
    // charla: exactamente a quien hay que buscar.
    expect(dejoDeVenir(null, HOY)).toBe(true)
  })

  it('un timestamp completo se compara igual que una fecha', () => {
    expect(dejoDeVenir('2026-03-10T23:40:00.000Z', HOY)).toBe(true)
    expect(dejoDeVenir('2026-05-10T00:01:00.000Z', HOY)).toBe(false)
  })

  it('la ventana es más larga que la de REP-5, a propósito', () => {
    // REP-5 busca a quien se está enfriando ESTA semana (5 semanas); acá, a
    // quien ya se fue. Con 5 semanas la lista serían cientos que faltaron un mes.
    expect(MESES_SIN_VENIR).toBe(6)
  })
})

describe('REP-14 · el año en que se perdió', () => {
  it('sale de su última señal', () => {
    expect(anioEnQueDejoDeIr('2024-11-03')).toBe(2024)
  })
  it('y sin señal no se inventa', () => {
    expect(anioEnQueDejoDeIr(null)).toBeNull()
    expect(anioEnQueDejoDeIr('')).toBeNull()
  })
  it('veinte check-ins es la vara de recurrente', () => {
    // Con una charla por semana son cinco meses de asistencia sostenida.
    expect(MINIMO_CHECKINS_RECURRENTE).toBe(20)
  })
})

describe('DIR-7 · el teléfono para WhatsApp', () => {
  it('un número nacional de 8 dígitos lleva el 506', () => {
    expect(telefonoParaWhatsApp('8888-8888')).toBe('50688888888')
    expect(telefonoParaWhatsApp('8888 8888')).toBe('50688888888')
    expect(telefonoParaWhatsApp('88888888')).toBe('50688888888')
  })

  it('y uno que YA trae el 506 no lo duplica', () => {
    // Duplicarlo daría 5065068888..., un número que no existe, y el enlace
    // abriría WhatsApp en un chat vacío sin decir que está mal.
    expect(telefonoParaWhatsApp('+506 8888-8888')).toBe('50688888888')
    expect(telefonoParaWhatsApp('50688888888')).toBe('50688888888')
  })

  it('un número extranjero se respeta', () => {
    expect(telefonoParaWhatsApp('+1 305 555 1234')).toBe('13055551234')
  })

  it('lo que no es un teléfono devuelve null, no un enlace roto', () => {
    expect(telefonoParaWhatsApp(null)).toBeNull()
    expect(telefonoParaWhatsApp('')).toBeNull()
    expect(telefonoParaWhatsApp('—')).toBeNull()
    expect(telefonoParaWhatsApp('1234567')).toBeNull() // siete dígitos
  })
})

describe('DIR-7 · el mensaje', () => {
  it('usa solo el PRIMER nombre: el completo suena a carta', () => {
    const m = mensajeParaWhatsApp('María José Rojas Vargas', 'Beto Mora Castro')
    expect(m).toContain('¡Hola María!')
    expect(m).toContain('Soy Beto,')
    expect(m).not.toContain('Rojas')
  })

  it('no pide nada ni vende: solo saluda', () => {
    // Si arranca vendiendo, el dirigente no lo va a querer mandar.
    expect(PLANTILLA_WHATSAPP).not.toMatch(/matricul|inscrib|cupo|pag/i)
  })

  it('el enlace va URL-encoded y con el número normalizado', () => {
    const url = enlaceDeWhatsApp({ telefono: '8888-8888', nombre: 'Ana Rojas', dirigente: 'Beto Mora' })!
    expect(url.startsWith('https://wa.me/50688888888?text=')).toBe(true)
    // El texto no puede romper la URL.
    expect(url).not.toContain(' ')
    expect(decodeURIComponent(url.split('?text=')[1])).toContain('¡Hola Ana!')
  })

  it('sin teléfono no hay enlace', () => {
    expect(enlaceDeWhatsApp({ telefono: null, nombre: 'Ana', dirigente: 'Beto' })).toBeNull()
  })
})

describe('DIR-7 · el seguimiento', () => {
  it('sin contacto la fila está pendiente', () => {
    expect(situacionDeFila(null)).toBe('pendiente')
  })

  it('«quiere volver» se destaca aparte: pide acción de alguien más', () => {
    expect(situacionDeFila('quiere_volver')).toBe('quiere_volver')
  })

  it('escribirle sin respuesta es contactado, no cerrado', () => {
    expect(situacionDeFila('escrito_sin_respuesta')).toBe('contactado')
  })

  it('los otros tres desenlaces cierran la fila', () => {
    for (const e of ['cambio_de_iglesia', 'no_quiere_volver', 'numero_equivocado'] as const) {
      expect(situacionDeFila(e), e).toBe('cerrado')
    }
  })

  it('el resumen cuenta por situación y por desenlace', () => {
    const r = resumenDeContactos([
      null, null, 'quiere_volver', 'escrito_sin_respuesta', 'cambio_de_iglesia',
    ])
    expect(r.total).toBe(5)
    expect(r.situaciones.pendiente).toBe(2)
    expect(r.situaciones.quiere_volver).toBe(1)
    expect(r.situaciones.contactado).toBe(1)
    expect(r.situaciones.cerrado).toBe(1)
    expect(r.desenlaces.cambio_de_iglesia).toBe(1)
  })

  it('las SITUACIONES suman el total; los desenlaces no tienen por qué', () => {
    // Cada fila está en exactamente una situación. Los desenlaces solo los
    // tienen las contactadas, así que suman menos.
    const r = resumenDeContactos([null, null, 'quiere_volver'])
    const sumaSit = Object.values(r.situaciones).reduce((a, b) => a + b, 0)
    const sumaDes = Object.values(r.desenlaces).reduce((a, b) => a + b, 0)
    expect(sumaSit).toBe(3)
    expect(sumaDes).toBe(1)
  })

  it('«quiere volver» se cuenta UNA vez, no dos', () => {
    // Es a la vez situación y desenlace: en un objeto plano la misma llave
    // recibía los dos incrementos y el número salía al doble.
    const r = resumenDeContactos(['quiere_volver'])
    expect(r.situaciones.quiere_volver).toBe(1)
    expect(r.desenlaces.quiere_volver).toBe(1)
    expect(r.total).toBe(1)
  })

  it('los validadores no dejan pasar cualquier cosa', () => {
    expect(esEstadoDeContacto('quiere_volver')).toBe(true)
    expect(esEstadoDeContacto('se_fue')).toBe(false)
    expect(esAQueVuelve('estudio')).toBe(true)
    expect(esAQueVuelve('otra')).toBe(false)
  })
})
