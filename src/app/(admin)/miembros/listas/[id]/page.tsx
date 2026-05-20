'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { listStore } from '@/data/mock-member-lists'
import { mockMembers, type Member } from '@/data/mock-members'
import { ColumnSelector, type ColumnDef } from '@/components/shared/ColumnSelector'
import { ExportButton } from '@/components/shared/ExportButton'
import { SortableHeader } from '@/components/shared/SortableHeader'
import { useSortableTable } from '@/hooks/useSortableTable'
import { cn } from '@/lib/utils'
import {
  ChevronLeft, MessageCircle, ArrowRight, RefreshCw, ExternalLink,
} from 'lucide-react'

function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date()
  const nac = new Date(fechaNacimiento)
  let edad = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--
  return edad
}

function initials(m: Member) {
  return (m.first_name[0] + m.last_name[0]).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-navy text-white', 'bg-coral text-white', 'bg-teal-deep text-white', 'bg-navy-light text-white',
]
function avatarColor(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

const LIST_MEMBER_COLUMNS: ColumnDef<Member>[] = [
  {
    key: 'name', label: 'Nombre', defaultVisible: true, alwaysVisible: true,
    exportValue: m => `${m.first_name} ${m.last_name}`,
  },
  {
    key: 'cedula', label: 'Cédula', defaultVisible: true,
    exportValue: m => m.cedula ?? 'Sin cédula',
  },
  {
    key: 'age', label: 'Edad', defaultVisible: true,
    exportValue: m => m.birth_date ? String(calcularEdad(m.birth_date)) : '',
  },
  {
    key: 'email', label: 'Correo', defaultVisible: false,
  },
  {
    key: 'phone', label: 'Teléfono', defaultVisible: false,
  },
  {
    key: 'status', label: 'Estado', defaultVisible: true,
    exportValue: m => m.status === 'active' ? 'Activo' : 'Inactivo',
  },
  {
    key: 'is_donor', label: 'Donador', defaultVisible: false,
    exportValue: m => m.is_donor ? 'Sí' : 'No',
  },
  {
    key: 'current_study', label: 'Nivel actual', defaultVisible: false,
    exportValue: m => m.current_study ?? '',
  },
  {
    key: 'service_position', label: 'Puesto de servicio', defaultVisible: false, exportable: true,
    render: m => {
      const active = m.service_history?.find(s => s.status === 'activo' && s.to === null)
      return active
        ? <span style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>{active.position}</span>
        : <span className="text-navy-light/30" style={{ fontSize: 12 }}>—</span>
    },
    exportValue: m => m.service_history?.find(s => s.status === 'activo' && s.to === null)?.position ?? '',
  },
  {
    key: 'service_committee', label: 'Comité', defaultVisible: false, exportable: true,
    render: m => {
      const active = m.service_history?.find(s => s.status === 'activo' && s.to === null)
      return active
        ? <span style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}>{active.committee}</span>
        : <span className="text-navy-light/30" style={{ fontSize: 12 }}>—</span>
    },
    exportValue: m => m.service_history?.find(s => s.status === 'activo' && s.to === null)?.committee ?? '',
  },
  {
    key: 'join_date', label: 'Fecha de ingreso', defaultVisible: false,
    exportValue: m => m.join_date ? new Date(m.join_date).toLocaleDateString('es-CR') : '',
  },
]

