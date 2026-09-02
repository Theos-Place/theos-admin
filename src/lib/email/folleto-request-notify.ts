/**
 * El correo que avisa que hay folletos que imprimir.
 *
 * Antes decía tres cosas: nivel, cantidad y sede. Con eso quien imprime tenía
 * que entrar al sistema, buscar el grupo, buscar al dirigente y adivinar de
 * dónde salía la cantidad. Ahora el correo trae lo que hace falta para
 * trabajar sin abrir nada:
 *
 *   · a quién se le entrega (dirigente y co-dirigente),
 *   · dónde se da el estudio y a qué hora,
 *   · a qué sede mandar los folletos,
 *   · de dónde sale la cantidad (estudiantes + dirigentes),
 *   · y si viene de un cierre, cómo terminó el grupo anterior.
 *
 * El desglose del cierre solo aparece en los tiquetes de tipo 'cierre'. Los de
 * cupo lleno y fin de matrícula se crean ANTES de que el grupo arranque, así
 * que ahí no hay aprobados ni reprobados que reportar — y decir "0 reprobados"
 * sería mentira, no un dato faltante.
 *
 * Es un módulo puro: recibe el detalle ya leído y devuelve texto. Los tests
 * verifican el contenido sin tocar la base ni mandar nada.
 */
import { textoDesglose } from '@/lib/studies/folleto-desglose'
import { formatDateLong } from '@/lib/format'
import type { FolletoDetalle } from '@/lib/supabase/queries/folletos'

const BASE = 'https://admin.theosplace.org'

export function etiquetaTipo(tipo: string): string {
  switch (tipo) {
    case 'cupo_lleno': return 'el grupo llenó el cupo'
    case 'fin_matricula': return 'cerró la matrícula del grupo'
    case 'cierre': return 'se cerró el grupo anterior y la gente pasó de nivel'
    case 'manual': return 'solicitud manual (caso especial)'
    case 'reubicacion': return 'reubicación'
    default: return tipo.replace(/_/g, ' ')
  }
}

function fila(label: string, valor: string | null | undefined): string {
  if (!valor || !valor.trim()) return ''
  return `<tr>
    <td style="padding:6px 12px 6px 0; font-size:13px; color:#777; white-space:nowrap; vertical-align:top;">${label}</td>
    <td style="padding:6px 0; font-size:14px; color:#161440; vertical-align:top;"><strong>${valor}</strong></td>
  </tr>`
}

/** Dónde se da el estudio, en una línea legible. */
export function textoUbicacion(g: FolletoDetalle['grupo']): string | null {
  if (!g) return null
  if (g.es_virtual) return 'Virtual'
  const partes = [g.ubicacion, g.zona].filter((p): p is string => !!p && p.trim() !== '')
  if (partes.length === 0) return null
  // La zona no se repite cuando ya viene dentro de la ubicación escrita a mano.
  if (partes.length === 2 && partes[0].toLowerCase().includes(partes[1].toLowerCase())) return partes[0]
  return partes.join(' · ')
}

/** Etiquetas de los días como los guarda `schedule_days`. */
const DIAS: Record<string, string> = {
  L: 'lunes', M: 'martes', X: 'miércoles', J: 'jueves', V: 'viernes', S: 'sábado', D: 'domingo',
}

