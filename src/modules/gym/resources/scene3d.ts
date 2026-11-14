/**
 * Visor 3D de ejercicios (Three.js). Se carga bajo demanda (import dinámico) para no pesar en el arranque.
 *
 * Maniquí anatómico gris sobre fondo de estudio oscuro: extremidades con volumen muscular, tronco con pecho,
 * abdomen y pelvis, y el músculo principal del ejercicio resaltado en naranja con halo azul. Se construye en
 * el dispositivo con las MISMAS poses (inicio → final) que la figura 2D de `data/poses.ts`: el plano sagital se
 * coloca en 3D, las extremidades se duplican a ambos lados y el implemento (barra, mancuernas, polea, banco…)
 * se modela alrededor. Cada ejercicio usa su propio modelo; nunca se reutiliza el de otro.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Pose, Pt, Template } from '../data/poses'

const S = 0.0105 // unidades 2D → metros aprox.
const SKIN = 0xb4b7bf
const HOT = 0xff5a2b
const HALF_SH = 0.2 // media anchura de hombros
const HALF_HIP = 0.09

type Tag = 'chest' | 'back' | 'traps' | 'delts' | 'upperArm' | 'forearm' | 'thigh' | 'calf' | 'glutes' | 'core'
const HIGHLIGHT: Record<string, Tag[]> = {
  Pecho: ['chest'], Espalda: ['back'], Hombros: ['delts'], Trapecio: ['traps'],
  'Bíceps': ['upperArm'], 'Tríceps': ['upperArm'], Antebrazos: ['forearm'],
  'Cuádriceps': ['thigh'], Isquiotibiales: ['thigh'], 'Glúteos': ['glutes'], Gemelos: ['calf'], Core: ['core'],
}

/** Ajustes 3D para ejercicios cuyo movimiento no ocurre en el plano lateral. */
const LATERAL_ARMS = new Set(['lateral'])
/** Apertura lateral extra de los brazos (m) en pose inicial / final. */
const SPREAD: Record<string, [number, number]> = { fly: [0.5, 0.06] }
/** Ejercicios con el pecho mirando al suelo (el resto: pecho hacia delante o arriba). */
const PRONE = new Set(['pushup', 'plank', 'chestRow'])

export interface Viewer {
  play(): void
  pause(): void
  restart(): void
  showPose(p: 'A' | 'B'): void
  resetView(): void
  isPlaying(): boolean
  dispose(): void
}

const ease = (x: number) => x * x * (3 - 2 * x)
/** Misma temporización que la figura 2D: A→B, pausa, B→A, pausa. */
const weight = (u: number) => (u < 0.42 ? ease(u / 0.42) : u < 0.5 ? 1 : u < 0.92 ? 1 - ease((u - 0.5) / 0.42) : 0)
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

interface J { head: Pt; shoulder: Pt; hip: Pt; elbow: Pt; hand: Pt; knee: Pt; foot: Pt; toe: Pt; knee2: Pt; foot2: Pt; toe2: Pt }
const joints = (p: Pose): J => {
  const toe = p.toe ?? [p.foot[0] + 14, p.foot[1]]
  const foot2 = p.foot2 ?? p.foot
  return { head: p.head, shoulder: p.shoulder, hip: p.hip, elbow: p.elbow, hand: p.hand, knee: p.knee, foot: p.foot, toe, knee2: p.knee2 ?? p.knee, foot2, toe2: p.foot2 ? [foot2[0] + 14, foot2[1]] : toe }
}
const mix = (a: J, b: J, t: number): J => {
  const o = {} as J
  for (const k of Object.keys(a) as (keyof J)[]) o[k] = lerp(a[k], b[k], t)
  return o
}

