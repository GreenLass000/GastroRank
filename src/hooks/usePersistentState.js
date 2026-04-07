import { useEffect, useState } from 'react'
import { readLocalStorage, writeLocalStorage } from '../lib/storage.js'

export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => readLocalStorage(key, initialValue))

  useEffect(() => {
    writeLocalStorage(key, value)
  }, [key, value])

  return [value, setValue]
}
