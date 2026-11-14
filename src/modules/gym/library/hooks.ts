import { useEffect, useState } from 'react'
import { libraryIndex, loadLibraryExercise, loadLibraryIndex, type LibExercise, type LibIndexItem } from './library'

/** Índice de la biblioteca (carga diferida; null mientras se descarga la primera vez). */
export function useLibraryIndex(): LibIndexItem[] | null {
  const [list, setList] = useState<LibIndexItem[] | null>(libraryIndex())
  useEffect(() => { if (!list) { let off = false; void loadLibraryIndex().then((l) => { if (!off && l.length) setList(l) }); return () => { off = true } } }, [list])
  return list
}

/** Ficha completa de un ejercicio de la biblioteca (undefined = cargando, null = no existe). */
export function useLibraryExercise(id?: string): LibExercise | null | undefined {
  const [d, setD] = useState<LibExercise | null | undefined>(undefined)
  useEffect(() => {
    setD(undefined)
    if (!id) { setD(null); return }
    let off = false
    void loadLibraryExercise(id).then((x) => { if (!off) setD(x) })
    return () => { off = true }
  }, [id])
  return d
}
