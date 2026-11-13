/**
 * Proveedor propio de FILOSOFÍA: diario y favoritos (privados, en IndexedDB).
 * Se engancha a las copias de seguridad sin que el store raíz conozca su modelo.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { registerBackup } from '../../shared/lib/backupRegistry'
import { dbAll, dbClear, dbDelete, dbGet, dbPut } from '../../shared/lib/db'
import { EMPTY_FAVORITES, toggleFavorite } from './services/philosophyService'
import type { FavKind, JournalEntry, PhiloFavorites } from './types'

interface PhiloStore {
  journal: JournalEntry[]
  favorites: PhiloFavorites
  saveEntry: (e: JournalEntry) => void
  deleteEntry: (id: string) => void
  toggleFav: (kind: FavKind, id: string) => void
}
const Ctx = createContext<PhiloStore>(null as unknown as PhiloStore)
export const usePhilosophy = () => useContext(Ctx)

const byTsDesc = (a: JournalEntry, b: JournalEntry) => b.ts - a.ts
const FAV_KEY = 'favorites'

export function PhilosophyProvider({ children }: { children: ReactNode }) {
  const [journal, setJournal] = useState<JournalEntry[]>([])
  const [favorites, setFavorites] = useState<PhiloFavorites>(EMPTY_FAVORITES)

  useEffect(() => {
    void dbAll<JournalEntry>('journal').then((j) => setJournal(j.sort(byTsDesc)))
    void dbGet<PhiloFavorites>('philo', FAV_KEY).then((f) => f && setFavorites({ ...EMPTY_FAVORITES, ...f }))
  }, [])

  const saveEntry = useCallback((e: JournalEntry) => {
    void dbPut('journal', e.id, e)
    setJournal((cur) => [e, ...cur.filter((x) => x.id !== e.id)].sort(byTsDesc))
  }, [])
  const deleteEntry = useCallback((id: string) => { void dbDelete('journal', id); setJournal((cur) => cur.filter((x) => x.id !== id)) }, [])
  const toggleFav = useCallback((kind: FavKind, id: string) => {
    setFavorites((cur) => { const n = toggleFavorite(cur, kind, id); void dbPut('philo', FAV_KEY, n); return n })
  }, [])

  // Copia de seguridad: el diario y los favoritos viajan con ella
  useEffect(() => registerBackup({
    key: 'journal',
    export: () => journal,
    import: (data, mode) => {
      const inc = (Array.isArray(data) ? data : []) as JournalEntry[]
      setJournal((cur) => {
        const next = (mode === 'replace' ? inc : [...inc, ...cur.filter((c) => !inc.some((x) => x.id === c.id))]).sort(byTsDesc)
        void (async () => { await dbClear('journal'); for (const e of next) await dbPut('journal', e.id, e) })()
        return next
      })
    },
    reset: async () => { await dbClear('journal'); setJournal([]) },
  }), [journal])
  useEffect(() => registerBackup({
    key: 'philoFavorites',
    export: () => favorites,
    import: (data, mode) => {
      const inc = { ...EMPTY_FAVORITES, ...((data ?? {}) as Partial<PhiloFavorites>) }
      setFavorites((cur) => {
        const u = (a: string[], b: string[]) => [...new Set([...a, ...b])]
        const next = mode === 'replace' ? inc : { quotes: u(inc.quotes, cur.quotes), philosophers: u(inc.philosophers, cur.philosophers), reflections: u(inc.reflections, cur.reflections) }
        void dbPut('philo', FAV_KEY, next)
        return next
      })
    },
    reset: async () => { await dbClear('philo'); setFavorites(EMPTY_FAVORITES) },
  }), [favorites])

  const value = useMemo(() => ({ journal, favorites, saveEntry, deleteEntry, toggleFav }), [journal, favorites, saveEntry, deleteEntry, toggleFav])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