export function textoDias(dias: string[] | null | undefined): string | null {
  const nombres = (dias ?? []).map(d => DIAS[d] ?? d).filter(Boolean)
  if (nombres.length === 0) return null
  if (nombres.length === 1) return nombres[0]
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

export function textoHorario(g: FolletoDetalle['grupo']): string | null {
  if (!g) return null
  const dias = textoDias(g.dias)
  const hora = (g.hora ?? '').trim() || null
  if (dias && hora) return `${dias} a las ${hora}`
  return dias ?? hora
}

/**
 * Cuando aprobaron más (o menos) personas de las que quedaron matriculadas en
 * el grupo siguiente, hay que decirlo: el número de folletos sale de los
 * MATRICULADOS, no de los aprobados, y ese desfase casi siempre significa que
 * alguien se quedó por fuera del grupo sucesor sin que nadie lo notara.
 *
 * Caso real que motivó esto (tiquete del 2026-09-01): 8 aprobaron el Nivel 3
 * de Jhonny Leandro y solo 6 quedaron matriculados en el Nivel 4.
 */
export function textoDesfase(d: FolletoDetalle): string | null {
  const c = d.cierre
  if (!c) return null
  const dif = c.aprobados - d.desglose.estudiantes
  if (dif === 0) return null
  if (dif > 0) {
    return `Ojo: aprobaron ${c.aprobados} pero solo ${d.desglose.estudiantes} `
      + `quedaron matriculados en el grupo siguiente. Falta${dif !== 1 ? 'n' : ''} ${dif} `
      + `persona${dif !== 1 ? 's' : ''} — conviene revisar antes de imprimir.`
  }
  return `Ojo: hay ${d.desglose.estudiantes} matriculados y solo ${c.aprobados} aprobaron el grupo anterior. `
    + `Alguien entró por otra vía (matrícula directa o excepción).`
}

/** Los que venían con el nivel aprobado de antes. Se dice aparte porque
 *  explica, sin que nadie tenga que investigar, por qué la lista del grupo
 *  anterior tiene más gente que los folletos que se piden. */
export function textoHistoricos(d: FolletoDetalle): string | null {
  const n = d.cierre?.historicos ?? 0
  if (n === 0) return null
  const una = n === 1
  return `${n} ${una ? 'persona de la lista ya tenía' : 'personas de la lista ya tenían'} este nivel `
    + `aprobado desde antes (datos viejos importados), así que no ${una ? 'avanza' : 'avanzan'} `
    + `de nivel y no ${una ? 'lleva' : 'llevan'} folleto.`
}

export function asuntoFolleto(d: FolletoDetalle): string {
  const donde = d.sede_entrega ?? 'sede sin definir'
  return `Folletos de ${d.nivel ?? 'estudio'} — ${d.desglose.total} para ${donde}`
}

export function cuerpoFolleto(d: FolletoDetalle): string {
  const g = d.grupo
  const c = d.cierre

  const dirigentes = [g?.dirigente, g?.co_dirigente].filter(Boolean).join(' y ')
    || d.target_leader_name
    || null

  const cierreBloque = c
    ? `<div class="info-box">
  <p class="info-title">De dónde vienen estos estudiantes</p>
  <p style="font-size:14px; color:#555; line-height:1.8; margin:0 0 8px;">
    Se cerró <strong>${c.grupo.name ?? 'el grupo anterior'}</strong>${
      c.grupo.dirigente ? ` (dirigía ${c.grupo.dirigente})` : ''
    } y los que aprobaron pasaron a este grupo.
  </p>
  <table cellpadding="0" cellspacing="0" style="margin:0;">
    ${fila('Aprobados', textoDesfase(d)
      ? `${c.aprobados} pasaron de nivel`
      : `${c.aprobados} — son los que necesitan folleto`)}
    ${c.reprobados > 0 ? fila('Reprobados', `${c.reprobados} (no avanzan, no llevan folleto)`) : ''}
    ${c.retirados > 0 ? fila('Retirados', `${c.retirados} (dejaron el estudio)`) : ''}
    ${c.sin_evaluar > 0 ? fila('Sin evaluar', `${c.sin_evaluar} — la cantidad puede subir si los evalúan y aprueban`) : ''}
    ${c.historicos > 0 ? fila('Ya tenían el nivel', `${c.historicos} — no avanzan ni llevan folleto`) : ''}
  </table>
  ${textoHistoricos(d) ? `<p style="font-size:13px; color:#29365C; line-height:1.7; margin:12px 0 0;">${textoHistoricos(d)}</p>` : ''}
  ${textoDesfase(d) ? `<p style="font-size:13px; color:#A24437; line-height:1.7; margin:12px 0 0;">${textoDesfase(d)}</p>` : ''}
</div>`
    : `<p style="font-size:13px; color:#777; line-height:1.7;">
  Este tiquete se generó porque ${etiquetaTipo(d.tipo)}, antes de que el grupo arranque,
  así que todavía no hay resultados de cierre que reportar.
</p>`

  const pagosBloque = d.pagos.total > 0
    ? fila('Pagos', `${d.pagos.pagados} de ${d.pagos.total} ya pagaron su folleto`)
    : ''

  return `<p class="greeting">Hay folletos que imprimir</p>

<p>Entró una solicitud de folletos porque <strong>${etiquetaTipo(d.tipo)}</strong>.</p>

<div class="info-box">
  <p class="info-title">Cuántos y a dónde</p>
  <table cellpadding="0" cellspacing="0" style="margin:0;">
    ${fila('Total a imprimir', `${d.desglose.total} folletos de ${d.nivel ?? 'estudio'}`)}
    ${fila('Desglose', textoDesglose(d.desglose))}
    ${fila('Enviar a', d.sede_entrega ?? 'SIN DEFINIR — hay que preguntarle a quien cerró')}
    ${fila('Estarían listos', formatDateLong(d.available_at))}
    ${pagosBloque}
  </table>
</div>

<div class="info-box">
  <p class="info-title">A quién se le entrega</p>
  <table cellpadding="0" cellspacing="0" style="margin:0;">
    ${fila('Grupo', g?.name)}
    ${fila(g?.co_dirigente ? 'Dirigentes' : 'Dirigente', dirigentes ?? 'sin asignar')}
    ${fila('Se da en', textoUbicacion(g) ?? 'sin definir')}
    ${fila('Horario', textoHorario(g))}
  </table>
</div>

${cierreBloque}

${d.note ? `<p style="font-size:14px; color:#555;"><strong>Nota de quien lo pidió:</strong> ${d.note}</p>` : ''}

<p style="text-align:center; margin:28px 0;">
  <a class="btn" href="${BASE}/estudios/folletos/${d.id}">Ver el detalle completo</a>
</p>

<p style="font-size:13px; color:#777; line-height:1.7;">
  Desde ahí podés avanzar el estado del tiquete (en impresión → enviado → cerrado)
  y ver el detalle del cierre que lo originó.
</p>`
}
