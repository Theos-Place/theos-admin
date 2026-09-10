import { describe, it, expect } from 'vitest'
import { cuentasSinFicha, textoDelAviso } from './cuentas-sin-ficha'

const ficha = (id: string, nombre: string, email: string, auth: string | null = null) =>
  ({ id, nombre, email, auth_user_id: auth })

describe('cuentasSinFicha', () => {
  it('el caso de Gabriel: dos fichas con el mismo correo y la cuenta sin atar', () => {
    const r = cuentasSinFicha(
      [{ id: 'auth-1', email: 'gabriel@x.cr' }],
      [ficha('a', 'Gabriel (activa)', 'gabriel@x.cr'), ficha('b', 'Gabriel (inactiva)', 'gabriel@x.cr')],
    )
    expect(r).toHaveLength(1)
    expect(r[0].causa).toBe('correo_compartido')
    expect(r[0].quehacer).toContain('fusionalas')
    expect(r[0].fichas.map(f => f.nombre)).toEqual(['Gabriel (activa)', 'Gabriel (inactiva)'])
  })

  it('una ficha sola sin enlazar es el caso fácil', () => {
    const r = cuentasSinFicha([{ id: 'auth-1', email: 'ana@x.cr' }], [ficha('a', 'Ana', 'ana@x.cr')])
    expect(r[0].causa).toBe('sin_ficha')
    expect(r[0].quehacer).toContain('Se enlaza y listo')
  })

  it('una cuenta YA enlazada no se reporta', () => {
    expect(cuentasSinFicha(
      [{ id: 'auth-1', email: 'ana@x.cr' }],
      [ficha('a', 'Ana', 'ana@x.cr', 'auth-1')],
    )).toEqual([])
  })

  it('una cuenta sin NINGUNA ficha no es un problema: todavía no está en el padrón', () => {
    expect(cuentasSinFicha([{ id: 'auth-1', email: 'nadie@x.cr' }], [])).toEqual([])
  })

  it('no le importan las mayúsculas ni los espacios del correo', () => {
    expect(cuentasSinFicha(
      [{ id: 'auth-1', email: '  Ana@X.CR ' }],
      [ficha('a', 'Ana', 'ana@x.cr')],
    )).toHaveLength(1)
  })

  it('una familia que comparte correo Y ya tiene su cuenta atada no se reporta', () => {
    expect(cuentasSinFicha(
      [{ id: 'auth-1', email: 'casa@x.cr' }],
      [ficha('a', 'Mamá', 'casa@x.cr', 'auth-1'), ficha('b', 'Hija', 'casa@x.cr')],
    )).toEqual([])
  })
})

describe('textoDelAviso', () => {
  it('sin casos no se avisa nada', () => {
    expect(textoDelAviso([])).toBeNull()
  })

  it('dice cuántas son y de qué tipo', () => {
    const casos = cuentasSinFicha(
      [{ id: '1', email: 'a@x.cr' }, { id: '2', email: 'b@x.cr' }],
      [ficha('a', 'Ana', 'a@x.cr'), ficha('b1', 'Beto', 'b@x.cr'), ficha('b2', 'Beto dup', 'b@x.cr')],
    )
    const t = textoDelAviso(casos)!
    expect(t).toContain('2 personas entran sin perfil')
    expect(t).toContain('1 cuenta sin enlazar')
    expect(t).toContain('1 con el correo repartido')
  })
})
