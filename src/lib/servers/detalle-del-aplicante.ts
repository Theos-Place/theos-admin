/**
 * SRV-14 · El detalle de quien aplicó, en un solo lugar.
 *
 * POR QUÉ ES UN MÓDULO Y NO UN `select` suelto: el MISMO detalle se usa en
 * tres salidas —el PDF que se descarga, el correo al encargado del puesto y
 * el aviso a RH— y si cada una lo armara por su cuenta, el encargado y el PDF
 * dirían cosas distintas de la misma persona. Eso es peor que no tener PDF.
 *
 * QUÉ LLEVA (dictado el 2026-09-25): nombre y apellidos, teléfono, correo, el
 * último estudio que llevó con su dirigente, y el TELÉFONO DEL DIRIGENTE. Ese
 * último es el punto de todo: el encargado llama al dirigente para preguntar
 * por la persona antes de recibirla.
 *
 * Módulo PURO: arma el texto. Quien lee la base es la query.
 */

export type DetalleDelAplicante = {
  nombre: string
  telefono: string | null
  correo: string | null
  puesto: string
  comite: string
  /** El último estudio que llevó, ya resuelto. */
  ultimoEstudio: string | null
  dirigente: string | null
  telefonoDirigente: string | null
}

const SIN_DATO = 'No registrado'
const v = (s: string | null | undefined) => (s?.trim() ? s.trim() : SIN_DATO)

/**
 * El nombre del archivo: «[puesto] - [persona]», como se pidió.
 *
 * Se limpia lo que rompe un nombre de archivo (`/ \ : * ? " < > |`) y se
 * colapsan los espacios. Sin esto, un puesto llamado «Logística / Montaje»
 * generaría una ruta y la descarga saldría con un nombre raro o fallaría.
 */
export function nombreDelArchivo(puesto: string, persona: string): string {
  const limpio = (s: string) => s.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
  return `${limpio(puesto)} - ${limpio(persona)}.pdf`
}

/** Las líneas del detalle, en orden. Las comparten el PDF y los correos. */
export function lineasDelDetalle(d: DetalleDelAplicante): Array<[string, string]> {
  return [
    ['Nombre', v(d.nombre)],
    ['Teléfono', v(d.telefono)],
    ['Correo', v(d.correo)],
    ['Puesto al que aplicó', v(d.puesto)],
    ['Comité', v(d.comite)],
    ['Último estudio', v(d.ultimoEstudio)],
    ['Dirigente de ese estudio', v(d.dirigente)],
    // El dato por el que existe esta hoja: el encargado llama al dirigente
    // antes de recibir a la persona.
    ['Teléfono del dirigente', v(d.telefonoDirigente)],
  ]
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** El mismo detalle, como tabla para el cuerpo del correo. */
export function detalleEnHtml(d: DetalleDelAplicante): string {
  const filas = lineasDelDetalle(d)
    .map(([k, val]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${esc(k)}</td>`
      + `<td style="padding:4px 0"><strong>${esc(val)}</strong></td></tr>`)
    .join('')
  return `<table style="border-collapse:collapse;font-size:14px">${filas}</table>`
}
