/**
 * Visor 3D de ejercicios (Three.js). Se carga bajo demanda (import dinámico) para no pesar en el arranque.
 *
 * El maniquí se construye en el dispositivo con las MISMAS poses (inicio → final) que la figura 2D de
 * `data/poses.ts`: el plano sagital de la figura se coloca en 3D, las extremidades se duplican a ambos
 * lados del cuerpo y el implemento (barra, mancuernas, polea, banco…) se modela alrededor. Así el modelo 3D
 * de cada ejercicio es el de ESE ejercicio y nunca se reutiliza el de otro.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Pose, Pt, Template } from '../data/poses'

const S = 0.0105 // unidades 2D → metros aprox.
const BODY = 0xe8e8ec
const ACCENT = 0x9fd0ff
const HALF_SH = 0.2 // media anchura de hombros
const HALF_HIP = 0.09

type Tag = 'torsoTop' | 'torsoLow' | 'upperArm' | 'forearm' | 'thigh' | 'shin' | 'shoulder' | 'hip'
const HIGHLIGHT: Record<string, Tag[]> = {
  Pecho: ['torsoTop'], Espalda: ['torsoTop'], Hombros: ['shoulder'], Trapecio: ['shoulder'],
  'Bíceps': ['upperArm'], 'Tríceps': ['upperArm'], Antebrazos: ['forearm'],
  'Cuádriceps': ['thigh'], Isquiotibiales: ['thigh'], 'Glúteos': ['hip'], Gemelos: ['shin'], Core: ['torsoLow'],
}

/** Ajustes 3D para ejercicios cuyo movimiento no ocurre en el plano lateral. */
const LATERAL_ARMS = new Set(['lateral'])
/** Apertura lateral extra de los brazos (m) en pose inicial / final. */
const SPREAD: Record<string, [number, number]> = { fly: [0.5, 0.06] }

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

