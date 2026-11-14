/**
 * Esqueleto y animación del maniquí. Las poses de cada ejercicio (inicio → final, de `data/poses.ts`) se
 * resuelven con cinemática inversa de dos huesos (brazos y piernas con longitud fija: manos en la barra,
 * pies en el suelo) y se hornean en un AnimationClip que reproduce un AnimationMixer.
 */
import * as THREE from 'three'
import { BONES, PARENT, REST, TAIL_OF, type BoneName } from './body3d'

const v3 = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2])
const UP = new THREE.Vector3(0, 1, 0), FRONT = new THREE.Vector3(1, 0, 0)
const fromTo = (a: THREE.Vector3, b: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize())
/** Esqueleto en reposo: cabeza y cola de cada hueso. Por defecto el del cuerpo generado; el modelo anatómico (GLB) trae el suyo. */
export interface RigDef { rest: Record<BoneName, readonly number[]>; tail: Record<BoneName, readonly number[]>; /** parte del giro del tronco que asumen pelvis y lumbares (por defecto 0,25 y 0,7) */ torso?: [number, number] }
let R: RigDef = { rest: REST, tail: TAIL_OF }
const dirOf = (b: BoneName) => v3(R.tail[b]).sub(v3(R.rest[b])).normalize()
const lenOf = (b: BoneName) => v3(R.tail[b]).distanceTo(v3(R.rest[b]))
const I = new THREE.Quaternion()

export interface Targets {
  hip: THREE.Vector3; shoulder: THREE.Vector3; head: THREE.Vector3
  /** por lado (0 = izquierdo +Z, 1 = derecho −Z) */
  hand: THREE.Vector3[]; elbow: THREE.Vector3[]; foot: THREE.Vector3[]; knee: THREE.Vector3[]; toe: THREE.Vector3[]
  /** orientación deseada del pecho */
  facing: 'front' | 'up' | 'down'
}

export function createSkeleton(): { bones: Record<BoneName, THREE.Bone>; skeleton: THREE.Skeleton; root: THREE.Bone } {
  const bones = {} as Record<BoneName, THREE.Bone>
  for (const n of BONES) { const b = new THREE.Bone(); b.name = n; bones[n] = b }
  for (const n of BONES) {
    const p = PARENT[n]
    if (p) { bones[n].position.copy(v3(REST[n]).sub(v3(REST[p]))); bones[p].add(bones[n]) } else bones[n].position.copy(v3(REST[n]))
  }
  bones.hips.updateMatrixWorld(true)
  return { bones, skeleton: new THREE.Skeleton(BONES.map((n) => bones[n])), root: bones.hips }
}

/** IK analítica de dos huesos: devuelve codo/rodilla y extremo alcanzado */
function ik(s: THREE.Vector3, t: THREE.Vector3, pole: THREE.Vector3, l1: number, l2: number, fallback: THREE.Vector3) {
  const to = t.clone().sub(s)
  const d = THREE.MathUtils.clamp(to.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3)
  const u = to.lengthSq() > 1e-9 ? to.normalize() : UP.clone()
  const p = pole.clone().sub(s); p.addScaledVector(u, -p.dot(u))
  const n = p.lengthSq() > 1e-6 ? p.normalize() : fallback.clone().addScaledVector(u, -fallback.dot(u)).normalize()
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(l1 * l1 - a * a, 0))
  const mid = s.clone().addScaledVector(u, a).addScaledVector(n, h)
  return { mid, end: s.clone().addScaledVector(u, d) }
}

export interface Pose { root: THREE.Vector3; q: Record<BoneName, THREE.Quaternion> }

const ARM_POLE = new THREE.Vector3(-0.35, -1, 0.2), LEG_POLE = new THREE.Vector3(1, 0.1, 0)

