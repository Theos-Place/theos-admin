import Image from 'next/image'

interface Props {
  subject: string
  body: string
  fromName?: string
  previewName?: string
}

export function EmailPreview({ subject, body, fromName = 'Theos Place', previewName = 'María' }: Props) {
  const hydratedBody = body.replace(/\{nombre\}/g, previewName)
  const hydratedSubject = subject.replace(/\{nombre\}/g, previewName)

  return (
    <div className="rounded-2xl overflow-hidden border border-[var(--outline-variant)] bg-white">
      {/* Email client header bar */}
      <div className="px-4 py-2 border-b flex items-center gap-2 border-[#e0e0e0] bg-[#f8f8f8]">
        <div className="h-3 w-3 rounded-full bg-red-400" />
        <div className="h-3 w-3 rounded-full bg-yellow-400" />
        <div className="h-3 w-3 rounded-full bg-green-400" />
        <span className="ml-2 text-[11px] text-gray-400 font-body">Vista previa de correo</span>
      </div>

      {/* Email meta */}
      <div className="px-5 py-4 border-b space-y-1.5 border-[#e0e0e0]">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-widest text-gray-400 w-8 shrink-0 font-display">De</span>
          <span className="text-[12px] text-gray-700 font-body">{fromName} &lt;comunicaciones@theosplace.org&gt;</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-widest text-gray-400 w-8 shrink-0 font-display">Para</span>
          <span className="text-[12px] text-gray-700 font-body">{previewName} Rodríguez &lt;maria@ejemplo.com&gt;</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-widest text-gray-400 w-8 shrink-0 font-display">Asunto</span>
          <span className="text-[12px] font-semibold text-gray-800 font-body">{hydratedSubject || '(sin asunto)'}</span>
        </div>
      </div>

      {/* Email body */}
      <div className="px-5 py-5">
        <div className="flex justify-center mb-5">
          <Image src="/logo-theos-white.png" alt="Theos Place" width={80} height={22} className="object-contain opacity-40" />
        </div>
        <p className="text-[13px] leading-relaxed text-gray-700 whitespace-pre-line font-body">
          {hydratedBody}
        </p>
        <div className="mt-6 pt-4 border-t text-center border-[#f0f0f0]">
          <p className="text-[11px] text-gray-400 font-body">
            Theos Place · theosplace.org
          </p>
        </div>
      </div>
    </div>
  )
}
