// FRM-2 · Encabezado (hero) de un formulario: flyer + título + bienvenida.
//
// Lo comparten el formulario público (FormFiller), la vista previa del builder y
// el propio builder, para que lo que se ve armando sea lo que llega al celular.
//
// RESPONSIVE: la mayoría lo abre desde el teléfono. La imagen ocupa el ancho de
// la tarjeta y conserva su proporción; nunca desborda ni empuja el primer campo
// fuera de pantalla. Se usa <img> y no next/image a propósito: la URL sale de
// Storage y no queremos que un flyer suba con proporciones raras rompa el layout
// por un `fill` mal calculado.

export type FormHeroData = {
  hero_image_url?: string | null
  hero_title?: string | null
  hero_subtitle?: string | null
}

/** ¿Hay algo que mostrar? Sin nada, el formulario se ve igual que siempre. */
export function hasHero(h: FormHeroData | null | undefined): boolean {
  return !!(h?.hero_image_url || h?.hero_title || h?.hero_subtitle)
}

export function FormHero({ hero, fallbackTitle }: {
  hero: FormHeroData
  /** Si no hay hero_title se usa el nombre del formulario. */
  fallbackTitle?: string
}) {
  if (!hasHero(hero)) return null
  const titulo = hero.hero_title?.trim() || fallbackTitle?.trim() || ''

  return (
    <div>
      {hero.hero_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hero.hero_image_url}
          alt={titulo ? `Imagen de ${titulo}` : 'Imagen del formulario'}
          className="block w-full h-auto max-w-full object-cover"
        />
      )}
      {(titulo || hero.hero_subtitle) && (
        <div className="px-5 sm:px-8 pt-6 space-y-1.5 text-center">
          {titulo && (
            <h1 className="text-2xl font-extrabold text-navy font-display tracking-[-0.02em]">
              {titulo}
            </h1>
          )}
          {hero.hero_subtitle && (
            <p className="text-sm text-navy-light/70 leading-relaxed font-body whitespace-pre-line">
              {hero.hero_subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