export function solve(t: Targets, def?: RigDef): Pose {
  R = def ?? { rest: REST, tail: TAIL_OF }
  const L = { th: lenOf('thL'), sh: lenOf('shL'), ua: lenOf('uaL'), fa: lenOf('faL') }
  const q = {} as Record<BoneName, THREE.Quaternion>
  const W = {} as Record<BoneName, THREE.Quaternion>
  const local = (n: BoneName, w: THREE.Quaternion) => { W[n] = w; const p = PARENT[n]; q[n] = p ? W[p].clone().invert().multiply(w) : w.clone() }

  // Tronco: eje cadera → hombro; el pecho gira hacia delante, arriba o abajo según el ejercicio
  const axis = t.shoulder.clone().sub(t.hip).normalize()
  let Qt = fromTo(UP, axis)
  const pref = t.facing === 'up' ? UP : t.facing === 'down' ? UP.clone().negate() : FRONT
  const f0 = FRONT.clone().applyQuaternion(Qt)
  const proj = (v: THREE.Vector3) => v.clone().addScaledVector(axis, -v.dot(axis))
  const a = proj(f0), b = proj(pref)
  if (a.lengthSq() > 1e-4 && b.lengthSq() > 1e-4) {
    const ang = Math.atan2(axis.dot(a.clone().cross(b)), a.dot(b))
    Qt = new THREE.Quaternion().setFromAxisAngle(axis, ang).multiply(Qt)
  }
  const tf = def?.torso ?? [0.25, 0.7]
  local('hips', I.clone().slerp(Qt, tf[0]))
  local('spine', I.clone().slerp(Qt, tf[1]))
  local('chest', Qt.clone())
  const fk = (n: BoneName, parent: BoneName, base: THREE.Vector3) => base.clone().add(v3(R.rest[n]).sub(v3(R.rest[parent])).applyQuaternion(W[parent]))
  const pHips = t.hip.clone() // el hueso hips se coloca en la cadera del dato
  const pSpine = fk('spine', 'hips', pHips), pChest = fk('chest', 'spine', pSpine), pNeck = fk('neck', 'chest', pChest)
  const nd = t.head.clone().sub(pNeck).normalize()
  const Wn = fromTo(UP.clone().applyQuaternion(Qt), nd).multiply(Qt)
  local('neck', Wn); local('head', Wn.clone())

  // Brazos
  for (const s of [0, 1] as const) {
    const side = s === 0 ? 'L' : 'R'
    const ua = `ua${side}` as BoneName, fa = `fa${side}` as BoneName, hand = `hand${side}` as BoneName
    const sh = fk(ua, 'chest', pChest)
    const r = ik(sh, t.hand[s], t.elbow[s], L.ua, L.fa, ARM_POLE)
    local(ua, fromTo(dirOf(ua), r.mid.clone().sub(sh)))
    local(fa, fromTo(dirOf(fa), r.end.clone().sub(r.mid)))
    local(hand, W[fa].clone())
  }
  // Piernas
  for (const s of [0, 1] as const) {
    const side = s === 0 ? 'L' : 'R'
    const th = `th${side}` as BoneName, sh = `sh${side}` as BoneName, ft = `ft${side}` as BoneName
    const hj = fk(th, 'hips', pHips)
    const r = ik(hj, t.foot[s], t.knee[s], L.th, L.sh, LEG_POLE)
    local(th, fromTo(dirOf(th), r.mid.clone().sub(hj)))
    local(sh, fromTo(dirOf(sh), r.end.clone().sub(r.mid)))
    const toeDir = t.toe[s].clone().sub(t.foot[s])
    local(ft, toeDir.lengthSq() > 1e-6 ? fromTo(dirOf(ft), toeDir) : W[sh].clone())
  }
  return { root: pHips, q }
}

/** Hornea las poses de un ejercicio en un AnimationClip (posiciones de la raíz y rotaciones locales de cada hueso) */
export function bakeClip(poseAt: (u: number) => Pose, seconds: number, frames = 72): THREE.AnimationClip {
  const times: number[] = [], root: number[] = [], rot: Record<string, number[]> = {}
  for (const n of BONES) rot[n] = []
  for (let i = 0; i <= frames; i++) {
    const u = i / frames
    times.push(u * seconds)
    const p = poseAt(u)
    root.push(p.root.x, p.root.y, p.root.z)
    for (const n of BONES) { const qq = p.q[n]; rot[n].push(qq.x, qq.y, qq.z, qq.w) }
  }
  const tracks: THREE.KeyframeTrack[] = [new THREE.VectorKeyframeTrack('hips.position', times, root)]
  for (const n of BONES) tracks.push(new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, times, rot[n]))
  return new THREE.AnimationClip('exercise', seconds, tracks)
}
