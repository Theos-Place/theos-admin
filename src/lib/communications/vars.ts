// Sustitución de variables de comunicación. Por ahora solo {nombre}.
// Se aplica al enviar (email/whatsapp) y al crear la notificación interna,
// con el nombre del destinatario. Sin nombre → se usa un saludo neutro.

export function applyVars(text: string | null | undefined, vars: { nombre?: string | null }): string {
  if (!text) return ''
  const nombre = (vars.nombre ?? '').trim()
  return text.replace(/\{nombre\}/gi, nombre)
}
