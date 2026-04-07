import { useMemo, useRef, useState } from 'react'
import { FilterPanel } from '../components/filters/FilterPanel.jsx'
import { ModalSheet } from '../components/layout/ModalSheet.jsx'
import { SectionHeader } from '../components/layout/SectionHeader.jsx'
import { RankingList } from '../components/rankings/RankingList.jsx'
import { useAppState } from '../hooks/useAppState.js'
import { formatDate, formatRelativePrice, formatScore } from '../lib/format.js'
import { RANKING_CONTEXTS, RANKING_TYPES } from '../lib/constants.js'
import { filterEntriesByContext } from '../lib/ranking.js'
import { getScoreTone } from '../lib/scoring.js'

const SWIPE_THRESHOLD = 56

const TYPE_MAP = {
  'Por categoría': 'category',
  'Por tipo de plato': 'dishType',
  Global: 'global',
  'Por restaurante': 'restaurant',
}

function getAdjacentRankingType(activeType, direction) {
  const currentIndex = RANKING_TYPES.indexOf(activeType)

  if (currentIndex === -1) {
    return activeType
  }

  const nextIndex = currentIndex + direction

  if (nextIndex < 0 || nextIndex >= RANKING_TYPES.length) {
    return activeType
  }

  return RANKING_TYPES[nextIndex]
}

function decorateDetailEntries(entries, { dishTypes, restaurants, users }) {
  return [...entries]
    .map((entry) => ({
      ...entry,
      authorName:
        users.find((user) => user.id === entry.created_by_user_id)?.nombre ?? 'Usuario',
      dishTypeName:
        dishTypes.find((dishType) => dishType.id === entry.tipo_plato_id)?.nombre ??
        entry.nombre_plato ??
        'Plato',
      restaurantName:
        restaurants.find((restaurant) => restaurant.id === entry.restaurant_id)?.nombre ??
        'Restaurante',
    }))
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
}

function buildDetailState({
  activeType,
  categories,
  currentContextEntries,
  dishTypes,
  restaurants,
  selectedEntry,
  users,
}) {
  if (!selectedEntry) {
    return null
  }

  let matchingEntries = []
  let title = selectedEntry.restaurantName
  let subtitle = ''

  if (activeType === 'Por tipo de plato') {
    matchingEntries = currentContextEntries.filter(
      (entry) =>
        entry.restaurant_id === selectedEntry.restaurantId &&
        entry.tipo_plato_id === selectedEntry.dishTypeId,
    )
    title = `${selectedEntry.restaurantName} · ${selectedEntry.dishTypeName}`
    subtitle = `${selectedEntry.categoryIcon} ${selectedEntry.categoryName} · ${selectedEntry.votos} votos`
  }

  if (activeType === 'Por categoría') {
    matchingEntries = currentContextEntries.filter(
      (entry) =>
        entry.restaurant_id === selectedEntry.restaurantId &&
        entry.categoria_id === selectedEntry.categoryId,
    )
    title = `${selectedEntry.restaurantName} · ${selectedEntry.categoryName}`
    subtitle = `${selectedEntry.categoryIcon} ${selectedEntry.votos} platos valorados`
  }

  if (activeType === 'Por restaurante') {
    matchingEntries = currentContextEntries.filter(
      (entry) => entry.restaurant_id === selectedEntry.restaurantId,
    )
    title = selectedEntry.restaurantName
    subtitle = `${selectedEntry.votos} platos valorados en este contexto`
  }

  if (activeType === 'Global') {
    matchingEntries = currentContextEntries.filter((entry) => entry.id === selectedEntry.id)
    title = `${selectedEntry.restaurantName} · ${selectedEntry.dishName || 'Entrada'}`
    subtitle = 'Detalle de la entrada individual'
  }

  const detailEntries = decorateDetailEntries(matchingEntries, {
    dishTypes,
    restaurants,
    users,
  })
  const heroCategory =
    categories.find((category) => category.id === selectedEntry.categoryId) ?? null

  return {
    detailEntries,
    subtitle,
    title,
    topScore: selectedEntry.score,
    topTone: getScoreTone(selectedEntry.score),
    topVotes: selectedEntry.votos,
    heroCategory,
  }
}

