// Plantilla "Anuncio con video": cualquier anuncio que lleve un video arriba.
// Idempotente por nombre — re-correrla actualiza el contenido y conserva el id.
//
// Uso: node scripts/seed-video-announcement-template.mjs
//
// GENÉRICA a propósito: los textos del campa 2026 quedan como CONTENIDO DE
// EJEMPLO. Quien arma el comunicado reemplaza titular, fechas, precios, urgencia
// y cierre; la estructura (video + datos + dos opciones + urgencia + botón +
// respaldo del video) sirve igual para un retiro, un congreso o una campaña.
//
// CÓMO SE GUARDA: message_templates.body lleva SOLO el cuerpo; renderEmail() le
// pone el header navy con el logo y el footer al enviar y en el preview. Por eso
// acá no hay <html>, <head> ni <style>: las media queries viven en el layout base
// (src/lib/email/baseLayout.ts), porque un <style> dentro del body lo ignoran
// varios clientes de correo.
//
// VARIABLES: el editor de comunicaciones usa {nombre} (una sola llave), que se
// reemplaza por el nombre de cada destinatario al enviar. NO se usa $$first_name$$
// (eso era del sistema viejo).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const NAME = 'Anuncio con video'

// Los cuatro marcadores del diseño de referencia, convertidos en valores
// editables. Los tres primeros son texto plano findable con Cmd+F en el editor.
//
// El video se aloja en el propio sistema: bucket público email-media, vía
// /api/communications/upload-media. Sin YouTube ni Vimeo de por medio. Este es
// el del campa 2026, como valor de ejemplo — en otro anuncio se sube el suyo y
// se pega la URL que devuelve el endpoint.
const VIDEO_LINK = 'https://jdcyptqnznmywgjvcpxm.supabase.co/storage/v1/object/public/email-media/campa-servidores-2026.mp4'
// Destino del botón. Se probó con un marcador (LINK-DEL-BOTON) y el correo salía
// con el botón quebrado, así que va la URL real del campa 2026 como valor por
// defecto (TI, 2026-08-04). Es contenido de EJEMPLO como el resto: en otro
// anuncio se cambia por el formulario o la pantalla que corresponda.
const CTA_LINK   = 'https://theosplace.ccbchurch.com/goto/forms/1231/responses/new'
// La miniatura sube al bucket público email-images (endpoint
// /api/communications/upload-image). Esta es la del campa 2026, como default.
const THUMB = 'https://jdcyptqnznmywgjvcpxm.supabase.co/storage/v1/object/public/email-images/1785803813822-13822.jpg'

const FONT = "'Montserrat',Helvetica,Arial,sans-serif"

