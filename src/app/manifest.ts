import type { MetadataRoute } from 'next'

/**
 * UX-8 · El manifest, que no existía.
 *
 * EL BUG: al agregar el sistema a la pantalla de inicio, el ícono salía con
 * FONDO NEGRO y la theta navy encima, o sea casi invisible. La causa no era
 * el diseño sino el canal alfa: los PNG eran transparentes, y Android
 * rellena la transparencia de negro al generar el acceso directo. Sin
 * manifest tampoco había íconos `maskable`, así que el teléfono recortaba
 * el que encontraba.
 *
 * Ahora los íconos nacen con fondo navy sólido y sin alfa, y los
 * `maskable` traen la theta dentro de la zona segura del centro: Android
 * recorta hasta un 20% de cada borde, y un maskable a tamaño normal sale
 * mordido.
 *
 * `background_color` es el mismo navy para que la pantalla de arranque no
 * destelle en blanco antes de pintar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Theos Place — Sistema Administrativo',
    short_name: 'Theos Place',
    description: 'Sistema administrativo de Theos Place.',
    start_url: '/',
    display: 'standalone',
    background_color: '#161440',
    theme_color: '#161440',
    lang: 'es',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
