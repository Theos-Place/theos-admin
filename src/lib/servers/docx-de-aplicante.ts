import JSZip from 'jszip'
import {
  lineasDelDetalle, nombreDelArchivo, type DetalleDelAplicante,
} from '@/lib/servers/detalle-del-aplicante'

/**
 * SRV-14 · La hoja de quien aplicó, para descargar.
 *
 * POR QUÉ .docx Y NO PDF (decisión del 2026-09-25, con el usuario):
 *
 *  · EL TELÉFONO SE TIENE QUE PODER COPIAR. Esta hoja existe para que el
 *    encargado llame al dirigente y pregunte por la persona antes de
 *    recibirla. En una imagen ese número hay que teclearlo mirando la
 *    pantalla — por eso la imagen quedó descartada de entrada.
 *  · NO AGREGA NADA AL PROYECTO. Un .docx es un ZIP con tres XML adentro, y el
 *    comprimidor (`jszip`) ya venía instalado con ExcelJS. Un PDF habría
 *    necesitado una librería nueva de ~2 MB, o escribir el formato a mano, que
 *    con acentos y métricas de fuente es la clase de cleverness que se rompe.
 *  · Y SE PUEDE EDITAR: el encargado anota ahí mismo lo que le dijeron. Si
 *    alguien quiere PDF, Word lo exporta.
 *
 * EL CONTENIDO NO SE ESCRIBE ACÁ: sale de `lineasDelDetalle`, el mismo módulo
 * que arma el correo al encargado. Si fueran dos, la hoja y el correo dirían
 * cosas distintas de la misma persona, que es peor que no tener hoja.
 *
 * Módulo PURO: recibe el detalle y devuelve el archivo.
 */

/** Escapa lo que rompe un XML. Va sobre TODO lo que venga de la base: un
 *  apellido con «&» deja el documento ilegible para Word, que no perdona. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Los caracteres de control no son válidos en XML 1.0 y Word rechaza el
    // archivo entero si aparecen. Vienen de datos pegados desde otro lado.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

/** Un párrafo. `bold` y `size` en medios puntos, como manda OOXML (28 = 14pt). */
function parrafo(texto: string, opts?: { bold?: boolean; size?: number; espacioAntes?: number }): string {
  const props = [
    opts?.espacioAntes ? `<w:spacing w:before="${opts.espacioAntes}"/>` : '',
  ].join('')
  const runProps = [
    opts?.bold ? '<w:b/>' : '',
    opts?.size ? `<w:sz w:val="${opts.size}"/>` : '',
  ].join('')
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}`
    + `<w:r>${runProps ? `<w:rPr>${runProps}</w:rPr>` : ''}`
    // `xml:space="preserve"` para que Word no se coma los espacios de los
    // valores que terminan o empiezan con uno.
    + `<w:t xml:space="preserve">${esc(texto)}</w:t></w:r></w:p>`
}

function documento(d: DetalleDelAplicante): string {
  const cuerpo = [
    parrafo('Aplicación a un puesto de servicio', { bold: true, size: 32 }),
    parrafo(`${d.puesto} — ${d.comite}`, { size: 24 }),
    ...lineasDelDetalle(d).flatMap(([etiqueta, valor]) => [
      parrafo(etiqueta, { bold: true, size: 20, espacioAntes: 160 }),
      parrafo(valor, { size: 22 }),
    ]),
    parrafo(
      'El teléfono del dirigente está acá para que puedas preguntar por la persona '
      + 'antes de recibirla.',
      { size: 18, espacioAntes: 280 },
    ),
  ].join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${cuerpo}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>
  <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body>
</w:document>`
}

export async function construirDocxDeAplicante(d: DetalleDelAplicante): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.file('_rels/.rels', RELS)
  zip.file('word/document.xml', documento(d))
  // DEFLATE y no STORE: un .docx sin comprimir lo abre Word igual, pero pesa
  // cuatro veces más por nada.
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

/** El nombre del archivo, con la extensión que corresponde. La regla del
 *  nombre —«[puesto] - [persona]»— vive en `detalle-del-aplicante`. */
export function nombreDelDocx(puesto: string, persona: string): string {
  return nombreDelArchivo(puesto, persona).replace(/\.pdf$/, '.docx')
}

export const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
