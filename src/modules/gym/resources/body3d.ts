/**
 * Cuerpo humano 3D semirrealista, generado en el dispositivo una sola vez (se guarda en memoria):
 *  1. Anatomía como campo de distancias (SDF): pelvis, abdomen, caja torácica, pectorales, dorsales, trapecios,
 *     deltoides, bíceps/tríceps, antebrazos, glúteos, cuádriceps/isquios, gemelos, cabeza y manos, fundidos con
 *     uniones suaves para dar superficie orgánica con músculo definido.
 *  2. Malla triangular por Marching Cubes (vértices compartidos, normales del gradiente → sombreado suave).
 *  3. Pesos de piel hacia un esqueleto de 17 huesos (SkinnedMesh real) y pertenencia de cada vértice a cada
 *     grupo muscular, para iluminar en naranja/rojo el músculo que trabaja cada ejercicio.
 */
import * as THREE from 'three'
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js'

type V3 = [number, number, number]

// ── Esqueleto en reposo (postura en A, mira hacia +X, arriba +Y, lado izquierdo +Z) ──
export const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'uaL', 'faL', 'handL', 'uaR', 'faR', 'handR', 'thL', 'shL', 'ftL', 'thR', 'shR', 'ftR'] as const
export type BoneName = (typeof BONES)[number]
export const PARENT: Record<BoneName, BoneName | null> = {
  hips: null, spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck',
  uaL: 'chest', faL: 'uaL', handL: 'faL', uaR: 'chest', faR: 'uaR', handR: 'faR',
  thL: 'hips', shL: 'thL', ftL: 'shL', thR: 'hips', shR: 'thR', ftR: 'shR',
}
const mir = (p: V3): V3 => [p[0], p[1], -p[2]]
const SH: V3 = [0, 1.4, 0.19], EL: V3 = [0, 1.101, 0.329], WR: V3 = [0, 0.838, 0.452], HE: V3 = [0, 0.76, 0.49]
const HP: V3 = [0, 0.92, 0.1], KN: V3 = [0.0, 0.48, 0.125], AN: V3 = [0, 0.07, 0.15], TO: V3 = [0.21, 0.03, 0.155]
/** Cabeza (origen) de cada hueso en reposo */
export const REST: Record<BoneName, V3> = {
  hips: [0, 0.95, 0], spine: [0, 1.05, 0], chest: [0, 1.28, 0], neck: [0, 1.46, 0], head: [0, 1.58, 0],
  uaL: SH, faL: EL, handL: WR, uaR: mir(SH), faR: mir(EL), handR: mir(WR),
  thL: HP, shL: KN, ftL: AN, thR: mir(HP), shR: mir(KN), ftR: mir(AN),
}
/** Extremo (cola) de cada hueso: define su segmento para los pesos de piel */
const TAIL: Record<BoneName, V3> = {
  hips: REST.spine, spine: REST.chest, chest: REST.neck, neck: REST.head, head: [0.015, 1.78, 0],
  uaL: EL, faL: WR, handL: HE, uaR: mir(EL), faR: mir(WR), handR: mir(HE),
  thL: KN, shL: AN, ftL: TO, thR: mir(KN), shR: mir(AN), ftR: mir(TO),
}
export const TAIL_OF = TAIL

