/**
 * Layout base de los correos del sistema: head + estilos compartidos + header
 * (logo) + footer genérico. Cada plantilla guarda SOLO el contenido del cuerpo
 * (lo que va dentro de .body); renderEmail() lo envuelve para producir el correo
 * completo. Cambiar el header/footer/estilos acá afecta a TODAS las plantillas.
 *
 * Función PURA (sin imports server-only): se usa en el envío (server) y en el
 * preview del editor (cliente).
 */

// Estilos compartidos (antes repetidos en el <style> de cada plantilla). El
// contenido inyectado usa estas clases (.info-box, .tag, .cta-button, etc.).
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background-color: #f4f4f0; font-family: 'Montserrat', Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  .wrapper { max-width: 620px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(22,20,64,0.10); }
  .header { background-color: #161440; padding: 36px 48px; text-align: center; }
  .header img { height: auto; width: 160px; display: inline-block; }
  .body { padding: 48px 48px 36px; }
  .greeting { font-size: 22px; font-weight: 700; color: #161440; margin-bottom: 16px; }
  .body p { font-size: 15px; color: #555; line-height: 1.75; margin-bottom: 14px; }
  .divider { height: 1px; background: linear-gradient(to right, transparent, #e0e0e0, transparent); margin: 32px 0; }
  .cta-button { display: inline-block; background-color: #EF5554; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 16px 40px; border-radius: 50px; }
  .cta-wrapper { text-align: center; margin: 28px 0 8px; }
  .cta-secondary { display: inline-block; background-color: #161440; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 16px 40px; border-radius: 50px; }
  .info-box { background: #f4f4f0; border-radius: 12px; padding: 24px 28px; margin: 28px 0; }
  .info-box .info-title { font-size: 11px; font-weight: 700; color: #888; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 14px; }
  .info-title { font-size: 11px; font-weight: 700; color: #888; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 14px; }
  .info-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start; }
  .info-row:last-child { margin-bottom: 0; }
  .info-icon { font-size: 15px; min-width: 22px; }
  .info-label { font-size: 12px; font-weight: 700; color: #161440; min-width: 90px; }
  .info-value { font-size: 13px; color: #555; }
  .highlight-box { background: #161440; border-radius: 12px; padding: 20px 28px; margin: 28px 0; text-align: center; }
  .highlight-box .hl-label, .hl-label { font-size: 11px; font-weight: 600; color: #70BDC2; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
  .highlight-box .hl-value, .hl-value { font-size: 32px; font-weight: 700; color: #ffffff; letter-spacing: 6px; }
  .highlight-box .hl-sub, .hl-sub { font-size: 12px; color: #70BDC2; margin-top: 6px; }
  .tag { display: inline-block; background: #EF5554; color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 4px 12px; border-radius: 50px; margin-bottom: 16px; }
  .tag-blue { background: #161440; }
  .tag-teal { background: #70BDC2; }
  .student-list { margin: 0; padding: 0; list-style: none; }
  .student-list li { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #444; }
  .student-list li:last-child { border-bottom: none; }
  .student-avatar { width: 30px; height: 30px; border-radius: 50%; background: #161440; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .receipt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #555; }
  .receipt-row:last-child { border-bottom: none; }
  .receipt-total { display: flex; justify-content: space-between; padding: 14px 0 0; font-size: 16px; font-weight: 700; color: #161440; }
  .icons-strip { display: flex; justify-content: center; align-items: center; gap: 18px; padding: 16px 0 4px; opacity: 0.12; }
  .footer { background-color: #161440; padding: 28px 48px; text-align: center; }
  .footer p { font-size: 12px; color: #70BDC2; line-height: 1.8; }
  .footer a { color: #70BDC2; text-decoration: underline; }
  .footer-brand { font-size: 13px; font-weight: 700; color: #ffffff; margin-bottom: 6px; }
  .footer-divider { height: 2px; width: 48px; margin: 14px auto; background: #EF5554; border-radius: 2px; }
  @media (max-width: 640px) {
    .wrapper { margin: 0; border-radius: 0; }
    .header, .body, .footer { padding-left: 24px; padding-right: 24px; }
    .body { padding-top: 32px; padding-bottom: 28px; }
    .greeting { font-size: 18px; }
    .info-label { min-width: 70px; }
  }
`

const LOGO_URL = 'https://admin.theosplace.org/logo-theos-white.png'

/** Envuelve el contenido del cuerpo en el cascarón completo del correo. */
export function renderEmail(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Theos Place</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="${LOGO_URL}" alt="Theos Place" />
    </div>
    <div class="body">
${content}
    </div>
    <div class="footer">
      <p class="footer-brand">Theos Place</p>
      <p>¿Tenés alguna pregunta? Escribinos a <a href="mailto:info@theosplace.org">info@theosplace.org</a></p>
      <div class="footer-divider"></div>
      <p>© 2026 Theos Place · Este mensaje fue enviado automáticamente, por favor no respondas a este correo.</p>
    </div>
  </div>
</body>
</html>`
}
