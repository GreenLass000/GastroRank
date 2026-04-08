import { useMemo, useState } from 'react'
import { useAppState } from '../hooks/useAppState.js'
import {
  buildActiveFilterChips,
  filterDishEntries,
  normalizeFilters,
} from '../lib/filters.js'
import {
  formatDate,
  formatRelativePrice,
  formatScore,
} from '../lib/format.js'
import {
  buildCategoryRankings,
  buildDishTypeRankings,
  buildGlobalRankings,
  buildRestaurantRankings,
} from '../lib/ranking.js'
import { calculateAverageScore } from '../lib/scoring.js'

const TYPE_LABELS = {
  category: 'Por categoría',
  dishType: 'Por tipo de plato',
  global: 'Global',
  restaurant: 'Por restaurante',
}

const CONTEXT_LABELS = {
  private: 'Mi ranking',
  group: 'Mi grupo',
  public: 'Comunidad',
}

const SHARE_CONTEXT_TO_APP_CONTEXT = {
  mi_ranking: 'private',
  grupo: 'group',
  comunidad: 'public',
}

function buildFilteredRestaurants(restaurants, filteredEntries) {
  const filteredRestaurantIds = new Set(
    filteredEntries.map((entry) => entry.restaurant_id),
  )

  return restaurants
    .filter((restaurant) => filteredRestaurantIds.has(restaurant.id))
    .map((restaurant) => {
      const restaurantEntries = filteredEntries.filter(
        (entry) => entry.restaurant_id === restaurant.id,
      )

      return {
        ...restaurant,
        restaurant_score: calculateAverageScore(restaurantEntries),
        total_entries: restaurantEntries.length,
      }
    })
}

function buildReportData({
  categories,
  currentGroupId,
  currentUserId,
  dishEntries,
  dishTypes,
  filters,
  filterOrigin,
  restaurants,
  typeKey,
  users,
}) {
  const restaurantsById = Object.fromEntries(
    restaurants.map((restaurant) => [restaurant.id, restaurant]),
  )
  const normalizedFilters = normalizeFilters(filters, dishTypes)
  const filteredEntries = filterDishEntries({
    dishTypes,
    entries: dishEntries,
    filters: normalizedFilters,
    filterOrigin,
    restaurantsById,
  })
  const filteredRestaurants = buildFilteredRestaurants(restaurants, filteredEntries)
  const activeFilterChips = buildActiveFilterChips({
    categories,
    dishTypes,
    filters: normalizedFilters,
    users,
  })
  const rankingBuilders = {
    category: buildCategoryRankings,
    dishType: buildDishTypeRankings,
    global: buildGlobalRankings,
    restaurant: buildRestaurantRankings,
  }
  const rankingItems = rankingBuilders[typeKey]({
    categories,
    currentGroupId,
    currentUserId,
    dishTypes,
    entries: filteredEntries,
    restaurants: filteredRestaurants,
    contextId: filters.contextId,
  })
  const latestEntries = [...filteredEntries]
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
    .slice(0, 8)
    .map((entry) => ({
      ...entry,
      restaurantName:
        restaurants.find((restaurant) => restaurant.id === entry.restaurant_id)?.nombre ??
        'Restaurante',
      dishTypeName:
        dishTypes.find((dishType) => dishType.id === entry.tipo_plato_id)?.nombre ??
        'Plato',
      authorName:
        users.find((user) => user.id === entry.created_by_user_id)?.nombre ?? 'Usuario',
    }))

  const scoreBreakdown = filteredEntries.reduce(
    (acc, entry) => {
      const fields = ['sabor', 'textura', 'presentacion', 'calidad_precio']

      fields.forEach((field) => {
        if (typeof entry[field] === 'number') {
          acc[field].total += entry[field]
          acc[field].count += 1
        }
      })

      return acc
    },
    {
      sabor: { total: 0, count: 0 },
      textura: { total: 0, count: 0 },
      presentacion: { total: 0, count: 0 },
      calidad_precio: { total: 0, count: 0 },
    },
  )

  return {
    activeFilterChips,
    filteredEntries,
    filteredRestaurants,
    latestEntries,
    rankingItems,
    scoreBreakdown,
  }
}

