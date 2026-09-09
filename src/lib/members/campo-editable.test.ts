import { describe, it, expect } from 'vitest'
import { editabilidadDeCampo } from './campo-editable'
import { PERSONAL_DATA_FIELDS } from '@/data/form-config'

const sinDoc = { tieneDocumento: false }
const conDoc = { tieneDocumento: true }

describe('qué se edita en sitio desde el formulario', () => {
  it('los datos de contacto, salud y trabajo sí', () => {
    for (const clave of ['phone', 'address', 'allergies', 'occupation', 'workplace',
      'emergency_contact_name', 'emergency_contact_phone']) {
      expect(editabilidadDeCampo(clave, conDoc).editable, clave).toBe(true)
    }
  })

  it('el correo NO, y sin cartel: no lleva lápiz y ya', () => {
    expect(editabilidadDeCampo('email', conDoc)).toEqual({ editable: false, motivo: null })
  })

  it('nombre, edad, género y estado civil tampoco', () => {
    for (const clave of ['full_name', 'age', 'gender', 'marital_status']) {
      expect(editabilidadDeCampo(clave, conDoc).editable, clave).toBe(false)
    }
  })

  it('la cédula: se completa si falta, no se cambia si ya está', () => {
    expect(editabilidadDeCampo('cedula', sinDoc)).toEqual({ editable: true, columna: 'cedula', tipo: 'texto' })
    const conYa = editabilidadDeCampo('cedula', conDoc)
    expect(conYa.editable).toBe(false)
    expect(conYa.editable === false && conYa.motivo).toMatch(/pedilo en tu sede/)
  })

  it('el teléfono se marca como teléfono, y la dirección como párrafo', () => {
    const tel = editabilidadDeCampo('phone', conDoc)
    expect(tel.editable === true && tel.tipo).toBe('telefono')
    const dir = editabilidadDeCampo('address', conDoc)
    expect(dir.editable === true && dir.tipo).toBe('parrafo')
  })

  it('una clave desconocida no revienta ni se ofrece', () => {
    expect(editabilidadDeCampo('columna_inventada', conDoc)).toEqual({ editable: false, motivo: null })
  })

  it('todas las claves del catálogo tienen una respuesta', () => {
    // Si mañana alguien agrega un campo al catálogo, este test no falla — pero
    // deja constancia de cuáles quedan sin editar, que es la decisión.
    const noEditables = PERSONAL_DATA_FIELDS
      .filter(f => !editabilidadDeCampo(f.key, conDoc).editable)
      .map(f => f.key)
      .sort()
    expect(noEditables).toEqual(['age', 'cedula', 'email', 'full_name', 'gender', 'marital_status'])
  })
})
