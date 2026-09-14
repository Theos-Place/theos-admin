import { describe, it, expect } from 'vitest'
import {
  clasificarCampos, resolucionInicial, faltanPorDecidir, estaCompleta, combinarTexto,
  valoresAAplicar, avisoDeCuentas, correoFinalDeLogin, principalSugerido, CAMPOS_FUSIONABLES,
  type FichaParaFusion, type Resolucion,
} from './resolucion-de-fusion'

const ficha = (o: Record<string, unknown> = {}): FichaParaFusion => ({ id: 'x', ...o })

describe('clasificarCampos', () => {
  it('el caso Zully: dos apellidos distintos son CONFLICTO, no un hueco', () => {
    // Es el bug: coalesce se queda con el del principal y "Murillo Sanchez" se pierde.
    const c = clasificarCampos(ficha({ last_name: 'Murillo' }), ficha({ last_name: 'Murillo Sanchez' }))
    expect(c.conflictos.map(x => x.campo.key)).toContain('last_name')
    expect(c.conflictos.find(x => x.campo.key === 'last_name')).toMatchObject({
      principal: 'Murillo', duplicado: 'Murillo Sanchez',
    })
  })

  it('lo idéntico no se pregunta', () => {
    const c = clasificarCampos(ficha({ first_name: 'Zully' }), ficha({ first_name: 'Zully' }))
    expect(c.iguales.map(x => x.campo.key)).toContain('first_name')
    expect(c.conflictos).toHaveLength(0)
  })
  it('compara sin importar mayúsculas ni espacios de sobra', () => {
    const c = clasificarCampos(ficha({ email: ' Ana@X.com ' }), ficha({ email: 'ana@x.com' }))
    expect(c.iguales.map(x => x.campo.key)).toContain('email')
  })

  it('si solo el DUPLICADO tiene el dato, se conserva sin preguntar', () => {
    // Perder un dato porque el principal lo tenía vacío es el bug de fondo.
    const c = clasificarCampos(ficha({ allergies: null }), ficha({ allergies: 'penicilina' }))
    expect(c.soloUno).toEqual([{ campo: expect.objectContaining({ key: 'allergies' }), valor: 'penicilina', lado: 'duplicado' }])
    expect(c.conflictos).toHaveLength(0)
  })
  it('el string vacío cuenta como vacío, no como valor', () => {
    const c = clasificarCampos(ficha({ phone: '   ' }), ficha({ phone: '8888-8888' }))
    expect(c.soloUno[0].lado).toBe('duplicado')
  })
  it('vacío en los dos ni se muestra', () => {
    const c = clasificarCampos(ficha(), ficha())
    expect(c.ambosVacios).toHaveLength(CAMPOS_FUSIONABLES.length)
    expect(c.iguales.concat(c.conflictos as never[])).toHaveLength(0)
  })
})

describe('restricción alimenticia, que es un arreglo', () => {
  it('un arreglo vacío cuenta como vacío', () => {
    const c = clasificarCampos(ficha({ dietary_restrictions: [] }), ficha({ dietary_restrictions: ['sin gluten'] }))
    expect(c.soloUno.find(x => x.campo.key === 'dietary_restrictions')?.lado).toBe('duplicado')
  })
  it('el mismo contenido en otro orden no es conflicto', () => {
    const c = clasificarCampos(
      ficha({ dietary_restrictions: ['sin gluten', 'vegetariano'] }),
      ficha({ dietary_restrictions: ['vegetariano', 'sin gluten'] }))
    expect(c.iguales.map(x => x.campo.key)).toContain('dietary_restrictions')
  })
  it('contenidos distintos sí son conflicto', () => {
    const c = clasificarCampos(ficha({ dietary_restrictions: ['vegetariano'] }), ficha({ dietary_restrictions: ['sin gluten'] }))
    expect(c.conflictos.map(x => x.campo.key)).toContain('dietary_restrictions')
  })
  it('no se ofrece combinar: concatenar un arreglo no tiene sentido', () => {
    expect(CAMPOS_FUSIONABLES.find(f => f.key === 'dietary_restrictions')?.combinable).toBeFalsy()
  })
})

