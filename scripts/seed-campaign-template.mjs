// One-off: inserta la plantilla reutilizable "Campaña con flyer y CTA" en
// message_templates (NO es plantilla de sistema: editable y borrable).
// Basada en docs/referencias/theos_email_campa_servidores_preventa.html,
// adaptada al pipeline del repo:
//   · Guarda SOLO el cuerpo (renderEmail agrega header navy + logo + footer
//     con el texto de "mensaje automático" y el pie de baja de marketing).
//   · $$first_name$$ (sintaxis CCB) → {nombre} (applyVars del composer).
//   · Sin URLs de CCB: el logo sale del layout base (asset propio) y el flyer/
//     CTA quedan como placeholders de theosplace.org, editables por broadcast.
//   · Sin @import de Google Fonts en el cuerpo (el layout ya trae la fuente
//     con fallback Arial).
// Uso: node scripts/seed-campaign-template.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const NAME = 'Campaña con flyer y CTA'

const BODY = `<!-- Plantilla genérica de campaña. Al usarla, editá:
     · el saludo y los textos,
     · la imagen del flyer (src y alt) y el link al que lleva,
     · las líneas de precio de la caja azul,
     · el link y el texto del botón.
     {nombre} se reemplaza por el nombre de cada destinatario al enviar. -->
<p style="text-align:center; font-size:12px; color:#519DA2; letter-spacing:1.5px; text-transform:uppercase; font-weight:600; margin-bottom:28px;">disfrutá de una relación más cercana con Dios</p>

<p class="greeting">Hola, {nombre}</p>

<!-- Flyer clickeable: cambiá el src de la imagen y el href del enlace. -->
<div style="text-align:center; margin:0 0 28px;">
  <a href="https://theosplace.org" style="display:inline-block;">
    <img alt="Flyer de la campaña" src="https://www.theosplace.org/_components/v2/11079bc1f36720968985f09e74415eae8760e01d/campa.085a9e91.jpeg" style="width:100%; max-width:520px; height:auto; border-radius:12px; display:block; margin:0 auto; box-shadow:0 2px 12px rgba(22,20,64,0.12); border:0;" width="520" />
  </a>
</div>

<p style="font-size:16px; font-weight:700; color:#161440; line-height:1.6; margin-bottom:12px;">👀 Esto no es para todo el mundo… es para vos.</p>

<p>Como sos parte de Theos, tenés acceso a una preventa exclusiva con un precio preferencial para ser parte del <strong>Campa de Servidores 2026</strong>.</p>

<!-- Caja destacada navy: editá el título y las líneas de precio/fechas. -->
<div class="highlight-box" style="padding:28px;">
  <p class="hl-label" style="margin-bottom:8px;">🎟️ Precio preventa</p>
  <p style="font-size:18px; font-weight:700; color:#ffffff; margin-bottom:4px;">🛏️ Habitación doble · ₡89.000</p>
  <p style="font-size:18px; font-weight:700; color:#ffffff; margin-bottom:12px;">🛏️ Habitación compartida · ₡78.000</p>
  <p style="font-size:15px; color:#a0b8bb; margin-bottom:4px;">⏳ Fecha límite: 15 de agosto</p>
  <p class="hl-sub">Después de esa fecha inicia la venta general con el precio regular</p>
</div>

<p>Creemos que ese finde será una experiencia que fortalecerá tu corazón, tu propósito y las relaciones que estás construyendo mientras servís.</p>

<!-- Botón CTA: cambiá el href y el texto. -->
<div class="cta-wrapper">
  <a class="cta-button" href="https://theosplace.org">Asegurá tu lugar acá →</a>
</div>

<div class="divider"></div>

<p>¡Nos vemos!</p>`

const { data: existing } = await supabase
  .from('message_templates').select('id').eq('name', NAME).maybeSingle()

const row = {
  name: NAME,
  category: 'general',
  channel: 'email',
  subject: 'Preventa exclusiva · Campa de Servidores 2026',
  body: BODY,
  body_format: 'html',
  is_active: true,
}

if (existing) {
  const { error } = await supabase.from('message_templates').update(row).eq('id', existing.id)
  if (error) throw error
  console.log(`Actualizada plantilla existente "${NAME}" (${existing.id})`)
} else {
  const { data, error } = await supabase.from('message_templates').insert(row).select('id').single()
  if (error) throw error
  console.log(`Creada plantilla "${NAME}" (${data.id})`)
}
