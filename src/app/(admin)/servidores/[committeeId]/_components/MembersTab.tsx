'use client'

import { Plus, Search, ExternalLink, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { RowActionsMenu } from '@/components/shared/RowActionsMenu'
import type { CommitteeServer } from '@/types/server'
import { cn } from '@/lib/utils'
import { SortableHeader } from '@/components/shared/SortableHeader'
import { type SortDirection } from '@/hooks/useSortableTable'
import { agruparPorPersona } from '@/lib/servers/committee-filter'
import { formatDate } from '@/lib/format'
import { calcularAntiguedad } from '@/lib/servers/columns'
import type { DirigenteGrupo } from '@/lib/dirigentes'
import { EstrellaDeEncargado } from './EstrellaDeEncargado'

type StatusFilter = 'active' | 'inactive' | 'all'

/** El estudio más reciente: el que está dando, o el último que dio. */
function UltimoEstudio({ grupo }: { grupo: DirigenteGrupo | null }) {
  if (!grupo) return <span className="text-navy-light/80">Sin estudios</span>
  const enCurso = grupo.status === 'en_curso' || grupo.status === 'en_matricula'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-medium text-navy">{grupo.plan_code}</span>
      <span className="truncate max-w-[16ch]" title={grupo.group_name}>{grupo.group_name}</span>
      {/* El punto solo marca «está dando ahora». Va con aria-label porque el
          color por sí solo no comunica nada a quien no lo ve. */}
      {enCurso && (
        <span className="h-1.5 w-1.5 rounded-full bg-teal-deep shrink-0" aria-label="en curso" role="img" />
      )}
    </span>
  )
}


type Props = {
  sortedMembers: CommitteeServer[]
  memberSortKey: string | null
  memberSortDir: SortDirection
  toggleMemberSort: (key: string) => void
  search: string
  onSearchChange: (value: string) => void
  statusFilter: StatusFilter
  /** Puesto elegido ('all' = todos) y los que hay para elegir. */
  positionFilter: string
  positionOptions: string[]
  onPositionFilterChange: (v: string) => void
  onStatusFilterChange: (value: StatusFilter) => void
  onChangePosition: (member: CommitteeServer) => void
  /** Sumarle OTRO puesto del mismo comité. Una persona puede tener varios. */
  onAddPosition: (member: CommitteeServer) => void
  /** Volver a activar un registro que quedó inactivo. */
  onReactivate: (member: CommitteeServer) => void
  onDisconnect: (member: CommitteeServer) => void
  onAddServerClick: () => void
  toolbarExtra?: React.ReactNode
  /** member_ids a cargo del comité — la estrella (SRV-5). */
  encargados: readonly string[]
  /**
   * Solo el Comité Dirigentes: el estudio más reciente de cada persona, para
   * la columna que ahí reemplaza a «Antigüedad». Ver la nota de la columna.
   */
  estudioPorMiembro?: ReadonlyMap<string, DirigenteGrupo | null>
  /** Nombrar encargados es de staff/dirección, no del propio lider_comite. */
  puedeMarcarEncargado: boolean
  /** member_id con el guardado en curso, para deshabilitar solo esa estrella. */
  marcandoEncargado: string | null
  onToggleEncargado: (memberId: string, encargado: boolean) => void
}

