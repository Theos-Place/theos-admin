// Descripción de un pago: QUÉ es y DE QUÉ. Puro, para que la lista de pagos, el
// detalle, el perfil y los exports digan todos lo mismo.
//
// Pedido 2026-08-06: en los pagos hay que poder distinguir de un vistazo si es
// de un estudio o de un evento, y de CUÁL. Antes solo se veía el monto y el
// nombre del grupo ("N1 — Centro"), que no dice si es estudio o evento ni de qué
// estudio se trata.
//
// Se DERIVA de las columnas, no se depende de que alguien haya escrito una
// descripción: así vale también para los ~miles de pagos que ya existen.

export type PaymentKind = 'estudio' | 'evento' | 'prematrimonial' | 'folletos' | 'otro'

export type PaymentForLabel = {
  concept?: string | null
  entity_type?: string | null
  event_id?: string | null
  study_group_id?: string | null
  /** Nombre del evento. */
  event_name?: string | null
  /** Nombre del grupo de estudio (ej. "N1 — Centro"). */
  group_name?: string | null
  /** Nombre del PLAN del grupo (ej. "Transformados") — lo que la gente llama
   *  "el estudio". Es lo que faltaba. */
  plan_name?: string | null
  plan_code?: string | null
  /** Descripción escrita a mano, si la hay: manda sobre lo derivado. */
  description?: string | null
}

const KIND_LABEL: Record<PaymentKind, string> = {
  estudio: 'Estudio',
  evento: 'Evento',
  prematrimonial: 'Prematrimonial',
  folletos: 'Folletos',
  otro: 'Otro',
}

/** De qué tipo es el pago. El concepto manda; si no dice nada, se deduce de a
 *  qué apunta. */
export function paymentKind(p: PaymentForLabel): PaymentKind {
  const c = (p.concept ?? '').toLowerCase()
  if (c === 'prematrimonial') return 'prematrimonial'
  if (c === 'folletos') return 'folletos'
  if (c === 'evento') return 'evento'
  if (c === 'matricula') return 'estudio'
  if (p.event_id || p.entity_type === 'event') return 'evento'
  if (p.study_group_id || p.entity_type === 'study_group') return 'estudio'
  return 'otro'
}

export function paymentKindLabel(p: PaymentForLabel): string {
  return KIND_LABEL[paymentKind(p)]
}

/** El nombre de la cosa que se está pagando. Para un estudio se prefiere el
 *  nombre del PLAN ("Transformados") sobre el del grupo ("TRANS — Centro"):
 *  el grupo dice dónde y con quién, el plan dice qué. */
export function paymentEntityName(p: PaymentForLabel): string {
  const kind = paymentKind(p)
  if (kind === 'evento') return (p.event_name ?? '').trim()
  if (kind === 'estudio' || kind === 'prematrimonial') {
    return (p.plan_name ?? p.group_name ?? '').trim()
  }
  return (p.group_name ?? p.event_name ?? '').trim()
}

/** Una línea: "Estudio · Transformados", "Evento · Campa de servidores 2026".
 *  Sin nombre resoluble queda solo el tipo. Una descripción escrita a mano gana
 *  (para los pagos viejos importados que ya traen texto propio). */
export function paymentDescription(p: PaymentForLabel): string {
  const propia = (p.description ?? '').trim()
  if (propia) return propia
  const nombre = paymentEntityName(p)
  const tipo = paymentKindLabel(p)
  return nombre ? `${tipo} · ${nombre}` : tipo
}
