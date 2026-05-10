import { useEffect, useMemo, useState } from 'react'
import './ComunidadScreen.css'
import '../components/community/Community.css'
import { EmptyState } from '../components/feedback/EmptyState.jsx'
import { StatusBanner } from '../components/feedback/StatusBanner.jsx'
import { CommunityGrid } from '../components/community/CommunityGrid.jsx'
import { EntryDetailModal } from '../components/community/EntryDetailModal.jsx'
import { FilterBar } from '../components/community/FilterBar.jsx'
import { Pagination } from '../components/community/Pagination.jsx'
import { ParaTiSection } from '../components/community/ParaTiSection.jsx'
import { fetchCommunityFeed } from '../lib/api.js'
import { useAppState } from '../hooks/useAppState.js'

const DEFAULT_FILTERS = {
  categoryIds: [],
  dishTypeIds: [],
  priceRange: [],
  minScore: null,
  datePreset: '',
}

function buildDateRange(datePreset) {
  if (!datePreset) {
    return {}
  }

  const now = new Date()
  const start = new Date(now)
  const days = Number(datePreset.replace('d', ''))
  start.setDate(now.getDate() - days)
  const dateFrom = start.toISOString().slice(0, 10)
  const dateTo = now.toISOString().slice(0, 10)

  return { dateFrom, dateTo }
}

function normalizeRecommendationItems({
  currentUser,
  dishEntries,
  dishTypes,
  recommendations,
  restaurants,
  users,
}) {
  return recommendations
    .filter((recommendation) => recommendation.to_user_id === currentUser.id && !recommendation.seen)
    .map((recommendation) => {
      const entry =
        recommendation.dish_entry ??
        dishEntries.find((dishEntry) => dishEntry.id === recommendation.dish_entry_id)

      if (!entry) {
        return null
      }

      return {
        id: recommendation.id,
        recommendation,
        fromUser:
          recommendation.from_user ??
          users.find((user) => user.id === recommendation.from_user_id) ??
          null,
        entry: {
          ...entry,
          restaurant:
            entry.restaurant ??
            restaurants.find((restaurant) => restaurant.id === entry.restaurant_id) ??
            null,
          dishType:
            entry.dishType ??
            dishTypes.find((dishType) => dishType.id === entry.tipo_plato_id) ??
            null,
        },
      }
    })
    .filter(Boolean)
    .slice(0, 5)
}

