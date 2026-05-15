import { useContext } from 'react'
import { AppStateContext } from '../context/appStateContext.js'

export function useAppState() {
  const context = useContext(AppStateContext)

  if (!context) {
    throw new Error('useAppState debe usarse dentro de AppProviders')
  }

  return context
}
