// GRU-3 · El teléfono y el correo del dirigente son DATOS PERSONALES.
//
// Solo los recibe quien gestiona el grupo (viewer_scope 'admin' o 'leader'). Un
// estudiante inscrito ve el nombre de su dirigente, no su celular. Esto se hace
// borrándolos del PAYLOAD, no escondiéndolos en la UI: si viajan, están
// expuestos a cualquiera que mire la respuesta del API.
//
// Puro para poder testearlo sin Supabase.

type ConContacto = { phone?: unknown; email?: unknown }

export type GroupWithLeaders = {
  leader?: ConContacto | null
  co_leader?: ConContacto | null
}

/** ¿Este alcance puede ver el contacto del dirigente? */
export function canSeeLeaderContact(scope: string | null | undefined): boolean {
  return scope === 'admin' || scope === 'leader'
}

/** Devuelve el grupo con el contacto del dirigente y del co-dirigente en null.
 *  No muta el original. */
export function stripLeaderContact<T extends GroupWithLeaders>(group: T): T {
  return {
    ...group,
    leader: group.leader ? { ...group.leader, phone: null, email: null } : group.leader,
    co_leader: group.co_leader ? { ...group.co_leader, phone: null, email: null } : group.co_leader,
  }
}
