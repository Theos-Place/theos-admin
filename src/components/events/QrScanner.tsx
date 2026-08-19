'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { cn } from '@/lib/utils'
import { SwitchCamera, CameraOff } from 'lucide-react'

type Facing = 'environment' | 'user'

/** Lector de QR por cámara (navegador, HTTPS). Llama onResult con el texto del
 *  QR; el padre decide qué hacer. Mantiene la cámara abierta para escanear en
 *  serie. Maneja permiso denegado y permite alternar cámara. */
export function QrScanner({ onResult, className }: { onResult: (text: string) => void; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const [facing, setFacing] = useState<Facing>('environment')
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    const reader = new BrowserQRCodeReader()
    setError(null)
    reader
      .decodeFromConstraints({ video: { facingMode: facing } }, videoRef.current!, (result) => {
        if (result) onResultRef.current(result.getText())
      })
      .then(controls => {
        if (cancelled) controls.stop()
        else controlsRef.current = controls
      })
      .catch((e: unknown) => {
        const name = (e as { name?: string })?.name
        setError(
          name === 'NotAllowedError' ? 'Permiso de cámara denegado. Activalo en los ajustes del navegador.'
          : name === 'NotFoundError' ? 'No se encontró cámara en el dispositivo.'
          : 'No se pudo iniciar la cámara.',
        )
      })
    return () => { cancelled = true; controlsRef.current?.stop(); controlsRef.current = null }
  }, [facing, retry])

  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3 rounded-2xl bg-coral/5 border border-coral/20 p-6 text-center', className)}>
        <CameraOff size={32} className="text-coral/70" />
        <p className="text-navy text-sm font-medium font-body">{error}</p>
        <button
          onClick={() => { setError(null); setRetry(n => n + 1) }}
          className="rounded-full bg-coral px-4 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body min-h-[40px]"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-black', className)}>
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      {/* Marco guía */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative w-2/3 max-w-[220px] aspect-square">
          {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map((c, i) => (
            <div key={i} className={cn('absolute h-7 w-7 border-coral rounded-sm', c)} />
          ))}
        </div>
      </div>
      {/* Alternar cámara */}
      <button
        onClick={() => setFacing(f => (f === 'environment' ? 'user' : 'environment'))}
        aria-label="Alternar cámara"
        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-2 text-[13px] text-white hover:bg-black/70 transition-colors backdrop-blur min-h-[40px]"
      >
        <SwitchCamera size={15} /> Cambiar
      </button>
    </div>
  )
}
