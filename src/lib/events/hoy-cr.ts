import { ymdCR } from '@/lib/format'

/**
 * 00:00 de hoy en Costa Rica (UTC-6, sin horario de verano), como instante ISO.
 * Módulo PURO (QA-3/M2): lo usa la lista de eventos para acotar los check-ins
 * embebidos a los de hoy.
 */
export function inicioDeHoyCR(ahora: Date = new Date()): string {
  return new Date(`${ymdCR(ahora)}T00:00:00-06:00`).toISOString()
}
