import { useEffect, useState } from 'react'
import {
  authLogin as authLoginRequest,
  authLogout as authLogoutRequest,
  authMe as authMeRequest,
  authRegister as authRegisterRequest,
  updatePassword as updatePasswordRequest,
} from '../lib/api.js'
import { AuthSessionContext } from './appStateContexts.js'
import { readStoredAuthToken, storeAuthToken } from './appStateShared.js'

export function AuthSessionProvider({ children }) {
  const [authChecked, setAuthChecked] = useState(false)
  const [sessionUser, setSessionUser] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function initializeSession() {
      const storedToken = readStoredAuthToken()

      if (!storedToken) {
        setSessionUser(null)
        setSessionError('')
        setAuthChecked(true)
        setIsAuthLoading(false)
        return
      }

      try {
        setIsAuthLoading(true)
        const response = await authMeRequest(storedToken)

        if (cancelled) {
          return
        }

        setSessionUser(response.user ?? null)
        setSessionError('')
        setAuthChecked(true)
      } catch (error) {
        if (cancelled) {
          return
        }

        storeAuthToken('')
        setSessionUser(null)
        setSessionError(
          error instanceof Error
            ? `Error al cargar ❌ — ${error.message}`
            : 'Error al cargar ❌ — No se pudo validar la sesión.',
        )
        setAuthChecked(true)
      } finally {
        if (!cancelled) {
          setIsAuthLoading(false)
        }
      }
    }

    initializeSession()

    return () => {
      cancelled = true
    }
  }, [])

  async function requestLogin(identifier, password) {
    setIsAuthLoading(true)

    try {
      return await authLoginRequest({
        identifier,
        password,
      })
    } finally {
      setIsAuthLoading(false)
    }
  }

  async function requestRegister(nombre, email, password) {
    setIsAuthLoading(true)

    try {
      return await authRegisterRequest({
        nombre,
        email,
        password,
      })
    } finally {
      setIsAuthLoading(false)
    }
  }

  function completeSession(authResponse) {
    if (!authResponse?.token || !authResponse?.user) {
      throw new Error('La autenticación no devolvió una sesión válida.')
    }

    storeAuthToken(authResponse.token)
    setSessionUser(authResponse.user)
    setSessionError('')
    setAuthChecked(true)
    return authResponse
  }

  function clearSession() {
    storeAuthToken('')
    setSessionUser(null)
    setSessionError('')
    setAuthChecked(true)
  }

  async function logout() {
    try {
      await authLogoutRequest()
    } catch {
      // Logout remains tolerant to backend/network failures.
    }

    clearSession()
  }

  async function changePassword(payload) {
    const response = await updatePasswordRequest(payload)

    if (!response?.user) {
      throw new Error('La API no confirmó el cambio de contraseña.')
    }

    setSessionUser((current) =>
      current?.id === response.user.id ? { ...current, ...response.user } : current,
    )
    return response
  }

  function mergeSessionUser(user) {
    if (!user?.id) {
      return
    }

    setSessionUser((current) =>
      current?.id === user.id ? { ...current, ...user } : current,
    )
  }

  const value = {
    authChecked,
    sessionUser,
    isAuthLoading,
    sessionError,
    requestLogin,
    requestRegister,
    completeSession,
    clearSession,
    logout,
    changePassword,
    mergeSessionUser,
  }

  return (
    <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
  )
}