describe('defaults', () => {
  const c = clasificarCampos(
    ficha({ cedula: '111', birth_date: '1990-01-01', occupation: 'Ing' }),
    ficha({ cedula: '222', birth_date: '1990-05-05', occupation: 'Prof' }))

  it('el default es el principal en los campos normales', () => {
    expect(resolucionInicial(c).occupation).toBe('principal')
  })
  it('cédula y nacimiento NO traen default: hay que mirarlos', () => {
    const r = resolucionInicial(c)
    expect(r.cedula).toBeUndefined()
    expect(r.birth_date).toBeUndefined()
  })
  it('y la fusión no puede completarse hasta elegirlos', () => {
    const r = resolucionInicial(c)
    expect(estaCompleta(c, r)).toBe(false)
    expect(faltanPorDecidir(c, r).map(x => x.key).sort()).toEqual(['birth_date', 'cedula'])
    expect(estaCompleta(c, { ...r, cedula: 'principal', birth_date: 'duplicado' })).toBe(true)
  })
})

describe('combinarTexto', () => {
  it('junta las dos versiones', () => {
    expect(combinarTexto('penicilina', 'polen')).toBe('penicilina · polen')
  })
  it('no repite si una ya contiene a la otra', () => {
    expect(combinarTexto('alergia a la penicilina', 'penicilina')).toBe('alergia a la penicilina')
    expect(combinarTexto('penicilina', 'alergia a la penicilina')).toBe('alergia a la penicilina')
  })
  it('con uno vacío devuelve el otro', () => {
    expect(combinarTexto('', 'polen')).toBe('polen')
    expect(combinarTexto('polen', null)).toBe('polen')
  })
})

describe('valoresAAplicar', () => {
  const p = ficha({ last_name: 'Murillo', allergies: null, occupation: 'Ing', cedula: '111' })
  const d = ficha({ last_name: 'Murillo Sanchez', allergies: 'penicilina', occupation: 'Prof', cedula: '222' })
  const c = clasificarCampos(p, d)

  it('se lleva el valor elegido en cada conflicto', () => {
    const v = valoresAAplicar(c, { last_name: 'duplicado', occupation: 'principal', cedula: 'principal' }, p, d)
    expect(v.last_name).toBe('Murillo Sanchez')
    expect(v.occupation).toBe('Ing')
  })
  it('y también lo que solo tenía el duplicado, sin que nadie lo elija', () => {
    const v = valoresAAplicar(c, {}, p, d)
    expect(v.allergies).toBe('penicilina')
  })
  it('un conflicto sin decidir no se escribe', () => {
    const v = valoresAAplicar(c, {}, p, d)
    expect('cedula' in v).toBe(false)
  })
  it('"combinado" concatena los dos', () => {
    const p2 = ficha({ allergies: 'polen' }), d2 = ficha({ allergies: 'penicilina' })
    const c2 = clasificarCampos(p2, d2)
    expect(valoresAAplicar(c2, { allergies: 'combinado' }, p2, d2).allergies).toBe('polen · penicilina')
  })
})

