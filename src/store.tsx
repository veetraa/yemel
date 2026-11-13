import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { dbAll, dbClearAll, dbDelete, dbGet, dbPut, requestPersistence, type StoreName } from './lib/db'
import { exerciseById, matchExercise } from './data/exercises'
import { adjustedSets, fitToTime, planAdjustment, readiness, type Adjustment } from './lib/coach'
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, currentWeight, dateKey, migrateLegacy } from './lib/profile'
import { recommendWeight, roundTo } from './lib/recommend'
import type { Activity, ActiveWorkout, BackupFile, BodyEntry, ExerciseLog, Profile, Routine, RoutineDay, Session, Settings, Wellness } from './types'
import { parseRepRange, uid } from './lib/utils'

export { DEFAULT_SETTINGS }

export interface StartOpts {
  /** Aplicar ajuste por recuperación/carga (por defecto, el ajuste de Perfil) */
  adapt?: boolean
  /** Acortar el día para que quepa en estos minutos */
  fitMinutes?: number
}

interface Store {
  ready: boolean
  settings: Settings
  profile: Profile
  routines: Routine[]
  sessions: Session[]
  body: BodyEntry[]
  wellness: Wellness[]
  activities: Activity[]
  active: ActiveWorkout | null
  toast: string | null
  /** Peso corporal actual (última medición o dato del perfil) */
  weight?: number
  adjustment: Adjustment
  showToast: (m: string) => void
  updateSettings: (p: Partial<Settings>) => void
  updateProfile: (p: Partial<Profile>) => void
  setCurrentWeight: (kg: number | undefined) => void
  saveBody: (e: BodyEntry) => void
  deleteBody: (id: string) => void
  saveWellness: (w: Wellness) => void
  deleteWellness: (id: string) => void
  addActivity: (a: Omit<Activity, 'id'>) => void
  deleteActivity: (id: string) => void
  updateSession: (id: string, p: Partial<Session>) => void
  saveRoutine: (r: Routine) => void
  deleteRoutine: (id: string) => void
  startWorkout: (routine: Routine | undefined, day: RoutineDay | undefined, opts?: StartOpts) => void
  updateActive: (fn: (a: ActiveWorkout) => ActiveWorkout) => void
  finishWorkout: () => Session | null
  cancelWorkout: () => void
  deleteSession: (id: string) => void
  exportBackup: () => BackupFile
  importBackup: (text: string, mode: 'merge' | 'replace') => { ok: boolean; message: string }
  resetAll: () => Promise<void>
}

const Ctx = createContext<Store>(null as unknown as Store)
export const useStore = () => useContext(Ctx)

export function buildLogs(
  day: RoutineDay | undefined, sessions: Session[], user: { bodyWeight?: number; experience?: Profile['experience']; holdProgress?: boolean }, adj?: Adjustment,
): ExerciseLog[] {
  if (!day) return []
  return day.exercises.map((e) => {
    const lib = exerciseById(e.exerciseId) ?? matchExercise(e.name)
    const rec = recommendWeight({ exerciseId: e.exerciseId ?? lib?.id, name: e.name, targetReps: e.reps, recommendedWeight: e.recommendedWeight }, sessions, user)
    const range = parseRepRange(e.reps)
    const reps = rec.reps ?? range?.min ?? 0
    let weight = rec.weight ?? 0
    if (adj?.active && adj.weightFactor < 1 && weight > 0 && rec.kind !== 'deload') weight = roundTo(weight * adj.weightFactor, 0.5)
    const sets = adj ? adjustedSets(e.sets, e.muscle, adj) : e.sets
    return {
      id: uid(), exerciseId: e.exerciseId ?? lib?.id, name: e.name, muscle: e.muscle, targetReps: e.reps, rest: e.rest, notes: e.notes, plannedWeight: e.recommendedWeight,
      sets: Array.from({ length: sets }, () => ({ weight, reps, done: false })),
    }
  })
}

