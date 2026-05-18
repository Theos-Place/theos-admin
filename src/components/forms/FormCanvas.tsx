'use client'

import { useState } from 'react'
import { GripVertical, Copy, Trash2, Pencil, Zap, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FormFieldNew } from '@/data/mock-forms'
import { FieldTypeIcon } from './FieldTypeIcon'
import { FieldPreview } from './FieldPreview'

interface FormCanvasProps {
  fields: FormFieldNew[]
  activeFieldId: string | null
  onFieldsChange: (fields: FormFieldNew[]) => void
  onSelectField: (id: string) => void
  onDuplicateField: (id: string) => void
  onDeleteField: (id: string) => void
  onFocusLogic?: (id: string) => void
}

export function FormCanvas({
  fields,
  activeFieldId,
  onFieldsChange,
  onSelectField,
  onDuplicateField,
  onDeleteField,
  onFocusLogic,
}: FormCanvasProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function handleDragStart(index: number) { setDragIndex(index) }

  function handleDragOver(e: React.DragEvent, targetIndex: number) {
    e.preventDefault()
    setDragOverIndex(targetIndex)
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null); setDragOverIndex(null); return
    }
    const newFields = [...fields]
    const [removed] = newFields.splice(dragIndex, 1)
    newFields.splice(targetIndex, 0, removed)
    onFieldsChange(newFields.map((f, i) => ({ ...f, sort_order: i })))
    setDragIndex(null); setDragOverIndex(null)
  }

  function handleDragEnd() { setDragIndex(null); setDragOverIndex(null) }

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-80 rounded-2xl border-2 border-dashed gap-3" style={{ borderColor: 'var(--outline-variant)' }}>
        <div className="h-12 w-12 rounded-xl bg-navy/5 flex items-center justify-center">
          <GripVertical size={22} className="text-navy-light/30" />
        </div>
        <p className="text-sm text-navy-light/40 text-center max-w-xs" style={{ fontFamily: 'var(--font-body)' }}>
          Hacé clic en un tipo de campo para agregarlo, o arrastrálo aquí
        </p>
      </div>
    )
  }

  // Compute page numbers for page_break display
  let pageNum = 1
  const pageMap: Record<string, number> = {}
  fields.forEach(f => {
    if (f.type === 'page_break') {
      pageNum++
      pageMap[f.id] = pageNum
    }
  })

  return (
    <div className="space-y-2">
      {fields.map((field, index) => {
        const isActive = field.id === activeFieldId
        const isDragging = dragIndex === index
        const isOver = dragOverIndex === index && dragIndex !== index
        const logicCount = field.logic_rules?.length ?? 0

        // page_break gets a special full-width divider card
        if (field.type === 'page_break') {
          const pgNum = pageMap[field.id] ?? 2
          return (
            <div
              key={field.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={e => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelectField(field.id)}
              className={cn(
                'group relative rounded-2xl border-2 border-dashed px-4 py-3 cursor-pointer transition-all',
                isActive ? 'border-blue-400 bg-blue-50/50' : 'hover:border-navy/30',
                isDragging ? 'opacity-30' : '',
                isOver ? 'ring-2 ring-blue-300' : ''
              )}
              style={{ borderColor: isActive ? undefined : 'var(--outline-variant)' }}
            >
              <div className="flex items-center gap-3">
                <GripVertical size={15} className="text-navy-light/20 cursor-grab shrink-0" />
                <FileText size={14} className="text-blue-400 shrink-0" />
                <div className="flex-1">
                  <span className="text-[11px] font-bold text-blue-500 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
                    INICIO DE PÁGINA {pgNum}
                  </span>
                  {field.label && (
                    <span className="ml-2 text-[12px] text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>· {field.label}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={e => { e.stopPropagation(); onSelectField(field.id) }} className="h-7 w-7 rounded-lg hover:bg-navy/10 flex items-center justify-center transition-colors">
                    <Pencil size={12} className="text-navy-light/60" />
                  </button>
                  <button type="button" onClick={e => { e.stopPropagation(); onDeleteField(field.id) }} className="h-7 w-7 rounded-lg hover:bg-coral/10 flex items-center justify-center transition-colors">
                    <Trash2 size={12} className="text-coral" />
                  </button>
                </div>
              </div>
              {isActive && <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-blue-400" />}
            </div>
          )
        }

        return (
          <div
            key={field.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={e => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelectField(field.id)}
            className={cn(
              'group relative rounded-2xl border transition-all cursor-pointer',
              isActive ? 'border-coral shadow-sm' : 'hover:border-navy/20',
              isDragging ? 'opacity-30' : 'opacity-100',
              isOver ? 'ring-2 ring-coral/40' : '',
              field.type === 'section' ? 'py-3 px-4' : 'p-4'
            )}
            style={{
              background: 'var(--surface-card)',
              borderColor: isActive ? undefined : 'var(--outline-variant)',
              boxShadow: isActive ? undefined : 'var(--shadow-md)',
            }}
          >
            {/* Action bar */}
            <div className={cn('absolute top-2 right-2 flex items-center gap-1 transition-opacity z-10', 'opacity-0 group-hover:opacity-100')}>
              {logicCount > 0 && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onFocusLogic?.(field.id) }}
                  className="flex items-center gap-1 h-7 rounded-lg px-2 bg-amber-50 hover:bg-amber-100 transition-colors"
                  title={`${logicCount} regla${logicCount !== 1 ? 's' : ''} de lógica`}
                >
                  <Zap size={11} className="text-amber-600" />
                  <span className="text-[10px] font-bold text-amber-600">{logicCount}</span>
                </button>
              )}
              <button type="button" onClick={e => { e.stopPropagation(); onSelectField(field.id) }} className="h-7 w-7 rounded-lg hover:bg-navy/10 flex items-center justify-center transition-colors" title="Editar">
                <Pencil size={12} className="text-navy-light/60" />
              </button>
              <button type="button" onClick={e => { e.stopPropagation(); onDuplicateField(field.id) }} className="h-7 w-7 rounded-lg hover:bg-navy/10 flex items-center justify-center transition-colors" title="Duplicar">
                <Copy size={12} className="text-navy-light/60" />
              </button>
              <button type="button" onClick={e => { e.stopPropagation(); onDeleteField(field.id) }} className="h-7 w-7 rounded-lg hover:bg-coral/10 flex items-center justify-center transition-colors" title="Eliminar">
                <Trash2 size={12} className="text-coral" />
              </button>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 cursor-grab active:cursor-grabbing shrink-0">
                <GripVertical size={16} className="text-navy-light/20 hover:text-navy-light/50 transition-colors" />
              </div>

              {field.type === 'section' ? (
                <div className="flex-1">
                  <FieldPreview field={field} compact />
                </div>
              ) : (
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 h-5 w-5 rounded flex items-center justify-center mt-0.5" style={{ background: 'var(--surface-low)' }}>
                      <FieldTypeIcon type={field.type} size={11} className="text-navy-light/50" />
                    </div>
                    <div className="flex-1 min-w-0 flex items-start gap-2">
                      <p className="text-[13px] font-semibold text-navy leading-snug flex-1" style={{ fontFamily: 'var(--font-display)' }}>
                        {field.label || <span className="text-navy-light/30 italic">Sin etiqueta</span>}
                        {field.is_required && <span className="ml-1 text-coral text-[11px]">*</span>}
                      </p>
                      {logicCount > 0 && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onFocusLogic?.(field.id) }}
                          className="shrink-0 flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5"
                        >
                          <Zap size={9} className="text-amber-600" />
                          <span className="text-[9px] font-bold text-amber-600">{logicCount} regla{logicCount !== 1 ? 's' : ''}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {field.helper_text && (
                    <p className="text-[11px] text-navy-light/40 ml-7" style={{ fontFamily: 'var(--font-body)' }}>{field.helper_text}</p>
                  )}
                  <div className="pointer-events-none">
                    <FieldPreview field={field} compact />
                  </div>
                </div>
              )}

              <span className="shrink-0 mt-0.5 h-5 min-w-5 rounded-full bg-navy/5 flex items-center justify-center text-[10px] text-navy-light/40 font-mono px-1">
                {index + 1}
              </span>
            </div>

            {isActive && <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-coral" />}
          </div>
        )
      })}
    </div>
  )
}
