/**
 * Carga (idempotente) las 7 plantillas del SISTEMA en message_templates.
 * Lee el html_body de supabase/seed/system-emails/*.html (logo embebido tal cual).
 * Re-correr no duplica: upsert por system_key (select → update/insert).
 *
 *   npx tsx scripts/seed-system-templates.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// Cargar .env y .env.local (las claves de Supabase están en .env.local).
for (const file of ['.env', '.env.local']) {
  try {
    const t = readFileSync(join(process.cwd(), file), 'utf8')
    for (const line of t.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch { /* archivo ausente: seguir */ }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!,
  { auth: { persistSession: false } },
)

const DIR = join(process.cwd(), 'supabase', 'seed', 'system-emails')

const TEMPLATES: Array<{ key: string; name: string; subject: string; file: string; vars: string[] }> = [
  { key: 'bienvenida', name: 'Bienvenida', subject: '¡Bienvenido a Theos Place!', file: 'email-bienvenida-theos.html', vars: ['nombre'] },
  { key: 'recuperacion_contrasena', name: 'Recuperación de contraseña', subject: 'Recuperá tu contraseña', file: 'email-recuperacion-contrasena.html', vars: ['nombre', 'codigo'] },
  { key: 'form_asignado', name: 'Formulario asignado', subject: 'Tenés un formulario pendiente', file: 'theos_email_01_form_asignado.html', vars: ['nombre', 'nombre_proceso', 'nombre_form', 'fecha_limite', 'asignado_por', 'link_form'] },
  { key: 'form_completado', name: 'Formulario completado', subject: 'Recibimos tus respuestas', file: 'theos_email_02_form_completado.html', vars: ['nombre', 'nombre_form', 'id_respuesta', 'fecha_envio', 'link_respuestas'] },
  { key: 'matricula_estudiante', name: 'Matrícula confirmada (estudiante)', subject: 'Tu matrícula fue confirmada', file: 'theos_email_03_matricula_estudiante.html', vars: ['nombre', 'nombre_capacitacion', 'fecha_inicio', 'dias', 'hora', 'lugar', 'dirigentes'] },
  { key: 'matricula_dirigente', name: 'Nuevo estudiante matriculado (dirigente)', subject: 'Nuevo estudiante en tu capacitación', file: 'theos_email_04_matricula_dirigente.html', vars: ['nombre_dirigente', 'nombre_estudiante', 'nombre_capacitacion', 'fecha_inicio', 'dias', 'hora', 'lugar', 'total_estudiantes', 'estudiantes'] },
  { key: 'inicio_capacitacion', name: 'Inicio de capacitación', subject: 'Tu capacitación está por comenzar', file: 'theos_email_05_inicio_capacitacion.html', vars: ['nombre', 'nombre_capacitacion', 'fecha_inicio', 'dias', 'hora', 'lugar', 'dirigentes', 'descripcion'] },
]

async function run() {
  for (const t of TEMPLATES) {
    const html = readFileSync(join(DIR, t.file), 'utf8')
    const row = {
      name: t.name,
      category: 'transaccional',
      channel: 'email' as const,
      subject: t.subject,
      body: html,
      body_format: 'html' as const,
      is_active: true,
      is_system: true,
      system_key: t.key,
      available_variables: t.vars,
    }
    const { data: existing } = await supabase
      .from('message_templates').select('id').eq('system_key', t.key).maybeSingle()
    if (existing) {
      const { error } = await supabase.from('message_templates').update(row).eq('system_key', t.key)
      if (error) throw error
      console.log(`actualizada: ${t.key}`)
    } else {
      const { error } = await supabase.from('message_templates').insert(row)
      if (error) throw error
      console.log(`insertada:   ${t.key}`)
    }
  }
  console.log('Listo: 7 plantillas del sistema.')
}

run().catch(e => { console.error(e); process.exit(1) })
