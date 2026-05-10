import { EmptyState } from '../components/feedback/EmptyState.jsx'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { FilterPanel } from '../components/filters/FilterPanel.jsx'
import { ModalSheet } from '../components/layout/ModalSheet.jsx'
import { RankingList } from '../components/rankings/RankingList.jsx'
import { useAppState } from '../hooks/useAppState.js'
import { usePersistentState } from '../hooks/usePersistentState.js'
import { createPublicShareToken } from '../lib/api.js'
import {
  GLOBAL_RANKING_VIEWS,
  RANKING_CONTEXTS,
  RANKING_MODES,
  STORAGE_KEYS,
} from '../lib/constants.js'
import { formatDate, formatRelativePrice, formatScore } from '../lib/format.js'
import {
  buildCategoryFilteredRestaurantRankings,
  buildDishTypeFilteredRestaurantRankings,
  buildGlobalCategoryRankings,
  buildGlobalDishEntryRankings,
  buildGlobalRestaurantRankings,
  buildRankingDetailEntries,
  filterEntriesByContext,
} from '../lib/ranking.js'
import { getScoreTone } from '../lib/scoring.js'

const TOP_LIMIT_OPTIONS = [5, 10, 25, 50]

const SHARE_CONTEXT_MAP = {
  private: 'mi_ranking',
  group: 'grupo',
  public: 'comunidad',
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function sortByName(items, accessor) {
  return [...items].sort((left, right) =>
    accessor(left).localeCompare(accessor(right), 'es'),
  )
}

function pushRecentDishTypeId(currentIds, nextId) {
  if (!nextId) {
    return currentIds
  }

  return [nextId, ...currentIds.filter((id) => id !== nextId)].slice(0, 5)
}

function buildInlineDetailState({
  activeCategory,
  activeCategoryDishType,
  activeGlobalView,
  activeMode,
  categories,
  currentContextEntries,
  dishTypes,
  expandedEntry,
  restaurants,
  selectedDishType,
  users,
}) {
  if (!expandedEntry) {
    return null
  }

  let matchingEntries = []
  let title = expandedEntry.primaryLabel ?? expandedEntry.restaurantName ?? 'Detalle'
  let subtitle = expandedEntry.secondaryLabel ?? ''

  if (activeMode === 'category') {
    matchingEntries = currentContextEntries.filter(
      (entry) =>
        entry.restaurant_id === expandedEntry.restaurantId &&
        entry.categoria_id === activeCategory?.id &&
        (!activeCategoryDishType?.id || entry.tipo_plato_id === activeCategoryDishType.id),
    )
    title = expandedEntry.restaurantName ?? title
    subtitle = activeCategoryDishType
      ? `${activeCategory?.icono ?? '🍽️'} ${activeCategoryDishType.nombre}`
      : `${activeCategory?.icono ?? '🍽️'} ${activeCategory?.nombre ?? 'Categoría'}`
  } else if (activeMode === 'dishType') {
    matchingEntries = currentContextEntries.filter(
      (entry) =>
        entry.restaurant_id === expandedEntry.restaurantId &&
        entry.tipo_plato_id === selectedDishType?.id,
    )
    title = expandedEntry.restaurantName ?? title
    subtitle = `${expandedEntry.categoryIcon ?? activeCategory?.icono ?? '🍽️'} ${selectedDishType?.nombre ?? 'Tipo de plato'}`
  } else if (activeGlobalView === 'restaurant') {
    matchingEntries = currentContextEntries.filter(
      (entry) => entry.restaurant_id === expandedEntry.restaurantId,
    )
    title = expandedEntry.restaurantName ?? title
    subtitle = 'Últimas y mejores entradas del restaurante'
  } else if (activeGlobalView === 'category') {
    matchingEntries = currentContextEntries.filter(
      (entry) => entry.categoria_id === expandedEntry.categoryId,
    )
    subtitle = `${expandedEntry.votos} entradas dentro de esta categoría`
  } else {
    matchingEntries = currentContextEntries.filter((entry) => entry.id === expandedEntry.id)
    subtitle = expandedEntry.secondaryLabel ?? 'Detalle de la entrada'
  }

  return {
    title,
    subtitle,
    topScore: expandedEntry.score,
    topVotes: expandedEntry.votos,
    detailEntries: buildRankingDetailEntries({
      categories,
      dishTypes,
      entries: matchingEntries,
      restaurants,
      users,
    }),
  }
}

export function RankingsScreen({ onOpenReport }) {
  const {
    activeFilterChips,
    activeFilters,
    applyFilters,
    availableFilterOptions,
    categories,
    currentGroup,
    currentUser,
    dishTypes,
    filterOrigin,
    filterOriginLabel,
    filteredDishEntries,
    hasActiveFilters,
    removeFilter,
    resetFilters,
    restaurants,
    users,
  } = useAppState()
  const [activeContext, setActiveContext] = useState('private')
  const [activeMode, setActiveMode] = useState('dishType')
  const [activeGlobalView, setActiveGlobalView] = useState('dish')
  const [topLimit, setTopLimit] = useState(10)
  const [activeCategoryId, setActiveCategoryId] = useState('')
  const [activeCategoryDishTypeId, setActiveCategoryDishTypeId] = useState('')
  const [dishTypeQuery, setDishTypeQuery] = useState('')
  const [selectedDishTypeId, setSelectedDishTypeId] = useState('')
  const [recentDishTypeIds, setRecentDishTypeIds] = usePersistentState(
    STORAGE_KEYS.rankingsRecentDishTypes,
    [],
  )
  const [expandedEntryId, setExpandedEntryId] = useState('')
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [shareStatus, setShareStatus] = useState({ tone: '', message: '' })
  const [isSharing, setIsSharing] = useState(false)
  const deferredDishTypeQuery = useDeferredValue(dishTypeQuery)

  const currentContextEntries = useMemo(
    () =>
      filterEntriesByContext(
        filteredDishEntries,
        activeContext,
        currentUser.id,
        currentGroup?.id ?? null,
      ),
    [activeContext, currentGroup?.id, currentUser.id, filteredDishEntries],
  )
  const sortedCategories = useMemo(
    () => sortByName(categories, (category) => category.nombre),
    [categories],
  )
  const allDishTypesSorted = useMemo(
    () => sortByName(dishTypes, (dishType) => dishType.nombre),
    [dishTypes],
  )
  const categoryDishTypes = useMemo(
    () =>
      sortByName(
        dishTypes.filter((dishType) => dishType.categoria_id === activeCategoryId),
        (dishType) => dishType.nombre,
      ),
    [activeCategoryId, dishTypes],
  )
  const currentContextDishTypeIds = useMemo(
    () => new Set(currentContextEntries.map((entry) => entry.tipo_plato_id)),
    [currentContextEntries],
  )
  const recentDishTypes = useMemo(
    () =>
      recentDishTypeIds
        .map((dishTypeId) => allDishTypesSorted.find((dishType) => dishType.id === dishTypeId))
        .filter(Boolean),
    [allDishTypesSorted, recentDishTypeIds],
  )
  const matchingDishTypes = useMemo(() => {
    const normalizedQuery = normalizeText(deferredDishTypeQuery)

    return allDishTypesSorted.filter((dishType) => {
      if (!normalizedQuery) {
        return true
      }

      return (
        normalizeText(dishType.nombre).includes(normalizedQuery) ||
        normalizeText(dishType.alias).includes(normalizedQuery)
      )
    })
  }, [allDishTypesSorted, deferredDishTypeQuery])
  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) ?? null,
    [activeCategoryId, categories],
  )
  const activeCategoryDishType = useMemo(
    () =>
      dishTypes.find((dishType) => dishType.id === activeCategoryDishTypeId) ?? null,
    [activeCategoryDishTypeId, dishTypes],
  )
  const selectedDishType = useMemo(
    () => dishTypes.find((dishType) => dishType.id === selectedDishTypeId) ?? null,
    [dishTypes, selectedDishTypeId],
  )
  const rankingEntries = useMemo(() => {
    if (activeMode === 'category') {
      return buildCategoryFilteredRestaurantRankings({
        categories,
        dishTypes,
        entries: currentContextEntries,
        restaurants,
        categoryId: activeCategoryId,
        dishTypeId: activeCategoryDishTypeId,
      })
    }

    if (activeMode === 'dishType') {
      return buildDishTypeFilteredRestaurantRankings({
        categories,
        dishTypes,
        entries: currentContextEntries,
        restaurants,
        dishTypeId: selectedDishTypeId,
      })
    }

    if (activeGlobalView === 'category') {
      return buildGlobalCategoryRankings({
        categories,
        entries: currentContextEntries,
      })
    }

    if (activeGlobalView === 'restaurant') {
      return buildGlobalRestaurantRankings({
        entries: currentContextEntries,
        restaurants,
      })
    }

    return buildGlobalDishEntryRankings({
      categories,
      dishTypes,
      entries: currentContextEntries,
      restaurants,
    })
  }, [
    activeCategoryDishTypeId,
    activeCategoryId,
    activeGlobalView,
    activeMode,
    categories,
    currentContextEntries,
    dishTypes,
    restaurants,
    selectedDishTypeId,
  ])
  const visibleRankingItems = useMemo(
    () => rankingEntries.slice(0, topLimit),
    [rankingEntries, topLimit],
  )
  const expandedEntry = useMemo(
    () => rankingEntries.find((entry) => entry.id === expandedEntryId) ?? null,
    [expandedEntryId, rankingEntries],
  )
  const expandedState = useMemo(
    () =>
      buildInlineDetailState({
        activeCategory,
        activeCategoryDishType,
        activeGlobalView,
        activeMode,
        categories,
        currentContextEntries,
        dishTypes,
        expandedEntry,
        restaurants,
        selectedDishType,
        users,
      }),
    [
      activeCategory,
      activeCategoryDishType,
      activeGlobalView,
      activeMode,
      categories,
      currentContextEntries,
      dishTypes,
      expandedEntry,
      restaurants,
      selectedDishType,
      users,
    ],
  )

  useEffect(() => {
    if (activeCategoryId || sortedCategories.length === 0) {
      return
    }

    setActiveCategoryId(sortedCategories[0].id)
  }, [activeCategoryId, sortedCategories])

  useEffect(() => {
    if (!activeCategoryDishTypeId) {
      return
    }

    const stillExists = categoryDishTypes.some(
      (dishType) => dishType.id === activeCategoryDishTypeId,
    )

    if (!stillExists) {
      setActiveCategoryDishTypeId('')
    }
  }, [activeCategoryDishTypeId, categoryDishTypes])

  useEffect(() => {
    if (selectedDishTypeId && allDishTypesSorted.some((dishType) => dishType.id === selectedDishTypeId)) {
      return
    }

    const nextDishTypeId =
      allDishTypesSorted.find((dishType) => currentContextDishTypeIds.has(dishType.id))?.id ??
      recentDishTypeIds.find((dishTypeId) =>
        allDishTypesSorted.some((dishType) => dishType.id === dishTypeId),
      ) ??
      allDishTypesSorted[0]?.id ??
      ''

    if (nextDishTypeId !== selectedDishTypeId) {
      setSelectedDishTypeId(nextDishTypeId)
    }
  }, [
    allDishTypesSorted,
    currentContextDishTypeIds,
    recentDishTypeIds,
    selectedDishTypeId,
  ])

  useEffect(() => {
    if (!expandedEntryId) {
      return
    }

    const stillVisible = rankingEntries.some((entry) => entry.id === expandedEntryId)

    if (!stillVisible) {
      setExpandedEntryId('')
    }
  }, [expandedEntryId, rankingEntries])

  function resetExpanded() {
    setExpandedEntryId('')
  }

  function handleSelectDishType(dishTypeId) {
    setSelectedDishTypeId(dishTypeId)
    setRecentDishTypeIds((currentIds) => pushRecentDishTypeId(currentIds, dishTypeId))
    resetExpanded()
  }

  async function handleShareRanking() {
    setShareStatus({ tone: '', message: '' })
    setIsSharing(true)

    try {
      const response = await createPublicShareToken({
        context: SHARE_CONTEXT_MAP[activeContext],
        ranking_type: activeMode === 'global' ? 'global' : activeMode,
        filters: {
          ...activeFilters,
        },
        group_id: activeContext === 'group' ? currentGroup?.id ?? null : null,
        created_by_user_id: currentUser.id,
      })
      const shareUrl = `${window.location.origin}/informe?share=${response.shareToken.token}`

      await navigator.clipboard.writeText(shareUrl)
      setShareStatus({
        tone: 'success',
        message: 'Guardado ✅ — Enlace público copiado al portapapeles.',
      })
    } catch (error) {
      setShareStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo compartir el ranking.'}`,
      })
    } finally {
      setIsSharing(false)
    }
  }

  function renderExpandedContent(entry) {
    const detailState =
      expandedEntry?.id === entry.id ? expandedState : buildInlineDetailState({
        activeCategory,
        activeCategoryDishType,
        activeGlobalView,
        activeMode,
        categories,
        currentContextEntries,
        dishTypes,
        expandedEntry: entry,
        restaurants,
        selectedDishType,
        users,
      })

    if (!detailState) {
      return null
    }

    return (
      <article className="surface-card ranking-inline-detail">
        <div className="ranking-inline-detail__header">
          <div>
            <strong>{detailState.title}</strong>
            <p>{detailState.subtitle}</p>
          </div>
          <span
            className={`ranking-card__score ranking-card__score--${getScoreTone(detailState.topScore)}`}
          >
            {formatScore(detailState.topScore)}
          </span>
        </div>

        <div className="ranking-inline-detail__meta">
          <span className="status-pill">
            {detailState.topVotes} valoraciones
          </span>
          {detailState.detailEntries.length > 0 ? (
            <span className="status-pill">
              {detailState.detailEntries.length} entradas en detalle
            </span>
          ) : null}
        </div>

        {detailState.detailEntries.length > 0 ? (
          <div className="ranking-inline-detail__list">
            {detailState.detailEntries.slice(0, 8).map((detailEntry) => (
              <article key={detailEntry.id} className="ranking-inline-entry">
                <div className="ranking-inline-entry__main">
                  <strong>{detailEntry.dishLabel}</strong>
                  <p>
                    {activeMode === 'global' && activeGlobalView === 'category'
                      ? `${detailEntry.restaurantName} · `
                      : ''}
                    {detailEntry.authorName} · {formatDate(detailEntry.created_at)}
                    {typeof detailEntry.precio_plato === 'number'
                      ? ` · ${formatRelativePrice(detailEntry.precio_plato)}`
                      : ''}
                  </p>
                  {detailEntry.notas ? (
                    <p className="ranking-inline-entry__note">{detailEntry.notas}</p>
                  ) : null}
                </div>
                <span
                  className={`ranking-card__score ranking-card__score--${getScoreTone(detailEntry.puntuacion_general)}`}
                >
                  {formatScore(detailEntry.puntuacion_general)}
                </span>
              </article>
            ))}
            {detailState.detailEntries.length > 8 ? (
              <p className="ranking-inline-detail__more">
                +{detailState.detailEntries.length - 8} entradas más en este contexto
              </p>
            ) : null}
          </div>
        ) : (
          <p className="ranking-inline-detail__empty">
            No se encontraron entradas compatibles con este bloque.
          </p>
        )}
      </article>
    )
  }

  return (
    <section className="screen" aria-label="Pantalla de rankings">
      {hasActiveFilters ? (
        <div className="chip-row" aria-label="Filtros activos">
          {activeFilterChips.map((chip) => (
            <button
              key={chip.id}
              className="chip chip--active"
              type="button"
              onClick={() => removeFilter(chip.filterKey, chip.value)}
            >
              {chip.label} ✕
            </button>
          ))}
        </div>
      ) : null}

      <div className="rankings-context-row" aria-label="Contexto del ranking">
        {RANKING_CONTEXTS.map((context) => (
          <button
            key={context.id}
            className={`rankings-context-chip${context.id === activeContext ? ' rankings-context-chip--active' : ''}`}
            type="button"
            aria-pressed={context.id === activeContext}
            onClick={() => {
              setActiveContext(context.id)
              resetExpanded()
            }}
          >
            {context.label}
          </button>
        ))}
      </div>

      <div className="rankings-mode-row" aria-label="Modo de ranking">
        {RANKING_MODES.map((mode) => (
          <button
            key={mode.id}
            className={`rankings-mode-chip${mode.id === activeMode ? ' rankings-mode-chip--active' : ''}`}
            type="button"
            aria-pressed={mode.id === activeMode}
            onClick={() => {
              setActiveMode(mode.id)
              resetExpanded()
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {activeMode === 'global' ? (
        <div className="rankings-submode-row" aria-label="Subvista global">
          {GLOBAL_RANKING_VIEWS.map((view) => (
            <button
              key={view.id}
              className={`rankings-submode-chip${view.id === activeGlobalView ? ' rankings-submode-chip--active' : ''}`}
              type="button"
              aria-pressed={view.id === activeGlobalView}
              onClick={() => {
                setActiveGlobalView(view.id)
                resetExpanded()
              }}
            >
              {view.label}
            </button>
          ))}
        </div>
      ) : null}

      {activeMode === 'category' ? (
        <div className="rankings-control-stack">
          <div className="rankings-category-grid" aria-label="Categorías">
            {sortedCategories.map((category) => (
              <button
                key={category.id}
                className={`rankings-category-card${category.id === activeCategoryId ? ' rankings-category-card--active' : ''}`}
                type="button"
                aria-pressed={category.id === activeCategoryId}
                onClick={() => {
                  setActiveCategoryId(category.id)
                  setActiveCategoryDishTypeId('')
                  resetExpanded()
                }}
              >
                <span aria-hidden="true">{category.icono}</span>
                {category.nombre}
              </button>
            ))}
          </div>

          <div className="rankings-filter-row" aria-label="Tipo de plato de la categoría">
            <button
              className={`rankings-filter-chip${!activeCategoryDishTypeId ? ' rankings-filter-chip--active' : ''}`}
              type="button"
              aria-pressed={!activeCategoryDishTypeId}
              onClick={() => {
                setActiveCategoryDishTypeId('')
                resetExpanded()
              }}
            >
              Todos
            </button>
            {categoryDishTypes.map((dishType) => (
              <button
                key={dishType.id}
                className={`rankings-filter-chip${dishType.id === activeCategoryDishTypeId ? ' rankings-filter-chip--active' : ''}`}
                type="button"
                aria-pressed={dishType.id === activeCategoryDishTypeId}
                onClick={() => {
                  setActiveCategoryDishTypeId(dishType.id)
                  resetExpanded()
                }}
              >
                {dishType.nombre}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {activeMode === 'dishType' ? (
        <div className="rankings-control-stack">
          {recentDishTypes.length > 0 ? (
            <div className="rankings-filter-row" aria-label="Tipos recientes">
              {recentDishTypes.map((dishType) => (
                <button
                  key={dishType.id}
                  className={`rankings-filter-chip${dishType.id === selectedDishTypeId ? ' rankings-filter-chip--active' : ''}`}
                  type="button"
                  aria-pressed={dishType.id === selectedDishTypeId}
                  onClick={() => handleSelectDishType(dishType.id)}
                >
                  {dishType.nombre}
                </button>
              ))}
            </div>
          ) : null}

          <label className="rankings-search-field">
            <span>Tipo de plato</span>
            <input
              type="search"
              placeholder="Buscar tipo de plato..."
              value={dishTypeQuery}
              onChange={(event) => setDishTypeQuery(event.target.value)}
            />
          </label>

          {matchingDishTypes.length > 0 ? (
            <div className="rankings-filter-row" aria-label="Resultados de búsqueda">
              {matchingDishTypes.slice(0, 12).map((dishType) => (
                <button
                  key={dishType.id}
                  className={`rankings-filter-chip${dishType.id === selectedDishTypeId ? ' rankings-filter-chip--active' : ''}`}
                  type="button"
                  aria-pressed={dishType.id === selectedDishTypeId}
                  onClick={() => handleSelectDishType(dishType.id)}
                >
                  {dishType.nombre}
                </button>
              ))}
            </div>
          ) : (
            <article className="surface-card rankings-empty-block">
              <strong>Sin coincidencias</strong>
              <p>Prueba con otro nombre o elimina parte de la búsqueda.</p>
            </article>
          )}
        </div>
      ) : null}

      <div className="ranking-swipe-surface">
        <div className="section-header rankings-top-header">
          <div className="rankings-top-header__main">
            <h2>Top</h2>
            <div className="rankings-top-limit" aria-label="Selector de Top N">
              {TOP_LIMIT_OPTIONS.map((limit) => (
                <button
                  key={limit}
                  className={`rankings-top-limit__button${limit === topLimit ? ' rankings-top-limit__button--active' : ''}`}
                  type="button"
                  aria-pressed={limit === topLimit}
                  onClick={() => setTopLimit(limit)}
                >
                  {limit}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="section-header__icon-button"
            aria-label="Abrir filtros"
            onClick={() => setIsFilterPanelOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 5h18" />
              <path d="M6 12h12" />
              <path d="M10 19h4" />
            </svg>
          </button>
        </div>

        <div className="pill-row">
          <button
            className="pill-button"
            type="button"
            onClick={() =>
              onOpenReport?.({
                contextId: activeContext,
                filters: activeFilters,
                filterOrigin,
                typeKey: activeMode === 'global' ? 'global' : activeMode,
              })
            }
          >
            Informe
          </button>
          <button
            className="pill-button"
            type="button"
            onClick={handleShareRanking}
            disabled={isSharing}
          >
            {isSharing ? 'Cargando...' : 'Compartir'}
          </button>
        </div>

        {shareStatus.message ? (
          <div className={`status-banner status-banner--${shareStatus.tone || 'info'}`}>
            <strong>{shareStatus.tone === 'success' ? 'Estado' : 'Revisión'}</strong>
            <p>{shareStatus.message}</p>
          </div>
        ) : null}

        {rankingEntries.length > 0 ? (
          <RankingList
            entries={visibleRankingItems}
            expandedEntryId={expandedEntryId}
            onToggle={(entry) =>
              setExpandedEntryId((currentId) => (currentId === entry.id ? '' : entry.id))
            }
            renderExpandedContent={renderExpandedContent}
          />
        ) : (
          <EmptyState
            className="rankings-empty-block"
            description="Sin datos para mostrar en este contexto."
            title="Rankings vacíos"
          />
        )}
      </div>

      {isFilterPanelOpen ? (
        <ModalSheet
          title="Filtros de rankings"
          onClose={() => setIsFilterPanelOpen(false)}
        >
          <FilterPanel
            availableOptions={availableFilterOptions}
            filterOriginLabel={filterOriginLabel}
            initialFilters={activeFilters}
            onApply={applyFilters}
            onClose={() => setIsFilterPanelOpen(false)}
            onReset={resetFilters}
          />
        </ModalSheet>
      ) : null}
    </section>
  )
}
