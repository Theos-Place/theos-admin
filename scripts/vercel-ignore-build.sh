#!/usr/bin/env bash
# ¿Vale la pena construir este commit?
#
# Vercel corre esto como "Ignored Build Step":
#   salida 0  → SE SALTA el build
#   salida 1  → SE CONSTRUYE
#
# POR QUÉ EXISTE. Entre el 7 y el 16 de setiembre de 2026 hubo 199 commits a
# main y 140 —el 70%— no tocaban una sola línea de código desplegable: eran
# scripts one-off, documentación, CSV de data-import y migraciones SQL que se
# aplican a mano. Cada uno disparó un build de producción completo. El consumo
# de Build CPU fue de 2.656 minutos en 7 días, $9,30, el 61% de todo el gasto
# bajo demanda de la cuenta. Unos $6,50 de esos se fueron en builds que no
# cambiaban nada de lo que corre en producción.
#
# ANTE LA DUDA SE CONSTRUYE. Un build de más cuesta centavos; un deploy que no
# ocurre deja producción desactualizada sin que nadie se entere, y eso es mucho
# más caro. Por eso cada camino incierto —no hay commit previo, el diff falla,
# el clon es superficial— termina en "construir".

set -uo pipefail

construir() { echo "BUILD · $1"; exit 1; }
saltar()    { echo "SKIP · $1";  exit 0; }

# Producción siempre se construye si algo no calza; los previews también.
ANTERIOR="${VERCEL_GIT_PREVIOUS_SHA:-}"
ACTUAL="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

if [ -z "$ANTERIOR" ]; then
  # Primer deploy del proyecto, un rollback o un clon sin historia.
  git rev-parse HEAD^ >/dev/null 2>&1 || construir "sin commit anterior con el que comparar"
  ANTERIOR="HEAD^"
fi

CAMBIOS="$(git diff --name-only "$ANTERIOR" "$ACTUAL" 2>/dev/null)" \
  || construir "no se pudo leer el diff"
[ -z "$CAMBIOS" ] && construir "el diff vino vacío"

# Rutas que NO llegan a producción. Todo lo demás construye.
#  · scripts/        one-off que corren desde la máquina, nunca en el server
#  · docs/           el plan de desarrollo y las notas
#  · data-import/    CSV de trabajo
#  · supabase/migrations/  SQL que se aplica a mano contra la base (ver AGENTS)
#  · .claude/        configuración del asistente
IGNORABLES='^(scripts/|docs/|data-import/|supabase/migrations/|\.claude/|README|AGENTS\.md|\.gitignore$)'

RELEVANTES="$(echo "$CAMBIOS" | grep -vE "$IGNORABLES" || true)"

if [ -z "$RELEVANTES" ]; then
  saltar "solo cambió $(echo "$CAMBIOS" | wc -l | tr -d ' ') archivo(s) que no se despliegan"
fi

construir "$(echo "$RELEVANTES" | wc -l | tr -d ' ') archivo(s) de la app cambiaron"