/** Perfiles de radio (m) a lo largo de cada segmento: dan volumen de músculo (bíceps, cuádriceps, gemelo…). */
const PROFILE = {
  upperArm: [[0.002, 0], [0.04, 0.02], [0.05, 0.16], [0.058, 0.42], [0.05, 0.72], [0.04, 0.96], [0.002, 1]],
  forearm: [[0.002, 0], [0.04, 0.03], [0.047, 0.2], [0.036, 0.7], [0.027, 0.97], [0.002, 1]],
  thigh: [[0.002, 0], [0.074, 0.03], [0.094, 0.22], [0.09, 0.5], [0.07, 0.86], [0.056, 0.98], [0.002, 1]],
  shin: [[0.002, 0], [0.055, 0.03], [0.063, 0.2], [0.05, 0.55], [0.036, 0.96], [0.002, 1]],
} as const

export function createViewer(host: HTMLElement, key: string, tpl: Template, primary: string | undefined, onChange: () => void): Viewer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;outline:none'
  renderer.domElement.setAttribute('role', 'img')
  renderer.domElement.setAttribute('aria-label', 'Modelo 3D del ejercicio: arrastra para girar, pellizca para ampliar')
  host.appendChild(renderer.domElement)

  // Iluminación de estudio: luz principal cálida, contraluz azul y relleno suave
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0x8d97ab, 0x0b0c0f, 0.9))
  const keyL = new THREE.DirectionalLight(0xfff2e6, 2.3); keyL.position.set(2.2, 3.6, 3.2); scene.add(keyL)
  const rimB = new THREE.DirectionalLight(0x5b8dff, 1.8); rimB.position.set(-3, 2, -2.5); scene.add(rimB)
  const rimO = new THREE.DirectionalLight(0xff8a4a, 0.9); rimO.position.set(3, 1, -3); scene.add(rimO)

  const A = joints(tpl.A), B = joints(tpl.B)
  const all = [...Object.values(A), ...Object.values(B), ...(tpl.scene ?? []).flatMap((sh) => (sh.t === 'rect' ? [[sh.x, sh.y], [sh.x + sh.w, sh.y + sh.h]] as Pt[] : [sh.a, sh.b]))]
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1])
  const cx = ((Math.min(...xs) + Math.max(...xs)) / 2 - 120) * S
  const floorY = tpl.floor === false ? Math.max(...ys) : 168
  const cy = ((168 - floorY) + (168 - Math.min(...ys))) * S / 2
  const extH = (floorY - Math.min(...ys)) * S, extW = (Math.max(...xs) - Math.min(...xs)) * S
  const target = new THREE.Vector3(cx, cy, 0)
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40)
  const fit = (Math.max(extH, extW / 1.33, 0.9) + 0.45) / 2 / Math.tan((32 / 2) * Math.PI / 180)
  const home = () => { camera.position.set(cx + fit * 0.32, cy + fit * 0.12, fit * 0.94); controls.target.copy(target); controls.update() }

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false
  controls.enableDamping = true
  controls.dampingFactor = 0.12
  controls.minDistance = 1.2
  controls.maxDistance = Math.max(6.5, fit * 2)
  controls.maxPolarAngle = Math.PI * 0.62
  controls.rotateSpeed = 0.9
  controls.zoomSpeed = 0.9
  home()

  const mats = {
    skin: new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.62, metalness: 0.02 }),
    hot: new THREE.MeshStandardMaterial({ color: HOT, roughness: 0.45, metalness: 0.05, emissive: 0x8a2a0c, emissiveIntensity: 0.9 }),
    glow: new THREE.MeshBasicMaterial({ color: 0x4f86ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
    iron: new THREE.MeshStandardMaterial({ color: 0x9aa0aa, roughness: 0.3, metalness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.55, metalness: 0.35 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.85, metalness: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x6d727c, roughness: 0.4, metalness: 0.7 }),
    shadow: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    line: new THREE.LineBasicMaterial({ color: 0x9b9ba4 }),
  }
  const geos: THREE.BufferGeometry[] = []
  const track = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g }
  const cyl = track(new THREE.CylinderGeometry(1, 1, 1, 16))
  const hex = track(new THREE.CylinderGeometry(1, 1, 1, 6))
  const sph = track(new THREE.SphereGeometry(1, 22, 16))
  const box = track(new THREE.BoxGeometry(1, 1, 1))
  const lathe = (pts: readonly (readonly [number, number])[]) => track(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 20).translate(0, -0.5, 0))
  const G = { upperArm: lathe(PROFILE.upperArm), forearm: lathe(PROFILE.forearm), thigh: lathe(PROFILE.thigh), shin: lathe(PROFILE.shin) }

  const hl = HIGHLIGHT[primary ?? ''] ?? []
  const on = (t: Tag) => hl.includes(t)

  const V = (pt: Pt, z = 0) => new THREE.Vector3((pt[0] - 120) * S, (168 - pt[1]) * S, z)
  const UP = new THREE.Vector3(0, 1, 0)
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3()

  const fig = new THREE.Group(); scene.add(fig)
  const props = new THREE.Group(); scene.add(props)

  /** Segmento entre dos puntos con una geometría de unidad (largo 1 centrado). `t0..t1`: tramo del segmento. */
  const part = (parent: THREE.Object3D, g: THREE.BufferGeometry, material: THREE.Material, rad = 1, t0 = 0, t1 = 1, flatZ = 1) => {
    const m = new THREE.Mesh(g, material); parent.add(m)
    return (a: THREE.Vector3, b: THREE.Vector3) => {
      tmp.subVectors(b, a); const len = Math.max(tmp.length(), 1e-4)
      m.position.copy(a).addScaledVector(tmp, (t0 + t1) / 2)
      m.quaternion.setFromUnitVectors(UP, tmp.divideScalar(len))
      m.scale.set(rad, len * (t1 - t0), rad * flatZ)
    }
  }
  /** Músculo resaltado: forma naranja sobre el segmento + halo azul translúcido */
  const hotPart = (g: THREE.BufferGeometry, t0: number, t1: number) => {
    const a = part(fig, g, mats.hot, 1.1, t0, t1), b = part(fig, g, mats.glow, 1.28, t0, t1)
    return (p: THREE.Vector3, q: THREE.Vector3) => { a(p, q); b(p, q) }
  }
  const blob = (parent: THREE.Object3D, rx: number, ry: number, rz: number, material: THREE.Material = mats.skin) => {
    const m = new THREE.Mesh(sph, material); m.scale.set(rx, ry, rz); parent.add(m)
    return (p: THREE.Vector3, q?: THREE.Quaternion) => { m.position.copy(p); if (q) m.quaternion.copy(q) }
  }
  const ball = (r: number, material: THREE.Material = mats.skin) => { const f = blob(fig, r, r, r, material); return (p: THREE.Vector3) => f(p) }
  const hotBlob = (rx: number, ry: number, rz: number) => {
    const a = blob(fig, rx, ry, rz, mats.hot), b = blob(fig, rx * 1.3, ry * 1.18, rz * 1.18, mats.glow)
    return (p: THREE.Vector3, q?: THREE.Quaternion) => { a(p, q); b(p, q) }
  }

  const upd: ((j: J) => void)[] = []
  const handPts = [new THREE.Vector3(), new THREE.Vector3()]

  // ── Tronco: pecho, abdomen y pelvis como elipsoides orientados según la columna ──
  const chestB = blob(fig, 0.125, 0.2, 0.21), waistB = blob(fig, 0.092, 0.17, 0.138), pelvisB = blob(fig, 0.105, 0.115, 0.165)
  const neck = part(fig, cyl, mats.skin, 0.045), headB = blob(fig, 0.088, 0.108, 0.09), jaw = blob(fig, 0.06, 0.05, 0.065)
  const trapsB = blob(fig, 0.07, 0.075, 0.14)
  const pecs = on('chest') ? [hotBlob(0.06, 0.1, 0.105), hotBlob(0.06, 0.1, 0.105)] : []
  const lats = on('back') ? [hotBlob(0.05, 0.16, 0.085), hotBlob(0.05, 0.16, 0.085)] : []
  const trapHot = on('traps') ? hotBlob(0.06, 0.09, 0.13) : null
  const abs = on('core') ? [hotBlob(0.045, 0.15, 0.05), hotBlob(0.045, 0.15, 0.05)] : []
  const glutes = on('glutes') ? [hotBlob(0.08, 0.085, 0.085), hotBlob(0.08, 0.085, 0.085)] : []
  const delts = on('delts') ? [hotBlob(0.065, 0.075, 0.065), hotBlob(0.065, 0.075, 0.065)] : []
  const q = new THREE.Quaternion()
  upd.push((j) => {
    const sh = V(j.shoulder), hp = V(j.hip), axis = tmp2.subVectors(hp, sh)
    const len = axis.length(); axis.divideScalar(len)
    q.setFromUnitVectors(UP, axis)
    // normal frontal en el plano: pecho hacia delante/arriba (o hacia el suelo en ejercicios en prono)
    const front = new THREE.Vector3(-axis.y, axis.x, 0)
    if (PRONE.has(key)) front.multiplyScalar(-1)
    chestB(sh.clone().addScaledVector(axis, len * 0.27), q)
    waistB(sh.clone().addScaledVector(axis, len * 0.64), q)
    pelvisB(hp.clone().addScaledVector(axis, -len * 0.02), q)
    const hd = V(j.head)
    neck(sh, hd); headB(hd.clone().addScaledVector(front, 0.01)); jaw(hd.clone().addScaledVector(front, 0.035).addScaledVector(UP, -0.05))
    trapsB(sh.clone().addScaledVector(axis, len * 0.04).addScaledVector(front, -0.03), q)
    const at = (t: number, f: number, z = 0) => sh.clone().addScaledVector(axis, len * t).addScaledVector(front, f).add(new THREE.Vector3(0, 0, z))
    pecs.forEach((f, i) => f(at(0.2, 0.09, i ? -0.1 : 0.1), q))
    lats.forEach((f, i) => f(at(0.3, -0.085, i ? -0.1 : 0.1), q))
    trapHot?.(at(0.04, -0.045), q)
    abs.forEach((f, i) => f(at(0.62, 0.085, i ? -0.045 : 0.045), q))
    glutes.forEach((f, i) => f(hp.clone().addScaledVector(front, -0.085).addScaledVector(axis, 0.02).add(new THREE.Vector3(0, 0, i ? -0.085 : 0.085)), q))
    delts.forEach((f, i) => f(V(j.shoulder, i ? -HALF_SH : HALF_SH)))
  })

  const side = (s: 1 | -1) => {
    const ua = part(fig, G.upperArm, mats.skin), fa = part(fig, G.forearm, mats.skin)
    const th = part(fig, G.thigh, mats.skin), sn = part(fig, G.shin, mats.skin)
    const ft = part(fig, cyl, mats.skin, 0.032)
    const uaHot = on('upperArm') ? hotPart(G.upperArm, 0.12, 0.88) : null, faHot = on('forearm') ? hotPart(G.forearm, 0.08, 0.8) : null
    const thHot = on('thigh') ? hotPart(G.thigh, 0.1, 0.92) : null, calfHot = on('calf') ? hotPart(G.shin, 0.06, 0.62) : null
    const bShoulder = ball(0.072), bElbow = ball(0.04), bHand = blob(fig, 0.036, 0.046, 0.032)
    const bKnee = ball(0.056), bHip = ball(0.075), bFoot = blob(fig, 0.1, 0.035, 0.05), bAnkle = ball(0.04)
    return (j: J, spread: number) => {
      // Brazo: plano sagital, o lateral si el movimiento es una elevación lateral
      const sh = V(j.shoulder, s * HALF_SH)
      let el: THREE.Vector3, hd: THREE.Vector3
      if (LATERAL_ARMS.has(key)) {
        const out = (pt: Pt) => sh.clone().add(new THREE.Vector3(0, (j.shoulder[1] - pt[1]) * S, s * (pt[0] - j.shoulder[0]) * S))
        el = out(j.elbow); hd = out(j.hand)
      } else {
        el = V(j.elbow, s * (HALF_SH + spread * 0.55)); hd = V(j.hand, s * (HALF_SH + spread))
      }
      ua(sh, el); fa(el, hd); bShoulder(sh); bElbow(el); bHand(hd)
      uaHot?.(sh, el); faHot?.(el, hd)
      handPts[s === 1 ? 0 : 1].copy(hd)
      // Pierna (la lejana usa knee2/foot2 si existen: zancadas, subidas al cajón…)
      const hp = V(j.hip, s * HALF_HIP)
      const [k, f, t] = s === 1 ? [j.knee, j.foot, j.toe] : [j.knee2, j.foot2, j.toe2]
      const kn = V(k, s * HALF_HIP), fo = V(f, s * HALF_HIP), to = V(t, s * HALF_HIP)
      th(hp, kn); sn(kn, fo); ft(fo, to); bKnee(kn); bHip(hp); bAnkle(fo)
      bFoot(fo.clone().lerp(to, 0.55).add(new THREE.Vector3(0, -0.01, 0)))
      thHot?.(hp, kn); calfHot?.(kn, fo)
    }
  }
  const sides = [side(1), side(-1)]

  // ── Implementos ──
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = props) => { const o = new THREE.Mesh(g, m); parent.add(o); return o }
  const rotZ = (o: THREE.Object3D) => { o.rotation.x = Math.PI / 2 }
  const handleBar = (plates: boolean) => {
    const bar = mesh(cyl, mats.iron); bar.scale.set(0.014, plates ? 1.6 : 1.0, 0.014); rotZ(bar)
    const ps: THREE.Mesh[] = []
    if (plates) for (const z of [-0.66, -0.7, 0.66, 0.7]) { const p = mesh(cyl, mats.dark); p.scale.set(0.21 - Math.abs(z) * 0.03, 0.03, 0.21 - Math.abs(z) * 0.03); rotZ(p); p.userData.z = z; ps.push(p) }
    if (plates) for (const z of [-0.745, 0.745]) { const c = mesh(cyl, mats.steel); c.scale.set(0.03, 0.03, 0.03); rotZ(c); c.userData.z = z; ps.push(c) }
    return () => {
      const m = handPts[0].clone().add(handPts[1]).multiplyScalar(0.5)
      bar.position.copy(m); for (const p of ps) p.position.set(m.x, m.y, p.userData.z)
    }
  }
  const dumbbells = () => {
    const parts = [0, 1].map(() => {
      const h = mesh(cyl, mats.steel); h.scale.set(0.016, 0.15, 0.016); rotZ(h)
      const e1 = mesh(hex, mats.dark), e2 = mesh(hex, mats.dark)
      for (const e of [e1, e2]) { e.scale.set(0.065, 0.06, 0.065); rotZ(e) }
      return [h, e1, e2] as const
    })
    return () => parts.forEach(([h, e1, e2], i) => { const p = handPts[i]; h.position.copy(p); e1.position.set(p.x, p.y, p.z - 0.105); e2.position.set(p.x, p.y, p.z + 0.105) })
  }
  const cable = () => {
    const anchor = V(tpl.anchor ?? [214, 60])
    const lines = [0, 1].map(() => { const g = track(new THREE.BufferGeometry().setFromPoints([anchor.clone(), anchor.clone()])); const l = new THREE.Line(g, mats.line); props.add(l); return g })
    const knob = mesh(sph, mats.steel); knob.scale.setScalar(0.045)
    const post = mesh(box, mats.steel); post.scale.set(0.07, Math.max(anchor.y + 0.3, 0.4), 0.12); post.position.set(anchor.x + 0.1, (anchor.y + 0.3) / 2 - 0.15, 0)
    return () => { lines.forEach((g, i) => g.setFromPoints([anchor, handPts[i]])); knob.position.copy(anchor) }
  }
  const propUpdate: (() => void)[] = []
  const rails = key === 'dip'
  if (tpl.prop === 'barbell') propUpdate.push(handleBar(true))
  else if (tpl.prop === 'dumbbell') propUpdate.push(dumbbells())
  else if (tpl.prop === 'cable') propUpdate.push(cable())
  else if (tpl.prop === 'bar' && !rails) propUpdate.push(handleBar(false))

  // Escena: bancos acolchados, cajones, soportes…
  const addShape = (sh: NonNullable<Template['scene']>[number]) => {
    if (sh.t === 'rect') {
      const pad = sh.h <= 10
      const m = mesh(box, pad ? mats.leather : mats.dark)
      m.scale.set(sh.w * S, sh.h * S * (pad ? 1.5 : 1), 0.5); m.position.set(((sh.x + sh.w / 2) - 120) * S, (168 - (sh.y + sh.h / 2)) * S - (pad ? sh.h * S * 0.25 : 0), 0)
      return
    }
    const a = V(sh.a), b = V(sh.b), w = (sh.w ?? 4) * S * 0.5
    tmp.subVectors(b, a); const len = tmp.length()
    if (tpl.prop === 'bar') {
      if (!rails) return
      for (const z of [-HALF_SH, HALF_SH]) { const m = mesh(cyl, mats.steel); const aa = a.clone(); aa.z = z; const bb = b.clone(); bb.z = z; tmp2.subVectors(bb, aa); m.position.copy(aa).addScaledVector(tmp2, 0.5); m.quaternion.setFromUnitVectors(UP, tmp2.clone().normalize()); m.scale.set(0.02, tmp2.length(), 0.02) }
      return
    }
    const slab = (sh.w ?? 4) >= 7 // respaldo / asiento acolchado
    const m = mesh(slab ? box : cyl, slab ? mats.leather : mats.steel)
    m.position.copy(a).addScaledVector(tmp, 0.5)
    if (slab) { m.scale.set(len, w * 1.6, 0.5); m.rotation.z = Math.atan2(tmp.y, tmp.x) } else { m.scale.set(w * 1.2, len, w * 1.2); m.quaternion.setFromUnitVectors(UP, tmp.clone().normalize()) }
  }
  tpl.scene?.forEach(addShape)

  // Sombra de contacto suave bajo el maniquí (en vez de suelo translúcido)
  if (tpl.floor !== false) {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const g = c.getContext('2d')!, grd = g.createRadialGradient(64, 64, 4, 64, 64, 62)
    grd.addColorStop(0, 'rgba(0,0,0,.65)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128)
    const tex = new THREE.CanvasTexture(c); mats.shadow.map = tex
    const f = new THREE.Mesh(track(new THREE.PlaneGeometry(2.6, 1.7)), mats.shadow)
    f.rotation.x = -Math.PI / 2; f.position.set(cx, 0.002, 0); scene.add(f)
    geos.push({ dispose: () => tex.dispose() } as THREE.BufferGeometry)
  }

  // ── Animación ──
  const [sp0, sp1] = SPREAD[key] ?? [0, 0]
  let t = 0, playing = true, dirty = true, last = performance.now(), raf = 0
  const T = 3.4
  const apply = (w: number) => {
    const j = mix(A, B, w)
    sides.forEach((f) => f(j, sp0 + (sp1 - sp0) * w))
    upd.forEach((u) => u(j))
    propUpdate.forEach((u) => u())
    dirty = true
  }
  apply(0)

  const size = () => {
    const r = host.getBoundingClientRect()
    if (!r.width || !r.height) return
    renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); dirty = true
  }
  const ro = new ResizeObserver(size); ro.observe(host); size()
  controls.addEventListener('change', () => { dirty = true })

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min((now - last) / 1000, 0.1); last = now
    if (document.hidden) return
    if (playing) { t = (t + dt) % T; apply(weight(t / T)) }
    controls.update()
    if (dirty) { renderer.render(scene, camera); dirty = false }
  }
  raf = requestAnimationFrame(loop)

  return {
    play() { playing = true; onChange() },
    pause() { playing = false; onChange() },
    restart() { t = 0; playing = true; apply(0); onChange() },
    showPose(p) { playing = false; t = p === 'A' ? 0 : T * 0.42; apply(p === 'A' ? 0 : 1); onChange() },
    resetView: home,
    isPlaying: () => playing,
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose()
      geos.forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose())
      renderer.dispose(); renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
