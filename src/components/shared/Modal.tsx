'use client'
import { X } from 'lucide-react'
import { useEffect } from 'react'

export function Modal({
  onClose,
  children,
  width = 480,
}: {
  onClose: () => void
  children: React.ReactNode
  width?: number | string
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface-card)', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative', maxHeight: '90vh', overflowY: 'auto', width: '100%', maxWidth: width }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(41,54,92,0.4)', zIndex: 1 }}
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  )
}
