import type { FilterCondition } from '@/types/filters'
import { studyLabel } from '@/data/study-catalog'
import { ACCOUNT_STATE_FILTER_LABEL } from '@/lib/members/account-state'
import {
  ESTADO_DE_DIRIGENTE_LABEL, resumenDeSeleccion, type EstadoDeDirigente,
} from '@/lib/members/filtros-de-dirigente'
import { STUDY_GROUPS, type StudyGroupKey } from '@/lib/studies/study-grouping'

/**
 * PAR-5b · El chip tiene que decir que la condición está NEGADA.
 *
 * Va como prefijo «Excepto —» y no metido en cada etiqueta: quince `case` con
 * su propia forma de negar darían quince redacciones distintas, y alguno se
 * quedaría sin. Asistencia e inscripción conservan su texto propio —«No
 * asistió», «No inscrito»— porque en español suenan mejor que «Excepto — …» y
 * ya estaban así antes de que la negación fuera general.
 */
export function conditionLabel(c: FilterCondition): string {
  const base = etiquetaSinNegar(c)
  if (!c.negate) return base
  if (c.type === 'attendance' || c.type === 'registration') return base
  return `Excepto — ${base}`
}

/** El nombre de una opción del selector: 'GRP:niveles' → «Niveles», un código
 *  → su nombre del catálogo. */
function etiquetaDeEstudio(valor: string): string {
  if (valor.startsWith('GRP:')) {
    return STUDY_GROUPS[valor.slice(4) as StudyGroupKey]?.label ?? valor
  }
  return studyLabel(valor)
}

function etiquetaSinNegar(c: FilterCondition): string {
  switch (c.type) {
    case 'study': {
      // PAR-5: sin plan el filtro vale para CUALQUIER estudio, así que el chip
      // tiene que decirlo. Antes el vacío era imposible y mostraba '?'.
      const name = c.study ? studyLabel(c.study) : 'cualquier estudio'
      if (c.status === 'completed') return `Completó: ${name}`
      // «Cursando» y no «En progreso»: desde PAR-5 exige que el grupo haya
      // arrancado, y la etiqueta vieja se leía como «está matriculado».
      if (c.status === 'in_progress') return c.study ? `Cursando: ${name}` : 'Cursando un estudio'
      if (c.status === 'leading') return c.study ? `Dando: ${name}` : 'Dando un estudio'
      if (c.status === 'not_taken') return `No llevó: ${name}`
      return `Estudio: ${name}`
    }
    case 'attendance': {
      // FIL-1: el evento puntual manda sobre el tipo; negate antepone "No asistió".
      const type = c.eventName || c.eventTypeName || c.eventType || 'Asistencia'
      const sym = c.qtyOp === 'gte' ? '≥' : c.qtyOp === 'lte' ? '≤' : '='
      const base = (!c.qty || c.qtyOp === 'any') ? type : `${type} ${sym}${c.qty}×`
      return c.negate ? `No asistió: ${base}` : base
    }
    case 'registration': {
      // FIL-2: inscripción a eventos, con estado del tiquete opcional.
      const what = c.eventName || c.eventTypeName || c.eventType || 'Evento'
      const ticket = c.ticketStatus && c.ticketStatus !== 'any'
        ? ` (${{ pending: 'pendiente', paid: 'pagado', exempted: 'exonerado', expired: 'expirado' }[c.ticketStatus]})`
        : ''
      return `${c.negate ? 'No inscrito' : 'Inscrito'}: ${what}${ticket}`
    }
    case 'service': {
      if (c.position) return `Puesto: ${c.position}`
      if (c.committee) return `Comité: ${c.committee}`
      return 'Servicio'
    }
    case 'form': {
      // El nombre viaja en la condición (se setea al agregarla desde el catálogo real).
      const name = c.formName || c.formId
      if (c.status === 'filled') return `Llenó: ${name}`
      if (c.status === 'not_filled') return `No llenó: ${name}`
      return name
    }
    case 'donor': return c.value === 'yes' ? 'Donante' : 'No donante'
    case 'age':
      if (c.min && c.max) return `Edad ${c.min}–${c.max}`
      if (c.min) return `Edad ≥${c.min}`
      if (c.max) return `Edad ≤${c.max}`
      return 'Edad'
    case 'status': return c.value === 'active' ? 'Perfil activo' : 'Perfil inactivo'
    case 'leader': return c.value === 'yes' ? 'Dirigente' : 'No dirigente'
    case 'leader_state': {
      const nombres = c.states.map(e => ESTADO_DE_DIRIGENTE_LABEL[e as EstadoDeDirigente] ?? e)
      return nombres.length > 0 ? `Dirigente: ${nombres.join(' o ')}` : 'Estado del dirigente'
    }
    case 'leader_trained':  return `Capacitado para dar: ${resumenDeSeleccion(c.studies, etiquetaDeEstudio)}`
    case 'leader_teaching': return `Dando ahora: ${resumenDeSeleccion(c.studies, etiquetaDeEstudio)}`
    case 'leader_available': return `Disponible para dar: ${resumenDeSeleccion(c.studies, etiquetaDeEstudio)}`
    case 'server': return c.value === 'yes' ? 'Sirve actualmente' : 'No sirve actualmente'
    case 'marital': return `Estado civil: ${c.value}`
    case 'account':
      return ACCOUNT_STATE_FILTER_LABEL[c.value]
    case 'created':
      if (c.from && c.to) return `Creado ${c.from} – ${c.to}`
      if (c.from) return `Creado desde ${c.from}`
      if (c.to) return `Creado hasta ${c.to}`
      return 'Fecha de creación'
  }
}