export default function ListaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const list = useMemo(() => listStore.getById(id), [id])

  const [visibleColumns, setVisibleColumns] = useState<ColumnDef<Member>[]>(
    LIST_MEMBER_COLUMNS.filter(c => c.defaultVisible)
  )

  const listMembers = useMemo(
    () => mockMembers.filter(m => list?.member_ids.includes(m.id)),
    [list]
  )

  const { sorted, sortKey, sortDir, toggleSort } = useSortableTable(listMembers)

  if (!list) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <p className="text-sm text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
          Lista no encontrada.
        </p>
      </div>
    )
  }

  function handleComunicar() {
    const ids = list!.member_ids.join(',')
    const label = encodeURIComponent(list!.name)
    router.push(`/comunicaciones/nueva?mode=manual&members=${ids}&segment_label=${label}&list_id=${list!.id}`)
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Back */}
      <Link
        href="/miembros/listas"
        className="inline-flex items-center gap-1.5 text-sm text-navy-light/50 hover:text-navy transition-colors"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <ChevronLeft size={15} />
        Listas guardadas
      </Link>

      {/* Header */}
      <div
        className="rounded-2xl px-6 py-5"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        <div className="flex items-start gap-4 justify-between flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-widest uppercase',
                  list.is_dynamic ? 'bg-teal-soft/30 text-teal-deep' : 'bg-navy-light/10 text-navy-light/60'
                )}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {list.is_dynamic ? 'Dinámica' : 'Snapshot'}
              </span>
              <span className="text-[12px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
                {list.member_count.toLocaleString('es-CR')} miembros
              </span>
            </div>
            <h1
              className="text-2xl text-navy"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              {list.name}
            </h1>
            {list.description && (
              <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
                {list.description}
              </p>
            )}
            <p className="text-[12px] text-navy-light/40" style={{ fontFamily: 'var(--font-body)' }}>
              Creada por {list.created_by} · {new Date(list.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/miembros"
              className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
              style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
            >
              <ExternalLink size={14} />
              Abrir en búsqueda
            </Link>
            <button
              onClick={handleComunicar}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-all"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              <MessageCircle size={14} />
              Comunicar a esta lista
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic / Snapshot banner */}
      {list.is_dynamic ? (
        <div
          className="rounded-2xl px-5 py-3.5 flex items-center gap-3"
          style={{ background: 'rgba(61,185,122,0.08)', border: '1px solid rgba(61,185,122,0.25)' }}
        >
          <RefreshCw size={14} className="text-teal-deep shrink-0" />
          <p className="text-[13px] text-teal-deep" style={{ fontFamily: 'var(--font-body)' }}>
            Esta lista se recalcula automáticamente con los filtros guardados
            <span className="text-teal-deep/60"> · Última actualización: {new Date(list.updated_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl px-5 py-3.5 flex items-center gap-3"
          style={{ background: 'var(--surface-low)', border: '1px solid var(--outline-variant)' }}
        >
          <p className="text-[13px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            Esta lista contiene un snapshot de <strong className="text-navy">{list.member_count.toLocaleString('es-CR')}</strong> miembros del {new Date(list.updated_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
            <span className="mx-2">·</span>
            <button
              className="text-coral hover:underline"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              onClick={() => {
                listStore.update(list.id, { updated_at: new Date().toISOString() })
                router.refresh()
              }}
            >
              Actualizar snapshot
            </button>
          </p>
        </div>
      )}

      {/* Segment label card */}
      <div
        className="rounded-2xl px-5 py-4 space-y-1"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        <p className="text-[10px] uppercase tracking-widests text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Filtros que generaron esta lista
        </p>
        <p className="text-sm text-navy" style={{ fontFamily: 'var(--font-body)' }}>
          {list.segment_label}
        </p>
        {list.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {list.tags.map(tag => (
              <span
                key={tag}
                className="rounded-full bg-surface-low px-2.5 py-0.5 text-[10px] text-navy-light/60"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Members table */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--outline-variant)' }}>
          <p className="text-[12px] text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>
            <strong className="text-navy">{listMembers.length}</strong> miembros en esta lista
            {list.member_count > listMembers.length && (
              <span className="ml-1 text-navy-light/30">(mock: mostrando {listMembers.length} de {list.member_count.toLocaleString('es-CR')})</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <ColumnSelector<Member>
              columns={LIST_MEMBER_COLUMNS}
              storageKey="theos_columns_lista_detail"
              onChange={setVisibleColumns}
            />
            <ExportButton<Member>
              data={sorted}
              columns={visibleColumns}
              allColumns={LIST_MEMBER_COLUMNS}
              filename={`lista-${list.id}-theos`}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                {visibleColumns.map(col => (
                  <SortableHeader
                    key={String(col.key)}
                    label={col.label}
                    sortKey={String(col.key)}
                    currentSortKey={sortKey}
                    currentSortDir={sortDir}
                    onSort={toggleSort}
                  />
                ))}
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 1}
                    className="px-4 py-12 text-center text-sm text-navy-light/40"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    No hay miembros en esta lista
                  </td>
                </tr>
              ) : (
                sorted.map((member, i) => (
                  <tr
                    key={member.id}
                    onClick={() => router.push(`/miembros/${member.id}`)}
                    className="group transition-colors hover:bg-surface-low cursor-pointer"
                    style={i < sorted.length - 1 ? { borderBottom: '1px solid var(--outline-variant)' } : {}}
                  >
                    {visibleColumns.map(col => {
                      switch (String(col.key)) {
                        case 'name':
                          return (
                            <td key="name" className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs', avatarColor(member.id))} style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                                  {initials(member)}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-navy" style={{ fontFamily: 'var(--font-body)' }}>{member.first_name} {member.last_name}</p>
                                  <p className="truncate text-xs text-navy-light/50" style={{ fontFamily: 'var(--font-body)' }}>{member.email}</p>
                                </div>
                              </div>
                            </td>
                          )
                        case 'cedula':
                          return (
                            <td key="cedula" className="px-4 py-3.5 text-navy-light/70 tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                              {member.cedula ?? <span className="rounded-full bg-surface-low px-2 py-0.5 text-[10px] text-navy-light/30">Sin cédula</span>}
                            </td>
                          )
                        case 'age':
                          return (
                            <td key="age" className="px-4 py-3.5 text-navy-light/70 tabular-nums whitespace-nowrap" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                              {member.birth_date ? `${calcularEdad(member.birth_date)} años` : '—'}
                            </td>
                          )
                        case 'status':
                          return (
                            <td key="status" className="px-4 py-3.5">
                              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', member.status === 'active' ? 'bg-[rgba(61,185,122,0.12)] text-[#3DB97A]' : 'bg-coral/10 text-coral')} style={{ fontFamily: 'var(--font-body)' }}>
                                {member.status === 'active' ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                          )
                        case 'is_donor':
                          return (
                            <td key="is_donor" className="px-4 py-3.5">
                              {member.is_donor
                                ? <span className="rounded-full bg-coral/10 px-2.5 py-0.5 text-xs text-coral" style={{ fontFamily: 'var(--font-body)' }}>Sí</span>
                                : <span className="text-sm text-navy-light/30">—</span>
                              }
                            </td>
                          )
                        default: {
                          if (col.render) {
                            return (
                              <td key={String(col.key)} className="px-4 py-3.5">
                                {col.render(member)}
                              </td>
                            )
                          }
                          const rawVal = (member as Record<string, unknown>)[String(col.key)]
                          const display = Array.isArray(rawVal) ? (rawVal as string[]).join(', ') : String(rawVal ?? '')
                          return (
                            <td key={String(col.key)} className="px-4 py-3.5 text-sm text-navy-light/70 max-w-[180px] truncate" style={{ fontFamily: 'var(--font-body)' }}>
                              {display || '—'}
                            </td>
                          )
                        }
                      }
                    })}
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/miembros/${member.id}`) }}
                        className="rounded-lg p-1.5 text-navy-light/30 transition-all hover:bg-surface-low hover:text-coral"
                      >
                        <ArrowRight size={16} strokeWidth={1.75} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
