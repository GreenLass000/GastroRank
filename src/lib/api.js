const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
const API_BASE_URL = RAW_API_BASE_URL || ''

function buildUrl(pathname) {
  return API_BASE_URL ? `${API_BASE_URL}${pathname}` : pathname
}

function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return
      }

      searchParams.set(key, JSON.stringify(value))
      return
    }

    if (typeof value === 'object') {
      searchParams.set(key, JSON.stringify(value))
      return
    }

    if (value === '') {
      return
    }

    searchParams.set(key, String(value))
  })

  const serialized = searchParams.toString()
  return serialized ? `?${serialized}` : ''
}

async function fetchJson(pathname, { timeoutMs = 6000 } = {}) {
  return requestJson(pathname, {
    method: 'GET',
    timeoutMs,
  })
}

async function requestJson(pathname, { body, method, timeoutMs = 6000 } = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(buildUrl(pathname), {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(payload?.error ?? `HTTP ${response.status}`)
    }

    return payload
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La petición agotó el tiempo de espera.')
    }

    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export function fetchBootstrapData() {
  return fetchJson('/api/bootstrap')
}

export function fetchFollows({ userId, currentUserId, viewerUserId } = {}) {
  return fetchJson(
    `/api/follows${buildQueryString({
      user_id: userId,
      current_user_id: currentUserId,
      viewer_user_id: viewerUserId,
    })}`,
  )
}

export function createFollow(payload) {
  return requestJson('/api/follows', {
    method: 'POST',
    body: payload,
    timeoutMs: 15000,
  })
}

export function deleteFollow(followedUserId, { userId, currentUserId, viewerUserId } = {}) {
  return requestJson(
    `/api/follows/${encodeURIComponent(followedUserId)}${buildQueryString({
      user_id: userId,
      current_user_id: currentUserId,
      viewer_user_id: viewerUserId,
    })}`,
    {
      method: 'DELETE',
      timeoutMs: 15000,
    },
  )
}

export function fetchCommunityFeed({
  userId,
  currentUserId,
  viewerUserId,
  tab,
  page,
  pageSize,
  filters,
} = {}) {
  return fetchJson(
    `/api/community/feed${buildQueryString({
      user_id: userId,
      current_user_id: currentUserId,
      viewer_user_id: viewerUserId,
      tab,
      page,
      page_size: pageSize,
      filters,
    })}`,
    {
      timeoutMs: 15000,
    },
  )
}

export function createReaction(payload) {
  return requestJson('/api/reactions', {
    method: 'POST',
    body: payload,
    timeoutMs: 15000,
  })
}

export function deleteReaction(reactionId) {
  return requestJson(`/api/reactions/${encodeURIComponent(reactionId)}`, {
    method: 'DELETE',
    timeoutMs: 15000,
  })
}

export function fetchComments(entryId) {
  return fetchJson(`/api/comments/${encodeURIComponent(entryId)}`, {
    timeoutMs: 15000,
  })
}

export function createComment(payload) {
  return requestJson('/api/comments', {
    method: 'POST',
    body: payload,
    timeoutMs: 15000,
  })
}

export function fetchInspirationLists({ userId, currentUserId, viewerUserId } = {}) {
  return fetchJson(
    `/api/inspiration-lists${buildQueryString({
      user_id: userId,
      current_user_id: currentUserId,
      viewer_user_id: viewerUserId,
    })}`,
    {
      timeoutMs: 15000,
    },
  )
}

export function createInspirationList(payload) {
  return requestJson('/api/inspiration-lists', {
    method: 'POST',
    body: payload,
    timeoutMs: 15000,
  })
}

export function createInspirationListItem(payload) {
  return requestJson('/api/inspiration-list-items', {
    method: 'POST',
    body: payload,
    timeoutMs: 15000,
  })
}

export function updateInspirationListItem(itemId, payload) {
  return requestJson(`/api/inspiration-list-items/${encodeURIComponent(itemId)}`, {
    method: 'PUT',
    body: payload,
    timeoutMs: 15000,
  })
}

export function createRecommendation(payload) {
  return requestJson('/api/recommendations', {
    method: 'POST',
    body: payload,
    timeoutMs: 15000,
  })
}

export function updateRecommendation(recommendationId, payload = {}) {
  return requestJson(`/api/recommendations/${encodeURIComponent(recommendationId)}`, {
    method: 'PUT',
    body: payload,
    timeoutMs: 15000,
  })
}

export function fetchRecommendations({ userId, currentUserId, viewerUserId } = {}) {
  return fetchJson(
    `/api/recommendations${buildQueryString({
      user_id: userId,
      current_user_id: currentUserId,
      viewer_user_id: viewerUserId,
    })}`,
    {
      timeoutMs: 15000,
    },
  )
}

export function fetchAchievements({ userId, currentUserId, viewerUserId } = {}) {
  return fetchJson(
    `/api/achievements${buildQueryString({
      user_id: userId,
      current_user_id: currentUserId,
      viewer_user_id: viewerUserId,
    })}`,
    {
      timeoutMs: 15000,
    },
  )
}

export function createAchievement(payload) {
  return requestJson('/api/achievements', {
    method: 'POST',
    body: payload,
    timeoutMs: 15000,
  })
}

export function createRestaurant(payload) {
  return requestJson('/api/restaurants', {
    method: 'POST',
    body: payload,
    timeoutMs: 60000,
  })
}

export function updateRestaurant(restaurantId, payload) {
  return requestJson(`/api/restaurants/${encodeURIComponent(restaurantId)}`, {
    method: 'PUT',
    body: payload,
    timeoutMs: 60000,
  })
}

export function createGroup(payload) {
  return requestJson('/api/groups', {
    method: 'POST',
    body: payload,
    timeoutMs: 15000,
  })
}

export function updateGroup(groupId, payload) {
  return requestJson(`/api/groups/${encodeURIComponent(groupId)}`, {
    method: 'PUT',
    body: payload,
    timeoutMs: 15000,
  })
}

export function createPublicShareToken(payload) {
  return requestJson('/api/public-share-tokens', {
    method: 'POST',
    body: payload,
    timeoutMs: 15000,
  })
}

export function fetchPublicShare(token) {
  return fetchJson(`/api/public-share/${encodeURIComponent(token)}`, {
    timeoutMs: 15000,
  })
}

export function createCategory(payload) {
  return requestJson('/api/categories', {
    method: 'POST',
    body: payload,
    timeoutMs: 15000,
  })
}

export function updateCategory(categoryId, payload) {
  return requestJson(`/api/categories/${encodeURIComponent(categoryId)}`, {
    method: 'PUT',
    body: payload,
    timeoutMs: 15000,
  })
}

export function createDishType(payload) {
  return requestJson('/api/dish-types', {
    method: 'POST',
    body: payload,
    timeoutMs: 15000,
  })
}

export function updateDishType(dishTypeId, payload) {
  return requestJson(`/api/dish-types/${encodeURIComponent(dishTypeId)}`, {
    method: 'PUT',
    body: payload,
    timeoutMs: 15000,
  })
}

export function createDishEntry(payload) {
  return requestJson('/api/dish-entries', {
    method: 'POST',
    body: payload,
    timeoutMs: 60000,
  })
}

export function updateDishEntry(dishEntryId, payload) {
  return requestJson(`/api/dish-entries/${encodeURIComponent(dishEntryId)}`, {
    method: 'PUT',
    body: payload,
    timeoutMs: 60000,
  })
}

export function updateUser(userId, payload) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: payload,
    timeoutMs: 15000,
  })
}

export function getApiBaseUrl() {
  return API_BASE_URL || 'same-origin (/api)'
}