// ── Campo de distancias ──
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25 }
type F = (x: number, y: number, z: number) => number
const capsule = (a: V3, b: V3, ra: number, rb = ra, off: V3 = [0, 0, 0]): F => {
  const ax = a[0] + off[0], ay = a[1] + off[1], az = a[2] + off[2]
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], bb = bx * bx + by * by + bz * bz
  return (x, y, z) => {
    const px = x - ax, py = y - ay, pz = z - az
    const h = clamp((px * bx + py * by + pz * bz) / bb, 0, 1)
    return Math.hypot(px - bx * h, py - by * h, pz - bz * h) - (ra + (rb - ra) * h)
  }
}
const ell = (c: V3, r: V3): F => (x, y, z) => {
  const ux = (x - c[0]) / r[0], uy = (y - c[1]) / r[1], uz = (z - c[2]) / r[2]
  const k0 = Math.hypot(ux, uy, uz)
  const k1 = Math.hypot(ux / r[0], uy / r[1], uz / r[2])
  return k1 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1
}
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** Volúmenes de cada grupo muscular (también definen la forma del cuerpo) */
export const ZONES = ['chest', 'back', 'traps', 'delts', 'biceps', 'triceps', 'forearm', 'quads', 'hams', 'glutes', 'calves', 'core'] as const
export type Zone = (typeof ZONES)[number]
const zoneShapes: Record<Zone, F[]> = {
  chest: [ell([0.062, 1.34, 0.1], [0.07, 0.08, 0.108])],
  back: [ell([-0.075, 1.27, 0.13], [0.08, 0.14, 0.1]), ell([-0.1, 1.34, 0.06], [0.05, 0.12, 0.09])],
  traps: [capsule([-0.02, 1.52, 0], [-0.05, 1.42, 0.17], 0.055, 0.05)],
  delts: [ell([0, 1.4, 0.2], [0.085, 0.1, 0.085])],
  biceps: [capsule(lerp3(SH, EL, 0.22), lerp3(SH, EL, 0.75), 0.05, 0.042, [0.024, 0, 0])],
  triceps: [capsule(lerp3(SH, EL, 0.2), lerp3(SH, EL, 0.78), 0.052, 0.044, [-0.026, 0, 0])],
  forearm: [capsule(lerp3(EL, WR, 0.04), lerp3(EL, WR, 0.8), 0.046, 0.032)],
  quads: [capsule(lerp3(HP, KN, 0.1), lerp3(HP, KN, 0.88), 0.088, 0.062, [0.026, 0, 0])],
  hams: [capsule(lerp3(HP, KN, 0.12), lerp3(HP, KN, 0.9), 0.08, 0.058, [-0.026, 0, 0])],
  glutes: [ell([-0.07, 0.9, 0.09], [0.09, 0.095, 0.095])],
  calves: [capsule(lerp3(KN, AN, 0.1), lerp3(KN, AN, 0.62), 0.056, 0.044, [-0.028, 0, 0])],
  core: [ell([0.075, 1.1, 0.05], [0.05, 0.165, 0.085]), ell([0.01, 1.1, 0.145], [0.08, 0.12, 0.05])],
}
const zoneD = (z: Zone, x: number, y: number, zz: number) => { let d = 1e9; for (const f of zoneShapes[z]) d = Math.min(d, f(x, y, zz)); return d }

