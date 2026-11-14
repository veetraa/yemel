#!/usr/bin/env bash
# Descarga las fuentes públicas de la biblioteca de ejercicios a .library-src/ (no se sube al repositorio).
# Uso: bash scripts/fetch-library-sources.sh && node scripts/build-library.mjs
set -euo pipefail
cd "$(dirname "$0")/.."
D=.library-src; mkdir -p $D/img/repdb
G=https://raw.githubusercontent.com
get() { [ -s "$2" ] || curl -sSf -m 120 "$1" -o "$2"; }
get $G/kinetic-place/exercises-db/main/es/exercises.json $D/kinetic-es-exercises.json
get $G/kinetic-place/exercises-db/main/es/guides.json $D/kinetic-es-guides.json
get $G/kinetic-place/exercises-db/main/en/exercises.json $D/kinetic-en-exercises.json
get $G/RepDB/exercise-dataset/main/exercises.json $D/repdb-exercises.json
get $G/yuhonas/free-exercise-db/main/dist/exercises.json $D/yuhonas-exercises.json
# Ilustraciones de RepDB solo de los ejercicios vinculados (uso dentro de la app; no se redistribuye el dataset)
node -e '
const l=require("./scripts/library-links.json"), r=require("./.library-src/repdb-exercises.json").exercises, by=Object.fromEntries(r.map(e=>[e.id,e]));
for (const c of l.core) if (c.repdb) { const f=by[c.repdb].images.flat; for (const p of Object.values(f)) console.log(p) }' |
while read -r p; do get "$G/RepDB/exercise-dataset/main/$p" "$D/img/repdb/$(basename "$p")"; done
echo "Fuentes listas en $D"
