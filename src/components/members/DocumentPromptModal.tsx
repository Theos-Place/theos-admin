'use client'

import { useState } from 'react'
import { IdCard } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { Modal } from '@/components/shared/Modal'
import { DocumentCapture } from './DocumentCapture'
import {
  shouldShowDocumentPrompt, DOCUMENT_PROMPT_NOTICE, DOCUMENT_PROMPT_SNOOZE_DAYS,
} from '@/lib/members/document-prompt'

/**
 * FIN-2 (1) · Aviso al entrar al sistema para completar el documento.
 *
 * DESCARTABLE y no bloquea nada: quien lo cierra lo vuelve a ver a los
 * DOCUMENT_PROMPT_SNOOZE_DAYS días (el descarte se guarda con fecha en
 * notice_dismissals). El documento se ingresa acá mismo.
 */
export function DocumentPromptModal() {
  const { user, loaded } = useAuth()
  // Cerrado en esta vista: evita que reaparezca al navegar dentro de la sesión
  // mientras el POST del descarte viaja.
  const [closed, setClosed] = useState(false)
  const [saved, setSaved] = useState(false)

  const show = loaded && !!user && shouldShowDocumentPrompt({
    hasDocument: user.has_cedula,
    isSystem: user.is_system,
    hasMember: !!user.member_id,
    dismissedAt: user.document_prompt_dismissed_at ?? null,
  })

  if (!show || closed || !user?.member_id) return null

  function postponer() {
    setClosed(true)
    // Best-effort: si el registro del descarte falla, el aviso reaparece — es
    // preferible a perder el dato que se quiere completar.
    fetch('/api/members/notice-dismissals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notice_key: DOCUMENT_PROMPT_NOTICE }),
    }).catch(() => {})
  }

  return (
    <Modal onClose={postponer} titleId="document-prompt-title" width={440}>
      <div className="p-6">
        <div className="text-center">
          <IdCard className="mx-auto mb-3 text-coral-deep" size={28} aria-hidden />
          <h2 id="document-prompt-title" className="text-lg font-bold text-navy font-display">
            {saved ? '¡Listo, gracias!' : 'Completá tu perfil'}
          </h2>
          <p className="mt-2 text-sm text-navy-light/80 font-body">
            {saved
              ? 'Tu documento quedó guardado en tu perfil.'
              : 'Falta tu documento de identidad. Ingresalo acá — queda guardado en tu perfil y te sirve para matricularte y para trámites.'}
          </p>
        </div>

        {saved ? (
          <button
            type="button"
            onClick={() => setClosed(true)}
            className="mt-5 w-full rounded-full bg-coral px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-coral-deep font-body"
          >
            Cerrar
          </button>
        ) : (
          <>
            <div className="mt-4">
              <DocumentCapture
                memberId={user.member_id}
                onSaved={() => setSaved(true)}
                submitLabel="Guardar documento"
                idPrefix="prompt-doc"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={postponer}
              className="mt-2 w-full rounded-full px-4 py-2 text-[13px] text-navy-light/80 transition-colors hover:bg-navy/5 hover:text-navy font-body"
            >
              Más tarde
            </button>
            <p className="mt-2 text-center text-[13px] text-navy-light/80 font-body">
              Te lo volvemos a recordar en {DOCUMENT_PROMPT_SNOOZE_DAYS} días.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
