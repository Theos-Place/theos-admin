import type { FilterCondition } from '@/types/filters'
import { studyLabel } from '@/data/study-catalog'

export function conditionLabel(c: FilterCondition): string {
  switch (c.type) {
    case 'study': {
      const name = c.study ? studyLabel(c.study) : '?'
      if (c.status === 'completed') return `Completó: ${name}`
      if (c.status === 'in_progress') return `En progreso: ${name}`
      return `Estudio: ${name}`
    }
    case 'attendance': {
      const type = c.eventTypeName || c.eventType || 'Asistencia'
      if (!c.qty || c.qtyOp === 'any') return type
      const sym = c.qtyOp === 'gte' ? '≥' : c.qtyOp === 'lte' ? '≤' : '='
      return `${type} ${sym}${c.qty}×`
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
    case 'marital': return `Estado civil: ${c.value}`
    case 'created':
      if (c.from && c.to) return `Creado ${c.from} – ${c.to}`
      if (c.from) return `Creado desde ${c.from}`
      if (c.to) return `Creado hasta ${c.to}`
      return 'Fecha de creación'
  }
}
