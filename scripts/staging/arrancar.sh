#!/usr/bin/env bash
# INF-1 · Llevar una base EN BLANCO a un staging usable, de una.
#
# Qué hace, en orden: aplica las 112+ migraciones, siembra el catálogo (planes
# de estudio, puestos, plantillas de correo), crea una cuenta por cada rol y
# monta el set de datos de prueba.
#
# NO inventa nada: encadena los seeds que ya existían y que hasta hoy había que
# correr a mano, en el orden correcto —el set de prueba se apoya en el catálogo,
# así que al revés falla a media carga y deja la base a medias.
#
# Uso:
#   scripts/staging/arrancar.sh              # usa el .env del entorno
#   SOLO_ESQUEMA=1 scripts/staging/arrancar.sh   # migraciones y nada más
#
# Espera en el entorno: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y
# SEED_TEST_PASSWORD. `SUPABASE_DB_URL` es OPCIONAL: solo la usa el paso del
# esquema, y si no está, las migraciones se aplican por el API de gestión.
# Todo lo demás va con la llave de servicio, que es un secreto menos que mover.
#
# LOS SEEDS SE PROTEGEN SOLOS: `src/lib/entorno/base-de-datos` mira a qué base
# apunta la URL y en producción se niega. Este script no lleva un `--force`
# a propósito — si algún día alguien lo corre con el .env equivocado, que la
# barrera siga estando.
set -euo pipefail

falta() { echo "✗ Falta la variable $1"; exit 1; }
: "${NEXT_PUBLIC_SUPABASE_URL:?$(falta NEXT_PUBLIC_SUPABASE_URL)}"

echo "→ Base: $NEXT_PUBLIC_SUPABASE_URL"
echo
echo "── 1/5 · esquema ──────────────────────────────────────────"
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  # --db-url explícito y NUNCA --linked: el CLI de este repo está enlazado al
  # proyecto de PRODUCCIÓN, así que un comando sin destino escribe ahí.
  npx supabase db push --db-url "$SUPABASE_DB_URL"
else
  # Sin contraseña de la base, las migraciones se aplican por el API de
  # gestión; ver docs/staging.md. Acá solo se comprueba que el esquema esté.
  echo "   (sin SUPABASE_DB_URL — se asume el esquema ya aplicado)"
fi

if [[ "${SOLO_ESQUEMA:-}" == "1" ]]; then echo; echo "✓ Solo el esquema, como se pidió."; exit 0; fi

echo
echo "── 2/5 · catálogo ─────────────────────────────────────────"
# Tipos de evento, sedes, áreas, planes de estudio, puestos y categorías de
# pago: 499 filas de CONFIGURACIÓN, sin datos de personas. Va primero porque
# todo lo demás cuelga de acá — sin `event_types` las charlas no se pueden
# crear, y sin charlas no hay asistencia que sembrar.
#
# NO se usa `seed-study-plans.ts` ni `seed-service-positions.ts`: el primero
# importa `src/data/mock-studies`, que ya no existe, y el segundo pide un xlsx
# que no está en el repo. Los dos están muertos y se descubrió corriéndolos.
npx tsx scripts/staging/sembrar-catalogo.ts

echo
echo "── 3/5 · plantillas de correo ─────────────────────────────"
npx tsx scripts/seed-system-templates.ts

echo
echo "── 4/5 · una cuenta por rol ───────────────────────────────"
: "${SEED_TEST_PASSWORD:?$(falta SEED_TEST_PASSWORD)}"
npx tsx scripts/seed-test-users.ts

echo
echo "── 5/5 · charlas y set de datos de prueba ─────────────────"
npx tsx scripts/seed-charlas.ts
# Y doce semanas hacia atrás: el set de prueba cuelga asistencia de charlas de
# los últimos 170 días y se niega si hay menos de seis. En producción existen
# porque llevan meses pasando; en una base nueva hay que fabricarlas.
npx tsx scripts/staging/sembrar-charlas-pasadas.ts
npx tsx scripts/seed-datos-de-prueba.ts

echo
echo "✓ Staging listo. La hoja de referencia quedó en content/ayuda/datos-de-prueba.md"
