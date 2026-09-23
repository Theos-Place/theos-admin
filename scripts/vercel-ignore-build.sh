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
#  · .claude/        configuración del asistente
#
# `supabase/migrations/` SALIÓ de esta lista el 2026-09-22 y es importante que
# no vuelva. Antes el SQL se aplicaba a mano, así que un commit con solo una
# migración no tenía nada que desplegar. Ahora el build ES el que las aplica
# (`buildCommand` en vercel.json): si se saltara, la migración no correría
# nunca y el esquema se quedaría atrás en silencio — exactamente el problema
# que se quiso resolver.
#
# Por lo mismo `scripts/migraciones/` tampoco se ignora: ese código corre en el
# build, no desde una máquina.
IGNORABLES='^(scripts/|docs/|data-import/|\.claude/|README|AGENTS\.md|\.gitignore$)'

# Rutas que FUERZAN el build aunque caigan bajo una ignorable. Se evalúan
# aparte y no con un lookahead porque `grep -E` no los soporta — se probó.
FORZADAS='^(supabase/migrations/|scripts/migraciones/)'

RELEVANTES="$( { echo "$CAMBIOS" | grep -vE "$IGNORABLES" || true
                 echo "$CAMBIOS" | grep -E  "$FORZADAS"   || true
               } | sort -u | grep -v '^$' || true )"

if [ -z "$RELEVANTES" ]; then
  saltar "solo cambió $(echo "$CAMBIOS" | wc -l | tr -d ' ') archivo(s) que no se despliegan"
fi

construir "$(echo "$RELEVANTES" | wc -l | tr -d ' ') archivo(s) de la app cambiaron"
