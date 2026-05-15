import { useCallback, useEffect, useState } from 'react'
import { getAchievementTitle } from '../lib/achievements.js'
import {
  createAchievement as createAchievementRequest,
  createComment as createCommentRequest,
  createFollow as createFollowRequest,
  createInspirationList as createInspirationListRequest,
  createInspirationListItem as createInspirationListItemRequest,
  createReaction as createReactionRequest,
  createRecommendation as createRecommendationRequest,
  deleteComment as deleteCommentRequest,
  deleteFollow as deleteFollowRequest,
  deleteReaction as deleteReactionRequest,
  fetchAchievements as fetchAchievementsRequest,
  fetchComments as fetchCommentsRequest,
  fetchFollows as fetchFollowsRequest,
  fetchInspirationLists as fetchInspirationListsRequest,
  fetchRecommendations as fetchRecommendationsRequest,
  updateAchievement as updateAchievementRequest,
  updateComment as updateCommentRequest,
  updateInspirationListItem as updateInspirationListItemRequest,
  updateRecommendation as updateRecommendationRequest,
} from '../lib/api.js'
import { SocialContext } from './appStateContexts.js'
import {
  useAppDataContext,
  useAuthSessionContext,
  useFiltersContext,
} from './appStateContexts.js'
import {
  ACHIEVEMENT_DEFINITIONS,
  buildDerivedState,
  flattenInspirationLists,
  getTopEntryByCategory,
  getMaxCountBy,
  hasAllSubscores,
  parseCityFromAddress,
  replaceRecordById,
} from './appStateShared.js'
import { buildGlobalRankings } from '../lib/ranking.js'

