import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Clave para ordenar alfabéticamente por como se LEE un nombre.
 *
 *  Quita los signos de apertura y paréntesis del principio y los acentos, para
 *  que "¿Adónde va este bus?" caiga en la A y "(RE) Descubriendo" en la R, en
 *  vez de amontonarse antes de la primera letra. */
export function claveAlfabetica(s: string): string {
  return (s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .toLowerCase()
    .trim()
}
