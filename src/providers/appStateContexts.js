import { createContext, useContext } from 'react'

export const AuthSessionContext = createContext(null)
export const FiltersContext = createContext(null)
export const AppDataContext = createContext(null)
export const SocialContext = createContext(null)

function createContextHook(name, Context) {
  return function useNamedContext() {
    const context = useContext(Context)

    if (!context) {
      throw new Error(`${name} debe usarse dentro de AppProviders`)
    }

    return context
  }
}

export const useAuthSessionContext = createContextHook(
  'useAuthSessionContext',
  AuthSessionContext,
)
export const useFiltersContext = createContextHook(
  'useFiltersContext',
  FiltersContext,
)
export const useAppDataContext = createContextHook(
  'useAppDataContext',
  AppDataContext,
)
export const useSocialContext = createContextHook(
  'useSocialContext',
  SocialContext,
)