export function ComunidadScreen({ onOpenEntity, onOpenSearch }) {
  const {
    addComment,
    addReaction,
    categories,
    comments,
    createInspirationList,
    currentUser,
    dishEntries,
    dishTypes,
    inspirationLists,
    loadComments,
    loadFollows,
    loadInspirationLists,
    loadRecommendations,
    markRecommendationSeen,
    mutualFollows,
    recommendations,
    removeReaction,
    restaurants,
    saveToList,
    socialLoadState,
    users,
  } = useAppState()
  const [tab, setTab] = useState('amigos')
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [feedState, setFeedState] = useState({
    entries: [],
    page: 1,
    totalPages: 1,
    totalItems: 0,
  })
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [isFeedLoading, setIsFeedLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSocialHydrating, setIsSocialHydrating] = useState(true)
  const [feedError, setFeedError] = useState('')
  const [socialLoadError, setSocialLoadError] = useState('')
  const [dismissedRecommendationIds, setDismissedRecommendationIds] = useState([])
  const hasActiveCommunityFilters = useMemo(
    () =>
      filters.categoryIds.length > 0 ||
      filters.dishTypeIds.length > 0 ||
      filters.priceRange.length > 0 ||
      filters.minScore != null ||
      Boolean(filters.datePreset),
    [filters],
  )

  const recommendationItems = useMemo(
    () =>
      normalizeRecommendationItems({
        currentUser,
        dishEntries,
        dishTypes,
        recommendations,
        restaurants,
        users,
      }).filter((item) => !dismissedRecommendationIds.includes(item.id)),
    [currentUser, dismissedRecommendationIds, dishEntries, dishTypes, recommendations, restaurants, users],
  )

  useEffect(() => {
    let cancelled = false

    async function hydrateSocialState() {
      try {
        setIsSocialHydrating(true)
        await Promise.all([
          socialLoadState.follows ? Promise.resolve() : loadFollows(),
          socialLoadState.recommendations ? Promise.resolve() : loadRecommendations(),
          socialLoadState.inspirationLists ? Promise.resolve() : loadInspirationLists(),
        ])

        if (!cancelled) {
          setSocialLoadError('')
        }
      } catch (error) {
        if (!cancelled) {
          setSocialLoadError(
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar los datos sociales de comunidad.',
          )
        }
      } finally {
        if (!cancelled) {
          setIsSocialHydrating(false)
        }
      }
    }

    hydrateSocialState()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    socialLoadState.follows,
    socialLoadState.inspirationLists,
    socialLoadState.recommendations,
  ])

  useEffect(() => {
    let cancelled = false

    async function loadFeed() {
      try {
        setIsFeedLoading(true)
        const { dateFrom, dateTo } = buildDateRange(filters.datePreset)
        const response = await fetchCommunityFeed({
          userId: currentUser.id,
          tab,
          page,
          filters: {
            categoryIds: filters.categoryIds,
            dishTypeIds: filters.dishTypeIds,
            priceRange: filters.priceRange,
            minScore: filters.minScore,
            dateFrom,
            dateTo,
          },
        })

        if (cancelled) {
          return
        }

        setFeedState({
          entries: response.items ?? response.entries ?? [],
          page: response.page ?? 1,
          totalPages: response.totalPages ?? response.total_pages ?? 1,
          totalItems: response.total ?? response.total_items ?? 0,
        })
        setFeedError('')
      } catch (error) {
        if (cancelled) {
          return
        }

        setFeedState({
          entries: [],
          page: 1,
          totalPages: 1,
          totalItems: 0,
        })
        setFeedError(
          error instanceof Error ? error.message : 'No se pudo cargar la comunidad.',
        )
      } finally {
        if (!cancelled) {
          setIsFeedLoading(false)
        }
      }
    }

    loadFeed()

    return () => {
      cancelled = true
    }
  }, [currentUser.id, filters, page, tab])

  useEffect(() => {
    if (!selectedEntry?.id) {
      return
    }

    loadComments(selectedEntry.id).catch(() => {})
  }, [loadComments, selectedEntry])

  function resetFilters() {
    setFilters(DEFAULT_FILTERS)
    setPage(1)
  }

  async function ensureDefaultList() {
    const existingDefault =
      inspirationLists.find((list) => list.is_default) ??
      inspirationLists.find((list) => list.name.toLowerCase() === 'para probar')

    if (existingDefault) {
      return existingDefault
    }

    const response = await createInspirationList({
      user_id: currentUser.id,
      name: 'Para probar',
      is_default: true,
    })

    return response.inspirationList
  }

  async function handleSaveEntry(entry) {
    setIsSaving(true)

    try {
      const targetList = await ensureDefaultList()
      await saveToList({
        list_id: targetList.id,
        dish_entry_id: entry.id,
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReact(reactionType) {
    if (!selectedEntry) {
      return
    }

    const currentReactionId = selectedEntry.user_reaction?.id ?? ''
    const currentReactionType = selectedEntry.user_reaction?.reaction_type ?? ''

    if (currentReactionType === reactionType && currentReactionId) {
      await removeReaction(currentReactionId)
    } else {
      await addReaction({
        dish_entry_id: selectedEntry.id,
        user_id: currentUser.id,
        reaction_type: reactionType,
      })
    }

    const { dateFrom, dateTo } = buildDateRange(filters.datePreset)
    const response = await fetchCommunityFeed({
      userId: currentUser.id,
      tab,
      page,
      filters: {
        categoryIds: filters.categoryIds,
        dishTypeIds: filters.dishTypeIds,
        priceRange: filters.priceRange,
        minScore: filters.minScore,
        dateFrom,
        dateTo,
      },
    })
    setFeedState({
      entries: response.items ?? response.entries ?? [],
      page: response.page ?? 1,
      totalPages: response.totalPages ?? response.total_pages ?? 1,
      totalItems: response.total ?? response.total_items ?? 0,
    })
    setSelectedEntry(
      (response.items ?? response.entries)?.find((entry) => entry.id === selectedEntry.id) ??
        null,
    )
  }

  async function handleComment({ mentions, text }) {
    if (!selectedEntry) {
      return
    }

    await addComment({
      dish_entry_id: selectedEntry.id,
      user_id: currentUser.id,
      text,
      mentions,
    })
    await loadComments(selectedEntry.id)
  }

  async function handleOpenRecommendation(item) {
    await markRecommendationSeen(item.id)
    setDismissedRecommendationIds((current) => [...current, item.id])
    setSelectedEntry(item.entry)
  }

  const selectedComments = selectedEntry
    ? comments.filter((comment) => comment.dish_entry_id === selectedEntry.id)
    : []

  return (
    <section className="screen screen--explore" aria-label="Pantalla de explorar">
      <div className="community-screen__subtabs">
        <button
          className={`community-screen__subtab${tab === 'explorar' ? ' community-screen__subtab--active' : ''}`}
          type="button"
          onClick={() => {
            setTab('explorar')
            setPage(1)
          }}
        >
          Explorar
        </button>
        <button
          className={`community-screen__subtab${tab === 'amigos' ? ' community-screen__subtab--active' : ''}`}
          type="button"
          onClick={() => {
            setTab('amigos')
            setPage(1)
          }}
        >
          Amigos
        </button>
      </div>

      <FilterBar
        categories={categories}
        dishTypes={dishTypes}
        filters={filters}
        onChange={(nextFilters) => {
          setFilters(nextFilters)
          setPage(1)
        }}
        onReset={resetFilters}
      />

      {feedError ? (
        <StatusBanner tone="error" title="Error al cargar" detail={feedError} />
      ) : null}
      {socialLoadError ? (
        <StatusBanner
          tone="error"
          title="Datos sociales incompletos"
          detail={socialLoadError}
        />
      ) : null}

      {tab === 'amigos' ? (
        <>
          <ParaTiSection items={recommendationItems} onOpen={handleOpenRecommendation} />
          {isFeedLoading ? (
            <EmptyState
              description="Estamos preparando tu feed de amigos."
              title="Cargando..."
            />
          ) : isSocialHydrating ? (
            <EmptyState
              description="Cargando follows, listas y recomendaciones para tu comunidad."
              title="Cargando..."
            />
          ) : mutualFollows.length === 0 ? (
            <EmptyState
              actionLabel="Buscar amigos →"
              description="No sigues a nadie todavía. Busca amigos →"
              onAction={onOpenSearch}
              title="Feed de amigos vacío"
            />
          ) : feedState.entries.length > 0 ? (
            <CommunityGrid
              entries={feedState.entries}
              onOpenEntry={setSelectedEntry}
              onSaveEntry={handleSaveEntry}
            />
          ) : (
            <EmptyState
              description="Tus amistades todavía no han publicado platos visibles para este feed."
              title="👥 Aún no hay platos en tu feed de amigos"
            />
          )}
        </>
      ) : isFeedLoading ? (
        <EmptyState
          description="Buscando platos públicos de la comunidad."
          title="Cargando..."
        />
      ) : feedState.entries.length > 0 ? (
        <CommunityGrid
          entries={feedState.entries}
          onOpenEntry={setSelectedEntry}
          onSaveEntry={handleSaveEntry}
        />
      ) : (
        <EmptyState
          actionLabel={hasActiveCommunityFilters ? 'Resetear filtros' : ''}
          description={
            hasActiveCommunityFilters
              ? 'Prueba a ampliar la selección o resetear los filtros activos.'
              : 'Nadie ha publicado entradas públicas aún.'
          }
          onAction={hasActiveCommunityFilters ? resetFilters : undefined}
          title={
            hasActiveCommunityFilters
              ? '🍽 No hay resultados con estos filtros'
              : 'Explorar vacío'
          }
        />
      )}

      <Pagination
        page={feedState.page}
        totalPages={feedState.totalPages}
        onChange={setPage}
      />

      {selectedEntry ? (
        <EntryDetailModal
          comments={selectedComments}
          entry={selectedEntry}
          isSaving={isSaving}
          mutualFollows={mutualFollows}
          onClose={() => setSelectedEntry(null)}
          onComment={handleComment}
          onOpenRestaurant={(restaurant) => {
            setSelectedEntry(null)
            onOpenEntity?.({ type: 'restaurant', id: restaurant.id })
          }}
          onReact={handleReact}
          onSave={handleSaveEntry}
        />
      ) : null}
    </section>
  )
}
