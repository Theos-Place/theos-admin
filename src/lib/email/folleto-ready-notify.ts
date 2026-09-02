/**
 * El aviso al dirigente de que sus folletos ya están en la sede.
 *
 * Hasta ahora el flujo del tiquete era interno: quien imprime lo movía de
 * "creada" a "en impresión" y a "enviado / entregado", y el dirigente no se
 * enteraba de nada. Tenía que preguntar, o aparecerse a ver si habían llegado.
 *
 * Este correo sale cuando el tiquete pasa a "enviado / entregado", con lo que
 * ya está en la solicitud: cuántos son, de qué estudio y en qué sede los puede
 * recoger.
 *
 * Módulo puro: recibe el detalle ya leído y devuelve texto.
 */
import { textoDesglose } from '@/lib/studies/folleto-desglose'
import { formatDateLong } from '@/lib/format'
import type { FolletoDetalle } from '@/lib/supabase/queries/folletos'

export function asuntoListos(d: FolletoDetalle): string {
  const donde = d.sede_entrega ? ` en ${d.sede_entrega}` : ''
  return `Tus folletos de ${d.nivel ?? 'estudio'} ya están${donde}`
}

function fila(label: string, valor: string | null | undefined): string {
  if (!valor || !valor.trim()) return ''
  return `<tr>
    <td style="padding:6px 12px 6px 0; font-size:13px; color:#777; white-space:nowrap; vertical-align:top;">${label}</td>
    <td style="padding:6px 0; font-size:14px; color:#161440; vertical-align:top;"><strong>${valor}</strong></td>
  </tr>`
}

export function cuerpoListos(d: FolletoDetalle, nombreDirigente: string): string {
  const primerNombre = nombreDirigente.split(/\s+/)[0] || nombreDirigente
  const g = d.grupo

  const donde = d.sede_entrega
    ? `Los podés recoger en <strong>${d.sede_entrega}</strong>.`
    : `Todavía no tenemos anotado dónde quedaron: escribinos y lo averiguamos.`

  return `<p class="greeting">Hola, ${primerNombre}</p>

<p>Ya están listos los folletos de tu estudio. ${donde}</p>

<div class="info-box">
  <p class="info-title">Lo que te espera</p>
  <table cellpadding="0" cellspacing="0" style="margin:0;">
    ${fila('Cuántos', `${d.desglose.total} folletos de ${d.nivel ?? 'estudio'}`)}
    ${fila('Desglose', textoDesglose(d.desglose))}
    ${fila('Recogés en', d.sede_entrega ?? 'sin definir')}
    ${fila('Para el grupo', g?.name)}
    ${g?.starts_at ? fila('Que arranca', formatDateLong(g.starts_at)) : ''}
  </table>
</div>

${d.desglose.dirigentes > 0 ? `<p style="font-size:13px; color:#777; line-height:1.7;">
  El total incluye tu folleto${d.desglose.dirigentes > 1 ? ' y el del co-dirigente' : ''}: no es solo el de los estudiantes.
</p>` : ''}

<p style="font-size:13px; color:#777; line-height:1.7;">
  Si al recogerlos falta alguno o la cantidad no calza, escribinos a
  <a href="mailto:estudios@theosplace.org" style="color:#3B7579;">estudios@theosplace.org</a>
  antes de que arranque el grupo.
</p>`
}
