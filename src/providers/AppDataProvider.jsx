import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createCategory as createCategoryRequest,
  createDishEntry as createDishEntryRequest,
  createDishType as createDishTypeRequest,
  createGroup as createGroupRequest,
  createGroupMember as createGroupMemberRequest,
  createRestaurant as createRestaurantRequest,
  fetchBootstrapData,
  joinGroupByInviteCode as joinGroupByInviteCodeRequest,
  transferGroupOwnership as transferGroupOwnershipRequest,
  updateCategory as updateCategoryRequest,
  updateDishEntry as updateDishEntryRequest,
  updateDishType as updateDishTypeRequest,
  updateGroup as updateGroupRequest,
  updateGroupMember as updateGroupMemberRequest,
  updateRestaurant as updateRestaurantRequest,
  updateUser as updateUserRequest,
  deleteGroupMember as deleteGroupMemberRequest,
} from '../lib/api.js'
import { normalizeFilters } from '../lib/filters.js'
import { AppDataContext } from './appStateContexts.js'
import { useAuthSessionContext, useFiltersContext } from './appStateContexts.js'
import {
  buildDerivedState,
  createEmptyAppData,
  enrichRestaurants,
  hydrateStateFromData,
  replaceRecordById,
} from './appStateShared.js'

function updateRestaurantsFromEntries(restaurants, dishEntries) {
  return enrichRestaurants(restaurants, dishEntries)
}

