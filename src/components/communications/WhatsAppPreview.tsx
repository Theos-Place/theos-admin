interface Props {
  fromName: string
  body: string
  previewName?: string
}

function formatWAText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~)/g)
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return <strong key={i}>{part.slice(1, -1)}</strong>
    }
    if (part.startsWith('_') && part.endsWith('_')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('~') && part.endsWith('~')) {
      return <s key={i}>{part.slice(1, -1)}</s>
    }
    return <span key={i}>{part}</span>
  })
}

export function WhatsAppPreview({ fromName, body, previewName = 'María' }: Props) {
  const hydrated = body.replace(/\{nombre\}/g, previewName)
  const lines = hydrated.split('\n')

  return (
    <div className="rounded-2xl overflow-hidden bg-[#e5ddd5]">
      {/* WA Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#075e54]">
        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <span className="text-[12px] font-bold text-white font-display">
            {fromName.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-white font-body">{fromName}</p>
          <p className="text-[12px] text-white/70 font-body">En línea</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="px-4 py-5 min-h-32">
        <div
          className="inline-block max-w-[85%] rounded-2xl rounded-tl-none px-3.5 py-2.5 shadow-sm bg-white"
        >
          <p className="text-[12px] leading-relaxed text-gray-800 whitespace-pre-line font-body">
            {lines.map((line, i) => (
              <span key={i}>
                {formatWAText(line)}
                {i < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
          <p className="text-[11px] text-gray-400 text-right mt-1 font-body">
            {new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })} ✓✓
          </p>
        </div>
      </div>
    </div>
  )
}
