import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { dbAll, dbClearAll, dbDelete, dbGet, dbPut, requestPersistence } from './lib/db'
import { exerciseById, matchExercise } from './data/exercises'
import { recommendWeight } from './lib/recommend'
import type { ActiveWorkout, BackupFile, ExerciseLog, Routine, RoutineDay, Session, Settings } from './types'
import { parseRepRange, uid } from './lib/utils'

export const DEFAULT_SETTINGS: Settings = {
  name: '', unit: 'kg', weeklyGoal: 4, experience: 'intermediate', sound: true, vibrate: true,
}

interface Store {
  ready: boolean
  settings: Settings
  routines: Routine[]
  sessions: Session[]
  active: ActiveWorkout | null
  toast: string | null
  showToast: (m: string) => void
  updateSettings: (p: Partial<Settings>) => void
  saveRoutine: (r: Routine) => void
  deleteRoutine: (id: string) => void
  startWorkout: (routine: Routine | undefined, day: RoutineDay | undefined) => void
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

export function buildLogs(day: RoutineDay | undefined, sessions: Session[], settings: Settings): ExerciseLog[] {
  if (!day) return []
  return day.exercises.map((e) => {
    const lib = exerciseById(e.exerciseId) ?? matchExercise(e.name)
    const rec = recommendWeight({ exerciseId: e.exerciseId ?? lib?.id, name: e.name, targetReps: e.reps, recommendedWeight: e.recommendedWeight }, sessions, settings)
    const range = parseRepRange(e.reps)
    const reps = rec.reps ?? range?.min ?? 0
    return {
      id: uid(), exerciseId: e.exerciseId ?? lib?.id, name: e.name, muscle: e.muscle, targetReps: e.reps, rest: e.rest, notes: e.notes, plannedWeight: e.recommendedWeight,
      sets: Array.from({ length: e.sets }, () => ({ weight: rec.weight ?? 0, reps, done: false })),
    }
  })
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [active, setActive] = useState<ActiveWorkout | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number>(0)

  useEffect(() => {
    ;(async () => {
      const [s, r, ss, a] = await Promise.all([
        dbGet<Settings>('kv', 'settings'), dbAll<Routine>('routines'), dbAll<Session>('sessions'), dbGet<ActiveWorkout>('kv', 'active'),
      ])
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...s })
      setRoutines(r.sort((x, y) => y.updatedAt - x.updatedAt))
      setSessions(ss.sort((x, y) => y.endedAt - x.endedAt))
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
    setSettings((cur) => {
      const n = { ...cur, ...p }
      void dbPut('kv', 'settings', n)
      return n
    })
  }, [])

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

  const persistActive = (a: ActiveWorkout | null) => {
    if (a) void dbPut('kv', 'active', a)
    else void dbDelete('kv', 'active')
  }

  const startWorkout = useCallback((routine: Routine | undefined, day: RoutineDay | undefined) => {
    const a: ActiveWorkout = {
      id: uid(), routineId: routine?.id, routineName: routine?.name ?? 'Entrenamiento libre',
      dayName: day?.name ?? 'Sesión libre', startedAt: Date.now(),
      exercises: buildLogs(day, sessions, settings), index: 0,
    }
    setActive(a)
    persistActive(a)
  }, [sessions, settings])

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
    const exercises = active.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) }))
      .filter((e) => e.sets.length)
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

  const cancelWorkout = useCallback(() => {
    setActive(null)
    persistActive(null)
  }, [])

  const deleteSession = useCallback((id: string) => {
    void dbDelete('sessions', id)
    setSessions((cur) => cur.filter((s) => s.id !== id))
  }, [])

  const exportBackup = useCallback((): BackupFile => ({
    app: 'forma', version: 1, exportedAt: new Date().toISOString(), settings, routines, sessions,
  }), [settings, routines, sessions])

  const importBackup = useCallback((text: string, mode: 'merge' | 'replace') => {
    let data: BackupFile
    try {
      data = JSON.parse(text)
    } catch {
      return { ok: false, message: 'El archivo no es un JSON válido.' }
    }
    if (data?.app !== 'forma' || !Array.isArray(data.routines) || !Array.isArray(data.sessions))
      return { ok: false, message: 'No parece una copia de seguridad de Forma.' }
    const rs = mode === 'replace' ? [] : routines
    const ss = mode === 'replace' ? [] : sessions
    const mergedR = [...data.routines, ...rs.filter((r) => !data.routines.some((x) => x.id === r.id))]
    const mergedS = [...data.sessions, ...ss.filter((s) => !data.sessions.some((x) => x.id === s.id))].sort((a, b) => b.endedAt - a.endedAt)
    void (async () => {
      if (mode === 'replace') {
        await dbClearAll()
      }
      await Promise.all([...mergedR.map((r) => dbPut('routines', r.id, r)), ...mergedS.map((s) => dbPut('sessions', s.id, s))])
      if (mode === 'replace' && data.settings) {
        await dbPut('kv', 'settings', { ...DEFAULT_SETTINGS, ...data.settings })
      }
    })()
    setRoutines(mergedR)
    setSessions(mergedS)
    if (mode === 'replace') {
      setActive(null)
      if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
    }
    return { ok: true, message: `Importadas ${data.routines.length} rutinas y ${data.sessions.length} sesiones.` }
  }, [routines, sessions])

  const resetAll = useCallback(async () => {
    await dbClearAll()
    setRoutines([]); setSessions([]); setActive(null); setSettings(DEFAULT_SETTINGS)
  }, [])

  const value = useMemo<Store>(() => ({
    ready, settings, routines, sessions, active, toast, showToast, updateSettings, saveRoutine, deleteRoutine,
    startWorkout, updateActive, finishWorkout, cancelWorkout, deleteSession, exportBackup, importBackup, resetAll,
  }), [ready, settings, routines, sessions, active, toast, showToast, updateSettings, saveRoutine, deleteRoutine, startWorkout, updateActive, finishWorkout, cancelWorkout, deleteSession, exportBackup, importBackup, resetAll])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