export function AppDataProvider({ children }) {
  const { sessionUser } = useAuthSessionContext()
  const { activeFilters, filterOrigin } = useFiltersContext()
  const [state, setState] = useState(createEmptyAppData)
  const stateRef = useRef(state)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [dataSource, setDataSource] = useState('seed')
  const [toast, setToast] = useState({ message: '', tone: 'success' })

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const derivedState = useMemo(
    () => buildDerivedState(state, activeFilters, filterOrigin, sessionUser),
    [activeFilters, filterOrigin, sessionUser, state],
  )

  function clearToast() {
    setToast({ message: '', tone: 'success' })
  }

  function updateState(updater) {
    setState((current) => {
      const nextState =
        typeof updater === 'function' ? updater(current) : updater
      stateRef.current = nextState
      return nextState
    })
  }

  function resetAppData() {
    const nextState = createEmptyAppData()
    stateRef.current = nextState
    setState(nextState)
    setLoadError('')
    setDataSource('api')
    setToast({ message: '', tone: 'success' })
  }

  function getStateSnapshot() {
    return stateRef.current
  }

  function replaceUserRecordInState(user) {
    if (!user?.id) {
      return
    }

    updateState((current) => ({
      ...current,
      users: current.users.some((item) => item.id === user.id)
        ? replaceRecordById(current.users, user)
        : [...current.users, user],
    }))
  }

  async function bootstrapApp() {
    const remoteData = await fetchBootstrapData()
    const hydratedState = hydrateStateFromData(remoteData)
    stateRef.current = hydratedState
    setState(hydratedState)
    setDataSource('api')
    setLoadError('')
    return remoteData
  }

  async function createRestaurant(payload) {
    const response = await createRestaurantRequest(payload)

    if (!response?.restaurant) {
      throw new Error('La API no devolvió el restaurante creado.')
    }

    const createdRestaurant = {
      ...response.restaurant,
      restaurant_score: 0,
      total_entries: 0,
    }

    updateState((current) => ({
      ...current,
      restaurants: [...current.restaurants, createdRestaurant],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return response
  }

  async function updateRestaurant(restaurantId, payload) {
    const response = await updateRestaurantRequest(restaurantId, payload)

    if (!response?.restaurant) {
      throw new Error('La API no devolvió el restaurante actualizado.')
    }

    updateState((current) => ({
      ...current,
      restaurants: updateRestaurantsFromEntries(
        replaceRecordById(current.restaurants, {
          ...response.restaurant,
          restaurant_score:
            current.restaurants.find((item) => item.id === restaurantId)
              ?.restaurant_score ?? 0,
          total_entries:
            current.restaurants.find((item) => item.id === restaurantId)
              ?.total_entries ?? 0,
        }),
        current.dishEntries,
      ),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return response
  }

  async function createGroup(payload) {
    const response = await createGroupRequest(payload)

    if (!response?.group || !response?.groupMember) {
      throw new Error('La API no devolvió el grupo creado correctamente.')
    }

    updateState((current) => ({
      ...current,
      groups: [...current.groups, response.group],
      groupMembers: [...current.groupMembers, response.groupMember],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return response
  }

  async function updateGroup(groupId, payload) {
    const response = await updateGroupRequest(groupId, payload)

    if (!response?.group) {
      throw new Error('La API no devolvió el grupo actualizado.')
    }

    updateState((current) => ({
      ...current,
      groups: replaceRecordById(current.groups, response.group),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return response
  }

  async function joinGroupByInviteCode(inviteCode) {
    const response = await joinGroupByInviteCodeRequest({
      invite_code: inviteCode,
    })

    if (!response?.group || !response?.groupMember) {
      throw new Error('La API no devolvió el alta al grupo correctamente.')
    }

    updateState((current) => ({
      ...current,
      groups: current.groups.some((group) => group.id === response.group.id)
        ? current.groups
        : [...current.groups, response.group],
      groupMembers: [
        ...current.groupMembers.filter(
          (member) => member.id !== response.groupMember.id,
        ),
        response.groupMember,
      ],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return response
  }

  async function addGroupMember(groupId, payload) {
    const response = await createGroupMemberRequest(groupId, payload)

    if (!response?.group || !response?.groupMember) {
      throw new Error('La API no devolvió el miembro de grupo.')
    }

    updateState((current) => ({
      ...current,
      groups: current.groups.some((group) => group.id === response.group.id)
        ? current.groups
        : [...current.groups, response.group],
      groupMembers: [
        ...current.groupMembers.filter(
          (member) => member.id !== response.groupMember.id,
        ),
        response.groupMember,
      ],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return response
  }

  async function updateGroupMember(groupId, memberId, payload) {
    const response = await updateGroupMemberRequest(groupId, memberId, payload)

    if (!response?.groupMember) {
      throw new Error('La API no devolvió la actualización del miembro.')
    }

    updateState((current) => ({
      ...current,
      groupMembers: replaceRecordById(current.groupMembers, response.groupMember),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return response
  }

  async function removeGroupMember(groupId, memberId) {
    await deleteGroupMemberRequest(groupId, memberId)

    updateState((current) => ({
      ...current,
      groupMembers: current.groupMembers.filter((member) => member.id !== memberId),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
  }

  async function leaveGroup(groupId) {
    const membership = getStateSnapshot().groupMembers.find(
      (member) =>
        member.group_id === groupId &&
        member.user_id === derivedState.currentUser?.id &&
        ['active', 'pending'].includes(member.status),
    )

    if (!membership) {
      throw new Error('No perteneces a ese grupo.')
    }

    await removeGroupMember(groupId, membership.id)
  }

  async function transferGroupOwnership(groupId, userId) {
    const response = await transferGroupOwnershipRequest(groupId, { user_id: userId })

    if (!Array.isArray(response?.members) || response.members.length === 0) {
      throw new Error('La API no devolvió la transferencia del grupo.')
    }

    updateState((current) => ({
      ...current,
      groupMembers: current.groupMembers.map((member) => {
        const updatedMember = response.members.find((item) => item.id === member.id)
        return updatedMember ?? member
      }),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return response
  }

  async function createCategory(payload) {
    const response = await createCategoryRequest(payload)

    if (!response?.category) {
      throw new Error('La API no devolvió la categoría creada.')
    }

    updateState((current) => ({
      ...current,
      categories: [...current.categories, response.category],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function updateCategory(categoryId, payload) {
    const response = await updateCategoryRequest(categoryId, payload)

    if (!response?.category) {
      throw new Error('La API no devolvió la categoría actualizada.')
    }

    updateState((current) => ({
      ...current,
      categories: replaceRecordById(current.categories, response.category),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function createDishType(payload) {
    const response = await createDishTypeRequest(payload)

    if (!response?.dishType) {
      throw new Error('La API no devolvió el tipo de plato creado.')
    }

    updateState((current) => ({
      ...current,
      dishTypes: [...current.dishTypes, response.dishType],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function updateDishType(dishTypeId, payload) {
    const response = await updateDishTypeRequest(dishTypeId, payload)

    if (!response?.dishType) {
      throw new Error('La API no devolvió el tipo de plato actualizado.')
    }

    updateState((current) => ({
      ...current,
      dishTypes: replaceRecordById(current.dishTypes, response.dishType),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function createDishEntry(payload) {
    const response = await createDishEntryRequest(payload)

    if (!response?.dishEntry) {
      throw new Error('La API no devolvió la entrada creada.')
    }

    let nextStateSnapshot = null

    updateState((current) => {
      const nextDishEntries = [...current.dishEntries, response.dishEntry]
      nextStateSnapshot = {
        ...current,
        dishEntries: nextDishEntries,
        restaurants: updateRestaurantsFromEntries(current.restaurants, nextDishEntries),
      }
      stateRef.current = nextStateSnapshot
      return nextStateSnapshot
    })
    setToast({ message: 'Guardado ✅', tone: 'success' })

    return {
      ...response,
      nextStateSnapshot,
    }
  }

  async function updateDishEntry(dishEntryId, payload) {
    const response = await updateDishEntryRequest(dishEntryId, payload)

    if (!response?.dishEntry) {
      throw new Error('La API no devolvió la valoración actualizada.')
    }

    updateState((current) => {
      const nextDishEntries = replaceRecordById(current.dishEntries, response.dishEntry)
      const nextState = {
        ...current,
        dishEntries: nextDishEntries,
        restaurants: updateRestaurantsFromEntries(current.restaurants, nextDishEntries),
      }
      stateRef.current = nextState
      return nextState
    })
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function updateUser(userId, payload) {
    const response = await updateUserRequest(userId, payload)

    if (!response?.user) {
      throw new Error('La API no devolvió el perfil actualizado.')
    }

    replaceUserRecordInState(response.user)
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  function applyFilters(nextFilters) {
    return normalizeFilters(nextFilters, getStateSnapshot().dishTypes)
  }

  const value = {
    state,
    derivedState,
    isLoading,
    setIsLoading,
    loadError,
    setLoadError,
    dataSource,
    setDataSource,
    toast,
    setToast,
    setState: updateState,
    clearToast,
    resetAppData,
    getStateSnapshot,
    replaceUserRecordInState,
    bootstrapApp,
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
    updateUser,
    normalizeIncomingFilters: applyFilters,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}
