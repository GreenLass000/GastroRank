import { useCallback, useEffect, useState } from 'react'

function readQueryState(schema) {
  const params = new URLSearchParams(window.location.search)

  return Object.entries(schema).reduce((acc, [stateKey, config]) => {
    const rawValue = params.get(config.queryKey)

    acc[stateKey] =
      rawValue == null
        ? config.defaultValue
        : config.parse
          ? config.parse(rawValue)
          : rawValue

    return acc
  }, {})
}

function writeQueryState(schema, state) {
  const params = new URLSearchParams(window.location.search)

  Object.entries(schema).forEach(([stateKey, config]) => {
    const value = state[stateKey]
    const shouldPersist = config.shouldPersist
      ? config.shouldPersist(value, config.defaultValue, state)
      : value !== config.defaultValue

    if (!shouldPersist) {
      params.delete(config.queryKey)
      return
    }

    const serializedValue = config.serialize ? config.serialize(value, state) : String(value)

    if (!serializedValue) {
      params.delete(config.queryKey)
      return
    }

    params.set(config.queryKey, serializedValue)
  })

  return params
}

export function useScreenQueryState(schema) {
  const [state, setState] = useState(() => readQueryState(schema))

  useEffect(() => {
    function handlePopState() {
      setState(readQueryState(schema))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [schema])

  useEffect(() => {
    const nextParams = writeQueryState(schema, state)
    const nextQuery = nextParams.toString()
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}`
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, '', nextUrl)
    }
  }, [schema, state])

  const updateState = useCallback((nextState) => {
    setState((currentState) =>
      typeof nextState === 'function'
        ? nextState(currentState)
        : { ...currentState, ...nextState },
    )
  }, [])

  return [state, updateState]
}
