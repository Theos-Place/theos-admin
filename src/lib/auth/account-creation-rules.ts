// AUTH-1: reglas puras de la creación masiva de cuentas (sin Supabase, para
// testear en node). El script scripts/create-member-accounts.ts las ejecuta.

export type MemberForAccount = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  auth_user_id: string | null
  is_active: boolean | null
  is_system: boolean | null
  email_bounced: boolean | null
  email_complained: boolean | null
  /** Para la exclusión de menores de 12. null = edad desconocida (se incluye). */
  birth_date: string | null
}

export type ExclusionCause =
  | 'ya_tiene_cuenta'
  | 'sin_correo'
  | 'correo_invalido'
  | 'inactivo'
  | 'sistema'
  | 'correo_rebotado'
  | 'correo_con_queja'
  | 'correo_duplicado'
  | 'menor_de_12'

/** Menor de 12 años CUMPLIDOS a la fecha `now`. Sin fecha de nacimiento no se
 *  puede saber → false (se incluye). */
export function isUnder12(birthDate: string | null, now: Date): boolean {
  if (!birthDate) return false
  const b = new Date(`${birthDate.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(b.getTime())) return false
  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 12, now.getUTCMonth(), now.getUTCDate()))
  return b.getTime() > cutoff.getTime()
}

// Mismo criterio de formato que /recuperar.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmailForAccount(email: string | null | undefined): string | null {
  const e = (email ?? '').trim().toLowerCase()
  return e || null
}

/**
 * Clasifica el padrón para la creación masiva: elegibles vs. excluidos por
 * causa. Duplicados: si el correo (normalizado) aparece en MÁS de un miembro
 * —tenga o no cuenta ya—, ningún miembro sin cuenta de ese correo es elegible
 * (se listan para resolver el duplicado a mano). Idempotente por diseño:
 * quien ya tiene auth_user_id queda excluido como ya_tiene_cuenta.
 */
export function classifyForAccountCreation(members: MemberForAccount[], now: Date = new Date()): {
  eligible: MemberForAccount[]
  excluded: Array<{ member: MemberForAccount; cause: ExclusionCause }>
  duplicates: Array<{ email: string; members: MemberForAccount[] }>
} {
  const byEmail = new Map<string, MemberForAccount[]>()
  for (const m of members) {
    const e = normalizeEmailForAccount(m.email)
    if (!e) continue
    const list = byEmail.get(e) ?? []
    list.push(m)
    byEmail.set(e, list)
  }

  const eligible: MemberForAccount[] = []
  const excluded: Array<{ member: MemberForAccount; cause: ExclusionCause }> = []
  const dupEmails = new Map<string, MemberForAccount[]>()

  for (const m of members) {
    const email = normalizeEmailForAccount(m.email)
    const cause: ExclusionCause | null =
      m.auth_user_id ? 'ya_tiene_cuenta'
      : !email ? 'sin_correo'
      : !EMAIL_RE.test(email) ? 'correo_invalido'
      : m.is_active === false ? 'inactivo'
      : m.is_system ? 'sistema'
      : m.email_bounced ? 'correo_rebotado'
      : m.email_complained ? 'correo_con_queja'
      : isUnder12(m.birth_date, now) ? 'menor_de_12'
      : (byEmail.get(email)!.length > 1) ? 'correo_duplicado'
      : null
    if (cause) {
      excluded.push({ member: m, cause })
      if (cause === 'correo_duplicado') dupEmails.set(email!, byEmail.get(email!)!)
    } else {
      eligible.push(m)
    }
  }

  return {
    eligible,
    excluded,
    duplicates: [...dupEmails.entries()].map(([email, ms]) => ({ email, members: ms })),
  }
}