const byTsDesc = <T extends { ts: number }>(a: T, b: T) => b.ts - a.ts

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [body, setBody] = useState<BodyEntry[]>([])
  const [wellness, setWellness] = useState<Wellness[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [active, setActive] = useState<ActiveWorkout | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number>(0)

  useEffect(() => {
    ;(async () => {
      const [s, p, r, ss, a, b, w, ac] = await Promise.all([
        dbGet<Record<string, unknown>>('kv', 'settings'), dbGet<Profile>('kv', 'profile'), dbAll<Routine>('routines'), dbAll<Session>('sessions'),
        dbGet<ActiveWorkout>('kv', 'active'), dbAll<BodyEntry>('body'), dbAll<Wellness>('wellness'), dbAll<Activity>('activities'),
      ])
      setSettings({ ...DEFAULT_SETTINGS, ...(s as Partial<Settings>) })
      if (p) setProfile({ ...DEFAULT_PROFILE, ...p })
      else {
        // Primera ejecución tras la actualización: se crea el perfil con los datos iniciales y lo que hubiera en ajustes
        const np = migrateLegacy(s)
        setProfile(np)
        void dbPut('kv', 'profile', np)
      }
      setRoutines(r.sort((x, y) => y.updatedAt - x.updatedAt))
      setSessions(ss.sort((x, y) => y.endedAt - x.endedAt))
      setBody(b.sort(byTsDesc))
      setWellness(w.sort((x, y) => (x.id < y.id ? 1 : -1)))
      setActivities(ac.sort(byTsDesc))
      if (a) setActive(a)
      setReady(true)
      void requestPersistence()
    })()
  }, [])

  const showToast = useCallback((m: string) => {
    setToast(m)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2400)
  }, [])

  const updateSettings = useCallback((p: Partial<Settings>) => {
    setSettings((cur) => { const n = { ...cur, ...p }; void dbPut('kv', 'settings', n); return n })
  }, [])

  const updateProfile = useCallback((p: Partial<Profile>) => {
    setProfile((cur) => { const n = { ...cur, ...p }; void dbPut('kv', 'profile', n); return n })
  }, [])

  // ── Historial corporal ──
  const syncWeight = useCallback((entries: BodyEntry[]) => {
    const w = entries.filter((e) => typeof e.weight === 'number').sort(byTsDesc)[0]?.weight
    if (w !== undefined) setProfile((cur) => { if (cur.weightKg === w) return cur; const n = { ...cur, weightKg: w }; void dbPut('kv', 'profile', n); return n })
  }, [])

  const saveBody = useCallback((e: BodyEntry) => {
    void dbPut('body', e.id, e)
    setBody((cur) => { const n = [e, ...cur.filter((x) => x.id !== e.id)].sort(byTsDesc); syncWeight(n); return n })
  }, [syncWeight])

  const deleteBody = useCallback((id: string) => {
    void dbDelete('body', id)
    setBody((cur) => { const n = cur.filter((x) => x.id !== id); syncWeight(n); return n })
  }, [syncWeight])

  const setCurrentWeight = useCallback((kg: number | undefined) => {
    if (kg === undefined) return updateProfile({ weightKg: undefined })
    // El peso actual también queda en el historial (una entrada por día)
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const existing = body.find((b) => b.ts >= start.getTime() && typeof b.weight === 'number') ?? body.find((b) => b.ts >= start.getTime())
    saveBody({ ...(existing ?? { id: uid(), ts: Date.now() }), weight: kg })
  }, [body, saveBody, updateProfile])

  const saveWellness = useCallback((w: Wellness) => {
    void dbPut('wellness', w.id, w)
    setWellness((cur) => [w, ...cur.filter((x) => x.id !== w.id)].sort((x, y) => (x.id < y.id ? 1 : -1)))
  }, [])
  const deleteWellness = useCallback((id: string) => {
    void dbDelete('wellness', id)
    setWellness((cur) => cur.filter((x) => x.id !== id))
  }, [])

  const addActivity = useCallback((a: Omit<Activity, 'id'>) => {
    const n = { ...a, id: uid() }
    void dbPut('activities', n.id, n)
    setActivities((cur) => [n, ...cur].sort(byTsDesc))
  }, [])
  const deleteActivity = useCallback((id: string) => {
    void dbDelete('activities', id)
    setActivities((cur) => cur.filter((x) => x.id !== id))
  }, [])

  // ── Rutinas ──
  const saveRoutine = useCallback((r: Routine) => {
    const n = { ...r, updatedAt: Date.now() }
    void dbPut('routines', n.id, n)
    setRoutines((cur) => [n, ...cur.filter((x) => x.id !== n.id)])
    setSettings((cur) => {
      if (cur.activeRoutineId) return cur
      const s = { ...cur, activeRoutineId: n.id }
      void dbPut('kv', 'settings', s)
      return s
    })
  }, [])

  const deleteRoutine = useCallback((id: string) => {
    void dbDelete('routines', id)
    setRoutines((cur) => cur.filter((x) => x.id !== id))
    setSettings((cur) => {
      if (cur.activeRoutineId !== id) return cur
      const s = { ...cur, activeRoutineId: undefined }
      void dbPut('kv', 'settings', s)
      return s
    })
  }, [])

  const weight = useMemo(() => currentWeight(profile, body), [profile, body])
  const adjustment = useMemo(() => planAdjustment({ profile, sessions, activities, wellness }), [profile, sessions, activities, wellness])

  const persistActive = (a: ActiveWorkout | null) => {
    if (a) void dbPut('kv', 'active', a)
    else void dbDelete('kv', 'active')
  }

  const startWorkout = useCallback((routine: Routine | undefined, day: RoutineDay | undefined, opts: StartOpts = {}) => {
    const adapt = opts.adapt ?? settings.adaptToRecovery
    const adj = adapt && adjustment.active ? adjustment : undefined
    let d = day
    const notes: string[] = []
    if (d && opts.fitMinutes) {
      const f = fitToTime(d, opts.fitMinutes)
      d = f.day
      if (f.removedSets || f.removedExercises) notes.push(`Acortado a ${opts.fitMinutes} min: ${f.removedSets} series y ${f.removedExercises} ejercicios menos.`)
    }
    if (adj) notes.push(...adj.notes)
    const r = readiness(wellness)
    const a: ActiveWorkout = {
      id: uid(), routineId: routine?.id, routineName: routine?.name ?? 'Entrenamiento libre',
      dayName: day?.name ?? 'Sesión libre', startedAt: Date.now(),
      exercises: buildLogs(d, sessions, { bodyWeight: weight, experience: profile.experience, holdProgress: r.level === 'low' || adjustment.setDelta < 0 }, adj),
      index: 0, adjustNotes: notes.length ? notes : undefined,
    }
    setActive(a)
    persistActive(a)
  }, [sessions, settings.adaptToRecovery, adjustment, wellness, weight, profile.experience])

  const updateActive = useCallback((fn: (a: ActiveWorkout) => ActiveWorkout) => {
    setActive((cur) => {
      if (!cur) return cur
      const n = fn(cur)
      persistActive(n)
      return n
    })
  }, [])

  const finishWorkout = useCallback((): Session | null => {
    if (!active) return null
    const exercises = active.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length)
    const s: Session = {
      id: active.id, routineId: active.routineId, routineName: active.routineName, dayName: active.dayName,
      startedAt: active.startedAt, endedAt: Date.now(), exercises,
    }
    setActive(null)
    persistActive(null)
    if (!exercises.length) return null
    void dbPut('sessions', s.id, s)
    setSessions((cur) => [s, ...cur])
    return s
  }, [active])

  const updateSession = useCallback((id: string, p: Partial<Session>) => {
    setSessions((cur) => cur.map((s) => {
      if (s.id !== id) return s
      const n = { ...s, ...p }
      void dbPut('sessions', n.id, n)
      return n
    }))
  }, [])

  const cancelWorkout = useCallback(() => { setActive(null); persistActive(null) }, [])

  const deleteSession = useCallback((id: string) => {
    void dbDelete('sessions', id)
    setSessions((cur) => cur.filter((s) => s.id !== id))
  }, [])

  const exportBackup = useCallback((): BackupFile => ({
    app: 'forma', version: 2, exportedAt: new Date().toISOString(), settings, profile, routines, sessions, body, wellness, activities,
  }), [settings, profile, routines, sessions, body, wellness, activities])

  const importBackup = useCallback((text: string, mode: 'merge' | 'replace') => {
    let data: BackupFile
    try { data = JSON.parse(text) } catch { return { ok: false, message: 'El archivo no es un JSON válido.' } }
    if (data?.app !== 'forma' || !Array.isArray(data.routines) || !Array.isArray(data.sessions))
      return { ok: false, message: 'No parece una copia de seguridad de Forma.' }
    const merge = <T extends { id: string }>(incoming: T[] | undefined, cur: T[]) => {
      const inc = incoming ?? []
      return mode === 'replace' ? inc : [...inc, ...cur.filter((c) => !inc.some((x) => x.id === c.id))]
    }
    const mergedR = merge(data.routines, routines)
    const mergedS = merge(data.sessions, sessions).sort((a, b) => b.endedAt - a.endedAt)
    const mergedB = merge(data.body, body).sort(byTsDesc)
    const mergedW = merge(data.wellness, wellness).sort((x, y) => (x.id < y.id ? 1 : -1))
    const mergedA = merge(data.activities, activities).sort(byTsDesc)
    // Merge: el perfil actual se conserva salvo que esté vacío; replace: se usa el de la copia (o el de antes del perfil único)
    const newProfile: Profile | undefined = mode === 'replace'
      ? data.profile ? { ...DEFAULT_PROFILE, ...data.profile } : migrateLegacy(data.settings as unknown as Record<string, unknown>)
      : !profile.name && data.profile ? { ...DEFAULT_PROFILE, ...data.profile } : undefined
    const newSettings = mode === 'replace' && data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : undefined
    void (async () => {
      if (mode === 'replace') await dbClearAll()
      const put = <T extends { id: string }>(store: StoreName, items: T[]) => Promise.all(items.map((x) => dbPut(store, x.id, x)))
      await Promise.all([put('routines', mergedR), put('sessions', mergedS), put('body', mergedB), put('wellness', mergedW), put('activities', mergedA)])
      if (newProfile) await dbPut('kv', 'profile', newProfile)
      if (newSettings) await dbPut('kv', 'settings', newSettings)
      else if (mode === 'replace') await dbPut('kv', 'settings', settings)
    })()
    setRoutines(mergedR); setSessions(mergedS); setBody(mergedB); setWellness(mergedW); setActivities(mergedA)
    if (newProfile) setProfile(newProfile)
    if (newSettings) setSettings(newSettings)
    if (mode === 'replace') setActive(null)
    return { ok: true, message: `Importadas ${data.routines.length} rutinas y ${data.sessions.length} sesiones${data.profile ? ' (con perfil)' : ''}.` }
  }, [routines, sessions, body, wellness, activities, profile.name, settings])

  const resetAll = useCallback(async () => {
    await dbClearAll()
    setRoutines([]); setSessions([]); setBody([]); setWellness([]); setActivities([]); setActive(null)
    setSettings(DEFAULT_SETTINGS); setProfile(DEFAULT_PROFILE)
  }, [])

  const value = useMemo<Store>(() => ({
    ready, settings, profile, routines, sessions, body, wellness, activities, active, toast, weight, adjustment,
    showToast, updateSettings, updateProfile, setCurrentWeight, saveBody, deleteBody, saveWellness, deleteWellness, addActivity, deleteActivity, updateSession,
    saveRoutine, deleteRoutine, startWorkout, updateActive, finishWorkout, cancelWorkout, deleteSession, exportBackup, importBackup, resetAll,
  }), [ready, settings, profile, routines, sessions, body, wellness, activities, active, toast, weight, adjustment, showToast, updateSettings, updateProfile, setCurrentWeight, saveBody, deleteBody, saveWellness, deleteWellness, addActivity, deleteActivity, updateSession, saveRoutine, deleteRoutine, startWorkout, updateActive, finishWorkout, cancelWorkout, deleteSession, exportBackup, importBackup, resetAll])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export { dateKey }
