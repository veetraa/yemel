/**
 * Visor 3D de ejercicios (Three.js). Se carga bajo demanda (import dinámico) para no pesar en el arranque.
 *
 * Un único maniquí anatómico semirrealista (SkinnedMesh con esqueleto de 17 huesos, ver `body3d.ts`) con
 * iluminación de estudio sobre fondo oscuro. La animación propia de cada ejercicio se genera con cinemática
 * inversa a partir de sus poses (inicio → final) y se reproduce con un AnimationMixer. El músculo principal se
 * ilumina en naranja (rojo en la zona de más énfasis) y los secundarios en naranja suave; el resto, gris claro.
 * El implemento (barra, mancuernas, polea, banco…) se modela alrededor y sigue a las manos del esqueleto.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Pt, Template } from '../data/poses'
import { buildBody, geometryOf, REST, TAIL_OF, ZONES, type Zone } from './body3d'
import { bakeClip, createSkeleton, solve, type Targets } from './rig3d'

const S = 0.0118 // unidades 2D → metros
const HALF_SH = 0.19
const HALF_HIP = 0.1
const T = 3.4

const ZONE_OF: Record<string, Zone[]> = {
  Pecho: ['chest'], Espalda: ['back', 'traps'], Hombros: ['delts'], Trapecio: ['traps'], 'Bíceps': ['biceps'], 'Tríceps': ['triceps'],
  Antebrazos: ['forearm'], 'Cuádriceps': ['quads'], Isquiotibiales: ['hams'], 'Glúteos': ['glutes'], Gemelos: ['calves'], Core: ['core'],
}
/** Ajustes 3D para ejercicios cuyo movimiento no ocurre en el plano lateral. */
const LATERAL_ARMS = new Set(['lateral'])
const SPREAD: Record<string, [number, number]> = { fly: [0.5, 0.06] }
/** Orientación del pecho: hacia arriba (tumbado boca arriba) o hacia el suelo (prono) */
const SUPINE = new Set(['bench', 'incline', 'fly', 'skull', 'hipThrust', 'crunch', 'legPress'])
const PRONE = new Set(['pushup', 'plank', 'chestRow', 'legCurl'])

export type ViewName = 'lateral' | 'frontal' | 'superior'
export type PhaseKind = 'concentric' | 'eccentric' | 'hold'

export interface Viewer {
  play(): void
  pause(): void
  restart(): void
  showPose(p: 'A' | 'B'): void
  setPhase(u: number): void
  phase(): number
  /** Fase del movimiento en el instante actual (null si el ejercicio no la distingue) */
  kind(): PhaseKind | null
  setView(v: ViewName): void
  resetView(): void
  isPlaying(): boolean
  dispose(): void
}

const ease = (x: number) => x * x * (3 - 2 * x)
/** Temporización: A→B, pausa, B→A, pausa. */
const weight = (u: number) => (u < 0.42 ? ease(u / 0.42) : u < 0.5 ? 1 : u < 0.92 ? 1 - ease((u - 0.5) / 0.42) : 0)
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

interface J { head: Pt; shoulder: Pt; hip: Pt; elbow: Pt; hand: Pt; knee: Pt; foot: Pt; toe: Pt; knee2: Pt; foot2: Pt; toe2: Pt }
const joints = (p: import('../data/poses').Pose): J => {
  const toe = p.toe ?? [p.foot[0] + 14, p.foot[1]]
  const foot2 = p.foot2 ?? p.foot
  return { head: p.head, shoulder: p.shoulder, hip: p.hip, elbow: p.elbow, hand: p.hand, knee: p.knee, foot: p.foot, toe, knee2: p.knee2 ?? p.knee, foot2, toe2: p.foot2 ? [foot2[0] + 14, foot2[1]] : toe }
}
const mix = (a: J, b: J, t: number): J => { const o = {} as J; for (const k of Object.keys(a) as (keyof J)[]) o[k] = lerp(a[k], b[k], t); return o }

