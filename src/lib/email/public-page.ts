/**
 * Página HTML mínima para los flujos públicos de email (sin login):
 * baja y re-suscripción. Mismo look para no divergir entre rutas.
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Devuelve un Response HTML. `actionHref`/`actionLabel` agregan un botón opcional. */
export function emailPublicPage(
  title: string,
  body: string,
  opts?: { actionHref?: string; actionLabel?: string },
): Response {
  const button = opts?.actionHref && opts?.actionLabel
    ? `<a href="${escapeHtml(opts.actionHref)}" style="display:inline-block;margin-top:20px;background:#EF5554;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:999px">${escapeHtml(opts.actionLabel)}</a>`
    : ''
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#f6f6f9;margin:0;padding:48px 16px;color:#161440">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 8px 32px rgba(22,20,64,.08);text-align:center">
    <h1 style="font-size:18px;margin:0 0 8px">${escapeHtml(title)}</h1>
    <p style="font-size:14px;color:#6b6b80;line-height:1.5;margin:0">${escapeHtml(body)}</p>
    ${button}
  </div>
</body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
