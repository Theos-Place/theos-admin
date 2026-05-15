'use client'

import { useState, useMemo, useCallback } from 'react'
import { mockMembers, type Member } from '@/data/mock-members'
import { STUDY_CATALOG, studyLabel } from '@/data/study-catalog'

export type QuickFilter = 'todos' | 'activos' | 'donadores' | 'servidores'
export type TriState = 'si' | 'no' | 'cualquiera'

export type FilterChip = {
  id: string
  label: string
  onRemove: () => void
}

function toggled(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
}

const ESTADO_DIRIGENTE_LABEL: Record<string, string> = {
  activo: 'Activo',
  en_descanso: 'En descanso',
  disponible: 'Disponible',
}

export function useMemberFilters() {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('todos')
  const [search, setSearch] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Estudios
  const [completedStudies, setCompletedStudies]     = useState<string[]>([])
  const [inProgressStudies, setInProgressStudies]   = useState<string[]>([])
  const [ultimoEstudio, setUltimoEstudio]           = useState('')

  // Eventos
  const [tiposEvento, setTiposEvento]   = useState<string[]>([])
  const [fechaDesde, setFechaDesde]     = useState('')
  const [fechaHasta, setFechaHasta]     = useState('')
  const [sedes, setSedes]               = useState<string[]>([])

  // Voluntarios
  const [comites, setComites]                       = useState<string[]>([])
  const [estadoServicio, setEstadoServicio]         = useState<TriState>('cualquiera')

  // Dirigentes
  const [esDirigente, setEsDirigente]               = useState<TriState>('cualquiera')
  const [estadosDirigente, setEstadosDirigente]     = useState<string[]>([])

  // Datos personales
  const [edadDesde, setEdadDesde]         = useState<number | ''>('')
  const [edadHasta, setEdadHasta]         = useState<number | ''>('')
  const [donador, setDonador]             = useState<TriState>('cualquiera')
  const [estadoPerfil, setEstadoPerfil]   = useState<'activo' | 'inactivo' | 'todos'>('todos')

  // Single togglers
  const toggleCompletedStudy   = useCallback((v: string) => setCompletedStudies(p => toggled(p, v)), [])
  const toggleInProgressStudy  = useCallback((v: string) => setInProgressStudies(p => toggled(p, v)), [])
  const toggleTipoEvento       = useCallback((v: string) => setTiposEvento(p => toggled(p, v)), [])
  const toggleSede             = useCallback((v: string) => setSedes(p => toggled(p, v)), [])
  const toggleComite           = useCallback((v: string) => setComites(p => toggled(p, v)), [])
  const toggleEstadoDirigente  = useCallback((v: string) => setEstadosDirigente(p => toggled(p, v)), [])

  // Stage togglers — select/deselect all studies in a stage at once
  const toggleStageCompleted = useCallback((stage: string) => {
    const codes = STUDY_CATALOG.filter(s => s.stage === stage).map(s => s.code as string)
    setCompletedStudies(prev => {
      const allSelected = codes.every(c => prev.includes(c))
      if (allSelected) return prev.filter(c => !codes.includes(c))
      return [...new Set([...prev, ...codes])]
    })
  }, [])

  const toggleStageInProgress = useCallback((stage: string) => {
    const codes = STUDY_CATALOG.filter(s => s.stage === stage).map(s => s.code as string)
    setInProgressStudies(prev => {
      const allSelected = codes.every(c => prev.includes(c))
      if (allSelected) return prev.filter(c => !codes.includes(c))
      return [...new Set([...prev, ...codes])]
    })
  }, [])

  const filteredMembers = useMemo((): Member[] => {
    let list = mockMembers

    if      (quickFilter === 'activos')    list = list.filter(m => m.status === 'active')
    else if (quickFilter === 'donadores')  list = list.filter(m => m.is_donor)
    else if (quickFilter === 'servidores') list = list.filter(m => m.is_server)

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.cedula.includes(q)
      )
    }

    if (completedStudies.length > 0)
      list = list.filter(m => completedStudies.some(c => m.completed_studies.includes(c)))

    if (inProgressStudies.length > 0)
      list = list.filter(m => m.current_study != null && inProgressStudies.includes(m.current_study))

    if (ultimoEstudio) {
      list = list.filter(m => {
        const last = m.completed_studies[m.completed_studies.length - 1]
        return last === ultimoEstudio
      })
    }

    if (tiposEvento.length > 0)
      list = list.filter(m => tiposEvento.some(t => m.tipos_evento.includes(t)))
    if (sedes.length > 0)
      list = list.filter(m => sedes.includes(m.sede))

    if (comites.length > 0)
      list = list.filter(m => comites.some(c => m.comites.includes(c)))
    if (estadoServicio !== 'cualquiera')
      list = list.filter(m => estadoServicio === 'si' ? m.is_server : !m.is_server)

    if (esDirigente !== 'cualquiera')
      list = list.filter(m => esDirigente === 'si' ? m.es_dirigente : !m.es_dirigente)
    if (estadosDirigente.length > 0)
      list = list.filter(m => m.estado_dirigente != null && estadosDirigente.includes(m.estado_dirigente))

    if (edadDesde !== '')
      list = list.filter(m => m.age >= (edadDesde as number))
    if (edadHasta !== '')
      list = list.filter(m => m.age <= (edadHasta as number))
    if (donador !== 'cualquiera')
      list = list.filter(m => donador === 'si' ? m.is_donor : !m.is_donor)
    if (estadoPerfil !== 'todos')
      list = list.filter(m => estadoPerfil === 'activo' ? m.status === 'active' : m.status === 'inactive')

    return list
  }, [
    quickFilter, search,
    completedStudies, inProgressStudies, ultimoEstudio,
    tiposEvento, sedes,
    comites, estadoServicio,
    esDirigente, estadosDirigente,
    edadDesde, edadHasta, donador, estadoPerfil,
  ])

  const activeChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = []

    completedStudies.forEach(v => chips.push({
      id: `cs-${v}`, label: `Completado: ${studyLabel(v)}`,
      onRemove: () => setCompletedStudies(p => p.filter(x => x !== v)),
    }))
    inProgressStudies.forEach(v => chips.push({
      id: `ip-${v}`, label: `En progreso: ${studyLabel(v)}`,
      onRemove: () => setInProgressStudies(p => p.filter(x => x !== v)),
    }))
    if (ultimoEstudio) chips.push({
      id: 'ue', label: `Último: ${studyLabel(ultimoEstudio)}`,
      onRemove: () => setUltimoEstudio(''),
    })
    tiposEvento.forEach(v => chips.push({
      id: `te-${v}`, label: `Evento: ${v}`,
      onRemove: () => setTiposEvento(p => p.filter(x => x !== v)),
    }))
    if (fechaDesde) chips.push({
      id: 'fd', label: `Desde ${fechaDesde}`,
      onRemove: () => setFechaDesde(''),
    })
    if (fechaHasta) chips.push({
      id: 'fh', label: `Hasta ${fechaHasta}`,
      onRemove: () => setFechaHasta(''),
    })
    sedes.forEach(v => chips.push({
      id: `sede-${v}`, label: `Sede: ${v}`,
      onRemove: () => setSedes(p => p.filter(x => x !== v)),
    }))
    comites.forEach(v => chips.push({
      id: `com-${v}`, label: `Comité: ${v}`,
      onRemove: () => setComites(p => p.filter(x => x !== v)),
    }))
    if (estadoServicio !== 'cualquiera') chips.push({
      id: 'esv', label: `Servicio: ${estadoServicio === 'si' ? 'Activo' : 'Inactivo'}`,
      onRemove: () => setEstadoServicio('cualquiera'),
    })
    if (esDirigente !== 'cualquiera') chips.push({
      id: 'ed', label: `Dirigente: ${esDirigente === 'si' ? 'Sí' : 'No'}`,
      onRemove: () => setEsDirigente('cualquiera'),
    })
    estadosDirigente.forEach(v => chips.push({
      id: `edd-${v}`, label: `Est. dirig.: ${ESTADO_DIRIGENTE_LABEL[v] ?? v}`,
      onRemove: () => setEstadosDirigente(p => p.filter(x => x !== v)),
    }))
    if (edadDesde !== '') chips.push({
      id: 'edad-min', label: `Edad ≥ ${edadDesde}`,
      onRemove: () => setEdadDesde(''),
    })
    if (edadHasta !== '') chips.push({
      id: 'edad-max', label: `Edad ≤ ${edadHasta}`,
      onRemove: () => setEdadHasta(''),
    })
    if (donador !== 'cualquiera') chips.push({
      id: 'don', label: `Donador: ${donador === 'si' ? 'Sí' : 'No'}`,
      onRemove: () => setDonador('cualquiera'),
    })
    if (estadoPerfil !== 'todos') chips.push({
      id: 'ep', label: `Perfil: ${estadoPerfil === 'activo' ? 'Activo' : 'Inactivo'}`,
      onRemove: () => setEstadoPerfil('todos'),
    })

    return chips
  }, [
    completedStudies, inProgressStudies, ultimoEstudio,
    tiposEvento, fechaDesde, fechaHasta, sedes,
    comites, estadoServicio,
    esDirigente, estadosDirigente,
    edadDesde, edadHasta, donador, estadoPerfil,
  ])

  const clearAll = useCallback(() => {
    setCompletedStudies([])
    setInProgressStudies([])
    setUltimoEstudio('')
    setTiposEvento([])
    setFechaDesde('')
    setFechaHasta('')
    setSedes([])
    setComites([])
    setEstadoServicio('cualquiera')
    setEsDirigente('cualquiera')
    setEstadosDirigente([])
    setEdadDesde('')
    setEdadHasta('')
    setDonador('cualquiera')
    setEstadoPerfil('todos')
  }, [])

  return {
    quickFilter, setQuickFilter,
    search, setSearch,
    advancedOpen, setAdvancedOpen,
    completedStudies, toggleCompletedStudy, toggleStageCompleted,
    inProgressStudies, toggleInProgressStudy, toggleStageInProgress,
    ultimoEstudio, setUltimoEstudio,
    tiposEvento, toggleTipoEvento,
    fechaDesde, setFechaDesde,
    fechaHasta, setFechaHasta,
    sedes, toggleSede,
    comites, toggleComite,
    estadoServicio, setEstadoServicio,
    esDirigente, setEsDirigente,
    estadosDirigente, toggleEstadoDirigente,
    edadDesde, setEdadDesde,
    edadHasta, setEdadHasta,
    donador, setDonador,
    estadoPerfil, setEstadoPerfil,
    filteredMembers,
    activeFilterCount: activeChips.length,
    activeChips,
    clearAll,
  }
}
