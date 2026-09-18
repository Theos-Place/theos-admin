/**
 * DON-1 · Reconocer las columnas del archivo sin pedirle a nadie que lo prepare.
 *
 * Los reportes llegan como los exporta cada banco: "Fecha"/"Fecha de
 * transacción", "Cliente"/"Nombre"/"Detalle del cliente", "Notas"/"Descripción".
 * Obligar a renombrar encabezados antes de subir es justamente lo que hace que
 * el archivo se edite a mano y se rompa.
 *
 * Se elige por PALABRA CONTENIDA y en orden de preferencia: gana el encabezado
 * más específico. El mapeo detectado se le muestra a la persona para confirmar,
 * así que equivocarse acá no importa mientras sea visible.
 */
export type ColumnaDonacion = 'fecha' | 'nombre' | 'cedula' | 'monto' | 'moneda' | 'nota'

/** Orden = preferencia. El primero que aparezca en el encabezado gana. */
const PISTAS: Record<ColumnaDonacion, string[]> = {
  cedula: ['cedula', 'cédula', 'identificacion', 'identificación', 'documento', 'id cliente'],
  fecha: ['fecha de transaccion', 'fecha de transacción', 'fecha', 'date'],
  nombre: ['nombre del cliente', 'detalle del cliente', 'cliente', 'nombre', 'donante', 'name'],
  monto: ['monto', 'importe', 'credito', 'crédito', 'amount', 'valor'],
  moneda: ['moneda', 'currency', 'divisa'],
  nota: ['nota', 'notas', 'descripcion', 'descripción', 'detalle', 'concepto', 'referencia'],
}

const norm = (s: string) => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * @param encabezados los de la primera fila, en orden.
 * @returns qué índice usar para cada columna; `null` si no se reconoció.
 *
 * Una columna ya tomada no se reasigna: sin eso, "Fecha" y "Fecha de
 * transacción" en el mismo archivo caerían las dos en `fecha` y una quedaría
 * sin usar mientras otra columna se queda sin candidato.
 */
export function detectarColumnas(
  encabezados: readonly string[],
): Record<ColumnaDonacion, number | null> {
  const limpios = encabezados.map(norm)
  const usados = new Set<number>()
  const salida = {} as Record<ColumnaDonacion, number | null>

  // `cedula` primero: es la columna que más cambia el resultado del cruce, y
  // "id cliente" podría confundirse con otras si se resolviera al final.
  const orden: ColumnaDonacion[] = ['cedula', 'fecha', 'monto', 'moneda', 'nombre', 'nota']
  for (const col of orden) {
    let elegido: number | null = null
    for (const pista of PISTAS[col]) {
      const i = limpios.findIndex((h, idx) => !usados.has(idx) && h.includes(pista))
      if (i >= 0) { elegido = i; break }
    }
    if (elegido !== null) usados.add(elegido)
    salida[col] = elegido
  }
  return salida
}

/** ¿Alcanza para intentar la importación? Sin fecha no hay donación, y sin
 *  nombre ni cédula no hay a quién asignarla. */
export function columnasSuficientes(m: Record<ColumnaDonacion, number | null>): boolean {
  return m.fecha !== null && (m.nombre !== null || m.cedula !== null)
}

/** Una fecha como la escriben los bancos → 'YYYY-MM-DD', o null.
 *
 *  Se acepta 'DD/MM/YYYY' además del ISO. NO se acepta 'MM/DD/YYYY': con los
 *  dos formatos vivos no hay forma de distinguir 03/04 y elegir mal cambia la
 *  fecha de la donación sin avisar. Un archivo en formato gringo va a dar
 *  fechas inválidas (día > 12) y eso se ve en la vista previa. */
export function fechaDeReporte(valor: unknown): string | null {
  const s = String(valor ?? '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s)
  if (m) {
    const [, d, mes, a] = m
    if (Number(mes) > 12 || Number(d) > 31) return null
    return `${a}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

/** Un monto como lo escribe un banco: "₡50 000,00", "50,000.00", "1.234,56". */
export function montoDeReporte(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  let s = String(valor).replace(/[^\d.,-]/g, '').trim()
  if (!s) return null
  // El separador DECIMAL es el último punto o coma que quede; lo demás son
  // separadores de miles. Así "1.234,56" y "1,234.56" dan lo mismo.
  const ultimoPunto = s.lastIndexOf('.'), ultimaComa = s.lastIndexOf(',')
  const decimal = Math.max(ultimoPunto, ultimaComa)
  if (decimal >= 0) {
    s = s.slice(0, decimal).replace(/[.,]/g, '') + '.' + s.slice(decimal + 1).replace(/[.,]/g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