function bodySdf(): F {
  const torso: F[] = [
    ell([0, 0.95, 0], [0.1, 0.1, 0.165]),
    ell([-0.005, 1.09, 0], [0.085, 0.135, 0.135]),
    ell([-0.01, 1.3, 0], [0.108, 0.2, 0.195]),
    ...zoneShapes.chest, ...zoneShapes.back, ...zoneShapes.traps, ...zoneShapes.glutes, ...zoneShapes.core,
    ell([0.085, 1.045, 0.042], [0.028, 0.034, 0.038]), ell([0.088, 1.115, 0.042], [0.028, 0.034, 0.04]), ell([0.088, 1.185, 0.044], [0.028, 0.034, 0.042]),
  ]
  const neckHead: F[] = [
    capsule([0, 1.46, 0], [0.012, 1.58, 0], 0.058, 0.05), ell([0.015, 1.68, 0], [0.098, 0.118, 0.09]), ell([0.045, 1.62, 0], [0.066, 0.058, 0.062]), ell([0.105, 1.665, 0], [0.02, 0.025, 0.02]),
  ]
  const arm: F[] = [
    capsule(SH, EL, 0.048, 0.038), ...zoneShapes.biceps, ...zoneShapes.triceps, ...zoneShapes.delts,
    capsule(EL, WR, 0.04, 0.027), ...zoneShapes.forearm, ell(lerp3(WR, HE, 0.5), [0.03, 0.06, 0.036]),
  ]
  const leg: F[] = [
    capsule(HP, KN, 0.088, 0.06), ...zoneShapes.quads, ...zoneShapes.hams,
    capsule(KN, AN, 0.058, 0.036), ...zoneShapes.calves, ell(KN, [0.058, 0.058, 0.058]),
    capsule(AN, TO, 0.04, 0.03), ell([-0.02, 0.06, AN[2]], [0.05, 0.055, 0.05]),
  ]
  const un = (fs: F[], k: number): F => (x, y, z) => { let d = fs[0](x, y, z); for (let i = 1; i < fs.length; i++) d = smin(d, fs[i](x, y, z), k); return d }
  const T = un(torso, 0.045), N = un(neckHead, 0.035), A = un(arm, 0.03), L = un(leg, 0.035)
  return (x, y, z) => {
    z = Math.abs(z)
    let d = smin(T(x, y, z), N(x, y, z), 0.05)
    d = smin(d, A(x, y, z), 0.04)
    d = smin(d, L(x, y, z), 0.06)
    return d
  }
}

// ── Marching Cubes ──
export interface BodyData {
  positions: Float32Array
  normals: Float32Array
  index: Uint32Array
  skinIndex: Uint16Array
  skinWeight: Float32Array
  /** pertenencia (0..1) de cada vértice a cada grupo muscular: nv × ZONES.length */
  zones: Float32Array
}
let cache: BodyData | null = null

const CORNER: V3[] = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
const EDGE: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]

