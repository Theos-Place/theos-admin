// Resumen de pago de un tiquete de folletos (módulo puro, cliente + servidor).
//
// Los pagos son INDIVIDUALES, uno por estudiante — acá solo se cuentan para
// mostrarlos juntos en el tiquete. El tiquete no es un cobro: es el lugar donde
// se ve cómo va el cobro de su gente.
//
// El pago NO frena la impresión. Los estados del folleto (creada → en_impresion
// → enviado_entregado → cerrada) corren por su lado; esto es la otra pista.

export type ConteoPagos = { total: number; pagados: number }

export type ResumenPago = {
  texto: string
  /** 'ninguno' = el nivel no se cobra; 'listo' = todos pagaron; 'parcial' = faltan. */
  tono: 'ninguno' | 'listo' | 'parcial'
}

/**
 * `total` en 0 NO es "nadie ha pagado": es que el nivel no se cobra.
 *
 * Pasa de verdad con Discípulos: DIS2 y DIS3 cuestan ₡0 porque el folleto se
 * paga al matricularse en DIS1. Mostrar "0 de 8 pagados" en esos tiquetes
 * mandaría a cobrar algo que ya está cobrado.
 */
export function resumenPagos(c: ConteoPagos | undefined): ResumenPago {
  const total = c?.total ?? 0
  if (total === 0) return { texto: 'Sin cobro', tono: 'ninguno' }
  const pagados = Math.min(c?.pagados ?? 0, total)
  if (pagados >= total) return { texto: `Pagado · ${total}/${total}`, tono: 'listo' }
  return { texto: `${pagados} de ${total} pagados`, tono: 'parcial' }
}

export const RESUMEN_PAGO_BADGE: Record<ResumenPago['tono'], string> = {
  ninguno: 'bg-navy-light/10 text-navy-light/80',
  listo: 'bg-teal-soft/30 text-teal-deep',
  parcial: 'bg-amber-50 text-amber-700',
}