/** ¿El tramo A→B es la fase concéntrica (se levanta la carga / se contrae el músculo)? undefined si no es claro. */
function concentricFirst(key: string, tpl: Template): boolean | undefined {
  if (['plank', 'carry', 'pallof', 'landmine'].includes(key)) return undefined
  const a = joints(tpl.A), b = joints(tpl.B)
  const dist = (p: Pt, q: Pt) => Math.hypot(p[0] - q[0], p[1] - q[1])
  if (key === 'legPress' || key === 'legExt') return dist(b.foot, b.hip) > dist(a.foot, a.hip)
  if (key === 'legCurl') return dist(b.foot, b.hip) < dist(a.foot, a.hip)
  if (key === 'hipThrust') return b.hip[1] < a.hip[1]
  if (key === 'legRaise') return b.foot[1] < a.foot[1]
  if (key === 'crunch') return b.shoulder[1] < a.shoulder[1]
  if (tpl.prop === 'cable' && tpl.anchor) return dist(b.hand, tpl.anchor) > dist(a.hand, tpl.anchor)
  if (tpl.prop === 'barbell' || tpl.prop === 'dumbbell') return b.hand[1] < a.hand[1]
  return b.head[1] < a.head[1]
}

export function createViewer(host: HTMLElement, key: string, tpl: Template, primary: string | undefined, secondary: string[], onChange: () => void): Viewer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.95
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;outline:none'
  renderer.domElement.setAttribute('role', 'img')
  renderer.domElement.setAttribute('aria-label', 'Modelo 3D del ejercicio: arrastra para girar, pellizca para ampliar')
  host.appendChild(renderer.domElement)

  // Iluminación cinematográfica: luz principal cálida, contraluces azul y naranja, relleno suave
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0x8d97ab, 0x0b0c0f, 0.32))
  const keyL = new THREE.DirectionalLight(0xfff0e0, 1.7); keyL.position.set(2.2, 3.6, 3.2); scene.add(keyL)
  const fillL = new THREE.DirectionalLight(0xaab4cc, 0.3); fillL.position.set(-3, 1.5, 2.5); scene.add(fillL)
  const rimB = new THREE.DirectionalLight(0x5b8dff, 1.4); rimB.position.set(-3, 2.2, -2.5); scene.add(rimB)
  const rimO = new THREE.DirectionalLight(0xff8a4a, 0.9); rimO.position.set(3, 1.2, -3); scene.add(rimO)

  const A = joints(tpl.A), B = joints(tpl.B)
  const all = [...Object.values(A), ...Object.values(B), ...(tpl.scene ?? []).flatMap((sh) => (sh.t === 'rect' ? [[sh.x, sh.y], [sh.x + sh.w, sh.y + sh.h]] as Pt[] : [sh.a, sh.b]))]
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1])
  const cx = ((Math.min(...xs) + Math.max(...xs)) / 2 - 120) * S
  const floorY = tpl.floor === false ? Math.max(...ys) : 168
  const cy = ((168 - floorY) + (168 - Math.min(...ys))) * S / 2
  const extH = (floorY - Math.min(...ys)) * S, extW = (Math.max(...xs) - Math.min(...xs)) * S
  const target = new THREE.Vector3(cx, cy, 0)
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40)
  const fit = (Math.max(extH + 0.15, extW / 1.33, 1.0) + 0.5) / 2 / Math.tan((32 / 2) * Math.PI / 180)
  const placeCamera = (x: number, y: number, z: number) => { camera.position.set(cx + x * fit, cy + y * fit, z * fit); controls.target.copy(target); controls.update() }
  const VIEWS: Record<ViewName | 'libre', [number, number, number]> = { libre: [0.34, 0.14, 0.92], lateral: [0, 0.02, 1], frontal: [1, 0.02, 0.001], superior: [0.001, 1, 0.001] }
  const home = () => placeCamera(...VIEWS.libre)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false
  controls.enableDamping = true
  controls.dampingFactor = 0.12
  controls.minDistance = 1.0
  controls.maxDistance = Math.max(6.5, fit * 2)
  controls.maxPolarAngle = Math.PI * 0.62
  controls.rotateSpeed = 0.9
  controls.zoomSpeed = 0.9
  home()

  const geos: THREE.BufferGeometry[] = []
  const track = <G extends THREE.BufferGeometry>(g: G) => { geos.push(g); return g }
  const disposers: (() => void)[] = []

  // ── Cuerpo: malla con piel al esqueleto y color por músculo ──
  const body = buildBody()
  const bg = track(geometryOf(body))
  const nv = body.positions.length / 3
  const colors = new Float32Array(nv * 3)
  const mainZ = ZONE_OF[primary ?? ''] ?? [], secZ = secondary.flatMap((s) => ZONE_OF[s] ?? []).filter((z) => !mainZ.includes(z))
  const zi = (z: Zone) => ZONES.indexOf(z)
  const GREY = [0.6, 0.61, 0.65], ORANGE = [1.0, 0.36, 0.06], RED = [0.9, 0.08, 0.05], SOFT = [0.85, 0.45, 0.3]
  const mixc = (a: number[], b: number[], t: number, o: number[]) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t }
  const c = [0, 0, 0]
  for (let v = 0; v < nv; v++) {
    let m1 = 0, m2 = 0
    for (const z of mainZ) m1 = Math.max(m1, body.zones[v * ZONES.length + zi(z)])
    for (const z of secZ) m2 = Math.max(m2, body.zones[v * ZONES.length + zi(z)])
    mixc(GREY, SOFT, 0.55 * sstep(0.1, 0.6, m2), c)
    const o1 = [c[0], c[1], c[2]]
    mixc(o1, ORANGE, sstep(0.08, 0.5, m1), c)
    mixc(c, RED, sstep(0.6, 1, m1) * 0.9, c)
    colors[v * 3] = c[0]; colors[v * 3 + 1] = c[1]; colors[v * 3 + 2] = c[2]
  }
  bg.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.03, side: THREE.DoubleSide })
  skinMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float hot = clamp((vColor.r - vColor.b - 0.18) * 2.5, 0.0, 1.0);
      float rim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.4);
      totalEmissiveRadiance += vec3(1.0, 0.26, 0.05) * hot * 0.55 + vec3(0.25, 0.5, 1.0) * rim * (0.12 + hot * 1.1);`)
  }
  disposers.push(() => skinMat.dispose())

  const { bones, skeleton, root } = createSkeleton()
  const mesh = new THREE.SkinnedMesh(bg, skinMat)
  mesh.frustumCulled = false
  mesh.add(root)
  mesh.bind(skeleton)
  const fig = new THREE.Group(); fig.add(mesh); scene.add(fig)

  // ── Animación: poses → IK → clip ──
  const V = (pt: Pt, z = 0) => new THREE.Vector3((pt[0] - 120) * S, (168 - pt[1]) * S, z)
  const [sp0, sp1] = SPREAD[key] ?? [0, 0]
  const facing: Targets['facing'] = SUPINE.has(key) ? 'up' : PRONE.has(key) ? 'down' : 'front'
  const targetsAt = (u: number): Targets => {
    const w = weight(u), j = mix(A, B, w), spread = sp0 + (sp1 - sp0) * w
    const hand: THREE.Vector3[] = [], elbow: THREE.Vector3[] = [], foot: THREE.Vector3[] = [], knee: THREE.Vector3[] = [], toe: THREE.Vector3[] = []
    for (const s of [1, -1] as const) {
      if (LATERAL_ARMS.has(key)) {
        const sh = V(j.shoulder, s * HALF_SH)
        const out = (pt: Pt) => sh.clone().add(new THREE.Vector3(0, (j.shoulder[1] - pt[1]) * S, s * (pt[0] - j.shoulder[0]) * S))
        elbow.push(out(j.elbow)); hand.push(out(j.hand))
      } else { elbow.push(V(j.elbow, s * (HALF_SH + spread * 0.55))); hand.push(V(j.hand, s * (HALF_SH + spread))) }
      const [k, f, t] = s === 1 ? [j.knee, j.foot, j.toe] : [j.knee2, j.foot2, j.toe2]
      knee.push(V(k, s * HALF_HIP)); foot.push(V(f, s * HALF_HIP)); toe.push(V(t, s * HALF_HIP))
    }
    return { hip: V(j.hip), shoulder: V(j.shoulder), head: V(j.head), hand, elbow, foot, knee, toe, facing }
  }
  const clip = bakeClip((u) => solve(targetsAt(u)), T)
  const mixer = new THREE.AnimationMixer(fig)
  const action = mixer.clipAction(clip); action.play()
  const first = concentricFirst(key, tpl)

  // ── Implementos: siguen a las manos del esqueleto ──
  const props = new THREE.Group(); scene.add(props)
  const mats = {
    iron: new THREE.MeshStandardMaterial({ color: 0x9aa0aa, roughness: 0.3, metalness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.55, metalness: 0.35 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.85, metalness: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x6d727c, roughness: 0.4, metalness: 0.7 }),
    shadow: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    line: new THREE.LineBasicMaterial({ color: 0x9b9ba4 }),
  }
  const cyl = track(new THREE.CylinderGeometry(1, 1, 1, 18))
  const hex = track(new THREE.CylinderGeometry(1, 1, 1, 6))
  const sph = track(new THREE.SphereGeometry(1, 20, 14))
  const box = track(new THREE.BoxGeometry(1, 1, 1))
  const UP = new THREE.Vector3(0, 1, 0)
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3()
  const mesh3 = (g: THREE.BufferGeometry, m: THREE.Material) => { const o = new THREE.Mesh(g, m); props.add(o); return o }
  const rotZ = (o: THREE.Object3D) => { o.rotation.x = Math.PI / 2 }
  const gripLocal = new THREE.Vector3(TAIL_OF.handL[0] - REST.handL[0], TAIL_OF.handL[1] - REST.handL[1], TAIL_OF.handL[2] - REST.handL[2]).multiplyScalar(0.45)
  const handPts = [new THREE.Vector3(), new THREE.Vector3()]
  const readHands = () => {
    fig.updateMatrixWorld(true)
    handPts[0].copy(gripLocal); bones.handL.localToWorld(handPts[0])
    gripLocal.z *= -1; handPts[1].copy(gripLocal); bones.handR.localToWorld(handPts[1]); gripLocal.z *= -1
  }
  const handleBar = (plates: boolean) => {
    const bar = mesh3(cyl, mats.iron); bar.scale.set(0.014, plates ? 1.6 : 1.0, 0.014); rotZ(bar)
    const ps: THREE.Mesh[] = []
    if (plates) for (const z of [-0.66, -0.7, 0.66, 0.7]) { const p = mesh3(cyl, mats.dark); p.scale.set(0.21 - Math.abs(z) * 0.03, 0.03, 0.21 - Math.abs(z) * 0.03); rotZ(p); p.userData.z = z; ps.push(p) }
    if (plates) for (const z of [-0.745, 0.745]) { const k = mesh3(cyl, mats.steel); k.scale.set(0.03, 0.03, 0.03); rotZ(k); k.userData.z = z; ps.push(k) }
    return () => { const m = tmp.copy(handPts[0]).add(handPts[1]).multiplyScalar(0.5); bar.position.copy(m); for (const p of ps) p.position.set(m.x, m.y, p.userData.z) }
  }
  const dumbbells = () => {
    const parts = [0, 1].map(() => {
      const h = mesh3(cyl, mats.steel); h.scale.set(0.016, 0.15, 0.016); rotZ(h)
      const e1 = mesh3(hex, mats.dark), e2 = mesh3(hex, mats.dark)
      for (const e of [e1, e2]) { e.scale.set(0.065, 0.06, 0.065); rotZ(e) }
      return [h, e1, e2] as const
    })
    return () => parts.forEach(([h, e1, e2], i) => { const p = handPts[i]; h.position.copy(p); e1.position.set(p.x, p.y, p.z - 0.105); e2.position.set(p.x, p.y, p.z + 0.105) })
  }
  const cable = () => {
    const anchor = V(tpl.anchor ?? [214, 60])
    const lines = [0, 1].map(() => { const g = track(new THREE.BufferGeometry().setFromPoints([anchor.clone(), anchor.clone()])); props.add(new THREE.Line(g, mats.line)); return g })
    const knob = mesh3(sph, mats.steel); knob.scale.setScalar(0.045)
    const post = mesh3(box, mats.steel); post.scale.set(0.07, Math.max(anchor.y + 0.3, 0.4), 0.12); post.position.set(anchor.x + 0.1, (anchor.y + 0.3) / 2 - 0.15, 0)
    return () => { lines.forEach((g, i) => g.setFromPoints([anchor, handPts[i]])); knob.position.copy(anchor) }
  }
  const propUpdate: (() => void)[] = []
  const rails = key === 'dip'
  if (tpl.prop === 'barbell') propUpdate.push(handleBar(true))
  else if (tpl.prop === 'dumbbell') propUpdate.push(dumbbells())
  else if (tpl.prop === 'cable') propUpdate.push(cable())
  else if (tpl.prop === 'bar' && !rails) propUpdate.push(handleBar(false))

  const VV = (pt: Pt, z = 0) => V(pt, z)
  const addShape = (sh: NonNullable<Template['scene']>[number]) => {
    if (sh.t === 'rect') {
      const pad = sh.h <= 10
      const m = mesh3(box, pad ? mats.leather : mats.dark)
      m.scale.set(sh.w * S, sh.h * S * (pad ? 1.5 : 1), 0.5); m.position.set(((sh.x + sh.w / 2) - 120) * S, (168 - (sh.y + sh.h / 2)) * S - (pad ? sh.h * S * 0.25 : 0), 0)
      return
    }
    const a = VV(sh.a), b = VV(sh.b), w = (sh.w ?? 4) * S * 0.5
    tmp.subVectors(b, a); const len = tmp.length()
    if (tpl.prop === 'bar') {
      if (!rails) return
      for (const z of [-HALF_SH, HALF_SH]) { const m = mesh3(cyl, mats.steel); const aa = a.clone(); aa.z = z; const bb = b.clone(); bb.z = z; tmp2.subVectors(bb, aa); m.position.copy(aa).addScaledVector(tmp2, 0.5); m.quaternion.setFromUnitVectors(UP, tmp2.clone().normalize()); m.scale.set(0.02, tmp2.length(), 0.02) }
      return
    }
    const slab = (sh.w ?? 4) >= 7
    const m = mesh3(slab ? box : cyl, slab ? mats.leather : mats.steel)
    m.position.copy(a).addScaledVector(tmp, 0.5)
    if (slab) { m.scale.set(len, w * 1.6, 0.5); m.rotation.z = Math.atan2(tmp.y, tmp.x) } else { m.scale.set(w * 1.2, len, w * 1.2); m.quaternion.setFromUnitVectors(UP, tmp.clone().normalize()) }
  }
  tpl.scene?.forEach(addShape)

  // Sombra de contacto suave bajo el maniquí
  if (tpl.floor !== false) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128
    const g = cv.getContext('2d')!, grd = g.createRadialGradient(64, 64, 4, 64, 64, 62)
    grd.addColorStop(0, 'rgba(0,0,0,.65)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128)
    const tex = new THREE.CanvasTexture(cv); mats.shadow.map = tex; disposers.push(() => tex.dispose())
    const f = new THREE.Mesh(track(new THREE.PlaneGeometry(2.6, 1.7)), mats.shadow)
    f.rotation.x = -Math.PI / 2; f.position.set(cx, 0.002, 0); scene.add(f)
  }

  // ── Bucle ──
  let playing = true, dirty = true, last = performance.now(), raf = 0
  const frame = () => { mixer.update(0); readHands(); propUpdate.forEach((u) => u()); dirty = true }
  const setTime = (t: number) => { action.time = ((t % T) + T) % T; frame() }
  frame()

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
    if (playing) { mixer.update(dt); readHands(); propUpdate.forEach((u) => u()); dirty = true }
    controls.update()
    if (dirty) { renderer.render(scene, camera); dirty = false }
  }
  raf = requestAnimationFrame(loop)

  const phase = () => (((action.time % T) + T) % T) / T
  return {
    play() { playing = true; onChange() },
    pause() { playing = false; onChange() },
    restart() { setTime(0); playing = true; onChange() },
    showPose(p) { playing = false; setTime(p === 'A' ? 0 : T * 0.46); onChange() },
    setPhase(u) { playing = false; setTime(u * T); onChange() },
    phase,
    kind() {
      if (first === undefined) return null
      const u = phase()
      if (u < 0.42) return first ? 'concentric' : 'eccentric'
      if (u < 0.5) return 'hold'
      if (u < 0.92) return first ? 'eccentric' : 'concentric'
      return 'hold'
    },
    setView(v) { placeCamera(...VIEWS[v]) },
    resetView: home,
    isPlaying: () => playing,
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); mixer.stopAllAction(); skeleton.dispose()
      geos.forEach((g) => g.dispose()); Object.values(mats).forEach((m) => m.dispose()); disposers.forEach((d) => d())
      renderer.dispose(); renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
