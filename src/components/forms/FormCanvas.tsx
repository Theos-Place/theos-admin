'use client'

import { useState } from 'react'
import { GripVertical, Copy, Trash2, Pencil } from 'lucide-react'
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
}

export function FormCanvas({
  fields,
  activeFieldId,
  onFieldsChange,
  onSelectField,
  onDuplicateField,
  onDeleteField,
}: FormCanvasProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, targetIndex: number) {
    e.preventDefault()
    setDragOverIndex(targetIndex)
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const newFields = [...fields]
    const [removed] = newFields.splice(dragIndex, 1)
    newFields.splice(targetIndex, 0, removed)
    onFieldsChange(newFields.map((f, i) => ({ ...f, sort_order: i })))
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-80 rounded-2xl border-2 border-dashed gap-3"
        style={{ borderColor: 'var(--outline-variant)' }}>
        <div className="h-12 w-12 rounded-xl bg-navy/5 flex items-center justify-center">
          <GripVertical size={22} className="text-navy-light/30" />
        </div>
        <p className="text-sm text-navy-light/40 text-center max-w-xs" style={{ fontFamily: 'var(--font-body)' }}>
          Hacé clic en un tipo de campo para agregarlo, o arrastrálo aquí
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {fields.map((field, index) => {
        const isActive = field.id === activeFieldId
        const isDragging = dragIndex === index
        const isOver = dragOverIndex === index && dragIndex !== index

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
            <div className={cn(
              'absolute top-2 right-2 flex items-center gap-1 transition-opacity z-10',
              'opacity-0 group-hover:opacity-100'
            )}>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onSelectField(field.id) }}
                className="h-7 w-7 rounded-lg hover:bg-navy/10 flex items-center justify-center transition-colors"
                title="Editar"
              >
                <Pencil size={12} className="text-navy-light/60" />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onDuplicateField(field.id) }}
                className="h-7 w-7 rounded-lg hover:bg-navy/10 flex items-center justify-center transition-colors"
                title="Duplicar"
              >
                <Copy size={12} className="text-navy-light/60" />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onDeleteField(field.id) }}
                className="h-7 w-7 rounded-lg hover:bg-coral/10 flex items-center justify-center transition-colors"
                title="Eliminar"
              >
                <Trash2 size={12} className="text-coral" />
              </button>
            </div>

            <div className="flex items-start gap-3">
              {/* Drag handle */}
              <div className="mt-0.5 cursor-grab active:cursor-grabbing shrink-0">
                <GripVertical size={16} className="text-navy-light/20 hover:text-navy-light/50 transition-colors" />
              </div>

              {field.type === 'section' ? (
                <div className="flex-1">
                  <FieldPreview field={field} compact />
                </div>
              ) : (
                <div className="flex-1 space-y-2 min-w-0">
                  {/* Field header */}
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 h-5 w-5 rounded flex items-center justify-center mt-0.5" style={{ background: 'var(--surface-low)' }}>
                      <FieldTypeIcon type={field.type} size={11} className="text-navy-light/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-navy leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
                        {field.label || <span className="text-navy-light/30 italic">Sin etiqueta</span>}
                        {field.is_required && <span className="ml-1 text-coral text-[11px]">*</span>}
                      </p>
                      {field.helper_text && (
                        <p className="text-[11px] text-navy-light/40 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                          {field.helper_text}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="pointer-events-none">
                    <FieldPreview field={field} compact />
                  </div>
                </div>
              )}

              {/* Order badge */}
              <span
                className="shrink-0 mt-0.5 h-5 min-w-5 rounded-full bg-navy/5 flex items-center justify-center text-[10px] text-navy-light/40 font-mono px-1"
              >
                {index + 1}
              </span>
            </div>

            {/* Active indicator */}
            {isActive && (
              <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-coral" />
            )}
          </div>
        )
      })}
    </div>
  )
}
