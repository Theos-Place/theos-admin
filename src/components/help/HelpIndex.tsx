'use client'

// Índice del centro de ayuda: agrupado por sección, con buscador por título.
// La lista que recibe YA viene filtrada en el servidor por lo que puede ver
// quien pregunta — acá no hay ninguna decisión de permisos.

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, Image as ImageIcon, FileText } from 'lucide-react'
import { groupHelpBySection, searchHelpDocs, type HelpDocMeta } from '@/lib/help/visibility'

export function HelpIndex({ docs }: { docs: HelpDocMeta[] }) {
  const [q, setQ] = useState('')
  const groups = useMemo(() => groupHelpBySection(searchHelpDocs(docs, q)), [docs, q])

  return (
    <div className="space-y-6">
      {/* El buscador NO se estira a todo el ancho: un input de 1.400 px es
          incómodo de leer y de apuntar (layout.md, acotar elementos internos). */}
      <div className="relative max-w-xl">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-light/70" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar en la ayuda"
          aria-label="Buscar en la ayuda"
          className="w-full rounded-full border border-[var(--outline-variant)] bg-surface-card pl-10 pr-4 py-3 text-[15px] text-navy font-body outline-none focus:ring-1 focus:ring-coral/30"
        />
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl bg-surface-card px-5 py-10 text-center text-sm text-navy-light/70 font-body shadow-[var(--shadow-md)]">
          {docs.length === 0
            ? 'Todavía no hay guías publicadas.'
            : `Ninguna guía coincide con "${q}".`}
        </p>
      ) : (
        groups.map(({ seccion, docs: sectionDocs }) => (
          <section key={seccion} className="space-y-2">
            <h2 className="text-[12px] uppercase tracking-widest text-navy-light/70 font-display px-1">
              {seccion}
            </h2>
            {/* Listado, no lectura: en desktop se reparte en columnas en vez de
                quedar como una tira angosta centrada. En celular es una lista
                de una columna, igual que antes. */}
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sectionDocs.map(doc => (
                <li key={doc.slug} className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
                  <Link
                    href={`/ayuda/${doc.slug}`}
                    className="flex h-full items-center gap-3 px-4 py-4 active:bg-surface-low hover:bg-surface-low transition-colors"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy/[0.06] text-navy-light">
                      {doc.tipo === 'infografia' ? <ImageIcon size={16} /> : <FileText size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] text-navy font-body font-medium leading-snug">
                        {doc.titulo}
                      </span>
                      {doc.resumen && (
                        <span className="mt-0.5 block text-[13px] text-navy-light/70 font-body leading-snug">
                          {doc.resumen}
                        </span>
                      )}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-navy-light/70" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
