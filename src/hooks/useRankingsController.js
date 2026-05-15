import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAppState } from './useAppState.js'
import { usePersistentState } from './usePersistentState.js'
import { usePublicShare } from './usePublicShare.js'
import { useScreenQueryState } from './useScreenQueryState.js'
import {
  GLOBAL_RANKING_VIEWS,
  RANKING_CONTEXTS,
  RANKING_MODES,
  STORAGE_KEYS,
} from '../lib/constants.js'
import {
  buildCategoryFilteredRestaurantRankings,
  buildDishTypeFilteredRestaurantRankings,
  buildGlobalCategoryRankings,
  buildGlobalDishEntryRankings,
  buildGlobalRestaurantRankings,
  buildRankingDetailEntries,
  filterEntriesByContext,
} from '../lib/ranking.js'

export const TOP_LIMIT_OPTIONS = [5, 10, 25, 50]

const SHARE_CONTEXT_MAP = {
  private: 'mi_ranking',
  group: 'grupo',
  public: 'comunidad',
}

const RANKINGS_QUERY_SCHEMA = {
  activeContext: {
    queryKey: 'rk_ctx',
    defaultValue: 'private',
    parse: (value) =>
      RANKING_CONTEXTS.some((context) => context.id === value) ? value : 'private',
  },
  selectedGroupId: {
    queryKey: 'rk_grp',
    defaultValue: '',
  },
  activeMode: {
    queryKey: 'rk_mode',
    defaultValue: 'dishType',
    parse: (value) =>
      RANKING_MODES.some((mode) => mode.id === value) ? value : 'dishType',
  },
  activeGlobalView: {
    queryKey: 'rk_sub',
    defaultValue: 'dish',
    parse: (value) =>
      GLOBAL_RANKING_VIEWS.some((view) => view.id === value) ? value : 'dish',
  },
  topLimit: {
    queryKey: 'rk_top',
    defaultValue: 10,
    parse: (value) => {
      const parsed = Number.parseInt(value, 10)
      return TOP_LIMIT_OPTIONS.includes(parsed) ? parsed : 10
    },
  },
  activeCategoryId: {
    queryKey: 'rk_cat',
    defaultValue: '',
  },
  activeCategoryDishTypeId: {
    queryKey: 'rk_cat_type',
    defaultValue: '',
  },
  selectedDishTypeId: {
    queryKey: 'rk_type',
    defaultValue: '',
  },
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

export function useRankingsController({ onOpenReport }) {
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
    groupsForCurrentUser,
    hasActiveFilters,
    removeFilter,
    resetFilters,
    restaurants,
    users,
  } = useAppState()
  const [queryState, setQueryState] = useScreenQueryState(RANKINGS_QUERY_SCHEMA)
  const [dishTypeQuery, setDishTypeQuery] = useState('')
  const [expandedEntryId, setExpandedEntryId] = useState('')
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false)
  const [recentDishTypeIds, setRecentDishTypeIds] = usePersistentState(
    STORAGE_KEYS.rankingsRecentDishTypes,
    [],
  )
  const deferredDishTypeQuery = useDeferredValue(dishTypeQuery)
  const { clearShareStatus, copyPublicShareLink, isSharing, shareStatus } = usePublicShare()
  const {
    activeCategoryDishTypeId,
    activeCategoryId,
    activeContext,
    activeGlobalView,
    activeMode,
    selectedDishTypeId,
    selectedGroupId,
    topLimit,
  } = queryState

  const sortedGroups = useMemo(
    () => sortByName(groupsForCurrentUser, (group) => group.nombre),
    [groupsForCurrentUser],
  )
  const effectiveGroupId = useMemo(() => {
    if (selectedGroupId && sortedGroups.some((group) => group.id === selectedGroupId)) {
      return selectedGroupId
    }

    return currentGroup?.id ?? sortedGroups[0]?.id ?? ''
  }, [currentGroup?.id, selectedGroupId, sortedGroups])
  const activeGroup = useMemo(
    () => sortedGroups.find((group) => group.id === effectiveGroupId) ?? null,
    [effectiveGroupId, sortedGroups],
  )
  const currentContextEntries = useMemo(
    () =>
      filterEntriesByContext(
        filteredDishEntries,
        activeContext,
        currentUser?.id ?? '',
        effectiveGroupId || null,
      ),
    [activeContext, currentUser?.id, effectiveGroupId, filteredDishEntries],
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
    if (activeMode !== 'category' || sortedCategories.length === 0) {
      return
    }

    const activeCategoryExists = sortedCategories.some(
      (category) => category.id === activeCategoryId,
    )

    if (!activeCategoryExists) {
      setQueryState({ activeCategoryId: sortedCategories[0].id })
    }
  }, [activeCategoryId, activeMode, setQueryState, sortedCategories])

  useEffect(() => {
    if (!activeCategoryDishTypeId) {
      return
    }

    const stillExists = categoryDishTypes.some(
      (dishType) => dishType.id === activeCategoryDishTypeId,
    )

    if (!stillExists) {
      setQueryState({ activeCategoryDishTypeId: '' })
    }
  }, [activeCategoryDishTypeId, categoryDishTypes, setQueryState])

  useEffect(() => {
    if (activeMode !== 'dishType') {
      return
    }

    if (
      selectedDishTypeId &&
      allDishTypesSorted.some((dishType) => dishType.id === selectedDishTypeId)
    ) {
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
      setQueryState({ selectedDishTypeId: nextDishTypeId })
    }
  }, [
    activeMode,
    allDishTypesSorted,
    currentContextDishTypeIds,
    recentDishTypeIds,
    selectedDishTypeId,
    setQueryState,
  ])

  useEffect(() => {
    if (activeContext !== 'group') {
      return
    }

    const nextGroupId = currentGroup?.id ?? sortedGroups[0]?.id ?? ''

    if (!selectedGroupId && nextGroupId) {
      setQueryState({ selectedGroupId: nextGroupId })
      return
    }

    if (selectedGroupId && !sortedGroups.some((group) => group.id === selectedGroupId)) {
      setQueryState({ selectedGroupId: nextGroupId })
    }
  }, [activeContext, currentGroup?.id, selectedGroupId, setQueryState, sortedGroups])

  const resetExpanded = useCallback(() => {
    setExpandedEntryId('')
  }, [])

  const openActionSheet = useCallback(() => {
    setIsActionSheetOpen(true)
  }, [])

  const closeActionSheet = useCallback(() => {
    setIsActionSheetOpen(false)
  }, [])

  const openFilterPanel = useCallback(() => {
    setIsFilterPanelOpen(true)
  }, [])

  const closeFilterPanel = useCallback(() => {
    setIsFilterPanelOpen(false)
  }, [])

  const handleSelectDishType = useCallback(
    (dishTypeId) => {
      setQueryState({ selectedDishTypeId: dishTypeId })
      setRecentDishTypeIds((currentIds) => pushRecentDishTypeId(currentIds, dishTypeId))
      resetExpanded()
    },
    [resetExpanded, setQueryState, setRecentDishTypeIds],
  )

  const handleCopyShareLink = useCallback(async () => {
    const shareUrl = await copyPublicShareLink({
      context: SHARE_CONTEXT_MAP[activeContext],
      filters: activeFilters,
      groupId: activeContext === 'group' ? effectiveGroupId || null : null,
      rankingType: activeMode === 'global' ? 'global' : activeMode,
    })

    if (shareUrl) {
      setIsActionSheetOpen(false)
    }
  }, [
    activeContext,
    activeFilters,
    activeMode,
    copyPublicShareLink,
    effectiveGroupId,
  ])

  const handleOpenReport = useCallback(() => {
    setIsActionSheetOpen(false)
    onOpenReport?.({
      contextId: activeContext,
      currentGroupId: activeContext === 'group' ? effectiveGroupId || null : null,
      filters: activeFilters,
      filterOrigin,
      typeKey: activeMode === 'global' ? 'global' : activeMode,
    })
  }, [activeContext, activeFilters, activeMode, effectiveGroupId, filterOrigin, onOpenReport])

  const getExpandedDetailState = useCallback(
    (entry) =>
      entry?.id === expandedEntry?.id
        ? expandedState
        : buildInlineDetailState({
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
          }),
    [
      activeCategory,
      activeCategoryDishType,
      activeGlobalView,
      activeMode,
      categories,
      currentContextEntries,
      dishTypes,
      expandedEntry?.id,
      expandedState,
      restaurants,
      selectedDishType,
      users,
    ],
  )

  return {
    activeCategory,
    activeCategoryDishTypeId,
    activeCategoryId,
    activeContext,
    activeFilterChips,
    activeFilters,
    activeGlobalView,
    activeGroup,
    activeMode,
    allDishTypesSorted,
    applyFilters,
    availableFilterOptions,
    categoryDishTypes,
    clearShareStatus,
    closeActionSheet,
    closeFilterPanel,
    dishTypeQuery,
    effectiveGroupId,
    expandedEntryId,
    filterOriginLabel,
    getExpandedDetailState,
    groupsForCurrentUser: sortedGroups,
    handleCopyShareLink,
    handleOpenReport,
    handleSelectDishType,
    hasActiveFilters,
    isActionSheetOpen,
    isFilterPanelOpen,
    isGroupContextEmpty: activeContext === 'group' && sortedGroups.length === 0,
    isSharing,
    matchingDishTypes,
    openActionSheet,
    openFilterPanel,
    rankingEntries,
    recentDishTypes,
    removeFilter,
    resetExpanded,
    resetFilters,
    selectedDishTypeId,
    selectedGroupId,
    setDishTypeQuery,
    setExpandedEntryId,
    setQueryState,
    shareStatus,
    shouldShowGroupSelector: activeContext === 'group' && sortedGroups.length > 1,
    sortedCategories,
    topLimit,
    topLimitOptions: TOP_LIMIT_OPTIONS,
    toggleExpandedEntry: (entry) =>
      setExpandedEntryId((currentId) => (currentId === entry.id ? '' : entry.id)),
    visibleRankingItems,
  }
}
