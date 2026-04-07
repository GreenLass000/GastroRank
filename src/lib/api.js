const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
const API_BASE_URL = RAW_API_BASE_URL || ''

function buildUrl(pathname) {
  return API_BASE_URL ? `${API_BASE_URL}${pathname}` : pathname
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

export function createRestaurant(payload) {
  return requestJson('/api/restaurants', {
    method: 'POST',
    body: payload,
    timeoutMs: 8000,
  })
}

export function createCategory(payload) {
  return requestJson('/api/categories', {
    method: 'POST',
    body: payload,
    timeoutMs: 8000,
  })
}

export function createDishType(payload) {
  return requestJson('/api/dish-types', {
    method: 'POST',
    body: payload,
    timeoutMs: 8000,
  })
}

export function createDishEntry(payload) {
  return requestJson('/api/dish-entries', {
    method: 'POST',
    body: payload,
    timeoutMs: 10000,
  })
}

export function getApiBaseUrl() {
  return API_BASE_URL || 'same-origin (/api)'
}