describe('cuentas de acceso', () => {
  const conCuenta = (o: Record<string, unknown>) => ficha({ auth_user_id: 'u', ...o })

  it('sin dos cuentas no hay aviso', () => {
    expect(avisoDeCuentas(conCuenta({}), ficha({ auth_user_id: null }))).toBeNull()
  })
  it('con dos cuentas avisa cuál se deshabilita', () => {
    const a = avisoDeCuentas(
      conCuenta({ email: 'mchavesa28@hotmail.com', last_sign_in_at: '2026-09-11' }),
      conCuenta({ email: 'marchaari@gmail.com', last_sign_in_at: null }))
    expect(a).toMatchObject({ hayDos: true, correoQueSeVa: 'marchaari@gmail.com', laQueSeVaEsLaQueUsan: false })
  })
  it('avisa fuerte si la que se va es la que la persona USA', () => {
    // Señal de que el principal está mal elegido: dejaría a la persona afuera.
    const a = avisoDeCuentas(
      conCuenta({ email: 'vieja@x.com', last_sign_in_at: '2024-01-01' }),
      conCuenta({ email: 'nueva@x.com', last_sign_in_at: '2026-09-11' }))
    expect(a?.laQueSeVaEsLaQueUsan).toBe(true)
  })
  it('si la que se va nunca se usó y la otra tampoco, no alarma', () => {
    const a = avisoDeCuentas(conCuenta({ last_sign_in_at: null }), conCuenta({ last_sign_in_at: null }))
    expect(a?.laQueSeVaEsLaQueUsan).toBe(false)
  })
})

describe('el correo del login sigue al correo elegido', () => {
  const p = ficha({ auth_user_id: 'u', email: 'login@x.com' })
  const d = ficha({ auth_user_id: null, email: 'perfil@x.com' })

  it('si se elige el correo del duplicado, la cuenta se muda a ese correo', () => {
    // Un perfil, un correo: que el perfil diga uno y el login pida otro es una
    // trampa que la persona no tiene cómo descubrir.
    expect(correoFinalDeLogin(p, d, { email: 'duplicado' } as Resolucion))
      .toEqual({ mudar: true, a: 'perfil@x.com', desde: 'login@x.com' })
  })
  it('si se queda el del principal, no se muda nada', () => {
    expect(correoFinalDeLogin(p, d, { email: 'principal' } as Resolucion)).toEqual({ mudar: false })
  })
  it('si son el mismo correo, tampoco', () => {
    const d2 = ficha({ email: 'LOGIN@x.com' })
    expect(correoFinalDeLogin(p, d2, { email: 'duplicado' } as Resolucion)).toEqual({ mudar: false })
  })
  it('sin cuenta en el principal no hay login que mudar', () => {
    expect(correoFinalDeLogin(ficha({ email: 'a@x.com' }), d, { email: 'duplicado' } as Resolucion)).toEqual({ mudar: false })
  })
})

describe('principalSugerido', () => {
  const usada = (o = {}) => ficha({ auth_user_id: 'u', last_sign_in_at: '2026-09-08', ...o })
  const nuncaUsada = (o = {}) => ficha({ auth_user_id: 'u', last_sign_in_at: null, ...o })

  it('gana la ficha cuya cuenta SÍ se usa, venga en el orden que venga', () => {
    // El caso Ximena: la cuenta que ella usa estaba en la ficha que parecía la
    // secundaria. Dejarla de secundaria le apaga el login que ocupa.
    expect(principalSugerido(nuncaUsada({ id: 'a' }), usada({ id: 'b' })).principal.id).toBe('b')
    expect(principalSugerido(usada({ id: 'a' }), nuncaUsada({ id: 'b' })).principal.id).toBe('a')
  })
  it('y explica por qué la eligió', () => {
    expect(principalSugerido(nuncaUsada(), usada()).porQue).toContain('se usa para entrar')
  })
  it('si las dos se usaron, no inventa: decide la persona', () => {
    const r = principalSugerido(usada({ id: 'a' }), usada({ id: 'b' }))
    expect(r.principal.id).toBe('a')
    expect(r.porQue).toBeNull()
  })
  it('si ninguna se usó, tampoco', () => {
    expect(principalSugerido(nuncaUsada({ id: 'a' }), nuncaUsada({ id: 'b' })).porQue).toBeNull()
  })
  it('una ficha sin cuenta no cuenta como usada', () => {
    expect(principalSugerido(ficha({ id: 'a' }), usada({ id: 'b' })).principal.id).toBe('b')
  })
})
