import { useEffect, useMemo, useRef, useState } from 'react'
import { ThemeContext } from '../context/themeContext.js'
import { STORAGE_KEYS } from '../lib/constants.js'
import { readLocalStorage, writeLocalStorage } from '../lib/storage.js'

function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState(() =>
    readLocalStorage(STORAGE_KEYS.themeMode, 'system'),
  )
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)
  const hasMountedRef = useRef(false)
  const animationTimeoutRef = useRef(0)

  useEffect(() => {
    writeLocalStorage(STORAGE_KEYS.themeMode, themeMode)
  }, [themeMode])

  useEffect(() => {
    if (!window.matchMedia) {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    function handleChange(event) {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const resolvedTheme = themeMode === 'system' ? systemTheme : themeMode

  useEffect(() => {
    if (hasMountedRef.current) {
      document.documentElement.dataset.themeAnimating = 'true'
      window.clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = window.setTimeout(() => {
        delete document.documentElement.dataset.themeAnimating
      }, 280)
    }

    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.dataset.themeMode = themeMode
    document.body.dataset.theme = resolvedTheme
    hasMountedRef.current = true
  }, [resolvedTheme, themeMode])

  useEffect(
    () => () => {
      window.clearTimeout(animationTimeoutRef.current)
    },
    [],
  )

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode,
    }),
    [resolvedTheme, themeMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