export function MembersTab({
  sortedMembers,
  memberSortKey,
  memberSortDir,
  toggleMemberSort,
  search,
  onSearchChange,
  statusFilter,
  positionFilter,
  positionOptions,
  onPositionFilterChange,
  onStatusFilterChange,
  onChangePosition,
  onAddPosition,
  onReactivate,
  onDisconnect,
  onAddServerClick,
  toolbarExtra,
  encargados,
  estudioPorMiembro,
  puedeMarcarEncargado,
  marcandoEncargado,
  onToggleEncargado,
}: Props) {
  // Se agrupa DESPUÉS de ordenar: agruparPorPersona respeta el orden de entrada,
  // así que el orden que eligió quien mira la tabla se conserva.
  const grupos = agruparPorPersona(sortedMembers)

  return (
    <div className="py-4 px-[22px] flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 sm:min-w-48 w-full sm:w-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/80" />
          <input
            className="w-full rounded-xl bg-surface-low pl-8 pr-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
            placeholder="Buscar por nombre..."
            aria-label="Buscar por nombre"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex rounded-full p-1 gap-0.5 bg-surface-low">
          {([['active', 'Activos'], ['inactive', 'Inactivos'], ['all', 'Todos']] as [StatusFilter, string][]).map(([v, l]) => (
            <button
              key={v}
              onClick={() => onStatusFilterChange(v)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[13px] transition-all duration-150 font-display',
                statusFilter === v ? 'bg-navy text-white' : 'text-navy-light/80 hover:text-navy'
              )}
            >
              {l}
            </button>
          ))}
        </div>
        {/* Filtro por PUESTO. Los comités grandes tienen decenas de personas
            repartidas en una docena de puestos —Sede Meridiano Martes: 67 en
            unos 15— y no había cómo mirar uno solo. Se esconde cuando el comité
            tiene un solo puesto: ahí no filtra nada. */}
        {positionOptions.length > 1 && (
          <select
            value={positionFilter}
            onChange={e => onPositionFilterChange(e.target.value)}
            aria-label="Filtrar por puesto"
            className="rounded-full bg-surface-low px-3 py-2 text-[13px] text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body max-w-[14rem]"
          >
            <option value="all">Todos los puestos</option>
            {positionOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {toolbarExtra}
        <button
          className="inline-flex items-center gap-1.5 rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] px-4 py-2 text-[13px] text-white hover:bg-coral-deep transition-colors font-body"
          onClick={onAddServerClick}
        >
          <Plus size={13} />
          Añadir servidor
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[rgba(22,20,64,0.09)]">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--outline-variant)]">
                <SortableHeader label="Servidor"   sortKey="name"       currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                <SortableHeader label="Puesto"     sortKey="position"   currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                {/* En el Comité Dirigentes no se muestra «Inicio»: esa fecha
                    es la de la sincronización del Excel Madre (183 de 278 la
                    tienen igual, el 2026-09-11) y otros 46 no la tienen. No
                    dice cuándo entró nadie, así que ocupa una columna para
                    confundir. En los demás comités sí es un dato real. */}
                {!estudioPorMiembro && (
                  <SortableHeader label="Inicio"     sortKey="start_date" currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                )}
                <SortableHeader label={estudioPorMiembro ? 'Último estudio' : 'Antigüedad'} sortKey="seniority"  currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                <SortableHeader label="Estado"     sortKey="status"     currentSortKey={memberSortKey} currentSortDir={memberSortDir} onSort={toggleMemberSort} />
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {grupos.map((g, idx) => {
                const m = g.puestos[0]
                return (
                <tr
                  // La clave lleva el PUESTO además de la persona: quien sirve
                  // en dos puestos del mismo comité produce dos filas, y con
                  // solo el member_id las dos compartían clave. React entonces
                  // no puede distinguirlas y al filtrar reutiliza las de antes:
                  // se elegía un puesto y seguían apareciendo filas de otros.
                  // En Comité Oración hay 50 personas con dos o más puestos.
                  key={g.member_id}
                  className={cn('transition-colors', idx % 2 === 1 ? 'bg-surface-low/40' : '')}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-white font-display">
                          {m.initials}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-navy font-body">
                        {m.name}
                      </span>
                      <EstrellaDeEncargado
                        nombre={g.name}
                        encargado={encargados.includes(g.member_id)}
                        puedeEditar={puedeMarcarEncargado}
                        guardando={marcandoEncargado === g.member_id}
                        onToggle={() => onToggleEncargado(g.member_id, !encargados.includes(g.member_id))}
                      />
                    </div>
                  </td>
                  {/* TODOS sus puestos. Antes cada puesto era una fila y la
                      persona aparecía repetida, lo que se lee como un duplicado
                      por error (hay 50 así solo en Comité Oración). */}
                  <td className="px-4 py-3 text-[13px] text-navy-light/80 max-w-[180px] font-body">
                    {g.puestos.map(p2 => (
                      <span key={p2.position_id ?? p2.position} className="block">
                        {p2.position}
                        {p2.status !== 'active' && (
                          <span className="ml-1 text-[11px] text-navy-light/80">(inactivo)</span>
                        )}
                      </span>
                    ))}
                  </td>
                  {!estudioPorMiembro && (
                    <td className="px-4 py-3 text-[13px] text-navy-light/80 whitespace-nowrap font-body">
                      {formatDate(m.start_date)}
                    </td>
                  )}
                  {/*
                    EN EL COMITÉ DIRIGENTES esta columna muestra el estudio más
                    reciente en vez de la antigüedad. La antigüedad ahí no decía
                    nada: 183 de los 278 tienen `start_date` del 2026-09-11 —la
                    fecha de la sincronización del Excel Madre, no de cuándo
                    entraron— y otros 46 la tienen nula. La columna decía
                    «0 meses» para casi todos y «NaN año» para el resto.
                  */}
                  <td className="px-4 py-3 text-[13px] text-navy-light/80 whitespace-nowrap font-body">
                    {estudioPorMiembro ? <UltimoEstudio grupo={estudioPorMiembro.get(m.member_id) ?? null} />
                      : calcularAntiguedad(m.start_date)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold font-display',
                        g.status === 'active'
                          ? 'bg-teal-deep/10 text-teal-deep'
                          : 'bg-navy-light/10 text-navy-light/80'
                      )}
                    >
                      {g.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <RowActionsMenu
                        label={`Acciones de ${g.name}`}
                        actions={[
                          { label: 'Ver perfil', icon: <ExternalLink size={13} />, href: `/miembros/${g.member_id}` },
                          { label: 'Agregar otro puesto…', onClick: () => onAddPosition(m) },
                          // Cambiar y dar de baja son POR PUESTO. Con dos, el
                          // nombre del puesto va en la acción: sin eso no se
                          // sabría cuál de los dos se está tocando.
                          ...g.puestos.flatMap(p2 => {
                            const suf = g.puestos.length > 1 ? ` · ${p2.position}` : ''
                            return p2.status === 'active'
                              ? [
                                  { label: `Cambiar puesto${suf}`, onClick: () => onChangePosition(p2) },
                                  { label: `Desvincular${suf}`, onClick: () => onDisconnect(p2), danger: true },
                                ]
                              // A un registro inactivo no se le ofrece
                              // desvincular —ya lo está— sino reactivarlo: "un
                              // mae que regresó" es cotidiano y no había cómo.
                              : [{ label: `Reactivar${suf}`, onClick: () => onReactivate(p2) }]
                          }),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: tarjetas */}
        <ul className="md:hidden">
          {grupos.map((g, i) => {
            const m = g.puestos[0]
            return (
            <li
              key={g.member_id}
              className="flex items-center gap-3 px-4 py-3"
              style={i < sortedMembers.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
            >
              <div className="h-9 w-9 rounded-full bg-navy flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-white font-display">{m.initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-navy font-body">
                  <span className="truncate">{m.name}</span>
                  <EstrellaDeEncargado
                    nombre={g.name}
                    encargado={encargados.includes(g.member_id)}
                    puedeEditar={puedeMarcarEncargado}
                    guardando={marcandoEncargado === g.member_id}
                    onToggle={() => onToggleEncargado(g.member_id, !encargados.includes(g.member_id))}
                  />
                </p>
                <p className="truncate text-[13px] text-navy-light/80 font-body">
                  {g.puestos.map(p2 => p2.position).join(' · ')}
                  {estudioPorMiembro
                    ? <> · <UltimoEstudio grupo={estudioPorMiembro.get(m.member_id) ?? null} /></>
                    : <> · {calcularAntiguedad(m.start_date)}</>}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold font-display',
                  g.status === 'active' ? 'bg-teal-deep/10 text-teal-deep' : 'bg-navy-light/10 text-navy-light/80',
                )}
              >
                {g.status === 'active' ? 'Activo' : 'Inactivo'}
              </span>
              <div className="shrink-0">
                <RowActionsMenu
                  label={`Acciones de ${g.name}`}
                  actions={[
                    { label: 'Ver perfil', icon: <ExternalLink size={13} />, href: `/miembros/${g.member_id}` },
                    { label: 'Agregar otro puesto…', onClick: () => onAddPosition(m) },
                    ...g.puestos.flatMap(p2 => {
                      const suf = g.puestos.length > 1 ? ` · ${p2.position}` : ''
                      return p2.status === 'active'
                        ? [
                            { label: `Cambiar puesto${suf}`, onClick: () => onChangePosition(p2) },
                            { label: `Desvincular${suf}`, onClick: () => onDisconnect(p2), danger: true },
                          ]
                        : [{ label: `Reactivar${suf}`, onClick: () => onReactivate(p2) }]
                    }),
                  ]}
                />
              </div>
            </li>
            )
          })}
        </ul>

        {sortedMembers.length === 0 && (
          <EmptyState icon={Users} title="No hay servidores con ese filtro" />
        )}
      </div>
    </div>
  )
}
