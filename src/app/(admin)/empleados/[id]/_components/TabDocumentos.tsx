'use client'

import type { EmployeeDocument } from '@/types/employee'
import { DocumentCard } from '@/components/employees/DocumentCard'
import { Upload } from 'lucide-react'

interface TabDocumentosProps {
  allDocs: EmployeeDocument[]
  uploadRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDelete: (docId: string) => void
}

export function TabDocumentos({ allDocs, uploadRef, onFileChange, onDelete }: TabDocumentosProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widests text-navy-light/60 font-display">
          {allDocs.length} documento{allDocs.length !== 1 ? 's' : ''}
        </p>
        <>
          <input
            ref={uploadRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={onFileChange}
          />
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            <Upload size={12} />
            Subir documento
          </button>
        </>
      </div>
      {allDocs.length > 0 ? (
        <div className="space-y-2">
          {allDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-navy-light/60 py-6 font-body">
          Sin documentos.
        </p>
      )}
    </div>
  )
}
