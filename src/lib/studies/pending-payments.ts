// PAG-2 (decisión confirmada): un miembro no puede matricularse si tiene algún
// pago de ESTUDIOS/capacitaciones pendiente. Bloquea solo el concepto
// 'matricula' con status 'pending' (incluye sin comprobante, en revisión y
// comprobante rechazado). Eventos, folletos y prematrimonial NO bloquean.
//
// SUBIR EL COMPROBANTE NO DESBLOQUEA — decisión del 2026-08-24, confirmada
// después de plantear la alternativa. El pago queda en 'pending' con
// review_status 'en_revision' y sigue bloqueando hasta que finanzas lo
// confirma. Se eligió así a sabiendas de que la persona espera: la alternativa
// —habilitar al subir el comprobante— deja matriculado a quien mandó un
// comprobante que después se rechaza, y no hay un camino definido para
// deshacer esa matrícula.
//
// Por eso la pantalla de matrícula dice "en cuanto confirmemos tu pago" y no
// "en cuanto se registre": el texto promete exactamente lo que el sistema
// cumple. Si algún día se cambia la regla, hay que cambiar esa frase también.

export function isBlockingStudyPayment(p: { concept: string | null; status: string }): boolean {
  return p.concept === 'matricula' && p.status === 'pending'
}
