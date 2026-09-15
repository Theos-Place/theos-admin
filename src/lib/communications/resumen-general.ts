/**
 * Los números de arriba de /comunicaciones, contando TAMBIÉN los correos del
 * sistema.
 *
 * Por qué hacía falta: las tarjetas leían solo `message_broadcasts`, así que un
 * mes entero de avisos automáticos —matrículas, becas, enlaces de contraseña—
 * no existía en el resumen. En un mes normal esos son la mayoría del correo que
 * sale de Theos, y la pantalla decía que casi no había salido nada.
 *
 * Pero no se mezclan en silencio: un comunicado es UNA pieza que le llega a
 * miles, y un correo del sistema es una pieza para una persona. Sumarlos sin
 * decirlo convertiría "Mensajes este mes" en un número que no significa nada.
 * Por eso cada tarjeta lleva su desglose: cuánto es campaña y cuánto es
 * automático.
 *
 * VENTANA: todo es del mes en curso, las dos fuentes. Antes "Con errores"
 * contaba el historial completo mientras la tarjeta de al lado decía "este
 * mes"; con dos orígenes esa mezcla ya era insostenible.
 */

/** Lo que aporta una fuente (campañas o sistema) al resumen del mes. */
export type AporteAlResumen = {
  /** Piezas: comunicados en campañas, correos individuales en el sistema. */
  mensajes: number
  /** Personas que recibieron: incluye a las entregadas. NO incluye saltados. */
  alcanzados: number
  /** Subconjunto de `alcanzados` con confirmación de entrega del destinatario. */
  entregados: number
  /** Piezas con algo que falló (rebote o error de envío). */
  conErrores: number
}

export const APORTE_VACIO: AporteAlResumen = { mensajes: 0, alcanzados: 0, entregados: 0, conErrores: 0 }

export type TarjetaDelResumen = {
  total: number
  /** Cuánto del total es correo automático. 0 = no se muestra desglose. */
  delSistema: number
}

export type ResumenGeneral = {
  mensajes: TarjetaDelResumen
  alcanzados: TarjetaDelResumen
  /** Porcentaje entregados/alcanzados de las dos fuentes juntas. */
  tasa: number
  conErrores: TarjetaDelResumen
  /** Tasa solo del sistema, para el desglose. `null` si no alcanzó a nadie. */
  tasaDelSistema: number | null
}

function tasaDe(entregados: number, alcanzados: number): number {
  return alcanzados > 0 ? Math.round((entregados / alcanzados) * 100) : 0
}

export function resumenGeneral(campanas: AporteAlResumen, sistema: AporteAlResumen): ResumenGeneral {
  return {
    mensajes: { total: campanas.mensajes + sistema.mensajes, delSistema: sistema.mensajes },
    alcanzados: { total: campanas.alcanzados + sistema.alcanzados, delSistema: sistema.alcanzados },
    tasa: tasaDe(campanas.entregados + sistema.entregados, campanas.alcanzados + sistema.alcanzados),
    conErrores: { total: campanas.conErrores + sistema.conErrores, delSistema: sistema.conErrores },
    tasaDelSistema: sistema.alcanzados > 0 ? tasaDe(sistema.entregados, sistema.alcanzados) : null,
  }
}

/** El pie de cada tarjeta. `null` cuando el sistema no aportó nada: una línea
 *  que dice "0 del sistema" es ruido, no información. */
export function desgloseDeTarjeta(t: TarjetaDelResumen): string | null {
  if (t.delSistema <= 0) return null
  return `${t.delSistema.toLocaleString('es-CR')} del sistema`
}

/** Primer y último instante del mes en curso, en hora de Costa Rica (UTC-6),
 *  expresados en UTC — que es como se guardan las fechas. Sin esto, del 1 al
 *  último día del mes a partir de las 6 p.m. el correo cae en el mes que no es. */
export function ventanaDelMesCR(hoyYmd: string): { desde: string; hasta: string } {
  const [y, m] = hoyYmd.split('-').map(Number)
  const siguiente = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
  const iso = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01T06:00:00.000Z`
  return { desde: iso(y, m), hasta: iso(siguiente.y, siguiente.m) }
}
