// PAG-2 (decisión confirmada): un miembro no puede matricularse si tiene algún
// pago de ESTUDIOS/capacitaciones pendiente. Bloquea solo el concepto
// 'matricula' con status 'pending' (incluye sin comprobante, en revisión y
// comprobante rechazado). Eventos, folletos y prematrimonial NO bloquean.

export function isBlockingStudyPayment(p: { concept: string | null; status: string }): boolean {
  return p.concept === 'matricula' && p.status === 'pending'
}
