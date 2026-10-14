/**
 * FIN-11 · Los anexos del expediente, listos para imprimir.
 *
 * El PDF sale del navegador (mismo camino que SRV-14: una hoja con CSS de
 * impresión y `window.print()`, sin librería). Lo que vive acá es QUÉ dice
 * cada anexo, porque la hoja y la pantalla tienen que decir lo mismo: si la
 * hoja armara sus propias líneas, el papel que firma la Junta y lo que se ve
 * en el sistema se irían separando sin que nadie lo note — y el papel es el
 * que queda archivado.
 *
 * Módulo PURO: recibe el expediente ya cargado y devuelve texto.
 */
import { NOMBRE_DEL_RUBRO, subtotal, type Moneda, type Rubro } from './presupuesto'
import { kmDelTramo, type Tramo } from './kilometraje'
import { CAMPOS_DEL_INFORME, type Informe } from './informe'
import type { SaldoDeLiquidacion } from './liquidacion'

export const CODIGO_DEL_ANEXO = {
  solicitud: 'ANX-01',
  presupuesto: 'ANX-02',
  liquidacion: 'ANX-03',
  informe: 'ANX-04',
  bitacora: 'ANX-05',
} as const

export type ClaveDeAnexo = keyof typeof CODIGO_DEL_ANEXO

export const TITULO_DEL_ANEXO: Readonly<Record<ClaveDeAnexo, string>> = {
  solicitud: 'Solicitud de viaje',
  presupuesto: 'Presupuesto',
  liquidacion: 'Liquidación de gastos',
  informe: 'Informe de viaje',
  bitacora: 'Bitácora de kilometraje',
}

/** El orden del expediente impreso: el del reglamento, no el de las fases. */
export const ORDEN_DE_ANEXOS: readonly ClaveDeAnexo[] =
  ['solicitud', 'presupuesto', 'liquidacion', 'bitacora', 'informe']

/** Lo mínimo del expediente que la hoja necesita. */
export type ExpedienteParaImprimir = {
  destino: string
  tipo: string
  alcance: string
  sale_at: string
  vuelve_at: string
  acompanantes: string | null
  objetivo: string
  agenda: string | null
  beneficio: string | null
  resultado_esperado: string | null
  financiamiento: string | null
  centro_costo: string | null
  anticipo_monto: number | null
  anticipo_moneda: Moneda | null
  anticipo_recibido_monto: number | null
  anticipo_recibido_moneda: Moneda | null
  monto_maximo_politica: number | null
  notas_finanzas: string | null
  notas_liquidacion: string | null
  lineas: Array<{ rubro: Rubro; descripcion?: string | null; cantidad: number; tarifa: number; moneda: Moneda }>
  gastos: Array<{
    fecha: string; rubro: Rubro; proveedor?: string | null
    numero_comprobante?: string | null; monto: number; moneda: Moneda
    receipt_path?: string | null; sin_comprobante_motivo: string | null
  }>
  saldos: SaldoDeLiquidacion[]
  tramos: Tramo[]
  km_totales: number
  km_tarifa: number
  km_moneda: Moneda
  aprobacion_jefe_path: string | null
  informe: Informe
  informe_archivos: Array<{ nombre: string }>
}

export type FilaDeTabla = { celdas: string[]; esTotal?: boolean }
export type BloqueDeAnexo =
  | { tipo: 'datos'; filas: Array<[string, string]> }
  | { tipo: 'texto'; etiqueta: string; valor: string }
  | { tipo: 'tabla'; encabezados: string[]; filas: FilaDeTabla[] }

export type AnexoImpreso = {
  clave: ClaveDeAnexo
  codigo: string
  titulo: string
  bloques: BloqueDeAnexo[]
}

const SIN_DATO = '—'
const v = (x: string | null | undefined) => (x ?? '').trim() || SIN_DATO

/**
 * El dinero del papel.
 *
 * No usa `formatMoney` del sistema a propósito: aquel usa `Intl` con el
 * locale del navegador, y en una hoja que se archiva el separador de miles
 * no puede depender de la computadora desde la que se imprimió.
 */
