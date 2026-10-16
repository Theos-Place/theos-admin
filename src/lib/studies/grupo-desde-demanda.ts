/**
 * EST-29 · Lo que la pantalla de demanda le pasa a «Nuevo grupo» por la URL.
 *
 *   /estudios/grupos/nuevo?plan=N1&zona=escazu&dia=L&franja=noche&solicitudes=id1,id2
 *
 * Solo prellena: todo se puede cambiar antes de crear. Lo que no se entienda
 * se ignora en vez de romper la pantalla. Módulo PURO.
 */
const DIA_DE_NOMBRE: Record<string, string> = {
  lunes: 'L', martes: 'M', miercoles: 'X', miércoles: 'X', jueves: 'J', viernes: 'V', sabado: 'S', sábado: 'S', domingo: 'D',
}
const HORA_DE_FRANJA: Record<string, string> = { mañana: '09:00', manana: '09:00', tarde: '15:00', noche: '19:00' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PrellenadoDeDemanda = {
  plan: string
  zona: string | null
  dia: string | null
  hora: string | null
  solicitudes: string[]
}

/** El día en la letra que usa el grupo ('L'…'D'), venga como letra o como nombre. */
export function diaComoLetra(v: string | null | undefined): string | null {
  if (!v) return null
  const t = v.trim()
  if (/^[LMXJVSD]$/.test(t)) return t
  return DIA_DE_NOMBRE[t.toLowerCase()] ?? null
}

export function prellenadoDesdeDemanda(p: { get(k: string): string | null }): PrellenadoDeDemanda | null {
  const plan = (p.get('plan') ?? '').trim()
  if (!plan) return null
  const zona = (p.get('zona') ?? '').trim()
  return {
    plan,
    zona: zona && !zona.startsWith('__') ? zona : null,
    dia: diaComoLetra(p.get('dia')),
    hora: HORA_DE_FRANJA[(p.get('franja') ?? '').trim().toLowerCase()] ?? null,
    solicitudes: (p.get('solicitudes') ?? '').split(',').map(x => x.trim()).filter(x => UUID.test(x)).slice(0, 200),
  }
}

/** La URL de «Abrir grupo con estos datos» para un clúster. */
export function urlDeNuevoGrupo(c: { planCode: string; zona: string | null; diasMasPedidos: string[]; franjaMasPedida: string | null; solicitudes: string[] }): string {
  const q = new URLSearchParams({ plan: c.planCode })
  if (c.zona && !c.zona.startsWith('__')) q.set('zona', c.zona)
  const dia = diaComoLetra(c.diasMasPedidos[0])
  if (dia) q.set('dia', dia)
  if (c.franjaMasPedida) q.set('franja', c.franjaMasPedida)
  if (c.solicitudes.length) q.set('solicitudes', c.solicitudes.join(','))
  return `/estudios/grupos/nuevo?${q.toString()}`
}
