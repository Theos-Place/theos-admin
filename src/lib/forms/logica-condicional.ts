/**
 * Formularios · Cuándo se muestra una pregunta condicional.
 *
 * EL BUG QUE ARREGLA (reportado 2026-09-18, formulario "Lugares para Estudios o
 * Actividades"). La condición "es igual a" comparaba así:
 *
 *     String(answer ?? '') === valor
 *
 * Con una pregunta de CASILLAS la respuesta es una lista, y `String(...)` la
 * pega con comas. Así que marcar solo "Actividades Sociales" funcionaba
 * —`String(['Actividades Sociales'])` da justo ese texto— pero marcar además
 * "Estudios Bíblicos cortos" daba "Estudios Bíblicos cortos,Actividades
 * Sociales", que no es igual a nada, y las preguntas dependientes DESAPARECÍAN.
 *
 * En ese formulario eso escondía "Actividades Sociales" y "Reglas del Lugar",
 * las dos obligatorias: quien ofrecía su casa para estudios Y para actividades
 * —el caso más común— quedaba con un formulario que pedía campos invisibles.
 *
 * LA REGLA: sobre una lista, "es igual a X" significa "X está marcado". Es lo
 * que espera cualquiera que arma la condición en el editor, y lo que la
 * pantalla ya hacía bien con `contains`.
 *
 * Módulo puro: el caller trae las respuestas y esto decide.
 */
import type { LogicRule, FormFieldNew } from '@/types/forms'

export type Respuesta = string | string[] | number | null | undefined
export type Respuestas = Record<string, Respuesta>

/** Texto de una respuesta escalar, para los operadores que comparan texto. */
const texto = (r: Respuesta): string => String(r ?? '')

export function cumpleCondicion(
  operador: string, respuesta: Respuesta, valor: string,
): boolean {
  const esLista = Array.isArray(respuesta)
  switch (operador) {
    // Sobre una lista, "igual a X" = "X está marcado". Ver el comentario de
    // arriba: con String(lista) solo funcionaba cuando había UNA marcada.
    case 'eq': return esLista ? respuesta.includes(valor) : texto(respuesta) === valor
    case 'neq': return esLista ? !respuesta.includes(valor) : texto(respuesta) !== valor
    case 'contains':
      return esLista ? respuesta.includes(valor) : texto(respuesta).toLowerCase().includes(valor.toLowerCase())
    case 'not_contains':
      return esLista ? !respuesta.includes(valor) : !texto(respuesta).toLowerCase().includes(valor.toLowerCase())
    case 'is_empty':
      return !respuesta || respuesta === '' || (esLista && respuesta.length === 0)
    case 'is_not_empty':
      return !!respuesta && respuesta !== '' && (!esLista || respuesta.length > 0)
    case 'gt': return Number(respuesta) > Number(valor)
    case 'lt': return Number(respuesta) < Number(valor)
    default: return false
  }
}

export function evaluarRegla(regla: LogicRule, respuestas: Respuestas): boolean {
  const resultados = regla.conditions.map(c =>
    cumpleCondicion(c.operator, respuestas[c.field_id], c.value))
  return regla.condition_operator === 'AND' ? resultados.every(Boolean) : resultados.some(Boolean)
}

/**
 * ¿Se dibuja este campo?
 *
 * GANA LA PRIMERA REGLA QUE SE CUMPLE, en el orden en que están escritas — no
 * "ocultar le gana a mostrar". Es la semántica que ya tenía la pantalla y se
 * conserva tal cual: este cambio vino a arreglar el operador `eq` sobre
 * casillas, y cambiar de paso cómo se resuelven reglas en conflicto habría
 * movido formularios que hoy funcionan.
 *
 * Sin ninguna regla que se cumpla: visible solo si NO había reglas de mostrar.
 */
export function campoVisible(
  campo: Pick<FormFieldNew, 'logic_rules'>, respuestas: Respuestas,
): boolean {
  const reglas = campo.logic_rules ?? []
  if (reglas.length === 0) return true
  for (const regla of reglas) {
    if (!evaluarRegla(regla, respuestas)) continue
    if (regla.action === 'hide') return false
    if (regla.action === 'show') return true
  }
  return !reglas.some(r => r.action === 'show')
}