export function createViewer(host: HTMLElement, key: string, tpl: Template, primary: string | undefined, onChange: () => void): Viewer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;outline:none'
  renderer.domElement.setAttribute('role', 'img')
  renderer.domElement.setAttribute('aria-label', 'Modelo 3D del ejercicio: arrastra para girar, pellizca para ampliar')
  host.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x20242c, 1.15))
  const key1 = new THREE.DirectionalLight(0xffffff, 1.6); key1.position.set(2, 3, 3); scene.add(key1)
  const rim = new THREE.DirectionalLight(0x9fd0ff, 0.9); rim.position.set(-3, 2, -2); scene.add(rim)

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
    body: new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.55, metalness: 0.05 }),
    accent: new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.4, metalness: 0.1, emissive: 0x1d3d5c }),
    iron: new THREE.MeshStandardMaterial({ color: 0x8e8e98, roughness: 0.35, metalness: 0.7 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x2b2b31, roughness: 0.6, metalness: 0.3 }),
    prop: new THREE.MeshStandardMaterial({ color: 0x4a505c, roughness: 0.7, metalness: 0.1 }),
    floor: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, side: THREE.DoubleSide }),
    line: new THREE.LineBasicMaterial({ color: 0x9b9ba4 }),
  }
  const geos: THREE.BufferGeometry[] = []
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 14); geos.push(cyl)
  const sph = new THREE.SphereGeometry(1, 18, 14); geos.push(sph)
  const box = new THREE.BoxGeometry(1, 1, 1); geos.push(box)

  const hl = HIGHLIGHT[primary ?? ''] ?? []
  const matFor = (t?: Tag) => (t && hl.includes(t) ? mats.accent : mats.body)

  const V = (pt: Pt, z = 0) => new THREE.Vector3((pt[0] - 120) * S, (168 - pt[1]) * S, z)
  const UP = new THREE.Vector3(0, 1, 0)
  const tmp = new THREE.Vector3()

  /** Segmento (cilindro) entre dos puntos */
  const seg = (parent: THREE.Object3D, r: number, material: THREE.Material, flatZ = 1) => {
    const m = new THREE.Mesh(cyl, material); m.scale.set(r, 1, r * flatZ); parent.add(m)
    return (a: THREE.Vector3, b: THREE.Vector3) => {
      tmp.subVectors(b, a); const len = Math.max(tmp.length(), 1e-4)
      m.position.copy(a).addScaledVector(tmp, 0.5)
      m.quaternion.setFromUnitVectors(UP, tmp.divideScalar(len))
      m.scale.y = len
    }
  }
  const ball = (parent: THREE.Object3D, r: number, material: THREE.Material) => {
    const m = new THREE.Mesh(sph, material); m.scale.setScalar(r); parent.add(m)
    return (p: THREE.Vector3) => m.position.copy(p)
  }

  const fig = new THREE.Group(); scene.add(fig)
  type Upd = (j: J, t: number) => void
  const upd: Upd[] = []

  // Tronco (dos mitades para poder resaltar pecho/espalda o core), cuello y cabeza
  const torsoTop = seg(fig, 0.105, matFor('torsoTop'), 1.55)
  const torsoLow = seg(fig, 0.095, matFor('torsoLow'), 1.5)
  const neck = seg(fig, 0.04, mats.body)
  const headB = ball(fig, 0.095, mats.body)
  const shBar = seg(fig, 0.05, matFor('shoulder')), hipBar = seg(fig, 0.06, matFor('hip'))
  upd.push((j) => {
    const sh = V(j.shoulder), hp = V(j.hip), mid = sh.clone().lerp(hp, 0.5)
    torsoTop(sh, mid); torsoLow(mid, hp); neck(sh, V(j.head)); headB(V(j.head))
    shBar(V(j.shoulder, -HALF_SH), V(j.shoulder, HALF_SH)); hipBar(V(j.hip, -HALF_HIP), V(j.hip, HALF_HIP))
  })

  const side = (s: 1 | -1) => {
    const ua = seg(fig, 0.042, matFor('upperArm')), fa = seg(fig, 0.035, matFor('forearm'))
    const th = seg(fig, 0.062, matFor('thigh')), sn = seg(fig, 0.045, matFor('shin')), ft = seg(fig, 0.03, mats.body)
    const bShoulder = ball(fig, 0.055, matFor('shoulder')), bElbow = ball(fig, 0.04, mats.body), bHand = ball(fig, 0.034, mats.body)
    const bKnee = ball(fig, 0.05, mats.body), bHip = ball(fig, 0.065, matFor('hip'))
    return (j: J, spread: number) => {
      // Brazo: plano sagital, o lateral si el movimiento es una elevación lateral
      const sh = V(j.shoulder, s * HALF_SH)
      let el: THREE.Vector3, hd: THREE.Vector3
      if (LATERAL_ARMS.has(key)) {
        const out = (q: Pt) => sh.clone().add(new THREE.Vector3(0, (j.shoulder[1] - q[1]) * S, s * (q[0] - j.shoulder[0]) * S))
        el = out(j.elbow); hd = out(j.hand)
      } else {
        el = V(j.elbow, s * (HALF_SH + spread * 0.55)); hd = V(j.hand, s * (HALF_SH + spread))
      }
      ua(sh, el); fa(el, hd); bShoulder(sh); bElbow(el); bHand(hd)
      handPts[s === 1 ? 0 : 1].copy(hd)
      // Pierna (la lejana usa knee2/foot2 si existen: zancadas, subidas al cajón…)
      const hp = V(j.hip, s * HALF_HIP)
      const [k, f, t] = s === 1 ? [j.knee, j.foot, j.toe] : [j.knee2, j.foot2, j.toe2]
      const kn = V(k, s * HALF_HIP), fo = V(f, s * HALF_HIP), to = V(t, s * HALF_HIP)
      th(hp, kn); sn(kn, fo); ft(fo, to); bKnee(kn); bHip(hp)
    }
  }
  const handPts = [new THREE.Vector3(), new THREE.Vector3()]
  const sides = [side(1), side(-1)]

  // Implementos
  const props = new THREE.Group(); scene.add(props)
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => { const o = new THREE.Mesh(g, m); props.add(o); return o }
  const rotZ = (o: THREE.Object3D) => { o.rotation.x = Math.PI / 2 }
  const handleBar = (plates: boolean) => {
    const bar = mesh(cyl, mats.iron); bar.scale.set(0.014, plates ? 1.55 : 1.0, 0.014); rotZ(bar)
    const ps: THREE.Mesh[] = []
    if (plates) for (const z of [-0.68, 0.68]) { const p = mesh(cyl, mats.plate); p.scale.set(0.2, 0.05, 0.2); rotZ(p); p.userData.z = z; ps.push(p) }
    return () => {
      const m = handPts[0].clone().add(handPts[1]).multiplyScalar(0.5)
      bar.position.copy(m); for (const p of ps) p.position.set(m.x, m.y, p.userData.z)
    }
  }
  const dumbbells = () => {
    const parts = [0, 1].map(() => {
      const h = mesh(cyl, mats.iron); h.scale.set(0.014, 0.16, 0.014); rotZ(h)
      const e1 = mesh(cyl, mats.plate), e2 = mesh(cyl, mats.plate)
      for (const e of [e1, e2]) { e.scale.set(0.055, 0.045, 0.055); rotZ(e) }
      return [h, e1, e2] as const
    })
    return () => parts.forEach(([h, e1, e2], i) => { const p = handPts[i]; h.position.copy(p); e1.position.set(p.x, p.y, p.z - 0.09); e2.position.set(p.x, p.y, p.z + 0.09) })
  }
  const cable = () => {
    const anchor = V(tpl.anchor ?? [214, 60])
    const pts = [0, 1].map(() => { const g = new THREE.BufferGeometry().setFromPoints([anchor.clone(), anchor.clone()]); geos.push(g); const l = new THREE.Line(g, mats.line); props.add(l); return g })
    const knob = mesh(sph, mats.iron); knob.scale.setScalar(0.045)
    const post = mesh(cyl, mats.prop); post.scale.set(0.03, 1, 0.03); post.position.set(anchor.x + 0.04, anchor.y / 2, 0); post.scale.y = Math.max(anchor.y, 0.1)
    return () => {
      pts.forEach((g, i) => g.setFromPoints([anchor, handPts[i]]))
      knob.position.copy(anchor)
    }
  }
  const propUpdate: (() => void)[] = []
  const bar2 = key === 'dip' ? 'rails' : 'cross'
  if (tpl.prop === 'barbell') propUpdate.push(handleBar(true))
  else if (tpl.prop === 'dumbbell') propUpdate.push(dumbbells())
  else if (tpl.prop === 'cable') propUpdate.push(cable())
  else if (tpl.prop === 'bar' && bar2 === 'cross') propUpdate.push(handleBar(false))

  // Escena: bancos, cajones, rails…
  const addShape = (sh: NonNullable<Template['scene']>[number]) => {
    if (sh.t === 'rect') {
      const m = mesh(box, mats.prop)
      const w = sh.w * S, h = sh.h * S
      m.scale.set(w, h, 0.5); m.position.set(((sh.x + sh.w / 2) - 120) * S, (168 - (sh.y + sh.h / 2)) * S, 0)
      return
    }
    const a = V(sh.a), b = V(sh.b), w = (sh.w ?? 4) * S * 0.5
    if (tpl.prop === 'bar') {
      if (bar2 !== 'rails') return
      for (const z of [-HALF_SH, HALF_SH]) { const m = mesh(cyl, mats.iron); m.scale.set(0.018, 1, 0.018); const aa = a.clone(); aa.z = z; const bb = b.clone(); bb.z = z; tmp.subVectors(bb, aa); m.position.copy(aa).addScaledVector(tmp, 0.5); m.quaternion.setFromUnitVectors(UP, tmp.clone().normalize()); m.scale.y = tmp.length() }
      return
    }
    // tableros inclinados (w ≥ 7) como losa; el resto como patas finas
    const slab = (sh.w ?? 4) >= 7
    const m = mesh(slab ? box : cyl, mats.prop)
    tmp.subVectors(b, a); const len = tmp.length()
    m.position.copy(a).addScaledVector(tmp, 0.5)
    if (slab) { m.scale.set(len, w * 1.3, 0.5); m.rotation.z = Math.atan2(tmp.y, tmp.x) } else { m.scale.set(w, len, w); m.quaternion.setFromUnitVectors(UP, tmp.clone().normalize()) }
  }
  tpl.scene?.forEach(addShape)
  if (tpl.floor !== false) {
    const f = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), mats.floor); geos.push(f.geometry)
    f.rotation.x = -Math.PI / 2; f.position.set(cx, 0.001, 0); scene.add(f)
  }

  // Animación
  const [sp0, sp1] = SPREAD[key] ?? [0, 0]
  let t = 0, playing = true, dirty = true, last = performance.now(), raf = 0, T = 3.4, manual: number | null = null
  const apply = (w: number) => {
    const j = mix(A, B, w)
    sides.forEach((f) => f(j, sp0 + (sp1 - sp0) * w))
    upd.forEach((u) => u(j, w))
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
    play() { playing = true; manual = null; onChange() },
    pause() { playing = false; onChange() },
    restart() { t = 0; manual = null; playing = true; apply(0); onChange() },
    showPose(p) { playing = false; manual = p === 'A' ? 0 : 1; t = p === 'A' ? 0 : T * 0.42; apply(manual); onChange() },
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
