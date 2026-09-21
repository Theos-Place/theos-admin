import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getAuthContext } from '@/lib/auth/guard'
import { getHelpDoc, getHelpIndex } from '@/lib/help/loader'
import { renderMarkdown } from '@/lib/help/markdown'
import { helpNeighbors } from '@/lib/help/visibility'
import { HelpArticle, ZoomHint } from '@/components/help/HelpArticle'
import { PageContainer } from '@/components/layout/PageContainer'

// Un artículo. SEGURIDAD: getHelpDoc aplica la visibilidad del frontmatter en el
// servidor — un documento con roles NO se sirve a una petición sin sesión ni a un
// rol que no está en su lista, aunque se adivine la URL. Los dos casos (no existe
// / no te toca) responden 404 igual, para no confirmar que el contenido existe.
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const ctx = await getAuthContext()
  const doc = await getHelpDoc(slug, ctx?.roles ?? null)
  if (!doc) return { title: 'Centro de ayuda · Theos Place' }
  return {
    title: `${doc.titulo} · Ayuda · Theos Place`,
    description: doc.resumen ?? undefined,
  }
}

export default async function AyudaArticuloPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const ctx = await getAuthContext()
  const doc = await getHelpDoc(slug, ctx?.roles ?? null)
  if (!doc) notFound()

  // Los vecinos salen del índice YA filtrado: nunca se enlaza algo que la
  // persona no puede abrir.
  const index = await getHelpIndex(ctx?.roles ?? null)
  const { prev, next } = helpNeighbors(index, slug)
  const html = renderMarkdown(doc.content)
  const hasImages = html.includes('<img')

  // TODAS las guías van en ancho de trabajo, y el TEXTO se acota adentro con
  // una medida legible (`.help-prose`, en globals.css). Es la excepción que
  // pide el design system: el ancho de lectura aplica al texto, no al cascarón.
  //
  // Antes esto dependía de si el artículo TENÍA IMÁGENES: con GIF se abría a
  // 1600 px y sin GIF quedaba en una columna de 768 px. O sea que dos guías
  // vecinas de la misma sección se veían de dos anchos distintos según si a
  // alguien le había dado tiempo de grabar el tutorial — y las tres guías
  // nuevas del 2026-09-21 (donaciones, áreas/comités, roles), que todavía no
  // tienen GIF, salieron como una tira angosta perdida en la pantalla.
  // Reportado en producción ese mismo día.
  //
  // Capar el texto adentro en vez de encoger la página deja además que las
  // tablas y las infografías usen todo el ancho, que es lo que necesitan.

  return (
    <PageContainer width="work">
      <article className="space-y-5">
      <div className="space-y-2">
        <Link
          href="/ayuda"
          className="inline-flex items-center gap-1.5 text-sm text-navy-light/80 hover:text-navy transition-colors font-body"
        >
          <ChevronLeft size={15} />
          Centro de ayuda
        </Link>
        <p className="text-[13px] uppercase tracking-widest text-navy-light/80 font-display">
          {doc.seccion}
        </p>
      </div>

      {hasImages && <ZoomHint />}

      <div className="rounded-2xl bg-surface-card p-5 sm:p-7 shadow-[var(--shadow-md)]">
        <HelpArticle html={html} />
      </div>

      {(prev || next) && (
        <nav aria-label="Navegación entre guías" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {prev ? (
            <Link
              href={`/ayuda/${prev.slug}`}
              className="rounded-2xl bg-surface-card px-4 py-3 shadow-[var(--shadow-md)] hover:bg-surface-low transition-colors"
            >
              <span className="flex items-center gap-1 text-[13px] uppercase tracking-widest text-navy-light/80 font-display">
                <ChevronLeft size={12} /> Anterior
              </span>
              <span className="mt-1 block text-sm text-navy font-body font-medium">{prev.titulo}</span>
            </Link>
          ) : <span className="hidden sm:block" />}
          {next && (
            <Link
              href={`/ayuda/${next.slug}`}
              className="rounded-2xl bg-surface-card px-4 py-3 shadow-[var(--shadow-md)] hover:bg-surface-low transition-colors sm:text-right"
            >
              <span className="flex items-center gap-1 text-[13px] uppercase tracking-widest text-navy-light/80 font-display sm:justify-end">
                Siguiente <ChevronRight size={12} />
              </span>
              <span className="mt-1 block text-sm text-navy font-body font-medium">{next.titulo}</span>
            </Link>
          )}
        </nav>
      )}
      </article>
    </PageContainer>
  )
}
