import type { FilterCondition } from '@/types/filters'
import { studyLabel } from '@/data/study-catalog'
import { ACCOUNT_STATE_FILTER_LABEL } from '@/lib/members/account-state'

export function conditionLabel(c: FilterCondition): string {
  switch (c.type) {
    case 'study': {
      const name = c.study ? studyLabel(c.study) : '?'
      if (c.status === 'completed') return `Completó: ${name}`
      if (c.status === 'in_progress') return `En progreso: ${name}`
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
    case 'donor': return c.value === 'yes' ? 'Donador' : 'No donador'
    case 'age':
      if (c.min && c.max) return `Edad ${c.min}–${c.max}`
      if (c.min) return `Edad ≥${c.min}`
      if (c.max) return `Edad ≤${c.max}`
      return 'Edad'
    case 'status': return c.value === 'active' ? 'Perfil activo' : 'Perfil inactivo'
    case 'leader': return c.value === 'yes' ? 'Dirigente' : 'No dirigente'
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
