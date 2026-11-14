/**
 * Construye la biblioteca unificada de ejercicios de YEMEL GYM a partir de fuentes públicas.
 *
 *   bash scripts/fetch-library-sources.sh && node scripts/build-library.mjs
 *
 * Fuentes y licencias (ver también la pantalla Perfil → Créditos y licencias):
 *  · Kinetic Exercises Database (MIT) — base de 908 ejercicios en español: nombre, músculos, equipamiento,
 *    dificultad y guías (preparación, ejecución, claves, errores, respiración).
 *  · RepDB free tier (uso dentro de aplicaciones, con atribución) — ilustraciones inicio/final y anatomía de los
 *    ejercicios vinculados. NO se copia el dataset: solo los ejercicios que usa la app. No se usan sus animaciones premium.
 *  · Free Exercise DB de yuhonas (Unlicense) — fotos de referencia (inicio/final) cargadas bajo demanda desde el
 *    propio repositorio para el resto de la biblioteca.
 *  · Vídeos de «free-exercise-db-with-videos»: NO incorporados (procedencia y derechos de redistribución no
 *    verificables, ver README de la biblioteca). El campo `video` queda vacío hasta aportar vídeos con licencia clara.
 *
 * Salida (public/data/library/):
 *   index.json      lista ligera para buscar (se carga al abrir Ejercicios)
 *   ex/<id>.json    ficha completa (se carga al abrir cada ejercicio)
 *   img/<id>-*.webp ilustraciones de los ejercicios vinculados (carga bajo demanda)
 *   sources.json    fuentes, licencias y recuento
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, '.library-src')
const OUT = join(ROOT, 'public/data/library')
const rd = (f) => JSON.parse(readFileSync(join(SRC, f), 'utf8'))

const kEs = rd('kinetic-es-exercises.json'), kEn = rd('kinetic-en-exercises.json'), guides = rd('kinetic-es-guides.json')
const repdb = rd('repdb-exercises.json').exercises, yuh = rd('yuhonas-exercises.json')
const links = JSON.parse(readFileSync(join(ROOT, 'scripts/library-links.json'), 'utf8')).core

const kBySlug = new Map(kEs.map((e) => [e.slug, e])), kEnBySlug = new Map(kEn.map((e) => [e.slug, e]))
const guideMap = new Map(guides.map((g) => [g.exerciseId, g]))
const rById = new Map(repdb.map((e) => [e.id, e])), yById = new Map(yuh.map((e) => [e.id, e]))

// ── Normalización de nombres en inglés (solo para vincular fotos de yuhonas por nombre exacto) ──
const norm = (s) => {
  const t = s.toLowerCase().replace(/[-/]/g, ' ').replace(/[^a-z0-9 ]/g, '')
    .replace(/\bdb\b/g, 'dumbbell').replace(/\bbb\b/g, 'barbell').replace(/\bpushups?\b/g, 'push up').replace(/\bpullups?\b/g, 'pull up')
    .replace(/\bsitups?\b/g, 'sit up').replace(/\bchinups?\b/g, 'chin up')
  return [...new Set(t.split(' ').filter(Boolean).map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)))].sort().join(' ')
}
const yByNorm = new Map()
for (const e of yuh) { const n = norm(e.name); yByNorm.set(n, yByNorm.has(n) ? null : e) } // null = ambiguo

// ── Grupos musculares (vocabulario de la app) ──
const GROUP = { abdominals: 'Core', abductors: 'Glúteos', adductors: 'Cuádriceps', biceps: 'Bíceps', calves: 'Gemelos', chest: 'Pecho', forearms: 'Antebrazos', glutes: 'Glúteos', hamstrings: 'Isquiotibiales', lats: 'Espalda', 'lower-back': 'Espalda', 'middle-back': 'Espalda', neck: 'Trapecio', quadriceps: 'Cuádriceps', shoulders: 'Hombros', traps: 'Trapecio', triceps: 'Tríceps' }
const ANAT = { pectoralis_major: 'Pectoral mayor', pectoralis_minor: 'Pectoral menor', triceps_brachii: 'Tríceps braquial', biceps_brachii: 'Bíceps braquial', brachialis: 'Braquial', brachioradialis: 'Braquiorradial', latissimus_dorsi: 'Dorsal ancho', posterior_deltoid: 'Deltoides posterior', anterior_deltoid: 'Deltoides anterior', lateral_deltoid: 'Deltoides lateral', rhomboids: 'Romboides', trapezius: 'Trapecio', gluteus_maximus: 'Glúteo mayor', gluteus_medius: 'Glúteo medio', quadriceps: 'Cuádriceps', hamstrings: 'Isquiotibiales', gastrocnemius: 'Gastrocnemio', soleus: 'Sóleo', forearm_flexors: 'Flexores del antebrazo', forearm_extensors: 'Extensores del antebrazo', rectus_abdominis: 'Recto abdominal', obliques: 'Oblicuos', transverse_abdominis: 'Transverso del abdomen', erector_spinae: 'Erectores espinales', serratus_anterior: 'Serrato anterior', teres_major: 'Redondo mayor', adductors: 'Aductores', hip_flexors: 'Flexores de la cadera', rear_deltoid: 'Deltoides posterior', rotator_cuff: 'Manguito rotador', infraspinatus: 'Infraespinoso', core: 'Core', calves: 'Gemelos' }
const unknownAnat = new Set()
const anat = (arr = []) => arr.map((s) => { if (!ANAT[s]) unknownAnat.add(s); return ANAT[s] ?? s.replace(/_/g, ' ') })
const slugOf = (m) => m.slug
const uniq = (a) => [...new Set(a)]
const DIFF = { beginner: 'beginner', intermediate: 'intermediate', expert: 'advanced', advanced: 'advanced' }

function textOf(k) {
  const g = k ? guideMap.get(k.id) : null
  return {
    summary: g?.summary ?? null,
    setup: g?.setup ?? [],
    steps: g?.execution?.length ? g.execution : k?.instructions ?? [],
    cues: g?.formCues ?? [],
    mistakes: (g?.commonMistakes ?? []).map((m) => ({ m: m.mistake, c: m.correction })),
    breathing: g?.breathing ?? null,
  }
}
rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'ex'), { recursive: true }); mkdirSync(join(OUT, 'img'), { recursive: true })

const index = [], usedK = new Set(), report = { core: 0, kinetic: 0, withRepdbImages: 0, withYuhonas: 0, missingLinks: [] }
const sources = (k, r, y) => [
  ...(k ? [{ id: 'kinetic', ref: k.slug }] : []),
  ...(r ? [{ id: 'repdb', ref: r.id }] : []),
  ...(y ? [{ id: 'yuhonas', ref: y.id }] : []),
]
const write = (id, d) => writeFileSync(join(OUT, 'ex', `${id}.json`), JSON.stringify(d))

// 1) Ejercicios propios (ids estables) enriquecidos con sus fuentes
for (const c of links) {
  const k = c.kinetic ? kBySlug.get(c.kinetic) : null, r = c.repdb ? rById.get(c.repdb) : null, y = c.yuhonas ? yById.get(c.yuhonas) : null
  if ((c.kinetic && !k) || (c.repdb && !r) || (c.yuhonas && !y)) { report.missingLinks.push(c.id); continue }
  if (k) usedK.add(k.slug)
  const t = textOf(k)
  if (!t.steps.length && r) t.steps = r.instructions_es ?? []
  if (!t.cues.length && r) t.cues = r.tips_es ?? []
  const img = {}
  if (r) {
    const f = r.images.flat
    for (const [from, to] of [['start', 'start'], ['peak', 'end'], ['main', 'main']]) if (f[from]) {
      const base = f[from].split('/').pop(), src = join(SRC, 'img/repdb', base)
      if (!existsSync(src)) throw new Error(`Falta la imagen ${base}`)
      copyFileSync(src, join(OUT, 'img', `${c.id}-${to}.webp`)); img[to] = `${c.id}-${to}.webp`
    }
    report.withRepdbImages++
  }
  const d = {
    id: c.id, name: c.name, nameEn: k ? kEnBySlug.get(k.slug)?.name : r?.name_en, group: c.primary, primary: c.primary, secondary: c.secondary, equipment: c.equipment,
    difficulty: DIFF[k?.difficultyLevel ?? r?.difficulty] ?? null, category: k?.category ?? r?.category ?? null,
    ...t, anatomy: r ? uniq([...anat(r.primary_muscles), ...anat(r.secondary_muscles)]) : [],
    img: Object.keys(img).length ? img : null, y: y?.id ?? null, video: null, sources: sources(k, r, y),
  }
  if (!d.steps.length) d.steps = null
  write(c.id, d)
  index.push({ id: c.id, n: c.name, en: d.nameEn, g: c.primary, e: c.equipment, d: d.difficulty, i: img.start ? 1 : y ? 2 : 0, y: y?.id, core: 1 })
  report.core++
}

// 2) Resto de la biblioteca: base Kinetic en español.
// Una foto de referencia solo se asigna si pertenece a UN único ejercicio (si dos entradas casan con la misma foto, ninguna la recibe).
const yUse = new Map()
for (const c of links) if (c.yuhonas) yUse.set(c.yuhonas, (yUse.get(c.yuhonas) ?? 0) + 1)
const yFor = (k) => { const en = kEnBySlug.get(k.slug); return en ? yByNorm.get(norm(en.name)) ?? null : null }
for (const k of kEs) { if (usedK.has(k.slug)) continue; const y = yFor(k); if (y) yUse.set(y.id, (yUse.get(y.id) ?? 0) + 1) }
for (const k of kEs) {
  if (usedK.has(k.slug)) continue
  const en = kEnBySlug.get(k.slug), y0 = yFor(k), y = y0 && yUse.get(y0.id) === 1 ? y0 : null
  const mg = k.muscleGroups ?? []
  const prim = mg.filter((m) => m.type === 'primary'), first = prim[0] ?? mg[0]
  const secondary = uniq([...prim.slice(1), ...mg.filter((m) => m.type !== 'primary')].map((m) => m.name)).filter((n) => n !== first?.name)
  const t = textOf(k)
  const group = GROUP[first ? slugOf(first) : ''] ?? 'Cuerpo completo'
  const d = {
    id: k.slug, name: k.name, nameEn: en?.name, group, primary: first?.name ?? group, secondary,
    equipment: uniq((k.equipment ?? []).map((e) => e.name)).filter((n) => n !== 'Otro'),
    difficulty: DIFF[k.difficultyLevel] ?? null, category: k.category ?? null,
    ...t, anatomy: [], img: null, y: y?.id ?? null, video: null, sources: sources(k, null, y),
  }
  if (!d.steps.length) d.steps = null
  write(k.slug, d)
  index.push({ id: k.slug, n: k.name, en: d.nameEn, g: group, e: d.equipment, d: d.difficulty, i: y ? 2 : 0, y: y?.id })
  if (y) report.withYuhonas++
  report.kinetic++
}

index.sort((a, b) => a.n.localeCompare(b.n, 'es'))
writeFileSync(join(OUT, 'index.json'), JSON.stringify(index))
writeFileSync(join(OUT, 'sources.json'), JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  count: index.length,
  sources: [
    { id: 'kinetic', name: 'Kinetic Exercises Database', url: 'https://github.com/kinetic-place/exercises-db', license: 'MIT', use: 'Nombres, músculos, equipamiento, dificultad y guías en español' },
    { id: 'repdb', name: 'RepDB (repdb.co)', url: 'https://repdb.co', license: 'Free tier: uso en aplicaciones con atribución', use: 'Ilustraciones inicio/final y anatomía de los ejercicios vinculados' },
    { id: 'yuhonas', name: 'Free Exercise DB', url: 'https://github.com/yuhonas/free-exercise-db', license: 'Unlicense', use: 'Fotos de referencia cargadas bajo demanda' },
  ],
  videos: 'Sin vídeos incorporados: los derechos de redistribución de «free-exercise-db-with-videos» no se pueden verificar vídeo a vídeo.',
}))
console.log(JSON.stringify({ total: index.length, ...report, unknownAnat: [...unknownAnat] }, null, 1))
if (report.missingLinks.length) { console.error('Vínculos rotos:', report.missingLinks); process.exit(1) }
