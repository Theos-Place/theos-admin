import { describe, it, expect } from 'vitest'
import { usuarioDelCorreo, correoPareceDeLaPersona, deQuienEsElCorreo } from './correo-de-quien'

describe('usuarioDelCorreo', () => {
  it('se queda con las letras de antes del @', () => {
    expect(usuarioDelCorreo('andres.herreram1802@gmail.com')).toBe('andresherreram')
    expect(usuarioDelCorreo('Katmiranda_18@hotmail.com')).toBe('katmiranda')
    expect(usuarioDelCorreo(null)).toBe('')
  })
})

describe('correoPareceDeLaPersona', () => {
  it('reconoce el correo propio, con tildes o sin ellas', () => {
    expect(correoPareceDeLaPersona('andres.herreram1802@gmail.com', 'Andrés')).toBe(true)
    expect(correoPareceDeLaPersona('mariajesussaborio@gmail.com', 'María Jesús')).toBe(true)
    expect(correoPareceDeLaPersona('eugeniotrejos@yahoo.com', 'Eugenio')).toBe(true)
  })

  it('el correo de la mamá NO parece del hijo, ni aunque compartan APELLIDO', () => {
    // cristellopeztorres@ lleva "lopez", y la niña es Camilia Sanabria LOPEZ.
    // Con el apellido contando, el correo de la mamá pasaría por propio y se
    // le borraría a la niña el único contacto que tiene.
    expect(correoPareceDeLaPersona('cristellopeztorres@gmail.com', 'Camilia')).toBe(false)
    expect(correoPareceDeLaPersona('carlosandresb@gmail.com', 'Alana')).toBe(false)
  })

  it('no se conforma con tres letras: "ana" está dentro de demasiadas palabras', () => {
    // Sin el mínimo, "mariana@" daría por suya la ficha de una Ana cualquiera.
    expect(correoPareceDeLaPersona('marianaquiros@gmail.com', 'Ana')).toBe(false)
  })

  it('un correo sin letras útiles no prueba nada', () => {
    expect(correoPareceDeLaPersona('123@gmail.com', 'Ana')).toBe(false)
    expect(correoPareceDeLaPersona('', 'Ana')).toBe(false)
  })
})

describe('deQuienEsElCorreo', () => {
  it('correo propio → lo que está mal es la fecha', () => {
    expect(deQuienEsElCorreo({
      email: 'eugeniotrejos@yahoo.com', first_name: 'Eugenio', last_name: 'Trejos',
    })).toBe('la_fecha_esta_mal')
  })

  it('correo de un adulto identificado → prestado, falta la familia', () => {
    expect(deQuienEsElCorreo({
      email: 'cristellopeztorres@gmail.com', first_name: 'Camilia', last_name: 'Sanabria Lopez',
      adultoConElMismoCorreo: 'Cristel Lopez Torres',
    })).toBe('correo_prestado')
  })

  it('el teléfono compartido basta aunque el correo no calce con nadie', () => {
    expect(deQuienEsElCorreo({
      email: 'aurahernandezramos9@gmail.com', first_name: 'Samuel', last_name: 'Obando Bojorge',
      adultoConElMismoTelefono: 'Aura Hernández',
    })).toBe('correo_prestado')
  })

  it('sin ninguna pista, a mano — no se inventa', () => {
    expect(deQuienEsElCorreo({
      email: 'otracosa@gmail.com', first_name: 'Ana', last_name: 'Mora',
    })).toBe('a_mano')
  })

  it('el correo propio manda aunque además comparta teléfono con un adulto', () => {
    // Un adulto con la fecha mal puede compartir el teléfono de la casa. Si el
    // correo es suyo, quitárselo lo dejaría incomunicado.
    expect(deQuienEsElCorreo({
      email: 'eugeniotrejos@yahoo.com', first_name: 'Eugenio', last_name: 'Trejos',
      adultoConElMismoTelefono: 'Otro Trejos',
    })).toBe('la_fecha_esta_mal')
  })
})
