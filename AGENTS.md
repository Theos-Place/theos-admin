<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Accesibilidad

Toda UI nueva sigue `Theos Place Design System/accessibility.md` (estándar de la marca, meta WCAG 2.1 AA). Resumen: texto informativo mínimo `text-navy-light/60` (`/70` si es < 18px), nunca `/20`–`/30` para texto; `aria-label` en botones solo-ícono y en inputs sin label visible; modales solo con el `Modal.tsx` compartido; todo operable con teclado.

# Ancho y layout

Toda pantalla nueva sigue `Theos Place Design System/layout.md`. Resumen: en desktop
las pantallas de datos/gestión son **full-width** (sin `max-w-* mx-auto` en el contenedor
raíz) y distribuyen el contenido en grids responsive (`grid-cols-1` → `lg:grid-cols-2/3`),
no una columna estirada. Excepción: páginas de lectura/confirmación y párrafos de ayuda
sí usan `max-w-*` para un ancho de lectura cómodo.

# Seguridad en rutas API

El proxy (`src/proxy.ts`) excluye `/api`: **todo handler de ruta API debe llamar `requireRoles(...)` de `src/lib/auth/guard.ts`** (las queries usan service role y saltan RLS). Escrituras (POST/PUT/PATCH/DELETE) exigen roles explícitos, no solo sesión, salvo decisión documentada en el propio handler.
