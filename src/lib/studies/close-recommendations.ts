// EST-3: el bloque "Recomendar para" (oración/servicio/dirigente) del cierre
// de grupo solo aplica cuando el plan es el final de la cadena de niveles
// (N4 o posterior) o una capacitación (cadena DIS1→DIS3). Para N1–N3 y el
// resto de planes (SCJ, PREMAT, campañas, externas) no se muestra ni se
// acepta. Módulo puro — cliente y servidor.

export function allowsCloseRecommendations(planCode: string | null | undefined): boolean {
  if (!planCode) return false
  const nivel = /^N(\d+)$/.exec(planCode)
  if (nivel) return Number(nivel[1]) >= 4
  return /^DIS\d+$/.test(planCode)
}