export function RankingsScreen() {
  const {
    activeFilterChips,
    activeFilters,
    applyFilters,
    availableFilterOptions,
    categories,
    currentGroup,
    currentUser,
    dishTypes,
    filterOriginLabel,
    filteredDishEntries,
    filteredRankingContexts,
    filtersCount,
    hasActiveFilters,
    removeFilter,
    resetFilters,
    restaurants,
    users,
  } = useAppState()
  const [activeContext, setActiveContext] = useState('private')
  const [activeType, setActiveType] = useState('Por tipo de plato')
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [selectedRankingEntry, setSelectedRankingEntry] = useState(null)
  const touchStartXRef = useRef(0)
  const isSwipeGestureRef = useRef(false)

  const rankingItems =
    filteredRankingContexts[activeContext]?.[TYPE_MAP[activeType]] ?? []
  const currentContextEntries = useMemo(
    () =>
      filterEntriesByContext(
        filteredDishEntries,
        activeContext,
        currentUser.id,
        currentGroup.id,
      ),
    [activeContext, currentGroup.id, currentUser.id, filteredDishEntries],
  )
  const detailState = useMemo(
    () =>
      buildDetailState({
        activeType,
        categories,
        currentContextEntries,
        dishTypes,
        restaurants,
        selectedEntry: selectedRankingEntry,
        users,
      }),
    [
      activeType,
      categories,
      currentContextEntries,
      dishTypes,
      restaurants,
      selectedRankingEntry,
      users,
    ],
  )

  function handleSwipeStart(event) {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? 0
    isSwipeGestureRef.current = false
  }

  function handleSwipeEnd(event) {
    const endX = event.changedTouches[0]?.clientX ?? 0
    const deltaX = endX - touchStartXRef.current

    if (Math.abs(deltaX) < SWIPE_THRESHOLD) {
      return
    }

    isSwipeGestureRef.current = true
    setActiveType((current) => {
      const nextType = getAdjacentRankingType(current, deltaX < 0 ? 1 : -1)

      if (nextType !== current) {
        setSelectedRankingEntry(null)
      }

      return nextType
    })
    window.setTimeout(() => {
      isSwipeGestureRef.current = false
    }, 120)
  }

  return (
    <section className="screen" aria-label="Pantalla de rankings">
      <article className="screen__hero">
        <h2>Rankings en 2 toques</h2>
        <p>
          Los rankings ya respetan filtros persistentes por categoría, tipo,
          año, autor, precio, zona, foto y puntuación mínima.
        </p>
      </article>

      <div className="screen-note">{rankingItems.length} resultados encontrados</div>

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

      <div className="pill-row">
        {RANKING_CONTEXTS.map((context) => (
          <button
            key={context.id}
            className={`pill-button${context.id === activeContext ? ' chip chip--active' : ''}`}
            type="button"
            onClick={() => {
              setSelectedRankingEntry(null)
              setActiveContext(context.id)
            }}
          >
            {context.label}
          </button>
        ))}
      </div>

      <div
        className="ranking-swipe-surface"
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
      >
        <div className="chip-row">
          {RANKING_TYPES.map((type) => (
          <button
            key={type}
            className={`chip${type === activeType ? ' chip--active' : ''}`}
            type="button"
            onClick={() => {
              setSelectedRankingEntry(null)
              setActiveType(type)
            }}
          >
            {type}
          </button>
          ))}
        </div>

        <p className="ranking-swipe-hint">
          Desliza horizontalmente sobre este bloque para cambiar de tipo de ranking.
        </p>

        <SectionHeader
          title="Top actual"
          actionLabel={filtersCount > 0 ? `Filtrar (${filtersCount})` : 'Filtrar'}
          onAction={() => setIsFilterPanelOpen(true)}
        />
        <RankingList
          entries={rankingItems}
          onSelect={(entry) => {
            if (isSwipeGestureRef.current) {
              return
            }

            setSelectedRankingEntry(entry)
          }}
        />
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

      {selectedRankingEntry && detailState ? (
        <ModalSheet
          title="Detalle del ranking"
          onClose={() => setSelectedRankingEntry(null)}
        >
          <div className="detail-stack">
            <article className="surface-card">
              <div className="ranking-card__meta">
                <div>
                  <strong>{detailState.title}</strong>
                  <p>{detailState.subtitle}</p>
                </div>
                <span
                  className={`ranking-card__score ranking-card__score--${detailState.topTone}`}
                >
                  {formatScore(detailState.topScore)}
                </span>
              </div>
              <p>
                {detailState.topVotes} votos en el contexto seleccionado.
                {detailState.heroCategory
                  ? ` Categoría: ${detailState.heroCategory.icono} ${detailState.heroCategory.nombre}.`
                  : ''}
              </p>
            </article>

            {detailState.detailEntries.length > 0 ? (
              detailState.detailEntries.map((entry) => (
                <article key={entry.id} className="surface-card">
                  <div className="ranking-card__meta">
                    <div>
                      <strong>{entry.dishTypeName}</strong>
                      <p>
                        {entry.authorName} • {formatDate(entry.created_at)} •{' '}
                        {entry.visibility}
                      </p>
                    </div>
                    <span
                      className={`ranking-card__score ranking-card__score--${getScoreTone(entry.puntuacion_general)}`}
                    >
                      {formatScore(entry.puntuacion_general)}
                    </span>
                  </div>

                  <div className="detail-grid">
                    <span className="status-pill">Sabor {formatScore(entry.sabor)}</span>
                    <span className="status-pill">
                      Textura {formatScore(entry.textura)}
                    </span>
                    <span className="status-pill">
                      Presentación {formatScore(entry.presentacion)}
                    </span>
                    <span className="status-pill">
                      Calidad/precio {formatScore(entry.calidad_precio)}
                    </span>
                  </div>

                  <p>
                    Precio del plato: {formatRelativePrice(entry.precio_plato)}
                  </p>
                  {entry.notas ? <p>{entry.notas}</p> : null}
                  {entry.foto_url ? (
                    <a href={entry.foto_url} target="_blank" rel="noreferrer">
                      Ver foto
                    </a>
                  ) : null}
                </article>
              ))
            ) : (
              <article className="surface-card">
                <strong>Sin entradas detalladas</strong>
                <p>No se encontraron entradas compatibles con este ranking filtrado.</p>
              </article>
            )}
          </div>
        </ModalSheet>
      ) : null}
    </section>
  )
}