function buildRankingEntityTarget(item, typeKey) {
  if (typeKey === 'restaurant') {
    return { type: 'restaurant', id: item.restaurantId }
  }

  if (typeKey === 'global') {
    return { type: 'dishEntry', id: item.id }
  }

  if (typeKey === 'category') {
    return { type: 'category', id: item.categoryId }
  }

  if (typeKey === 'dishType') {
    return { type: 'dishType', id: item.dishTypeId }
  }

  return null
}

export function ReportScreen({
  onBack,
  onOpenEntity,
  reportConfig = null,
  sharePayload = null,
}) {
  const appState = useAppState()
  const [topLimit, setTopLimit] = useState(10)

  const resolvedConfig = reportConfig ?? {
    contextId: sharePayload
      ? SHARE_CONTEXT_TO_APP_CONTEXT[sharePayload.shareToken.context]
      : 'private',
    filterOrigin: sharePayload?.shareToken.filters?.filterOrigin ?? appState.filterOrigin,
    filters: sharePayload?.shareToken.filters ?? appState.activeFilters,
    typeKey: sharePayload?.shareToken.ranking_type ?? 'restaurant',
  }

  const reportData = useMemo(
    () =>
      buildReportData(
        sharePayload
          ? {
              categories: sharePayload.bootstrap.categories,
              currentGroupId: sharePayload.shareToken.group_id ?? null,
              currentUserId: sharePayload.shareToken.created_by_user_id,
              dishEntries: sharePayload.bootstrap.dishEntries,
              dishTypes: sharePayload.bootstrap.dishTypes,
              filters: {
                ...(sharePayload.shareToken.filters ?? {}),
                contextId:
                  SHARE_CONTEXT_TO_APP_CONTEXT[sharePayload.shareToken.context],
              },
              filterOrigin:
                sharePayload.shareToken.filters?.filterOrigin ?? appState.filterOrigin,
              restaurants: sharePayload.bootstrap.restaurants,
              typeKey: sharePayload.shareToken.ranking_type,
              users: sharePayload.bootstrap.users,
            }
          : {
              categories: appState.categories,
              currentGroupId: appState.currentGroup?.id ?? null,
              currentUserId: appState.currentUser.id,
              dishEntries: appState.dishEntries,
              dishTypes: appState.dishTypes,
              filters: {
                ...appState.activeFilters,
                contextId: resolvedConfig.contextId,
              },
              filterOrigin: resolvedConfig.filterOrigin ?? appState.filterOrigin,
              restaurants: appState.restaurants,
              typeKey: resolvedConfig.typeKey,
              users: appState.users,
            },
      ),
    [
      appState.activeFilters,
      appState.categories,
      appState.currentGroup?.id,
      appState.currentUser.id,
      appState.dishEntries,
      appState.dishTypes,
      appState.filterOrigin,
      appState.restaurants,
      appState.users,
      resolvedConfig.contextId,
      resolvedConfig.filterOrigin,
      resolvedConfig.typeKey,
      sharePayload,
    ],
  )

  const contextLabel = CONTEXT_LABELS[resolvedConfig.contextId] ?? 'Informe'
  const typeLabel = TYPE_LABELS[resolvedConfig.typeKey] ?? 'Ranking'
  const dateRange =
    reportData.filteredEntries.length > 0
      ? {
          from: formatDate(
            [...reportData.filteredEntries].sort(
              (left, right) => new Date(left.fecha) - new Date(right.fecha),
            )[0].fecha,
          ),
          to: formatDate(
            [...reportData.filteredEntries].sort(
              (left, right) => new Date(right.fecha) - new Date(left.fecha),
            )[0].fecha,
          ),
        }
      : null

  return (
    <section className="screen report-screen" aria-label="Pantalla de informe">
      <article className="screen__hero report-screen__hero">
        <p className="eyebrow">Informe imprimible</p>
        <h2>{sharePayload ? 'Enlace público' : 'Informe del ranking'}</h2>
        <p>
          {contextLabel} · {typeLabel}
        </p>
        {sharePayload ? (
          <p>
            Compartido el {formatDate(sharePayload.shareToken.created_at)} en modo
            solo lectura.
          </p>
        ) : null}
      </article>

      <div className="report-actions no-print">
        {onBack ? (
          <button className="pill-button" type="button" onClick={onBack}>
            Volver
          </button>
        ) : null}
        <button className="pill-button" type="button" onClick={() => setTopLimit(10)}>
          Top 10
        </button>
        <button className="pill-button" type="button" onClick={() => setTopLimit(20)}>
          Top 20
        </button>
        <button className="primary-button" type="button" onClick={() => window.print()}>
          Imprimir
        </button>
      </div>

      {reportData.activeFilterChips.length > 0 ? (
        <div className="chip-row no-print" aria-label="Filtros activos del informe">
          {reportData.activeFilterChips.map((chip) => (
            <span key={chip.id} className="chip chip--active">
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="stat-grid report-grid">
        <article className="stat-card">
          <strong>{reportData.rankingItems.length}</strong>
          <span>Posiciones</span>
        </article>
        <article className="stat-card">
          <strong>{reportData.filteredRestaurants.length}</strong>
          <span>Restaurantes</span>
        </article>
        <article className="stat-card">
          <strong>{reportData.filteredEntries.length}</strong>
          <span>Entradas</span>
        </article>
        <article className="stat-card">
          <strong>{dateRange ? `${dateRange.from} → ${dateRange.to}` : 'Sin datos'}</strong>
          <span>Rango</span>
        </article>
      </div>

      <article className="surface-card">
        <div className="section-header">
          <h2>Resumen</h2>
        </div>
        <p>
          El informe cubre {reportData.filteredEntries.length} valoraciones sobre{' '}
          {reportData.filteredRestaurants.length} restaurantes en el contexto{' '}
          {contextLabel.toLowerCase()}.
        </p>
        <div className="detail-grid">
          <span className="status-pill">
            Sabor{' '}
            {formatScore(
              reportData.scoreBreakdown.sabor.count
                ? reportData.scoreBreakdown.sabor.total /
                    reportData.scoreBreakdown.sabor.count
                : 0,
            )}
          </span>
          <span className="status-pill">
            Textura{' '}
            {formatScore(
              reportData.scoreBreakdown.textura.count
                ? reportData.scoreBreakdown.textura.total /
                    reportData.scoreBreakdown.textura.count
                : 0,
            )}
          </span>
          <span className="status-pill">
            Presentación{' '}
            {formatScore(
              reportData.scoreBreakdown.presentacion.count
                ? reportData.scoreBreakdown.presentacion.total /
                    reportData.scoreBreakdown.presentacion.count
                : 0,
            )}
          </span>
          <span className="status-pill">
            Calidad/precio{' '}
            {formatScore(
              reportData.scoreBreakdown.calidad_precio.count
                ? reportData.scoreBreakdown.calidad_precio.total /
                    reportData.scoreBreakdown.calidad_precio.count
                : 0,
            )}
          </span>
        </div>
      </article>

      <article className="surface-card">
        <div className="section-header">
          <h2>Top del informe</h2>
        </div>
        <div className="list-stack">
          {reportData.rankingItems.slice(0, topLimit).map((item, index) => {
            const entityTarget = buildRankingEntityTarget(item, resolvedConfig.typeKey)
            return (
              <button
                key={item.id}
                className="list-card report-card list-card--button"
                type="button"
                onClick={() => {
                  if (!sharePayload && entityTarget) {
                    onOpenEntity?.(entityTarget)
                  }
                }}
              >
                <div className="ranking-card__meta">
                  <div>
                    <strong>
                      #{index + 1} {item.restaurantName}
                    </strong>
                    <p>
                      {item.dishTypeName ?? item.categoryName ?? item.dishName ?? 'Ranking'} •{' '}
                      {item.votos} votos
                    </p>
                  </div>
                  <span className="ranking-card__score ranking-card__score--good">
                    {formatScore(item.score)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </article>

      <article className="surface-card">
        <div className="section-header">
          <h2>Últimas entradas incluidas</h2>
        </div>
        <div className="list-stack">
          {reportData.latestEntries.map((entry) => (
            <button
              key={entry.id}
              className="list-card report-card list-card--button"
              type="button"
              onClick={() => {
                if (!sharePayload) {
                  onOpenEntity?.({ type: 'dishEntry', id: entry.id })
                }
              }}
            >
              <strong>{entry.dishTypeName}</strong>
              <p>
                {entry.restaurantName} • {entry.authorName} •{' '}
                {formatDate(entry.created_at)}
              </p>
              <p>
                {formatScore(entry.puntuacion_general)} •{' '}
                {formatRelativePrice(entry.precio_plato)}
              </p>
            </button>
          ))}
        </div>
      </article>
    </section>
  )
}
