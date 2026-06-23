/**
 * Marketing: link de baja (unsubscribe) + header List-Unsubscribe.
 * El PIE de baja en el correo lo arma renderEmail() (layout base, una sola fuente);
 * acá solo queda la URL de baja y el header de un clic.
 */

/** URL de baja para un miembro, a partir de su unsubscribe_token. */
export function unsubscribeUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'
  return `${base}/api/email/unsubscribe?token=${encodeURIComponent(token)}`
}

/** Header List-Unsubscribe (un clic desde Gmail/Outlook) para marketing. */
export function listUnsubscribeHeader(token: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
