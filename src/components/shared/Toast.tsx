'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info'
type ToastItem = { id: number; msg: string; type: ToastType }

const ToastCtx = createContext<(msg: string, type?: ToastType) => void>(() => {})

/** Hook para mostrar toasts: const toast = useToast(); toast('Guardado', 'success') */
export function useToast() {
  return useContext(ToastCtx)
}

const STYLES: Record<ToastType, { icon: React.ElementType; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'border-[#3DB97A]/30 text-[#2a8c5a]' },
  error:   { icon: AlertTriangle, cls: 'border-coral/30 text-coral' },
  info:    { icon: Info, cls: 'border-navy/15 text-navy' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => setItems(prev => prev.filter(t => t.id !== id)), [])

  const toast = useCallback((msg: string, type: ToastType = 'info') => {
    const id = ++seq.current
    setItems(prev => [...prev, { id, msg, type }])
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2 max-w-[calc(100vw-2rem)]">
        {items.map(t => {
          const { icon: Icon, cls } = STYLES[t.type]
          return (
            <div
              key={t.id}
              role="status"
              className={cn('flex items-start gap-2.5 rounded-2xl border bg-surface-card px-4 py-3 shadow-[var(--shadow-lg)] w-80 max-w-full animate-[fadeIn_0.15s_ease-out]', cls)}
            >
              <Icon size={18} strokeWidth={2} className="shrink-0 mt-0.5" />
              <span className="flex-1 text-sm text-navy font-body">{t.msg}</span>
              <button onClick={() => dismiss(t.id)} aria-label="Cerrar" className="shrink-0 text-navy-light/60 hover:text-navy">
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}
