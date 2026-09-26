import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { SaxesParser } from 'saxes'
import {
  construirDocxDeAplicante, nombreDelDocx, DOCX_CONTENT_TYPE,
} from './docx-de-aplicante'
import type { DetalleDelAplicante } from './detalle-del-aplicante'

const base: DetalleDelAplicante = {
  nombre: 'Ana Rojas', telefono: '8888-8888', correo: 'ana@x.cr',
  puesto: 'Logística', comite: 'Sede Escazú',
  ultimoEstudio: 'Nivel 4', dirigente: 'Beto Mora', telefonoDirigente: '7777-7777',
}

/**
 * Un parser de XML de verdad y no un regex: `saxes` viene con ExcelJS y es
 * el mismo que usa para leer hojas. Si el XML está mal armado, tira — que es
 * exactamente lo que hace Word, solo que Word dice «el archivo está dañado»
 * y no dice dónde.
 */
function xmlValido(xml: string): void {
  const p = new SaxesParser()
  let error: Error | null = null
  p.on('error', e => { error = e })
  p.write(xml).close()
  if (error) throw error
}

/** Abre el .docx DE VERDAD: es un ZIP con XML adentro, y de un archivo
 *  generado, que el código compile no dice nada. */
async function abrir(d: DetalleDelAplicante) {
  const zip = await JSZip.loadAsync(await construirDocxDeAplicante(d))
  const doc = await zip.file('word/document.xml')!.async('string')
  return { zip, doc, archivos: Object.keys(zip.files).sort() }
}

describe('el .docx es un docx de verdad', () => {
  it('trae las tres partes que Word exige', () => {
    // Sin cualquiera de las tres, Word dice que el archivo está dañado y no
    // da ninguna pista de por qué.
    return abrir(base).then(({ archivos }) => {
      expect(archivos).toContain('[Content_Types].xml')
      expect(archivos).toContain('_rels/.rels')
      expect(archivos).toContain('word/document.xml')
    })
  })

  it('el XML es XML válido', async () => {
    // Un `&` sin escapar en un apellido deja el documento ilegible, y el error
    // aparece al abrirlo, no al generarlo.
    const { doc } = await abrir(base)
    expect(() => xmlValido(doc)).not.toThrow()
  })

  it('el content type es el que Word reconoce', () => {
    expect(DOCX_CONTENT_TYPE).toMatch(/wordprocessingml\.document$/)
  })
})

describe('lo que dice adentro', () => {
  it('lleva los datos de la persona', async () => {
    const { doc } = await abrir(base)
    for (const v of ['Ana Rojas', '8888-8888', 'ana@x.cr', 'Logística', 'Nivel 4', 'Beto Mora']) {
      expect(doc, v).toContain(v)
    }
  })

  it('y el TELÉFONO DEL DIRIGENTE, que es el punto de la hoja', async () => {
    const { doc } = await abrir(base)
    expect(doc).toContain('Teléfono del dirigente')
    expect(doc).toContain('7777-7777')
  })

  it('lo que falta dice «No registrado» en vez de quedar en blanco', async () => {
    const { doc } = await abrir({ ...base, telefonoDirigente: null, correo: null })
    expect(doc).toContain('No registrado')
  })
})

describe('lo que rompería el archivo', () => {
  it('un apellido con & no lo arruina', async () => {
    const { doc } = await abrir({ ...base, nombre: 'Ana & Beto' })
    expect(doc).toContain('Ana &amp; Beto')
    expect(() => xmlValido(doc)).not.toThrow()
  })

  it('ni un intento de meter etiquetas', async () => {
    const { doc } = await abrir({ ...base, comite: '</w:t><w:br/>' })
    expect(doc).not.toContain('</w:t><w:br/>')
    expect(() => xmlValido(doc)).not.toThrow()
  })

  it('ni un carácter de control pegado desde otro lado', async () => {
    // XML 1.0 no los admite y Word rechaza el archivo ENTERO.
    const { doc } = await abrir({ ...base, nombre: 'Ana\u0007 Rojas' })
    expect(doc).not.toContain('\u0007')
    expect(() => xmlValido(doc)).not.toThrow()
  })
})

describe('el nombre del archivo', () => {
  it('es «[puesto] - [persona].docx»', () => {
    expect(nombreDelDocx('Logística', 'Ana Rojas')).toBe('Logística - Ana Rojas.docx')
  })

  it('no genera una ruta cuando el puesto trae una barra', () => {
    expect(nombreDelDocx('Logística / Montaje', 'Ana Rojas'))
      .toBe('Logística - Montaje - Ana Rojas.docx')
  })
})
