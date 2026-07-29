// One-off (AUTH-2): inserta la plantilla reutilizable "Cambio de sistema /
// anuncio de plataforma" en message_templates (NO es de sistema: editable y
// borrable). Es la base del broadcast de lanzamiento post AUTH-1.
//  · Solo el cuerpo: renderEmail agrega header navy + logo + footer + pie de baja.
//  · {nombre} = personalización del composer.
//  · SIN links de invitación ni tokens que expiran: solo el link al login;
//    el enlace de crear contraseña lo pide cada persona a demanda.
// Uso: node scripts/seed-platform-announcement-template.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const NAME = 'Cambio de sistema / anuncio de plataforma'
const LOGIN_URL = 'https://admin.theosplace.org/login'

const BODY = `<!-- Plantilla del anuncio de cambio de plataforma (AUTH-2).
     EDITÁ: el anuncio inicial, la nota de confianza y el correo de ayuda.
     El link SIEMPRE es el login (${LOGIN_URL}) — nunca un link de invitación
     ni un token que expire: cada persona pide su enlace a demanda con
     "Creá tu contraseña". {nombre} se personaliza al enviar. -->
<p class="greeting">Hola, {nombre}</p>

<p>Te contamos algo importante: <strong>estamos estrenando plataforma</strong>. A partir de ahora vas a poder ver tu perfil, matricularte en estudios y gestionar tus pagos desde el nuevo sistema de Theos Place.</p>

<p style="font-size:16px; font-weight:700; color:#161440; margin:24px 0 8px;">Entrar es muy fácil (te toma 2 minutos):</p>

<!-- Paso a paso numerado, pensado para celular -->
<div style="margin:0 0 8px;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
    <tr><td style="vertical-align:top; width:34px; padding:10px 0;"><span style="display:inline-block; width:26px; height:26px; border-radius:50%; background:#161440; color:#fff; font-size:13px; font-weight:700; text-align:center; line-height:26px;">1</span></td>
        <td style="padding:10px 0; font-size:15px; color:#555; line-height:1.6;">Entrá al sistema con el botón de abajo.</td></tr>
    <tr><td style="vertical-align:top; width:34px; padding:10px 0;"><span style="display:inline-block; width:26px; height:26px; border-radius:50%; background:#161440; color:#fff; font-size:13px; font-weight:700; text-align:center; line-height:26px;">2</span></td>
        <td style="padding:10px 0; font-size:15px; color:#555; line-height:1.6;">Tocá <strong>“Creá tu contraseña”</strong> e ingresá <strong>este mismo correo</strong> donde recibiste el mensaje.</td></tr>
    <tr><td style="vertical-align:top; width:34px; padding:10px 0;"><span style="display:inline-block; width:26px; height:26px; border-radius:50%; background:#161440; color:#fff; font-size:13px; font-weight:700; text-align:center; line-height:26px;">3</span></td>
        <td style="padding:10px 0; font-size:15px; color:#555; line-height:1.6;">Revisá tu correo y abrí el enlace — llega en segundos, usalo de una vez.</td></tr>
    <tr><td style="vertical-align:top; width:34px; padding:10px 0;"><span style="display:inline-block; width:26px; height:26px; border-radius:50%; background:#161440; color:#fff; font-size:13px; font-weight:700; text-align:center; line-height:26px;">4</span></td>
        <td style="padding:10px 0; font-size:15px; color:#555; line-height:1.6;">Definí tu contraseña y listo: ya podés ver tu perfil, matricularte y gestionar tus pagos.</td></tr>
  </table>
</div>

<div class="cta-wrapper">
  <a class="cta-button" href="${LOGIN_URL}">Entrar al sistema →</a>
</div>

<div class="divider"></div>

<!-- Nota de confianza (editable) -->
<p style="font-size:13px; color:#777; line-height:1.7;">Recibís este correo porque ya eras parte del sistema anterior de Theos Place y tu cuenta ya está lista en la nueva plataforma. Si necesitás ayuda, escribinos a <a href="mailto:info@theosplace.org" style="color:#519DA2;">info@theosplace.org</a> y con gusto te acompañamos.</p>`

const row = {
  name: NAME,
  category: 'general',
  channel: 'email',
  subject: 'Estrenamos plataforma — así entrás a tu cuenta',
  body: BODY,
  body_format: 'html',
  is_active: true,
}

const { data: existing } = await supabase.from('message_templates').select('id').eq('name', NAME).maybeSingle()
if (existing) {
  const { error } = await supabase.from('message_templates').update(row).eq('id', existing.id)
  if (error) throw error
  console.log(`Actualizada plantilla existente "${NAME}" (${existing.id})`)
} else {
  const { data, error } = await supabase.from('message_templates').insert(row).select('id').single()
  if (error) throw error
  console.log(`Creada plantilla "${NAME}" (${data.id})`)
}
