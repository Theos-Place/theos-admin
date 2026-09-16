import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  horaDelCheckin, etiquetaDeCalidad, marcaEnLaBusqueda, textoYaRegistrado,
  textoDeshacer, textoQrRepetido, esYaRegistrado, YA_REGISTRADO,
} from './checkin-duplicado'

const c = (over: Partial<Parameters<typeof textoYaRegistrado>[0]> = {}) => ({
  id: 'x', checked_at: '2026-09-09T01:42:00.000Z', ...over,
})

describe('horaDelCheckin', () => {
  it('muestra la hora de Costa Rica, no la del servidor', () => {
    // 01:42 UTC son las 7:42 p. m. del día anterior en CR. Sin la zona, el
    // operador vería una hora que no corresponde a nada de lo que vivió.
    expect(horaDelCheckin('2026-09-09T01:42:00.000Z')).toMatch(/7:42/)
  })
  it('una fecha rota no rompe la pantalla', () => {
    expect(horaDelCheckin('nada')).toBe('')
  })
})

describe('marcaEnLaBusqueda', () => {
  it('quien ya está registrado sale marcado con hora y calidad', () => {
    expect(marcaEnLaBusqueda(c())).toMatch(/^✓ .+ · asistente$/)
    expect(marcaEnLaBusqueda(c({ checked_in_as: 'servidor' }))).toMatch(/servidor$/)
  })
  it('quien no está registrado no lleva marca', () => {
    expect(marcaEnLaBusqueda(null)).toBeNull()
    expect(marcaEnLaBusqueda(undefined)).toBeNull()
  })
})

describe('etiquetaDeCalidad', () => {
  it('cualquier cosa que no sea servidor es asistente', () => {
    // La base puede traer null en los históricos; mostrar "null" sería peor
    // que asumir el default, que es el mismo que usa el alta.
    expect(etiquetaDeCalidad(null)).toBe('asistente')
    expect(etiquetaDeCalidad('servidor')).toBe('servidor')
  })
})

describe('los textos dicen qué pasó y qué va a pasar', () => {
  it('el panel da hora, calidad y operador cuando se sabe', () => {
    expect(textoYaRegistrado(c({ operador: 'Ana Mora' }))).toMatch(/como asistente por Ana Mora\.$/)
  })
  it('sin operador no inventa "por undefined"', () => {
    expect(textoYaRegistrado(c())).not.toMatch(/por/)
  })
  it('la confirmación dice qué se pierde, no solo "¿seguro?"', () => {
    expect(textoDeshacer('Ana Mora')).toContain('la saca de la lista de asistencia')
  })
  it('el QR repetido informa, no reprocha', () => {
    const t = textoQrRepetido('Ana Mora', c())
    expect(t).toMatch(/ya estaba registrada a las /)
    expect(t).not.toMatch(/error|inválid/i)
  })
})

describe('esYaRegistrado', () => {
  it('distingue el duplicado de los otros 409', () => {
    // El POST también devuelve 409 para not_registered (evento pago sin
    // inscripción) y eso lleva a cobro en sitio, no al panel de duplicado.
    expect(esYaRegistrado(409, { code: YA_REGISTRADO })).toBe(true)
    expect(esYaRegistrado(409, { code: 'not_registered' })).toBe(false)
    expect(esYaRegistrado(500, { code: YA_REGISTRADO })).toBe(false)
    expect(esYaRegistrado(409, null)).toBe(false)
  })
})

describe('el cableado del check-in duplicado', () => {
  // La regla de arriba es texto; esto fija que esté CONECTADA. La feature se
  // rompe en silencio si alguien quita una llamada, y el síntoma es
  // exactamente el que se quiso arreglar: el operador a ciegas.
  const leer = (p: string) => readFileSync(p, 'utf8')
  const RUTA = leer('src/app/api/events/[id]/checkins/route.ts')
  const PANTALLA = leer('src/app/(admin)/eventos/[id]/checkin/page.tsx')

  it('el 409 devuelve los DATOS del check-in que ya existe, no solo el mensaje', () => {
    expect(RUTA).toMatch(/getCheckinExistente\(id, memberId\)/)
    expect(RUTA).toMatch(/checkin: existente/)
  })

  it('el body se lee UNA vez: el catch no puede releerlo', () => {
    // Un Request se consume al leerlo. Con el await dentro del catch, el 409
    // informativo reventaba y caía al 500 genérico.
    const posBody = RUTA.indexOf('await req.json()')
    expect(RUTA.indexOf('try {', posBody)).toBeGreaterThan(posBody)
  })

  it('el alta guarda QUIÉN registró', () => {
    // Los 172.569 check-ins previos tienen checked_in_by en NULL: sin esto el
    // panel nunca podría decir "por Fulano".
    expect(RUTA).toMatch(/checked_in_by: auth\.ctx\.userId/)
  })

  it('seleccionar a alguien ya registrado abre el panel en vez de reintentar', () => {
    expect(PANTALLA).toMatch(/const ya = checkinPorMiembro\.get\(member\.id\)/)
    expect(PANTALLA).toMatch(/if \(ya\) \{ setYaRegistrado/)
  })

  it('la búsqueda marca a los que ya tienen check-in', () => {
    expect(PANTALLA).toMatch(/marcaEnLaBusqueda\(checkinPorMiembro\.get\(r\.id\)\)/)
  })

  it('el 409 del servidor pinta el panel aunque el estado local esté viejo', () => {
    // Dos operadores en paralelo: el de esta pantalla puede no haber visto el
    // check-in del otro, y el servidor es el que sabe.
    expect(PANTALLA).toMatch(/esYaRegistrado\(res\.status, data\)/)
  })

  it('deshacer pide confirmación antes de borrar', () => {
    expect(PANTALLA).toMatch(/confirmarDeshacer/)
    expect(PANTALLA).toMatch(/textoDeshacer\(yaRegistrado\.nombre\)/)
  })

  it('el QR repetido informa con la hora, no con un error', () => {
    expect(PANTALLA).toMatch(/textoQrRepetido\(already\.member_name/)
  })
})
