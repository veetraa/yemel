# Biblioteca de ejercicios

`public/data/library/` se genera con:

```bash
bash scripts/fetch-library-sources.sh   # descarga las fuentes a .library-src/ (no se versiona)
node scripts/build-library.mjs          # genera index.json, ex/<id>.json, img/ y sources.json
```

| Fuente | Licencia | Uso |
|---|---|---|
| [Kinetic Exercises Database](https://github.com/kinetic-place/exercises-db) | MIT | 908 ejercicios en español: nombres, músculos, equipamiento, dificultad y guías |
| [RepDB](https://repdb.co) (free tier) | Uso en aplicaciones con atribución; no se redistribuye como dataset; sin animaciones premium | Ilustraciones inicio/final y anatomía **solo de los ejercicios vinculados** |
| [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) | Unlicense | Fotos de referencia, cargadas en línea bajo demanda |

**Vídeos.** `free-exercise-db-with-videos` no se incorpora: sus vídeos llevan ids numéricos de otra base comercial de animaciones y el README solo
dice que están «redistribuidos con los derechos del mantenedor»; no se puede verificar vídeo a vídeo. Si se consiguen vídeos con licencia clara:
copiar el MP4 vertical (10–25 s, comprimido) a `public/videos/gym/<id>.mp4` y añadirlo a `VIDEOS` en `src/modules/gym/resources/catalog.ts` con autor y licencia.

**Vínculos.** `scripts/library-links.json` enlaza a mano cada ejercicio propio (id estable) con su equivalente exacto en cada fuente (`null` = no hay).
Nunca se asocia un recurso a otro ejercicio: un test comprueba que ningún recurso se repite.
