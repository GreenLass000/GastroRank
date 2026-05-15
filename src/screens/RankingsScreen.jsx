import './RankingsScreen.css'
import { EmptyState } from '../components/feedback/EmptyState.jsx'
import { FilterPanel } from '../components/filters/FilterPanel.jsx'
import { useRankingsController } from '../hooks/useRankingsController.js'
import { ModalSheet } from '../components/layout/ModalSheet.jsx'
import { RankingList } from '../components/rankings/RankingList.jsx'
import { GLOBAL_RANKING_VIEWS, RANKING_CONTEXTS, RANKING_MODES } from '../lib/constants.js'
import { formatDate, formatRelativePrice, formatScore } from '../lib/format.js'
import { getScoreTone } from '../lib/scoring.js'

export function RankingsScreen({ onOpenReport }) {
  const {
    activeCategoryDishTypeId,
    activeCategoryId,
    activeContext,
    activeFilters,
    activeFilterChips,
    activeGlobalView,
    activeGroup,
    activeMode,
    applyFilters,
    availableFilterOptions,
    categoryDishTypes,
    closeActionSheet,
    closeFilterPanel,
    dishTypeQuery,
    filterOriginLabel,
    getExpandedDetailState,
    groupsForCurrentUser,
    handleCopyShareLink,
    handleOpenReport,
    handleSelectDishType,
    hasActiveFilters,
    isActionSheetOpen,
    isFilterPanelOpen,
    isGroupContextEmpty,
    isSharing,
    matchingDishTypes,
    openActionSheet,
    openFilterPanel,
    rankingEntries,
    recentDishTypes,
    removeFilter,
    resetFilters,
    selectedDishTypeId,
    selectedGroupId,
    setDishTypeQuery,
    expandedEntryId,
    setExpandedEntryId,
    setQueryState,
    shareStatus,
    shouldShowGroupSelector,
    sortedCategories,
    topLimit,
    topLimitOptions,
    toggleExpandedEntry,
    visibleRankingItems,
  } = useRankingsController({ onOpenReport })

  function renderExpandedContent(entry) {
    const detailState = getExpandedDetailState(entry)

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
    <section className="screen rankings-screen" aria-label="Pantalla de rankings">
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
              setQueryState({ activeContext: context.id })
              setExpandedEntryId('')
            }}
          >
            {context.label}
          </button>
        ))}
      </div>

      {activeContext === 'group' && !isGroupContextEmpty ? (
        <article className="rankings-group-card">
          <div className="rankings-group-card__header">
            <div>
              <strong>Grupo del ranking</strong>
              <p>Elige qué mesa compartida quieres usar como contexto.</p>
            </div>
            <span className="rankings-group-card__pill">
              {groupsForCurrentUser.length} grupo{groupsForCurrentUser.length === 1 ? '' : 's'}
            </span>
          </div>

          {shouldShowGroupSelector ? (
            <select
              className="rankings-group-card__select"
              value={selectedGroupId}
              onChange={(event) => {
                setQueryState({ selectedGroupId: event.target.value })
                setExpandedEntryId('')
              }}
            >
              {groupsForCurrentUser.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.nombre}
                </option>
              ))}
            </select>
          ) : (
            <strong>{activeGroup?.nombre ?? 'Tu grupo activo'}</strong>
          )}
        </article>
      ) : null}

      {isGroupContextEmpty ? (
        <article className="rankings-empty-group">
          <strong>Sin grupos disponibles</strong>
          <p>Únete o crea uno para comparar el ranking con tu gente.</p>
        </article>
      ) : null}

      <div className="rankings-mode-row" aria-label="Modo de ranking">
        {RANKING_MODES.map((mode) => (
          <button
            key={mode.id}
            className={`rankings-mode-chip${mode.id === activeMode ? ' rankings-mode-chip--active' : ''}`}
            type="button"
            aria-pressed={mode.id === activeMode}
            onClick={() => {
              setQueryState({ activeMode: mode.id })
              setExpandedEntryId('')
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
                setQueryState({ activeGlobalView: view.id })
                setExpandedEntryId('')
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
                  setQueryState({
                    activeCategoryId: category.id,
                    activeCategoryDishTypeId: '',
                  })
                  setExpandedEntryId('')
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
                setQueryState({ activeCategoryDishTypeId: '' })
                setExpandedEntryId('')
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
                  setQueryState({ activeCategoryDishTypeId: dishType.id })
                  setExpandedEntryId('')
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
        <div className="rankings-toolbar">
          <div className="rankings-toolbar__main">
            <p className="rankings-toolbar__eyebrow">Resumen rápido</p>
            <div className="rankings-toolbar__topline">
              <h2>Top</h2>
              {activeContext === 'group' && activeGroup ? (
                <span className="status-pill">{activeGroup.nombre}</span>
              ) : null}
            </div>
            <div className="rankings-top-limit" aria-label="Selector de Top N">
              {topLimitOptions.map((limit) => (
                <button
                  key={limit}
                  className={`rankings-top-limit__button${limit === topLimit ? ' rankings-top-limit__button--active' : ''}`}
                  type="button"
                  aria-pressed={limit === topLimit}
                  onClick={() => setQueryState({ topLimit: limit })}
                >
                  {limit}
                </button>
              ))}
            </div>
          </div>

          <div className="rankings-toolbar__actions">
            <button
              type="button"
              className="rankings-share-trigger"
              onClick={openActionSheet}
            >
              <strong>Lo que más me gusta</strong>
              <span>Informe y enlace público</span>
            </button>

            <button
              type="button"
              className="section-header__icon-button"
              aria-label="Abrir filtros"
              onClick={openFilterPanel}
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
            onToggle={toggleExpandedEntry}
            renderExpandedContent={renderExpandedContent}
          />
        ) : (
          <EmptyState
            className="rankings-empty-block"
            description={
              activeContext === 'group' && !activeGroup
                ? 'Selecciona un grupo para empezar a comparar.'
                : 'Sin datos para mostrar en este contexto.'
            }
            title={activeContext === 'group' && !activeGroup ? 'Elige un grupo' : 'Rankings vacíos'}
          />
        )}
      </div>

      {isActionSheetOpen ? (
        <ModalSheet title="Lo que más me gusta" onClose={closeActionSheet}>
          <div className="rankings-action-sheet__panel">
            <p className="rankings-action-sheet__intro">
              Guarda una versión imprimible o copia un enlace público del ranking actual.
            </p>

            <div className="rankings-action-sheet__actions">
              <button
                className="rankings-action-button rankings-action-button--accent"
                type="button"
                onClick={handleOpenReport}
              >
                <strong>Ver informe</strong>
                <span>Abre el resumen listo para revisar o imprimir.</span>
              </button>

              <button
                className="rankings-action-button"
                type="button"
                onClick={handleCopyShareLink}
                disabled={isSharing}
              >
                <strong>{isSharing ? 'Cargando...' : 'Copiar enlace'}</strong>
                <span>Genera un acceso público del ranking que estás viendo ahora.</span>
              </button>
            </div>
          </div>
        </ModalSheet>
      ) : null}

      {isFilterPanelOpen ? (
        <ModalSheet title="Filtros de rankings" onClose={closeFilterPanel}>
          <FilterPanel
            availableOptions={availableFilterOptions}
            filterOriginLabel={filterOriginLabel}
            initialFilters={activeFilters}
            onApply={applyFilters}
            onClose={closeFilterPanel}
            onReset={resetFilters}
          />
        </ModalSheet>
      ) : null}
    </section>
  )
}
