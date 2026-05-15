import { useEffect, useRef } from 'react'
import { AppStateContext } from '../context/appStateContext.js'
import {
  useAppDataContext,
  useAuthSessionContext,
  useFiltersContext,
  useSocialContext,
} from './appStateContexts.js'
import { DEFAULT_FILTERS } from './appStateShared.js'

export function AppStateProvider({ children }) {
  const auth = useAuthSessionContext()
  const filters = useFiltersContext()
  const appData = useAppDataContext()
  const social = useSocialContext()
  const {
    authChecked,
    clearSession,
    completeSession,
    isAuthLoading,
    logout: logoutSession,
    mergeSessionUser,
    requestLogin,
    requestRegister,
    sessionError,
    sessionUser,
  } = auth
  const {
    bootstrapApp,
    clearToast,
    dataSource,
    derivedState,
    getStateSnapshot,
    isLoading,
    loadError,
    replaceUserRecordInState,
    resetAppData,
    setIsLoading,
    setLoadError,
    setToast,
    state,
    toast,
    updateCategory,
    updateDishEntry,
    updateDishType,
    updateGroup,
    updateGroupMember,
    updateRestaurant,
    createCategory,
    createDishType,
    createGroup,
    createRestaurant,
    addGroupMember,
    joinGroupByInviteCode,
    leaveGroup,
    removeGroupMember,
    transferGroupOwnership,
    normalizeIncomingFilters,
  } = appData
  const {
    socialLoadState,
    resetSocialLoadState,
    loadFollows,
    followUser,
    unfollowUser,
    getMutualFollows,
    loadComments,
    addComment,
    updateComment,
    removeComment,
    addReaction,
    removeReaction,
    loadInspirationLists,
    createInspirationList,
    saveToList,
    markTried,
    removeFromList,
    loadRecommendations,
    sendRecommendation,
    markRecommendationSeen,
    loadAchievements,
    markAchievementNotified,
    checkAndUnlockAchievements,
  } = social
  const bootstrappingUserIdRef = useRef('')
  const bootstrappedUserIdRef = useRef('')

  function applyFilters(nextFilters) {
    filters.setActiveFilters(normalizeIncomingFilters(nextFilters))
  }

  function resetFilters() {
    filters.setActiveFilters(DEFAULT_FILTERS)
  }

  function removeFilter(filterKey, value) {
    filters.setActiveFilters((current) => {
      const nextFilters = normalizeIncomingFilters(current)

      if (Array.isArray(nextFilters[filterKey])) {
        return normalizeIncomingFilters({
          ...nextFilters,
          [filterKey]: nextFilters[filterKey].filter((item) => item !== value),
        })
      }

      if (typeof nextFilters[filterKey] === 'boolean') {
        return normalizeIncomingFilters({
          ...nextFilters,
          [filterKey]: false,
        })
      }

      return normalizeIncomingFilters({
        ...nextFilters,
        [filterKey]: filterKey === 'minimumScore' ? 0 : '',
      })
    })
  }

  useEffect(() => {
    if (!authChecked) {
      return
    }

    if (!sessionUser?.id) {
      bootstrappedUserIdRef.current = ''
      bootstrappingUserIdRef.current = ''
      resetSocialLoadState()
      resetAppData()
      setIsLoading(false)
      if (sessionError) {
        setLoadError(sessionError)
      }
      return
    }

    if (
      bootstrappedUserIdRef.current === sessionUser.id ||
      bootstrappingUserIdRef.current === sessionUser.id
    ) {
      return
    }

    let cancelled = false

    async function bootstrapSession() {
      bootstrappingUserIdRef.current = sessionUser.id
      setIsLoading(true)

      try {
        await bootstrapApp()

        if (cancelled) {
          return
        }

        bootstrappedUserIdRef.current = sessionUser.id
      } catch (error) {
        if (cancelled) {
          return
        }

        clearSession()
        resetSocialLoadState()
        resetAppData()
        setLoadError(
          error instanceof Error
            ? `Error al cargar ❌ — ${error.message}`
            : 'Error al cargar ❌ — No se pudo validar la sesión.',
        )
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
        bootstrappingUserIdRef.current = ''
      }
    }

    bootstrapSession()

    return () => {
      cancelled = true
    }
  }, [
    clearSession,
    authChecked,
    bootstrapApp,
    resetSocialLoadState,
    resetAppData,
    sessionError,
    sessionUser?.id,
    setIsLoading,
    setLoadError,
  ])

  async function login(identifier, password) {
    setIsLoading(true)
    setLoadError('')

    try {
      const authResponse = await requestLogin(identifier, password)
      completeSession(authResponse)
      bootstrappingUserIdRef.current = authResponse.user.id
      await bootstrapApp()
      bootstrappedUserIdRef.current = authResponse.user.id
      return authResponse
    } catch (error) {
      clearSession()
      resetSocialLoadState()
      resetAppData()
      throw error
    } finally {
      bootstrappingUserIdRef.current = ''
      setIsLoading(false)
    }
  }

  async function register(nombre, email, password) {
    setIsLoading(true)
    setLoadError('')

    try {
      const authResponse = await requestRegister(nombre, email, password)
      completeSession(authResponse)
      bootstrappingUserIdRef.current = authResponse.user.id
      await bootstrapApp()
      bootstrappedUserIdRef.current = authResponse.user.id
      return authResponse
    } catch (error) {
      clearSession()
      resetSocialLoadState()
      resetAppData()
      throw error
    } finally {
      bootstrappingUserIdRef.current = ''
      setIsLoading(false)
    }
  }

  async function logout() {
    setIsLoading(true)

    try {
      await logoutSession()
      bootstrappedUserIdRef.current = ''
      resetSocialLoadState()
      resetAppData()
    } finally {
      setIsLoading(false)
    }
  }

  async function changePassword(payload) {
    const response = await auth.changePassword(payload)

    if (!response?.user) {
      throw new Error('La API no confirmó el cambio de contraseña.')
    }

    replaceUserRecordInState(response.user)
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function updateUser(userId, payload) {
    const response = await appData.updateUser(userId, payload)

    if (response?.user) {
      mergeSessionUser(response.user)
    }

    return response
  }

  async function createDishEntry(payload) {
    const response = await appData.createDishEntry(payload)
    await checkAndUnlockAchievements(
      response.nextStateSnapshot ?? getStateSnapshot(),
    )
    return response
  }

  const value = {
    ...state,
    ...derivedState,
    authChecked,
    isLoading: isLoading || isAuthLoading,
    loadError: loadError || sessionError,
    dataSource,
    toast,
    clearToast,
    socialLoadState,
    defaultPinStyle: filters.defaultPinStyle,
    restaurantPinStyleOverrides: filters.restaurantPinStyleOverrides,
    setDefaultPinStyle: filters.setDefaultPinStyle,
    setRestaurantPinStyle: filters.setRestaurantPinStyle,
    clearRestaurantPinStyle: filters.clearRestaurantPinStyle,
    applyFilters,
    resetFilters,
    removeFilter,
    login,
    register,
    logout,
    changePassword,
    loadFollows,
    followUser,
    unfollowUser,
    getMutualFollows,
    loadComments,
    addComment,
    updateComment,
    removeComment,
    addReaction,
    removeReaction,
    loadInspirationLists,
    createInspirationList,
    saveToList,
    markTried,
    removeFromList,
    loadRecommendations,
    sendRecommendation,
    markRecommendationSeen,
    loadAchievements,
    markAchievementNotified,
    checkAndUnlockAchievements,
    updateUser,
    createRestaurant,
    updateRestaurant,
    createGroup,
    updateGroup,
    joinGroupByInviteCode,
    addGroupMember,
    updateGroupMember,
    removeGroupMember,
    leaveGroup,
    transferGroupOwnership,
    createCategory,
    updateCategory,
    createDishType,
    updateDishType,
    createDishEntry,
    updateDishEntry,
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