export function buildBody(): BodyData {
  if (cache) return cache
  const f = bodySdf()
  const H = 0.0135
  const X0 = -0.3, Y0 = -0.03, Z0 = -0.64
  const nx = Math.ceil(0.72 / H), ny = Math.ceil(1.86 / H), nz = Math.ceil(1.28 / H)
  const sx = nx + 1, sy = ny + 1
  const field = new Float32Array(sx * sy * (nz + 1)).fill(1)
  const ix = (i: number, j: number, k: number) => i + sx * (j + sy * k)
  // evaluación por bloques: se descartan los bloques lejos de la superficie
  const B = 4
  for (let bk = 0; bk <= nz; bk += B) for (let bj = 0; bj <= ny; bj += B) for (let bi = 0; bi <= nx; bi += B) {
    const cx = X0 + (bi + B / 2) * H, cy = Y0 + (bj + B / 2) * H, cz = Z0 + (bk + B / 2) * H
    const d0 = f(cx, cy, cz)
    if (Math.abs(d0) > B * H * 1.2) { for (let k = bk; k < Math.min(bk + B, nz + 1); k++) for (let j = bj; j < Math.min(bj + B, ny + 1); j++) for (let i = bi; i < Math.min(bi + B, nx + 1); i++) field[ix(i, j, k)] = d0 > 0 ? 1 : -1; continue }
    for (let k = bk; k < Math.min(bk + B, nz + 1); k++) for (let j = bj; j < Math.min(bj + B, ny + 1); j++) for (let i = bi; i < Math.min(bi + B, nx + 1); i++) field[ix(i, j, k)] = f(X0 + i * H, Y0 + j * H, Z0 + k * H)
  }

  const pos: number[] = [], idx: number[] = []
  const edgeVert = new Map<number, number>()
  const vertOnEdge = (i: number, j: number, k: number, e: number): number => {
    const [c0, c1] = EDGE[e]
    const a = CORNER[c0], b = CORNER[c1]
    const ai = i + a[0], aj = j + a[1], ak = k + a[2], bi = i + b[0], bj = j + b[1], bk = k + b[2]
    // clave única de la arista (extremo menor + eje)
    const lo = ix(Math.min(ai, bi), Math.min(aj, bj), Math.min(ak, bk))
    const axis = ai !== bi ? 0 : aj !== bj ? 1 : 2
    const key = lo * 3 + axis
    const hit = edgeVert.get(key)
    if (hit !== undefined) return hit
    const va = field[ix(ai, aj, ak)], vb = field[ix(bi, bj, bk)]
    const t = va / (va - vb)
    pos.push(X0 + (ai + (bi - ai) * t) * H, Y0 + (aj + (bj - aj) * t) * H, Z0 + (ak + (bk - ak) * t) * H)
    const n = pos.length / 3 - 1
    edgeVert.set(key, n)
    return n
  }
  const cv = new Float32Array(8)
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let cubeIndex = 0
    for (let c = 0; c < 8; c++) { const v = field[ix(i + CORNER[c][0], j + CORNER[c][1], k + CORNER[c][2])]; cv[c] = v; if (v < 0) cubeIndex |= 1 << c }
    if (cubeIndex === 0 || cubeIndex === 255 || !edgeTable[cubeIndex]) continue
    const row = cubeIndex * 16
    for (let t = 0; triTable[row + t] !== -1; t += 3) {
      const a = vertOnEdge(i, j, k, triTable[row + t]), b = vertOnEdge(i, j, k, triTable[row + t + 1]), c = vertOnEdge(i, j, k, triTable[row + t + 2])
      idx.push(a, c, b) // orientación hacia fuera
    }
  }

  const nv = pos.length / 3
  const positions = new Float32Array(pos), normals = new Float32Array(nv * 3)
  const e = 0.004
  for (let v = 0; v < nv; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2]
    // gradiente con z con signo (f usa |z|: se respeta la simetría)
    const gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e)
    const l = Math.hypot(gx, gy, gz) || 1
    normals[v * 3] = gx / l; normals[v * 3 + 1] = gy / l; normals[v * 3 + 2] = gz / l
  }

  // pesos de piel (4 huesos más cercanos) y pertenencia a grupos musculares
  const skinIndex = new Uint16Array(nv * 4), skinWeight = new Float32Array(nv * 4), zones = new Float32Array(nv * ZONES.length)
  const segs = BONES.map((b) => { const a = REST[b], t = TAIL[b]; return { a, ab: [t[0] - a[0], t[1] - a[1], t[2] - a[2]] as V3 } })
  const dist = new Float32Array(BONES.length)
  for (let v = 0; v < nv; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2]
    for (let b = 0; b < segs.length; b++) {
      const { a, ab } = segs[b]
      const px = x - a[0], py = y - a[1], pz = z - a[2]
      const h = clamp((px * ab[0] + py * ab[1] + pz * ab[2]) / (ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]), 0, 1)
      dist[b] = Math.hypot(px - ab[0] * h, py - ab[1] * h, pz - ab[2] * h)
    }
    const order = [...dist.keys()].sort((p, q) => dist[p] - dist[q]).slice(0, 4)
    let sum = 0
    const w = order.map((b) => { const r = 1 / Math.pow(dist[b] + 0.012, 4); sum += r; return r })
    order.forEach((b, n) => { skinIndex[v * 4 + n] = b; skinWeight[v * 4 + n] = w[n] / sum })
    ZONES.forEach((zn, n) => { zones[v * ZONES.length + n] = clamp((0.022 - zoneD(zn, x, y, Math.abs(z))) / 0.05, 0, 1) })
  }
  cache = { positions, normals, index: new Uint32Array(idx), skinIndex, skinWeight, zones }
  return cache
}

export const geometryOf = (b: BodyData) => {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(b.positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(b.normals, 3))
  g.setAttribute('skinIndex', new THREE.BufferAttribute(b.skinIndex, 4))
  g.setAttribute('skinWeight', new THREE.BufferAttribute(b.skinWeight, 4))
  g.setIndex(new THREE.BufferAttribute(b.index, 1))
  return g
}