export function SocialProvider({ children }) {
  const { derivedState, setToast, state, setState, toast } =
    useAppDataContext()
  const { sessionUser } = useAuthSessionContext()
  const { activeFilters, filterOrigin } = useFiltersContext()
  const [socialLoadState, setSocialLoadState] = useState({
    follows: false,
    inspirationLists: false,
    recommendations: false,
    achievements: false,
  })
  const [achievementNotificationInFlightId, setAchievementNotificationInFlightId] =
    useState('')

  const updateAppState = useCallback((updater) => {
    setState((current) => {
      const nextState = updater(current)
      return nextState
    })
  }, [setState])

  function resetSocialLoadState() {
    setSocialLoadState({
      follows: false,
      inspirationLists: false,
      recommendations: false,
      achievements: false,
    })
  }

  async function loadFollows(userId = derivedState.currentUser?.id) {
    const response = await fetchFollowsRequest({ userId })

    if (!response?.follows) {
      throw new Error('La API no devolvió los follows.')
    }

    const relatedUsers = [
      ...(response.following ?? []).map((item) => item.user).filter(Boolean),
      ...(response.followers ?? []).map((item) => item.user).filter(Boolean),
      ...(response.mutuals ?? []).filter(Boolean),
    ]

    updateAppState((current) => ({
      ...current,
      follows: response.follows,
      users: [
        ...current.users.filter(
          (user) => !relatedUsers.some((relatedUser) => relatedUser.id === user.id),
        ),
        ...relatedUsers,
      ],
    }))
    setSocialLoadState((current) => ({ ...current, follows: true }))

    return response
  }

  async function followUser(followedUserId) {
    const response = await createFollowRequest({
      follower_user_id: derivedState.currentUser.id,
      followed_user_id: followedUserId,
    })

    if (!response?.follow) {
      throw new Error('La API no devolvió el follow creado.')
    }

    updateAppState((current) => ({
      ...current,
      follows: [
        ...current.follows.filter(
          (follow) =>
            !(
              follow.follower_user_id === response.follow.follower_user_id &&
              follow.followed_user_id === response.follow.followed_user_id
            ),
        ),
        response.follow,
      ],
    }))

    return response
  }

  async function unfollowUser(followedUserId) {
    await deleteFollowRequest(followedUserId, {
      userId: derivedState.currentUser.id,
    })

    updateAppState((current) => ({
      ...current,
      follows: current.follows.filter(
        (follow) =>
          !(
            follow.follower_user_id === derivedState.currentUser.id &&
            follow.followed_user_id === followedUserId
          ),
      ),
    }))
  }

  function getMutualFollows() {
    return derivedState.mutualFollows
  }

  async function loadComments(entryId) {
    const response = await fetchCommentsRequest(entryId)

    if (!response?.comments) {
      throw new Error('La API no devolvió los comentarios.')
    }

    updateAppState((current) => ({
      ...current,
      comments: [
        ...current.comments.filter((comment) => comment.dish_entry_id !== entryId),
        ...response.comments,
      ],
    }))

    return response
  }

  async function addComment(payload) {
    const response = await createCommentRequest(payload)

    if (!response?.comment) {
      throw new Error('La API no devolvió el comentario creado.')
    }

    updateAppState((current) => ({
      ...current,
      comments: [...current.comments, response.comment],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function updateComment(commentId, payload) {
    const response = await updateCommentRequest(commentId, payload)

    if (!response?.comment) {
      throw new Error('La API no devolvió el comentario actualizado.')
    }

    updateAppState((current) => ({
      ...current,
      comments: replaceRecordById(current.comments, response.comment),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function removeComment(commentId) {
    await deleteCommentRequest(commentId)

    updateAppState((current) => ({
      ...current,
      comments: current.comments.filter((comment) => comment.id !== commentId),
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
  }

  async function addReaction(payload) {
    const response = await createReactionRequest(payload)

    if (!response?.reaction) {
      throw new Error('La API no devolvió la reacción.')
    }

    updateAppState((current) => ({
      ...current,
      reactions: [
        ...current.reactions.filter(
          (reaction) =>
            !(
              reaction.dish_entry_id === response.reaction.dish_entry_id &&
              reaction.user_id === response.reaction.user_id
            ),
        ),
        response.reaction,
      ],
    }))

    return response
  }

  async function removeReaction(reactionId) {
    await deleteReactionRequest(reactionId)

    updateAppState((current) => ({
      ...current,
      reactions: current.reactions.filter((reaction) => reaction.id !== reactionId),
    }))
  }

  async function loadInspirationLists(userId = derivedState.currentUser?.id) {
    const response = await fetchInspirationListsRequest({ userId })

    if (!response?.inspirationLists) {
      throw new Error('La API no devolvió las listas de inspiración.')
    }

    const flattened = flattenInspirationLists(response.inspirationLists)

    updateAppState((current) => ({
      ...current,
      inspirationLists: flattened.inspirationLists,
      inspirationListItems: flattened.inspirationListItems,
    }))
    setSocialLoadState((current) => ({ ...current, inspirationLists: true }))

    return response
  }

  async function createInspirationList(payload) {
    const response = await createInspirationListRequest(payload)

    if (!response?.inspirationList) {
      throw new Error('La API no devolvió la lista creada.')
    }

    updateAppState((current) => ({
      ...current,
      inspirationLists: [...current.inspirationLists, response.inspirationList],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function saveToList(payload) {
    const response = await createInspirationListItemRequest(payload)

    if (!response?.inspirationListItem) {
      throw new Error('La API no devolvió el guardado en lista.')
    }

    updateAppState((current) => ({
      ...current,
      inspirationListItems: [
        ...current.inspirationListItems.filter(
          (item) => item.id !== response.inspirationListItem.id,
        ),
        response.inspirationListItem,
      ],
    }))
    setToast({ message: 'Guardado ✅', tone: 'success' })
    return response
  }

  async function markTried(itemId, tried = true) {
    const response = await updateInspirationListItemRequest(itemId, { tried })

    if (!response?.inspirationListItem) {
      throw new Error('La API no devolvió el elemento actualizado.')
    }

    updateAppState((current) => ({
      ...current,
      inspirationListItems: replaceRecordById(
        current.inspirationListItems,
        response.inspirationListItem,
      ),
    }))

    return response
  }

  async function removeFromList(itemId) {
    const response = await updateInspirationListItemRequest(itemId, { remove: true })

    if (!response?.inspirationListItem?.removed) {
      throw new Error('La API no confirmó la eliminación del elemento.')
    }

    updateAppState((current) => ({
      ...current,
      inspirationListItems: current.inspirationListItems.filter((item) => item.id !== itemId),
    }))

    return response
  }

  async function loadRecommendations(userId = derivedState.currentUser?.id) {
    const response = await fetchRecommendationsRequest({ userId })

    if (!response?.recommendations) {
      throw new Error('La API no devolvió las recomendaciones.')
    }

    updateAppState((current) => ({
      ...current,
      recommendations: response.recommendations,
    }))
    setSocialLoadState((current) => ({ ...current, recommendations: true }))

    return response
  }

  async function sendRecommendation(payload) {
    const response = await createRecommendationRequest(payload)

    if (!response?.recommendation) {
      throw new Error('La API no devolvió la recomendación creada.')
    }

    updateAppState((current) => ({
      ...current,
      recommendations: [...current.recommendations, response.recommendation],
    }))

    return response
  }

  async function markRecommendationSeen(recommendationId) {
    const response = await updateRecommendationRequest(recommendationId, { seen: true })

    if (!response?.recommendation) {
      throw new Error('La API no devolvió la recomendación actualizada.')
    }

    updateAppState((current) => ({
      ...current,
      recommendations: replaceRecordById(
        current.recommendations,
        response.recommendation,
      ),
    }))

    return response
  }

  async function loadAchievements(userId = derivedState.currentUser?.id) {
    const response = await fetchAchievementsRequest({ userId })

    if (!response?.achievements) {
      throw new Error('La API no devolvió los logros.')
    }

    updateAppState((current) => ({
      ...current,
      achievements: [
        ...current.achievements.filter((achievement) => achievement.user_id !== userId),
        ...response.achievements,
      ],
    }))
    setSocialLoadState((current) => ({ ...current, achievements: true }))

    return response
  }

  async function markAchievementNotified(achievementId) {
    const response = await updateAchievementRequest(achievementId, {
      notified: true,
    })

    if (!response?.achievement) {
      throw new Error('La API no devolvió el logro actualizado.')
    }

    updateAppState((current) => ({
      ...current,
      achievements: replaceRecordById(current.achievements, response.achievement),
    }))

    return response
  }

  async function checkAndUnlockAchievements(nextState = state) {
    const currentUserId = derivedState.currentUser?.id

    if (!currentUserId) {
      return []
    }

    const currentUserEntries = nextState.dishEntries.filter(
      (entry) => entry.created_by_user_id === currentUserId,
    )
    const currentUserEntryIds = new Set(currentUserEntries.map((entry) => entry.id))
    const publicEntries = nextState.dishEntries.filter(
      (entry) => entry.visibility === 'public',
    )
    const restaurantsById = Object.fromEntries(
      (nextState.restaurants ?? []).map((restaurant) => [restaurant.id, restaurant]),
    )
    const publicGlobalTopTen = buildGlobalRankings({
      categories: nextState.categories ?? [],
      currentGroupId: null,
      currentUserId,
      dishTypes: nextState.dishTypes ?? [],
      entries: nextState.dishEntries ?? [],
      restaurants: nextState.restaurants ?? [],
      contextId: 'public',
    }).slice(0, 10)
    const evaluationInput = {
      currentUserId,
      sameDishTypeMaxCount: getMaxCountBy(
        currentUserEntries.map((entry) => entry.tipo_plato_id),
      ),
      distinctRestaurantsCount: new Set(
        currentUserEntries.map((entry) => entry.restaurant_id),
      ).size,
      entriesWithPhotoCount: currentUserEntries.filter((entry) => entry.foto_url).length,
      distinctCitiesCount: new Set(
        currentUserEntries
          .map((entry) => parseCityFromAddress(restaurantsById[entry.restaurant_id]?.direccion_texto))
          .filter(Boolean),
      ).size,
      communityTopTenEntriesCount: publicGlobalTopTen.filter((entry) =>
        currentUserEntryIds.has(entry.id),
      ).length,
      fullyScoredEntriesCount: currentUserEntries.filter((entry) => hasAllSubscores(entry))
        .length,
      sameRestaurantMaxCount: getMaxCountBy(
        currentUserEntries.map((entry) => entry.restaurant_id),
      ),
      distinctCategoriesCount: new Set(
        currentUserEntries.map((entry) => entry.categoria_id),
      ).size,
      reactionsFromOthersCount: (nextState.reactions ?? []).filter(
        (reaction) =>
          reaction.user_id !== currentUserId &&
          currentUserEntryIds.has(reaction.dish_entry_id),
      ).length,
      categoryWinsCount: getTopEntryByCategory(publicEntries).filter(
        (entry) => entry?.created_by_user_id === currentUserId,
      ).length,
      weeklyStreak: buildDerivedState(
        nextState,
        activeFilters,
        filterOrigin,
        sessionUser,
      ).weeklyStreak,
    }
    const unlockedBadgeTypes = new Set(
      (nextState.achievements ?? [])
        .filter((achievement) => achievement.user_id === currentUserId)
        .map((achievement) => achievement.badge_type),
    )
    const pendingDefinitions = ACHIEVEMENT_DEFINITIONS.filter(
      (definition) =>
        !unlockedBadgeTypes.has(definition.badgeType) &&
        definition.matches(evaluationInput),
    )

    if (pendingDefinitions.length === 0) {
      return []
    }

    const createdAchievements = []

    for (const definition of pendingDefinitions) {
      const response = await createAchievementRequest({
        user_id: currentUserId,
        badge_type: definition.badgeType,
        notified: false,
      })

      if (response?.achievement) {
        createdAchievements.push(response.achievement)
      }
    }

    if (createdAchievements.length > 0) {
      updateAppState((current) => ({
        ...current,
        achievements: [...current.achievements, ...createdAchievements],
      }))
    }

    return createdAchievements
  }

  useEffect(() => {
    const pendingAchievement =
      (derivedState.achievements ?? []).find((achievement) => !achievement.notified) ?? null

    if (!pendingAchievement || toast.message || achievementNotificationInFlightId) {
      return
    }

    setAchievementNotificationInFlightId(pendingAchievement.id)
    setToast({
      message: `🎉 Logro desbloqueado: ${getAchievementTitle(pendingAchievement.badge_type)}`,
      tone: 'achievement',
    })

    updateAchievementRequest(pendingAchievement.id, {
      notified: true,
    })
      .then((response) => {
        if (!response?.achievement) {
          throw new Error('La API no devolvió el logro actualizado.')
        }

        updateAppState((current) => ({
          ...current,
          achievements: replaceRecordById(current.achievements, response.achievement),
        }))
      })
      .catch((error) => {
        setToast({
          message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo confirmar el logro.'}`,
          tone: 'error',
        })
      })
      .finally(() => {
        setAchievementNotificationInFlightId('')
      })
  }, [
    achievementNotificationInFlightId,
    derivedState.achievements,
    setToast,
    toast.message,
    updateAppState,
  ])

  const value = {
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
  }

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}
