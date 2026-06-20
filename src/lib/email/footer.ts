/**
 * Pie de correo de MARKETING: link de baja (unsubscribe) + dirección física
 * (requisito anti-spam / CAN-SPAM). Los correos transaccionales NO lo llevan.
 */

// Dirección física del remitente (ajustar al domicilio legal real de Theos Place).
export const EMAIL_PHYSICAL_ADDRESS = 'Theos Place · San José, Costa Rica'

/** URL de baja para un miembro, a partir de su unsubscribe_token. */
export function unsubscribeUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://admin.theosplace.org'
  return `${base}/api/email/unsubscribe?token=${encodeURIComponent(token)}`
}

/** Agrega el pie de marketing (baja + dirección) al HTML del correo. */
export function withMarketingFooter(html: string, token: string): string {
  const url = unsubscribeUrl(token)
  const footer = `
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px" />
  <div style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#8a8a99;line-height:1.5">
    <p style="margin:0 0 4px">Recibís este correo porque sos parte de la comunidad de Theos Place.</p>
    <p style="margin:0 0 4px">
      ¿No querés más correos de este tipo?
      <a href="${url}" style="color:#519DA2">Darme de baja</a>.
    </p>
    <p style="margin:0;color:#b0b0bd">${EMAIL_PHYSICAL_ADDRESS}</p>
  </div>`
  return html + footer
}

/** Header List-Unsubscribe (un clic desde Gmail/Outlook) para marketing. */
export function listUnsubscribeHeader(token: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubscribeUrl(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