export function plata(monto: number, moneda: Moneda): string {
  const n = Math.round(Number(monto || 0) * 100) / 100
  const [entero, dec] = n.toFixed(moneda === 'USD' ? 2 : 0).split('.')
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return moneda === 'USD' ? `$${conPuntos}${dec ? ',' + dec : ''}` : `₡${conPuntos}`
}

/** `2026-11-03T06:00:00Z` → `3 nov 2026`. Sin zona: el string manda. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return SIN_DATO
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return SIN_DATO
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']
  return `${Number(m[3])} ${meses[Number(m[2]) - 1]} ${m[1]}`
}

/** ¿Este anexo tiene algo que imprimir? Uno vacío no se imprime. */
export function anexoTieneContenido(e: ExpedienteParaImprimir, clave: ClaveDeAnexo): boolean {
  if (clave === 'solicitud') return true
  if (clave === 'presupuesto') return e.lineas.length > 0
  if (clave === 'liquidacion') return e.gastos.length > 0
  if (clave === 'bitacora') return e.tramos.length > 0
  return CAMPOS_DEL_INFORME.some(c => (e.informe[c.campo] ?? '').trim())
    || e.informe_archivos.length > 0
}

export function armarAnexo(e: ExpedienteParaImprimir, clave: ClaveDeAnexo): AnexoImpreso {
  const base = { clave, codigo: CODIGO_DEL_ANEXO[clave], titulo: TITULO_DEL_ANEXO[clave] }

  if (clave === 'solicitud') {
    return {
      ...base,
      bloques: [
        {
          tipo: 'datos',
          filas: [
            ['Destino', v(e.destino)],
            ['Tipo', e.tipo === 'trabajo' ? 'Trabajo' : 'Capacitación'],
            ['Alcance', e.alcance === 'nacional' ? 'Nacional' : 'Internacional'],
            ['Sale', fechaCorta(e.sale_at)],
            ['Vuelve', fechaCorta(e.vuelve_at)],
            ['Acompañantes', v(e.acompanantes)],
            ['Fuente de financiamiento', v(e.financiamiento)],
            ['Centro de costo', v(e.centro_costo)],
            ['Anticipo solicitado', e.anticipo_monto != null && e.anticipo_moneda
              ? plata(e.anticipo_monto, e.anticipo_moneda) : SIN_DATO],
          ],
        },
        { tipo: 'texto', etiqueta: 'Objetivo', valor: v(e.objetivo) },
        { tipo: 'texto', etiqueta: 'Agenda', valor: v(e.agenda) },
        { tipo: 'texto', etiqueta: 'Beneficio para la Asociación', valor: v(e.beneficio) },
        { tipo: 'texto', etiqueta: 'Resultado esperado', valor: v(e.resultado_esperado) },
      ],
    }
  }

  if (clave === 'presupuesto') {
    const filas: FilaDeTabla[] = e.lineas.map(l => ({
      celdas: [
        NOMBRE_DEL_RUBRO[l.rubro], v(l.descripcion), String(l.cantidad),
        plata(l.tarifa, l.moneda), plata(subtotal(l), l.moneda),
      ],
    }))
    // Un total POR MONEDA, nunca uno solo (INT-3).
    for (const m of ['CRC', 'USD'] as Moneda[]) {
      const suyas = e.lineas.filter(l => l.moneda === m)
      if (suyas.length === 0) continue
      const total = suyas.reduce((a, l) => a + subtotal(l), 0)
      filas.push({ celdas: ['', '', '', `Total ${m}`, plata(total, m)], esTotal: true })
    }
    const bloques: BloqueDeAnexo[] = [
      { tipo: 'tabla', encabezados: ['Rubro', 'Detalle', 'Cant.', 'Tarifa', 'Subtotal'], filas },
    ]
    if (e.monto_maximo_politica != null || (e.notas_finanzas ?? '').trim()) {
      bloques.push({
        tipo: 'datos',
        filas: [
          ['Monto máximo según política', e.monto_maximo_politica != null
            ? plata(e.monto_maximo_politica, 'CRC') : SIN_DATO],
          ['Observaciones de finanzas', v(e.notas_finanzas)],
        ],
      })
    }
    return { ...base, bloques }
  }

  if (clave === 'liquidacion') {
    const filas: FilaDeTabla[] = e.gastos.map(g => ({
      celdas: [
        fechaCorta(g.fecha), NOMBRE_DEL_RUBRO[g.rubro], v(g.proveedor),
        v(g.numero_comprobante),
        g.receipt_path ? 'Sí' : `No — ${v(g.sin_comprobante_motivo)}`,
        plata(g.monto, g.moneda),
      ],
    }))
    const bloques: BloqueDeAnexo[] = [
      {
        tipo: 'tabla',
        encabezados: ['Fecha', 'Rubro', 'Proveedor', 'N° comprobante', 'Comprobante', 'Monto'],
        filas,
      },
      {
        tipo: 'datos',
        filas: [
          ['Anticipo recibido', e.anticipo_recibido_monto != null && e.anticipo_recibido_moneda
            ? plata(e.anticipo_recibido_monto, e.anticipo_recibido_moneda) : SIN_DATO],
          // Cada moneda con su propio resultado: un anticipo en dólares y
          // gastos en colones no se compensan.
          ...e.saldos.map(s => [
            `Saldo ${s.moneda}`,
            s.resultado === 'reintegrar' ? `Reintegra a la Asociación ${plata(s.diferencia, s.moneda)}`
              : s.resultado === 'reembolsar' ? `La Asociación le reembolsa ${plata(-s.diferencia, s.moneda)}`
                : 'Cuadra',
          ] as [string, string]),
          ['Observaciones', v(e.notas_liquidacion)],
        ],
      },
    ]
    return { ...base, bloques }
  }

  if (clave === 'bitacora') {
    const filas: FilaDeTabla[] = e.tramos.map(t => ({
      celdas: [
        fechaCorta(t.fecha), v(t.origen), v(t.destino),
        v(t.hora_salida), v(t.hora_regreso),
        String(t.km_inicial), String(t.km_final), `${kmDelTramo(t)} km`,
      ],
    }))
    filas.push({
      celdas: ['', '', '', '', '', '', 'Total', `${e.km_totales} km`],
      esTotal: true,
    })
    return {
      ...base,
      bloques: [
        {
          tipo: 'tabla',
          encabezados: ['Fecha', 'Origen', 'Destino', 'Salida', 'Regreso', 'Odóm. sale', 'Odóm. llega', 'Km'],
          filas,
        },
        {
          tipo: 'datos',
          filas: [
            ['Tarifa por kilómetro', plata(e.km_tarifa, e.km_moneda)],
            ['Monto a reconocer', plata(e.km_totales * e.km_tarifa, e.km_moneda)],
            ['Aprobación del jefe o supervisor', e.aprobacion_jefe_path ? 'Adjunta' : 'NO ADJUNTA'],
          ],
        },
      ],
    }
  }

  return {
    ...base,
    bloques: [
      ...CAMPOS_DEL_INFORME.map(c => ({
        tipo: 'texto' as const, etiqueta: c.etiqueta, valor: v(e.informe[c.campo]),
      })),
      {
        tipo: 'datos',
        filas: [['Evidencia adjunta', e.informe_archivos.length
          ? e.informe_archivos.map(a => a.nombre).join(', ')
          : SIN_DATO]],
      },
    ],
  }
}

/** Los anexos que de verdad se imprimen, en el orden del reglamento. */
export const anexosDelExpediente = (
  e: ExpedienteParaImprimir,
  solo?: ClaveDeAnexo | null,
): AnexoImpreso[] =>
  ORDEN_DE_ANEXOS
    .filter(c => (solo ? c === solo : anexoTieneContenido(e, c)))
    .map(c => armarAnexo(e, c))

/**
 * El nombre que el navegador propone al guardar como PDF.
 *
 * Sale del `document.title`, que es lo único que se puede controlar sin
 * cabeceras (misma limitación que SRV-14).
 */
export function nombreDeLaHoja(destino: string, persona: string, solo?: ClaveDeAnexo | null): string {
  const limpio = (s: string) => s.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim()
  const que = solo ? `${CODIGO_DEL_ANEXO[solo]} ${TITULO_DEL_ANEXO[solo]}` : 'Expediente de viaje'
  return `${que} - ${limpio(destino)} - ${limpio(persona)}`
}
