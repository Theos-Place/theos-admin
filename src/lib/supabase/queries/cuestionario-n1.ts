import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  veredicto, TITULO_DEL_FORMULARIO, type RespuestasDelCuestionario,
} from '@/lib/studies/cuestionario-de-matricula'

/**
 * EST-15 · El filtro de Nivel 1, del lado del SERVIDOR.
 *
 * Quien contesta que quiere los estudios para continuar en su iglesia no se
 * matricula. Eso lo decidió Floriana y no es un mensaje informativo: es un
 * filtro, así que tiene que vivir donde se crea la matrícula y no solo donde se
 * dibuja el botón. Con el bloqueo únicamente en pantalla, cerrar el modal y
 * volver a confirmar —o llamar al endpoint a mano— pasaba igual.
 *
 * SE MIRA LA RESPUESTA MÁS NUEVA. Cada matrícula a N1 deja la suya
 * (`allow_multiple_responses`), así que una de hace seis meses no puede dejar a
 * alguien bloqueado para siempre: si hoy contesta otra cosa, hoy vale la de
 * hoy. Que alguien pueda volver atrás y contestar distinto no es un agujero —
 * el dato es autodeclarado y ninguna regla puede evitarlo—; lo que este filtro
 * garantiza es que la respuesta que bloquea y la matrícula no puedan convivir.
 *
 * SIN RESPUESTA NO SE BLOQUEA, a propósito. La pantalla ya obliga a contestar
 * antes de llegar acá, y exigirla también en el servidor rompería los caminos
 * que no pasan por ahí —un import, una transferencia, una corrección a mano— y
 * convertiría una falla de datos en gente que no se puede matricular.
 */
export async function bloqueaElCuestionarioDeN1(memberId: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { data: form } = await supabase
    .from('forms').select('id').eq('title', TITULO_DEL_FORMULARIO).maybeSingle()
  if (!form) return false

  const { data: resp } = await supabase
    .from('form_responses')
    .select('id')
    .eq('form_id', (form as { id: string }).id)
    .eq('member_id', memberId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!resp) return false

  const { data: valores } = await supabase
    .from('form_response_values')
    .select('value_text, field:form_fields(label)')
    .eq('response_id', (resp as { id: string }).id)

  // El veredicto se calcula con las ETIQUETAS, que es como lo entiende la regla
  // pura — la misma que usa la pantalla.
  const respuestas: RespuestasDelCuestionario = {}
  for (const v of (valores ?? []) as Array<{ value_text: string | null; field: { label: string } | { label: string }[] | null }>) {
    const campo = Array.isArray(v.field) ? v.field[0] : v.field
    if (campo?.label) respuestas[campo.label] = v.value_text ?? ''
  }

  return veredicto(respuestas).estado === 'otras_opciones'
}
