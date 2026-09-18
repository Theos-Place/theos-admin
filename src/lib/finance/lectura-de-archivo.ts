/**
 * DON-1 · Del archivo a filas, sin pedirle a nadie que lo prepare.
 *
 * CSV se parsea acá; XLSX se carga bajo demanda porque la librería pesa ~400 KB
 * y no tiene por qué viajar en el bundle de quien nunca importa un Excel.
 */
import { detectarColumnas, type ColumnaDonacion } from './columnas-de-donaciones'

export type FilaCruda = Record<ColumnaDonacion, string>

/** Parser CSV que respeta comas entre comillas y comillas escapadas (""). */
export function partirCSV(texto: string): string[][] {
  const filas: string[][] = []
  let campo = '', fila: string[] = [], enComillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (enComillas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++ } else enComillas = false }
      else campo += c
    } else if (c === '"') enComillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = '' }
    else if (c !== '\r') campo += c
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila) }
  return filas.filter(f => f.some(x => x.trim() !== ''))
}

/**
 * La primera fila con contenido real es el encabezado.
 *
 * NO se asume que sea la fila 1: los exports traen título y filas en blanco
 * arriba —el del campa tenía el encabezado en la quinta— y leer la primera a
 * ciegas deja todas las columnas sin reconocer.
 */
export function filaDelEncabezado(matriz: string[][]): number {
  for (let i = 0; i < Math.min(matriz.length, 20); i++) {
    const llenas = matriz[i].filter(c => String(c ?? '').trim() !== '').length
    if (llenas >= 2) return i
  }
  return 0
}

export function aFilas(
  matriz: string[][], mapa: Record<ColumnaDonacion, number | null>, desde: number,
): FilaCruda[] {
  const col = (f: string[], c: ColumnaDonacion) => {
    const i = mapa[c]
    return i === null || i === undefined ? '' : String(f[i] ?? '').trim()
  }
  return matriz.slice(desde + 1).map(f => ({
    cedula: col(f, 'cedula'), nombre: col(f, 'nombre'), fecha: col(f, 'fecha'),
    monto: col(f, 'monto'), moneda: col(f, 'moneda'), nota: col(f, 'nota'),
  })).filter(f => Object.values(f).some(v => v !== ''))
}

/** Lee el archivo y devuelve la matriz + el mapeo detectado, para confirmarlo. */
export async function leerArchivoDeDonaciones(file: File): Promise<{
  matriz: string[][]
  encabezado: number
  mapa: Record<ColumnaDonacion, number | null>
}> {
  let matriz: string[][]
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    matriz = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], {
      header: 1, defval: '', raw: false, blankrows: false,
    })
  } else {
    matriz = partirCSV(await file.text())
  }
  const encabezado = filaDelEncabezado(matriz)
  return { matriz, encabezado, mapa: detectarColumnas(matriz[encabezado] ?? []) }
}
