import { describe, it, expect } from 'vitest'
import { ranurasDeImagen, reemplazarImagenDeRanura, tamanoRecomendado } from './ranuras-de-imagen'

const BOLETIN = `<table><tr><td style="padding:0 24px;">
<img alt="Actividades del mes" src="https://x.supabase.co/storage/v1/object/public/email-images/1.jpg" style="width:100%; max-width:520px;" width="520" data-imagen-slot="principal" />
<p>Hola {{nombre}}</p>
<img src="https://x/logo.png" alt="logo" width="80" />
</td></tr></table>`

describe('COM-5 · ranurasDeImagen', () => {
  it('encuentra solo las imágenes marcadas, con src, alt y ancho', () => {
    expect(ranurasDeImagen(BOLETIN)).toEqual([
      { slot: 'principal', src: 'https://x.supabase.co/storage/v1/object/public/email-images/1.jpg', alt: 'Actividades del mes', width: 520 },
    ])
  })
  it('sin marca no hay ranuras (y el panel no se muestra)', () => {
    expect(ranurasDeImagen('<p>Hola</p><img src="a.png" />')).toEqual([])
    expect(ranurasDeImagen('')).toEqual([])
  })
  it('acepta comillas simples y el atributo en cualquier posición', () => {
    expect(ranurasDeImagen(`<img data-imagen-slot='pie' src='p.png'>`)[0]).toMatchObject({ slot: 'pie', src: 'p.png', width: null })
  })
})

describe('COM-5 · reemplazarImagenDeRanura', () => {
  it('cambia SOLO el src de la ranura; el resto queda byte-idéntico', () => {
    const nuevo = reemplazarImagenDeRanura(BOLETIN, 'principal', 'https://x/nueva.jpg')
    expect(nuevo).not.toBe(BOLETIN)
    expect(nuevo.replace('https://x/nueva.jpg', 'https://x.supabase.co/storage/v1/object/public/email-images/1.jpg')).toBe(BOLETIN)
    expect(ranurasDeImagen(nuevo)[0].src).toBe('https://x/nueva.jpg')
    // La otra imagen (sin marca) no se toca.
    expect(nuevo).toContain('src="https://x/logo.png"')
  })
  it('una ranura que no existe deja el HTML igual', () => {
    expect(reemplazarImagenDeRanura(BOLETIN, 'otra', 'https://x/n.jpg')).toBe(BOLETIN)
  })
  it('sin src previo lo agrega; escapa comillas en la URL', () => {
    expect(reemplazarImagenDeRanura('<img data-imagen-slot="a" alt="x">', 'a', 'u"v')).toBe('<img src="u&quot;v" data-imagen-slot="a" alt="x">')
  })
  it('el tamaño recomendado sale del ancho declarado', () => {
    expect(tamanoRecomendado({ width: 520 })).toContain('520 px de ancho')
    expect(tamanoRecomendado({ width: null })).toBe('JPG o PNG, hasta 2 MB.')
  })
})