const BODY = `<!-- ══════════════ ANUNCIO CON VIDEO ══════════════
     QUÉ CAMBIAR EN CADA USO (buscá el texto con Cmd+F):

       El link del video → aparece 3 VECES: la miniatura, el link del texto y el
                           enlace de respaldo del pie. Cambiá las tres. Hoy es
                           el video del campa 2026, alojado en el sistema:
                           buscá "email-media" con Cmd+F.
                           Para subir otro: pantalla de comunicaciones, o
                           POST /api/communications/upload-media (MP4 hasta 50 MB).
       El link del botón "Apartar mi lugar" → hoy apunta al formulario del campa
                                     2026 (ccbchurch); cambialo por el destino
                                     de tu anuncio ANTES de enviar.
       La URL de la miniatura         → subí la tuya en el editor (botón de imagen)
                                        y pegá la URL que te da.

     El resto es texto: titular, fechas y lugar, las dos opciones de precio, el
     bloque de urgencia y el cierre. {nombre} se reemplaza solo con el nombre de
     cada destinatario.

     NO BORRAR el bloque del final ("¿No ves la imagen del video?"): muchos
     clientes bloquean imágenes por defecto, y sin ese enlace esa persona no ve
     ni la miniatura ni cómo llegar al video.
════════════════════════════════════════════════ -->

<!-- ===== PREHEADER — no borrar =====
     Es lo que se lee en la bandeja DEBAJO del asunto. Va oculto en el correo.
     renderEmail() lo iza al inicio del <body> por el atributo data-preheader,
     así que puede quedarse acá arriba en la plantilla. Cambialo junto con el
     asunto en cada anuncio. -->
<div data-preheader style="display:none;font-size:1px;color:#f4f4f0;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Debbie te tiene un mensaje. Campa de Servidores: 29 al 31 de agosto en Playa Palo Seco. Preventa desde &#8353;78.000 hasta el 15 de agosto.
  &#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;
</div>

<!-- ===== VIDEO ===== -->
<a href="${VIDEO_LINK}" target="_blank" style="text-decoration:none;display:block;">
  <img src="${THUMB}" width="600" alt="Mirá el video" style="display:block;width:100%;max-width:600px;height:auto;border-radius:12px;border:0;" />
</a>

<!-- ===== TITULAR ===== -->
<p style="margin:26px 0 8px 0;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:1.5px;text-transform:uppercase;color:#70BDC2;font-weight:bold;">
  Campa exclusivo para servidores
</p>
<h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:30px;line-height:36px;color:#161440;font-weight:bold;">
  &#127939;&#127995;&#8205;&#9794;&#65039; &iexcl;Hacia la Meta! &#127939;&#127995;&#8205;&#9792;&#65039;
</h1>
<p style="margin:0 0 6px 0;font-family:${FONT};font-size:17px;line-height:27px;color:#3a3a42;">
  Hola, {nombre}: Debbie tiene algo especial que compartirte&hellip;
  <a href="${VIDEO_LINK}" target="_blank" style="color:#EF5554;text-decoration:none;font-weight:bold;">&iexcl;mir&aacute; el video! &#127909;</a>
</p>
<p style="margin:0;font-family:${FONT};font-size:13px;line-height:19px;color:#8a8a93;">
  Toc&aacute; la imagen de arriba para verlo &middot; dura 27 segundos
</p>

<!-- ===== FECHA Y LUGAR ===== -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#161440;border-radius:10px;margin-top:26px;">
  <tr>
    <td align="center" style="padding:22px 24px;">
      <p style="margin:0 0 6px 0;font-family:${FONT};font-size:19px;line-height:26px;color:#ffffff;font-weight:bold;">
        29 al 31 de agosto
      </p>
      <p style="margin:0;font-family:${FONT};font-size:15px;line-height:23px;color:#a0b8bb;">
        Hotel La Isla &middot; Playa Palo Seco, Parrita
      </p>
    </td>
  </tr>
</table>

<!-- ===== DOS OPCIONES (se apilan en el celular con la clase stack) ===== -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px;">
  <tr>
    <td class="stack stack-pad" width="50%" valign="top" style="padding-right:7px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;border:2px solid #70BDC2;border-radius:10px;">
        <tr><td align="center" style="padding:18px 12px;">
          <p style="margin:0 0 6px 0;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:0.8px;text-transform:uppercase;color:#70BDC2;font-weight:bold;">&#128719;&#65039; Compartida</p>
          <p style="margin:0 0 3px 0;font-family:${FONT};font-size:28px;line-height:34px;color:#161440;font-weight:bold;">&#8353;78.000</p>
          <p style="margin:0;font-family:${FONT};font-size:13px;line-height:18px;color:#9a9aa2;"><s>&#8353;88.000</s> despu&eacute;s del 16</p>
        </td></tr>
      </table>
    </td>
    <td class="stack" width="50%" valign="top" style="padding-left:7px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;border:2px solid #70BDC2;border-radius:10px;">
        <tr><td align="center" style="padding:18px 12px;">
          <p style="margin:0 0 6px 0;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:0.8px;text-transform:uppercase;color:#70BDC2;font-weight:bold;">&#128719;&#65039; Doble</p>
          <p style="margin:0 0 3px 0;font-family:${FONT};font-size:28px;line-height:34px;color:#161440;font-weight:bold;">&#8353;89.000</p>
          <p style="margin:0;font-family:${FONT};font-size:13px;line-height:18px;color:#9a9aa2;"><s>&#8353;99.000</s> despu&eacute;s del 16</p>
        </td></tr>
      </table>
    </td>
  </tr>
</table>

<!-- ===== URGENCIA ===== -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fdeeee;border-radius:8px;margin-top:18px;">
  <tr>
    <td style="padding:15px 20px;border-left:4px solid #EF5554;">
      <p style="margin:0;font-family:${FONT};font-size:15px;line-height:23px;color:#5a3535;">
        &#128266; <strong>Importante:</strong> El 10 de agosto se abren las inscripciones para todos los
        servidores; adem&aacute;s record&aacute; que a partir del 16 de agosto el valor especial de preventa
        termina, as&iacute; que aprovech&aacute; en inscribirte antes.
      </p>
    </td>
  </tr>
</table>

<!-- ===== BOTÓN ===== -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" class="btn-block" style="margin:28px auto 0 auto;">
  <tr>
    <td align="center" style="background-color:#EF5554;border-radius:50px;">
      <a href="${CTA_LINK}" target="_blank" style="display:inline-block;padding:17px 44px;font-family:${FONT};font-size:17px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:50px;">
        Apartar mi lugar
      </a>
    </td>
  </tr>
</table>
<p style="margin:12px 0 0 0;text-align:center;font-family:${FONT};font-size:13px;line-height:19px;color:#8a8a93;">
  Toma menos de 2 minutos
</p>

<!-- ===== RESPALDO DEL VIDEO — no borrar (imágenes bloqueadas) ===== -->
<p style="margin:20px 0 0 0;text-align:center;font-family:${FONT};font-size:13px;line-height:20px;color:#8a8a93;">
  &iquest;No ves la imagen del video? Miralo ac&aacute;:<br />
  <a href="${VIDEO_LINK}" target="_blank" style="color:#EF5554;text-decoration:underline;word-break:break-all;">${VIDEO_LINK}</a>
</p>

<!-- ===== CIERRE ===== -->
<p style="margin:22px 0 0 0;font-family:${FONT};font-size:16px;line-height:26px;color:#3a3a42;">
  &iexcl;Nos encantar&iacute;a que nos acompa&ntilde;&eacute;s! &#128588;
</p>`

const row = {
  name: NAME,
  category: 'general',
  channel: 'email',
  // Asunto de EJEMPLO (el del campa 2026, sugerido por TI). Se cambia en cada
  // anuncio junto con el preheader.
  subject: 'Debbie te tiene un mensaje 🎥 · Campa de Servidores 2026',
  body: BODY,
  body_format: 'html',
  is_active: true,
}

const { data: existing } = await supabase
  .from('message_templates').select('id').eq('name', NAME).maybeSingle()

if (existing) {
  const { error } = await supabase.from('message_templates').update(row).eq('id', existing.id)
  if (error) throw error
  console.log(`Actualizada: "${NAME}" (${existing.id})`)
} else {
  const { data, error } = await supabase.from('message_templates').insert(row).select('id').single()
  if (error) throw error
  console.log(`Creada: "${NAME}" (${data.id})`)
}
console.log(`Miniatura por defecto: ${THUMB}`)
