'use client'

// Vista previa de una plantilla tal como se va a ver en el correo (o en
// WhatsApp), sin tener que entrar a editarla. Se abre desde el listado de
// plantillas y desde el selector de la pantalla de redacción.

import Link from 'next/link'
import { Lock, Pencil } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { EmailPreview } from './EmailPreview'
import { WhatsAppPreview } from './WhatsAppPreview'
import { ChannelBadge } from './ChannelBadge'
import { renderEmail } from '@/lib/email/baseLayout'
import { renderTemplate, PREVIEW_SAMPLE } from '@/lib/email/render-vars'
import { categoryLabel, categoryColor } from '@/lib/communications/categories'
import { inferEmailKind, emailKindNotice } from '@/lib/communications/email-kind'
import { cn } from '@/lib/utils'
import type { MessageTemplate } from '@/types/communication'

/** Link de ejemplo para el token que el sistema inyecta al enviar (EST-10). */
const SAMPLE_FORM_LINK = '#ejemplo-link-del-formulario'

/** El cuerpo del preview, SIN el <Modal> alrededor: así el selector de la
 *  pantalla de redacción lo muestra dentro de su propio modal (dos Modal
 *  anidados se pelean por Escape y por el foco). */
export function TemplatePreviewBody({
  template,
  onUse,
  onBack,
}: {
  template: MessageTemplate
  onUse?: (t: MessageTemplate) => void
  /** Si viene, se muestra un "Volver" en vez de asumir que hay una X del modal. */
  onBack?: () => void
}) {
  const kind = inferEmailKind({ is_system: template.is_system, category: template.category })
  const showEmail = template.channel === 'email' || template.channel === 'both'
  const showWhatsApp = template.channel === 'whatsapp' || template.channel === 'both'

  // Mismo render que el envío real: variables → cuerpo → layout base (header con
  // logo + footer). El logo va same-origin porque la CSP de la app bloquea
  // dominios externos dentro del iframe del preview.
  const body = template.body.split('{link_formulario}').join(SAMPLE_FORM_LINK)
  const withVars = template.is_system ? renderTemplate(body, PREVIEW_SAMPLE) : body
  const emailHtml = renderEmail(withVars, {
    logoUrl: '/logo-theos-white.png',
    ...(kind === 'marketing' ? { unsubscribeUrl: '#' } : {}),
  })

  return (
    <div>
        <div className="sticky top-0 z-10 px-5 py-4 border-b border-[var(--outline-variant)] bg-surface-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p id="preview-plantilla" className="text-sm font-bold text-navy font-display truncate">
                {template.name}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <ChannelBadge channel={template.channel} size="sm" />
                <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-semibold font-display', categoryColor(template.category))}>
                  {categoryLabel(template.category)}
                </span>
                {template.is_system && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-soft/30 text-teal-deep px-2.5 py-0.5 text-[10px] font-semibold font-display">
                    <Lock size={9} /> Del sistema
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
                >
                  Volver
                </button>
              )}
              <Link
                href={`/comunicaciones/plantillas/${template.id}/editar`}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[12px] text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                <Pencil size={11} /> Editar
              </Link>
              {onUse && (
                <button
                  type="button"
                  onClick={() => onUse(template)}
                  className="rounded-full bg-coral px-3.5 py-1.5 text-[12px] text-white hover:bg-coral-deep transition-colors font-body"
                >
                  Usar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {showEmail && (
            <>
              <p className="text-[12px] text-navy-light/70 font-body leading-relaxed">
                {emailKindNotice(kind)}
              </p>
              {/* maxHeight alto: el modal ya scrollea, y con el default (1200)
                  los correos largos se cortaban antes de la firma. */}
              <EmailPreview
                subject={template.subject}
                body={emailHtml}
                format="html"
                fullDocument
                maxHeight={5000}
              />
            </>
          )}

          {showWhatsApp && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-widest text-navy-light/70 font-display">WhatsApp</p>
              <WhatsAppPreview fromName="Theos Place" body={template.body} />
            </div>
          )}

          <p className="text-[11px] text-navy-light/70 font-body">
            Es una vista previa: el nombre y las fechas son de ejemplo, y los links de baja o de
            formulario se resuelven al enviar.
          </p>
      </div>
    </div>
  )
}

/** El preview en su propio modal (listado de plantillas). */
export function TemplatePreviewModal({
  template,
  onClose,
  onUse,
}: {
  template: MessageTemplate
  onClose: () => void
  onUse?: (t: MessageTemplate) => void
}) {
  return (
    <Modal onClose={onClose} titleId="preview-plantilla" width={680}>
      <TemplatePreviewBody template={template} onUse={onUse} />
    </Modal>
  )
}
