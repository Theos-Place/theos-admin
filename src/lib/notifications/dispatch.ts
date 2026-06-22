/**
 * Despacho de notificaciones que respeta las preferencias del miembro
 * (member_notification_prefs). Punto único para que cualquier emisor filtre
 * destinatarios según su preferencia ANTES de enviar.
 *
 * Categorías silenciables (las del toggle del usuario):
 *   · recordatorios_eventos
 *   · grupo_estudio
 *   · mensajes_sistema
 *
 * Las alertas de SEGURIDAD/operativas (reset de contraseña, cambios de acceso,
 * asignaciones de trabajo) NO usan este filtro: se envían SIEMPRE. La regla es
 * simple: si una notificación es silenciable, pasala por acá; si no, no.
 *
 * Default: un miembro SIN fila en member_notification_prefs cuenta como
 * habilitado (recibe todo) — la fila se crea recién al primer guardado.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type SilenceableCategory = 'recordatorios_eventos' | 'grupo_estudio' | 'mensajes_sistema'

/** Devuelve el subconjunto de memberIds que NO tienen silenciada esa categoría. */
export async function filterByNotifPref(
  supabase: SupabaseClient,
  memberIds: string[],
  category: SilenceableCategory,
): Promise<string[]> {
  if (memberIds.length === 0) return []
  // Quienes apagaron explícitamente la categoría (false en su fila). El resto
  // —sin fila o con true— queda habilitado por default.
  const muted = new Set<string>()
  for (let i = 0; i < memberIds.length; i += 300) {
    const slice = memberIds.slice(i, i + 300)
    // member_notification_prefs (mig. 089) aún no está en los tipos generados.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('member_notification_prefs')
      .select(`member_id, ${category}`)
      .in('member_id', slice)
      .eq(category, false)
    for (const row of (data ?? []) as Array<{ member_id: string }>) muted.add(row.member_id)
  }
  return memberIds.filter(id => !muted.has(id))
}
