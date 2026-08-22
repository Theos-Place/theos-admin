import { describe, it, expect } from 'vitest'
import { fieldA11y } from './field-a11y'

describe('fieldA11y', () => {
  it('ata label, input y error con el mismo nombre', () => {
    const a = fieldA11y('cedula', 'Falta la cédula')
    expect(a.labelFor).toBe(a.input.id)
    expect(a.input['aria-describedby']).toBe(a.error.id)
    expect(a.error.id).toBe('f-cedula-error')
  })

  it('con error, marca el input como inválido', () => {
    const a = fieldA11y('cedula', 'Falta la cédula')
    expect(a.input['aria-invalid']).toBe(true)
    expect(a.error.role).toBe('alert')
  })

  // El detalle que importa: undefined, no false ni ''. Un aria-invalid="false"
  // es ruido, y un aria-describedby que apunta a la nada hace que algunos
  // lectores anuncien vacío.
  it('sin error, los aria no se emiten', () => {
    for (const e of [undefined, null, '', '   ']) {
      const a = fieldA11y('cedula', e)
      expect(a.input['aria-invalid']).toBeUndefined()
      expect(a.input['aria-describedby']).toBeUndefined()
    }
  })

  it('required se declara aparte del error', () => {
    expect(fieldA11y('x', null, { required: true }).input['aria-required']).toBe(true)
    expect(fieldA11y('x', null).input['aria-required']).toBeUndefined()
    // Un campo obligatorio SIN error sigue siendo obligatorio.
    const a = fieldA11y('x', null, { required: true })
    expect(a.input['aria-invalid']).toBeUndefined()
    expect(a.input['aria-required']).toBe(true)
  })

  it('dos campos distintos no chocan de id', () => {
    expect(fieldA11y('cedula').input.id).not.toBe(fieldA11y('correo').input.id)
  })

  it('el id del error siempre existe, aunque no haya error', () => {
    // Así el markup puede escribir {...a11y.error} sin condicionales raros.
    expect(fieldA11y('x').error.id).toBe('f-x-error')
  })
})

describe('opts.id respeta ids que ya existen', () => {
  it('usa el id dado en vez de generarlo', () => {
    const a = fieldA11y('correo', 'mal', { id: 'login-identifier' })
    expect(a.input.id).toBe('login-identifier')
    expect(a.labelFor).toBe('login-identifier')
    expect(a.error.id).toBe('login-identifier-error')
    expect(a.input['aria-describedby']).toBe('login-identifier-error')
  })

  // Cambiar el id de un input de login rompe el autocompletado: el navegador y
  // el gestor de contraseñas se acuerdan del campo por su id.
  it('sin opts.id genera uno con prefijo', () => {
    expect(fieldA11y('correo').input.id).toBe('f-correo')
  })
})
