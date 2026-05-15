import { EmptyState } from '../components/feedback/EmptyState.jsx'
import { useEffect, useMemo, useState } from 'react'
import './ProfileScreen.css'
import { ProfileForm } from '../components/forms/ProfileForm.jsx'
import { GroupForm } from '../components/forms/GroupForm.jsx'
import { ModalSheet } from '../components/layout/ModalSheet.jsx'
import { SectionHeader } from '../components/layout/SectionHeader.jsx'
import { ACHIEVEMENT_META, getAchievementMeta } from '../lib/achievements.js'
import { useAppState } from '../hooks/useAppState.js'
import { createPublicShareToken } from '../lib/api.js'
import { PIN_STYLES } from '../lib/constants.js'
import {
  formatDate,
  formatRelativePrice,
  formatScore,
  formatShortAddress,
} from '../lib/format.js'
import { useTheme } from '../hooks/useTheme.js'
import {
  buildCategoryRankings,
  buildDishTypeRankings,
  buildGlobalRankings,
  buildRestaurantRankings,
} from '../lib/ranking.js'

const ENTRY_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'photo', label: 'Con foto' },
  { id: 'great', label: '+de 8' },
  { id: 'week', label: 'Esta semana' },
]

const SHARE_TYPE_OPTIONS = [
  { id: 'restaurant', label: 'Por restaurante' },
  { id: 'dishType', label: 'Por tipo de plato' },
  { id: 'category', label: 'Por categoría' },
  { id: 'global', label: 'Global' },
]

const SHARE_COUNT_OPTIONS = [5, 10, 20]
const INITIAL_PASSWORD_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

function AvatarPreview({ value, size = 'md' }) {
  const className = `avatar-badge avatar-badge--${size}`

  if (!value) {
    return <span className={className}>👤</span>
  }

  if (
    value.startsWith('data:image/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/')
  ) {
    return (
      <span className={`${className} avatar-badge--image`}>
        <img src={value} alt="" />
      </span>
    )
  }

  return <span className={className}>{value}</span>
}

function buildAchievementState(achievement, weeklyStreak, userLevel) {
  const meta = getAchievementMeta(achievement.badge_type)

  return {
    ...meta,
    helper: `Nivel actual: ${userLevel} · racha ${weeklyStreak} semanas`,
    progress: 1,
    target: 1,
  }
}

function buildAllAchievements(achievements, weeklyStreak, userLevel) {
  const unlockedByType = new Map(
    achievements.map((achievement) => [achievement.badge_type, achievement]),
  )

  return Object.keys(ACHIEVEMENT_META).map((badgeType) => {
    const unlockedAchievement = unlockedByType.get(badgeType)
    const meta = ACHIEVEMENT_META[badgeType]

    if (unlockedAchievement) {
      return {
        ...buildAchievementState(unlockedAchievement, weeklyStreak, userLevel),
        unlocked: true,
        unlockedAt: unlockedAchievement.unlocked_at,
        badgeType,
      }
    }

    return {
      ...meta,
      badgeType,
      helper:
        badgeType === 'social'
          ? 'Necesitas reacciones de otras personas en tus platos públicos.'
          : 'Sigue valorando para desbloquearlo.',
      progress: 0,
      target: 1,
      unlocked: false,
      unlockedAt: '',
    }
  })
}

function buildEntriesCsv({ entries, restaurantsById, dishTypesById }) {
  const header = [
    'tipo_registro',
    'nombre',
    'restaurante',
    'direccion',
    'puntuacion',
    'precio',
    'fecha',
  ]

  const rows = entries.map((entry) => {
    const restaurant = restaurantsById[entry.restaurant_id]
    const dishType = dishTypesById[entry.tipo_plato_id]

    return [
      'entrada',
      entry.nombre_plato || dishType?.nombre || 'Plato',
      restaurant?.nombre || 'Restaurante',
      restaurant?.direccion_texto || '',
      formatScore(entry.puntuacion_general),
      typeof entry.precio_plato === 'number' ? formatRelativePrice(entry.precio_plato) : '',
      formatDate(entry.created_at || entry.fecha),
    ]
  })

  return [header, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
        .join(','),
    )
    .join('\n')
}

function buildEntryStats({
  categoriesById,
  currentUserEntries,
  dishTypesById,
  restaurantsById,
}) {
  function getTopLabelByCount(items, getLabel) {
    if (items.length === 0) {
      return '—'
    }

    const counts = items.reduce((acc, item) => {
      acc[item] = (acc[item] ?? 0) + 1
      return acc
    }, {})
    const [topId] =
      Object.entries(counts).sort((left, right) => right[1] - left[1])[0] ?? []
    return getLabel(topId)
  }

  const averageScore =
    currentUserEntries.length > 0
      ? currentUserEntries.reduce(
          (total, entry) => total + Number(entry.puntuacion_general ?? 0),
          0,
        ) / currentUserEntries.length
      : null

  const bestEntry =
    currentUserEntries.length > 0
      ? [...currentUserEntries].sort(
          (left, right) => right.puntuacion_general - left.puntuacion_general,
        )[0]
      : null
  const worstEntry =
    currentUserEntries.length > 0
      ? [...currentUserEntries].sort(
          (left, right) => left.puntuacion_general - right.puntuacion_general,
        )[0]
      : null

  return [
    {
      id: 'average',
      label: 'Nota media',
      value: averageScore == null ? '—' : formatScore(averageScore),
    },
    {
      id: 'category',
      label: 'Categoría favorita',
      value: getTopLabelByCount(
        currentUserEntries.map((entry) => entry.categoria_id),
        (categoryId) => categoriesById[categoryId]?.nombre || 'Sin categoría',
      ),
    },
    {
      id: 'dish',
      label: 'Plato más repetido',
      value: getTopLabelByCount(
        currentUserEntries.map((entry) => entry.tipo_plato_id),
        (dishTypeId) => dishTypesById[dishTypeId]?.nombre || 'Plato',
      ),
    },
    {
      id: 'restaurant',
      label: 'Restaurante más visitado',
      value: getTopLabelByCount(
        currentUserEntries.map((entry) => entry.restaurant_id),
        (restaurantId) => restaurantsById[restaurantId]?.nombre || 'Restaurante',
      ),
    },
    {
      id: 'city',
      label: 'Ciudad top',
      value: getTopLabelByCount(
        currentUserEntries.map((entry) => {
          const address = restaurantsById[entry.restaurant_id]?.direccion_texto || ''
          const parts = address
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean)
          return parts[parts.length - 1] || 'Sin ciudad'
        }),
        (city) => city || 'Sin ciudad',
      ),
    },
    {
      id: 'best',
      label: 'Mejor valoración',
      value: bestEntry
        ? `${dishTypesById[bestEntry.tipo_plato_id]?.nombre || 'Plato'} · ${formatScore(
            bestEntry.puntuacion_general ?? 0,
          )}`
        : '—',
    },
    {
      id: 'worst',
      label: 'Puntuación más baja',
      value: worstEntry
        ? `${dishTypesById[worstEntry.tipo_plato_id]?.nombre || 'Plato'} · ${formatScore(
            worstEntry.puntuacion_general ?? 0,
          )}`
        : '—',
    },
  ]
}

function buildSharePreview({ contextId, currentGroupId, currentUserId, state, typeKey }) {
  const builders = {
    category: buildCategoryRankings,
    dishType: buildDishTypeRankings,
    global: buildGlobalRankings,
    restaurant: buildRestaurantRankings,
  }

  const builder = builders[typeKey] ?? buildRestaurantRankings
  const entries = builder({
    categories: state.categories,
    currentGroupId,
    currentUserId,
    dishTypes: state.dishTypes,
    entries: state.dishEntries,
    restaurants: state.restaurants,
    contextId,
  })

  return entries
}

function ListDetailSection({
  emptyLabel,
  items,
  onOpenEntry,
  onRemove,
  onToggleTried,
  restaurantsById,
  dishTypesById,
  title,
}) {
  return (
    <div className="profile-list-detail__section">
      <strong>{title}</strong>
      {items.length > 0 ? (
        <div className="list-stack">
          {items.map((item) => {
            const entry = item.entry
            const restaurant = restaurantsById[entry?.restaurant_id]
            const dishType = dishTypesById[entry?.tipo_plato_id]

            return (
              <article key={item.id} className="surface-card profile-list-detail__item">
                <button
                  className="profile-entry-card profile-entry-card--sheet"
                  type="button"
                  onClick={() => onOpenEntry(entry)}
                >
                  {entry?.foto_url ? (
                    <img src={entry.foto_url} alt={dishType?.nombre || 'Plato'} />
                  ) : (
                    <span className="profile-entry-card__placeholder">🍽️</span>
                  )}
                  <div>
                    <strong>{entry?.nombre_plato || dishType?.nombre || 'Plato'}</strong>
                    <p>{restaurant?.nombre || 'Restaurante'}</p>
                    <p>{formatScore(entry?.puntuacion_general ?? 0)} · {formatDate(item.saved_at)}</p>
                  </div>
                </button>
                <div className="profile-list-detail__actions">
                  <button
                    className="pill-button"
                    type="button"
                    onClick={() => onToggleTried(item)}
                  >
                    {item.tried ? 'Marcar pendiente' : 'Ya lo probé'}
                  </button>
                  <button className="pill-button" type="button" onClick={() => onRemove(item.id)}>
                    Quitar
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="community-empty-copy">{emptyLabel}</p>
      )}
    </div>
  )
}

export function ProfileScreen({
  hideBottomNavLabels = false,
  onHideBottomNavLabelsChange,
  onNavigate,
  onOpenEntity,
}) {
  const { setThemeMode, themeMode } = useTheme()
  const {
    achievements,
    categories,
    currentGroup,
    currentUser,
    currentUserEntries,
    defaultPinStyle,
    dishEntries,
    dishTypes,
    follows,
    groupMembers,
    groupsForCurrentUser,
    inspirationListItems,
    inspirationLists,
    joinGroupByInviteCode,
    loadFollows,
    loadAchievements,
    loadInspirationLists,
    markTried,
    pendingGroupsForCurrentUser,
    profileStats,
    removeFromList,
    restaurants,
    setDefaultPinStyle,
    socialLoadState,
    userLevel,
    users,
    weeklyStreak,
    createInspirationList,
    changePassword,
    logout,
  } = useAppState()

  const [isStatsOpen, setIsStatsOpen] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false)
  const [isCreatorVisible, setIsCreatorVisible] = useState(false)
  const [activeEntryFilter, setActiveEntryFilter] = useState('all')
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all')
  const [visibleEntriesCount, setVisibleEntriesCount] = useState(10)
  const [selectedSocialTab, setSelectedSocialTab] = useState('followers')
  const [selectedListId, setSelectedListId] = useState('')
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false)
  const [isSocialOpen, setIsSocialOpen] = useState(false)
  const [isGroupShareOpen, setIsGroupShareOpen] = useState(false)
  const [shareGroupId, setShareGroupId] = useState('')
  const [isCreateListOpen, setIsCreateListOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [groupInviteCode, setGroupInviteCode] = useState('')
  const [newListName, setNewListName] = useState('')
  const [passwordForm, setPasswordForm] = useState(INITIAL_PASSWORD_FORM)
  const [status, setStatus] = useState({ tone: '', message: '' })
  const [shareType, setShareType] = useState('restaurant')
  const [shareContext, setShareContext] = useState('private')
  const [shareCount, setShareCount] = useState(5)
  const [isShareLoading, setIsShareLoading] = useState(false)
  const [isJoinGroupLoading, setIsJoinGroupLoading] = useState(false)
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)
  const [isProfileSocialLoading, setIsProfileSocialLoading] = useState(true)
  const currentUserId = currentUser?.id ?? null
  const currentUserName = currentUser?.nombre || 'Tu perfil'

  const restaurantsById = useMemo(
    () => Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant])),
    [restaurants],
  )
  const categoriesById = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category])),
    [categories],
  )
  const dishTypesById = useMemo(
    () => Object.fromEntries(dishTypes.map((dishType) => [dishType.id, dishType])),
    [dishTypes],
  )
  const usersById = useMemo(
    () => Object.fromEntries(users.map((user) => [user.id, user])),
    [users],
  )

  const followers = useMemo(
    () =>
      currentUserId
        ? follows.filter((follow) => follow.followed_user_id === currentUserId)
        : [],
    [currentUserId, follows],
  )
  const following = useMemo(
    () =>
      currentUserId
        ? follows.filter((follow) => follow.follower_user_id === currentUserId)
        : [],
    [currentUserId, follows],
  )
  const activeGroupMember = useMemo(
    () =>
      groupMembers.find(
        (member) =>
          member.group_id === currentGroup?.id &&
          member.user_id === currentUserId &&
          member.status === 'active',
      ) ?? null,
    [currentGroup?.id, currentUserId, groupMembers],
  )

  const allAchievements = useMemo(
    () => buildAllAchievements(achievements, weeklyStreak, userLevel),
    [achievements, userLevel, weeklyStreak],
  )
  const recentAchievements = useMemo(
    () =>
      [...achievements]
        .sort((left, right) => new Date(right.unlocked_at) - new Date(left.unlocked_at))
        .slice(0, 3)
        .map((achievement) =>
          buildAchievementState(achievement, weeklyStreak, userLevel),
        ),
    [achievements, userLevel, weeklyStreak],
  )
  const entryStats = useMemo(
    () =>
      buildEntryStats({
        categoriesById,
        currentUserEntries,
        dishTypesById,
        restaurantsById,
      }),
    [categoriesById, currentUserEntries, dishTypesById, restaurantsById],
  )

  const filteredEntries = useMemo(() => {
    const now = new Date()
    const startOfWeek = new Date(now)
    const day = startOfWeek.getDay() || 7
    startOfWeek.setDate(startOfWeek.getDate() - day + 1)
    startOfWeek.setHours(0, 0, 0, 0)

    return currentUserEntries
      .filter((entry) => {
        if (activeCategoryFilter !== 'all' && entry.categoria_id !== activeCategoryFilter) {
          return false
        }

        if (activeEntryFilter === 'photo' && !entry.foto_url) {
          return false
        }

        if (activeEntryFilter === 'great' && Number(entry.puntuacion_general ?? 0) < 8) {
          return false
        }

        if (
          activeEntryFilter === 'week' &&
          new Date(entry.created_at ?? entry.fecha) < startOfWeek
        ) {
          return false
        }

        return true
      })
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
  }, [activeCategoryFilter, activeEntryFilter, currentUserEntries])

  const visibleEntries = filteredEntries.slice(0, visibleEntriesCount)
  const selectedList = inspirationLists.find((list) => list.id === selectedListId) ?? null
  const selectedListItems = useMemo(() => {
    if (!selectedList) {
      return []
    }

    return inspirationListItems
      .filter((item) => item.list_id === selectedList.id)
      .map((item) => ({
        ...item,
        entry: dishEntries.find((entry) => entry.id === item.dish_entry_id) ?? null,
      }))
      .filter((item) => item.entry)
      .sort((left, right) => new Date(right.saved_at) - new Date(left.saved_at))
  }, [dishEntries, inspirationListItems, selectedList])

  const shareContexts = useMemo(() => {
    const base = [{ id: 'private', label: 'Mi ranking' }, { id: 'public', label: 'Comunidad' }]

    if (currentGroup) {
      return [base[0], { id: 'group', label: 'Mi grupo' }, base[1]]
    }

    return base
  }, [currentGroup])

  const sharePreview = useMemo(
    () =>
      buildSharePreview({
        contextId: shareContext,
        currentGroupId: currentGroup?.id ?? null,
        currentUserId,
        state: {
          categories,
          dishEntries,
          dishTypes,
          restaurants,
        },
        typeKey: shareType,
      }).slice(0, shareCount),
    [
      categories,
      currentGroup?.id,
      currentUserId,
      dishEntries,
      dishTypes,
      restaurants,
      shareContext,
      shareCount,
      shareType,
    ],
  )

  const statCards = [
    { id: 'dish', label: 'Platos', value: String(profileStats.totalPlatos) },
    {
      id: 'restaurants',
      label: 'Restaurantes',
      value: String(profileStats.totalRestaurantes),
    },
    { id: 'groups', label: 'Grupos', value: String(profileStats.grupos) },
  ]
  const themeOptions = [
    { id: 'light', label: 'Claro' },
    { id: 'dark', label: 'Oscuro' },
    { id: 'system', label: 'Sistema' },
  ]

  useEffect(() => {
    if (!currentUserId) {
      return undefined
    }

    let cancelled = false

    async function hydrateProfileSocialState() {
      try {
        setIsProfileSocialLoading(true)
        await Promise.all([
          socialLoadState.follows ? Promise.resolve() : loadFollows(),
          socialLoadState.inspirationLists ? Promise.resolve() : loadInspirationLists(),
          socialLoadState.achievements ? Promise.resolve() : loadAchievements(),
        ])
      } catch (error) {
        if (!cancelled) {
          setStatus({
            tone: 'error',
            message: `Error al cargar ❌ — ${error instanceof Error ? error.message : 'No se pudieron cargar los datos sociales del perfil.'}`,
          })
        }
      } finally {
        if (!cancelled) {
          setIsProfileSocialLoading(false)
        }
      }
    }

    hydrateProfileSocialState()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentUserId,
    socialLoadState.achievements,
    socialLoadState.follows,
    socialLoadState.inspirationLists,
  ])

  async function copyText(value, successMessage) {
    try {
      await navigator.clipboard.writeText(value)
      setStatus({ tone: 'success', message: successMessage })
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo copiar.'}`,
      })
    }
  }

  async function handleJoinGroup(event) {
    event.preventDefault()

    try {
      setIsJoinGroupLoading(true)
      const response = await joinGroupByInviteCode(groupInviteCode)
      setGroupInviteCode('')
      setStatus({
        tone: 'success',
        message:
          response.groupMember?.status === 'pending'
            ? 'Guardado ✅ — Solicitud enviada.'
            : 'Guardado ✅ — Te has unido al grupo.',
      })
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo unir al grupo.'}`,
      })
    } finally {
      setIsJoinGroupLoading(false)
    }
  }

  async function handleExportCsv() {
    try {
      const csv = buildEntriesCsv({
        entries: currentUserEntries,
        restaurantsById,
        dishTypesById,
      })
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'mi-ranking-gastronomico.csv'
      link.click()
      URL.revokeObjectURL(url)
      setStatus({ tone: 'success', message: 'Guardado ✅ — CSV exportado.' })
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo exportar el CSV.'}`,
      })
    }
  }

  async function handleCreateList(event) {
    event.preventDefault()

    if (!currentUserId) {
      setStatus({
        tone: 'error',
        message: 'Error al guardar ❌ — La sesión todavía no está lista.',
      })
      return
    }

    try {
      await createInspirationList({
        user_id: currentUserId,
        name: newListName.trim(),
        is_default: false,
      })
      setNewListName('')
      setIsCreateListOpen(false)
      setStatus({ tone: 'success', message: 'Guardado ✅' })
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo crear la lista.'}`,
      })
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()

    if (passwordForm.newPassword.trim().length < 8) {
      setStatus({
        tone: 'error',
        message: 'La nueva contraseña debe tener al menos 8 caracteres.',
      })
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setStatus({
        tone: 'error',
        message: 'La confirmación de contraseña no coincide.',
      })
      return
    }

    try {
      setIsPasswordSaving(true)
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordForm(INITIAL_PASSWORD_FORM)
      setIsPasswordModalOpen(false)
      setStatus({ tone: 'success', message: 'Guardado ✅' })
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.'}`,
      })
    } finally {
      setIsPasswordSaving(false)
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo cerrar la sesión.'}`,
      })
    }
  }

  async function handleShareRanking({ shouldUseWebShare = false } = {}) {
    if (!currentUserId) {
      setStatus({
        tone: 'error',
        message: 'Error al guardar ❌ — La sesión todavía no está lista.',
      })
      return
    }

    try {
      setIsShareLoading(true)
      const response = await createPublicShareToken({
        context:
          shareContext === 'private'
            ? 'mi_ranking'
            : shareContext === 'group'
              ? 'grupo'
              : 'comunidad',
        ranking_type: shareType,
        created_by_user_id: currentUserId,
        group_id: shareContext === 'group' ? currentGroup?.id ?? null : null,
        filters: {},
      })

      const shareUrl = `${window.location.origin}/informe?share=${response.shareToken.token}`

      if (shouldUseWebShare && navigator.share) {
        await navigator.share({
          title: 'Mi ranking gastronómico',
          text: 'Te comparto mi ranking gastronómico.',
          url: shareUrl,
        })
        setStatus({ tone: 'success', message: 'Guardado ✅ — Enlace compartido.' })
        return
      }

      await copyText(shareUrl, 'Guardado ✅ — Enlace copiado.')
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo compartir el ranking.'}`,
      })
    } finally {
      setIsShareLoading(false)
    }
  }

  async function handleToggleTried(item, tried) {
    try {
      await markTried(item.id, tried)
      setStatus({ tone: 'success', message: 'Guardado ✅' })
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo actualizar la lista.'}`,
      })
    }
  }

  async function handleRemoveListItem(itemId) {
    try {
      await removeFromList(itemId)
      setStatus({ tone: 'success', message: 'Guardado ✅' })
    } catch (error) {
      setStatus({
        tone: 'error',
        message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo quitar el elemento.'}`,
      })
    }
  }

  if (!currentUser) {
    return (
      <section className="screen profile-screen" aria-label="Pantalla de perfil">
        <article className="surface-card">
          <strong>Cargando perfil</strong>
          <p>Cargando...</p>
        </article>
      </section>
    )
  }

  return (
    <section className="screen profile-screen" aria-label="Pantalla de perfil">
      <article className="surface-card profile-theme-card">
        <div>
          <strong>Apariencia</strong>
          <p>Elige entre claro, oscuro o seguir la preferencia del sistema.</p>
        </div>
        <div className="theme-toggle" role="group" aria-label="Selector de tema">
          {themeOptions.map((option) => (
            <button
              key={option.id}
              className={`theme-toggle__button${themeMode === option.id ? ' theme-toggle__button--active' : ''}`}
              type="button"
              onClick={() => setThemeMode(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </article>

      <article className="surface-card profile-hero">
        <div className="profile-hero__main">
          <button
            className="profile-avatar-button"
            type="button"
            onClick={() => setIsProfileEditorOpen(true)}
            aria-label="Editar perfil"
          >
            <AvatarPreview value={currentUser.avatar_url} size="lg" />
          </button>
          <div className="profile-hero__content">
            <div className="profile-hero__heading">
              <h2>{currentUser.nombre}</h2>
              <span className="status-pill">⭐ {userLevel}</span>
            </div>
            <p className="profile-hero__bio">
              {currentUser.bio?.trim() ||
                'Tu historia foodie empieza aquí. Edita nombre y avatar para dejar el perfil a tu gusto.'}
            </p>
            <p className="profile-hero__meta">
              Miembro desde {formatDate(currentUser.created_at)} · {weeklyStreak} semanas en racha
            </p>
          </div>
        </div>

        <div className="stat-grid">
          {statCards.map((stat) => (
            <article key={stat.id} className="stat-card">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </article>
          ))}
        </div>

        <div className="profile-social-row">
          <button
            className="surface-card surface-card--button profile-social-pill"
            type="button"
            onClick={() => {
              setSelectedSocialTab('followers')
              setIsSocialOpen(true)
            }}
          >
            <strong>{followers.length}</strong>
            <span>Seguidores</span>
          </button>
          <button
            className="surface-card surface-card--button profile-social-pill"
            type="button"
            onClick={() => {
              setSelectedSocialTab('following')
              setIsSocialOpen(true)
            }}
          >
            <strong>{following.length}</strong>
            <span>Siguiendo</span>
          </button>
        </div>
      </article>

      <button
        className="surface-card surface-card--button profile-active-group"
        type="button"
        onClick={() =>
          currentGroup
            ? onOpenEntity?.({ type: 'group', id: currentGroup.id })
            : setIsCreatorVisible((current) => !current)
        }
      >
        <div>
          <strong>
            {currentGroup
              ? `Puntuando en: ${currentGroup.nombre}`
              : 'Sin grupo activo todavía'}
          </strong>
          <p>
            {currentGroup
              ? `${currentGroup.tipo} · rol ${activeGroupMember?.role || 'member'}`
              : 'Crea tu primer grupo o revisa los grupos disponibles.'}
          </p>
        </div>
        <span aria-hidden="true">{currentGroup ? '→' : '＋'}</span>
      </button>

      <article className="surface-card profile-badges">
        <SectionHeader
          title="Logros recientes"
          actionLabel="Ver todos"
          onAction={() => {
            loadAchievements().catch(() => {})
            setIsAchievementsOpen(true)
          }}
        />
        {isProfileSocialLoading ? (
          <EmptyState
            description="Cargando logros, follows y listas guardadas."
            title="Cargando..."
          />
        ) : recentAchievements.length > 0 ? (
          <div className="profile-badge-row">
            {recentAchievements.map((achievement) => (
              <article key={achievement.title} className="profile-badge-card">
                <span>{achievement.icon}</span>
                <strong>{achievement.title}</strong>
                <p>{achievement.helper}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="community-empty-copy">
            Todavía no hay logros desbloqueados. Añade un plato para empezar.
          </p>
        )}
      </article>

      <article className="surface-card">
        <SectionHeader
          title="📊 Mis estadísticas"
          actionContent={<span>{isStatsOpen ? 'Ocultar' : 'Ver'}</span>}
          onAction={() => setIsStatsOpen((current) => !current)}
        />
        {isStatsOpen ? (
          entryStats.length > 0 ? (
            <div className="profile-stats-list">
              {entryStats.map((item) => (
                <div key={item.id} className="profile-stats-row">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="community-empty-copy">
              Todavía no hay suficientes platos para calcular estadísticas.
            </p>
          )
        ) : null}
      </article>

      <article className="surface-card">
        <SectionHeader title="🍽 Mis platos" />
        <div className="chip-row">
          {ENTRY_FILTERS.map((filter) => (
            <button
              key={filter.id}
              className={`chip${activeEntryFilter === filter.id ? ' chip--active' : ''}`}
              type="button"
              onClick={() => {
                setActiveEntryFilter(filter.id)
                setVisibleEntriesCount(10)
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="chip-row">
          <button
            className={`chip${activeCategoryFilter === 'all' ? ' chip--active' : ''}`}
            type="button"
            onClick={() => {
              setActiveCategoryFilter('all')
              setVisibleEntriesCount(10)
            }}
          >
            Todas las categorías
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              className={`chip${activeCategoryFilter === category.id ? ' chip--active' : ''}`}
              type="button"
              onClick={() => {
                setActiveCategoryFilter(category.id)
                setVisibleEntriesCount(10)
              }}
            >
              {category.icono} {category.nombre}
            </button>
          ))}
        </div>

        {visibleEntries.length > 0 ? (
          <div className="list-stack">
            {visibleEntries.map((entry) => {
              const restaurant = restaurantsById[entry.restaurant_id]
              const dishType = dishTypesById[entry.tipo_plato_id]

              return (
                <button
                  key={entry.id}
                  className="surface-card surface-card--button profile-entry-card"
                  type="button"
                  onClick={() => onOpenEntity?.({ type: 'dishEntry', id: entry.id })}
                >
                  {entry.foto_url ? (
                    <img src={entry.foto_url} alt={dishType?.nombre || 'Plato'} />
                  ) : (
                    <span className="profile-entry-card__placeholder">🍽️</span>
                  )}
                  <div className="profile-entry-card__body">
                    <div className="profile-entry-card__header">
                      <strong>{entry.nombre_plato || dishType?.nombre || 'Plato'}</strong>
                      <span className="ranking-card__score ranking-card__score--good">
                        {formatScore(entry.puntuacion_general)}
                      </span>
                    </div>
                    <p>{restaurant?.nombre || 'Restaurante'}</p>
                    <p>{formatDate(entry.created_at)} · {formatShortAddress(restaurant?.direccion_texto)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        ) : currentUserEntries.length === 0 ? (
          <EmptyState
            actionLabel="Añadir plato"
            description="Aún no has añadido platos."
            onAction={() => onNavigate?.('home')}
            title="Perfil vacío"
          />
        ) : (
          <p className="community-empty-copy">
            No hay platos que coincidan con este filtro.
          </p>
        )}

        {filteredEntries.length > visibleEntriesCount ? (
          <button
            className="pill-button profile-more-button"
            type="button"
            onClick={() => setVisibleEntriesCount((current) => current + 10)}
          >
            Ver más
          </button>
        ) : null}
      </article>

      <article className="surface-card">
        <SectionHeader
          title="👥 Mis grupos"
          actionLabel={isCreatorVisible ? 'Cancelar' : 'Crear grupo'}
          onAction={() => setIsCreatorVisible((current) => !current)}
        />
        {isCreatorVisible ? (
          <GroupForm
            onCancel={() => setIsCreatorVisible(false)}
            onSaved={() => setIsCreatorVisible(false)}
          />
        ) : null}

        <form className="profile-inline-form" onSubmit={handleJoinGroup}>
          <label className="field">
            <span>Unirme con código</span>
            <input
              type="text"
              maxLength="6"
              value={groupInviteCode}
              onChange={(event) => setGroupInviteCode(event.target.value.toUpperCase())}
              placeholder="ABC123"
            />
          </label>
          <button className="primary-button" type="submit" disabled={isJoinGroupLoading}>
            {isJoinGroupLoading ? 'Cargando...' : 'Unirme al grupo'}
          </button>
        </form>

        {groupsForCurrentUser.length > 0 ? (
          <div className="list-stack">
            {groupsForCurrentUser.map((group) => {
              const members = groupMembers
                .filter((member) => member.group_id === group.id && member.status === 'active')
                .map((member) => usersById[member.user_id])
                .filter(Boolean)
              const currentMember = groupMembers.find(
                (member) =>
                  member.group_id === group.id &&
                  member.user_id === currentUserId &&
                  member.status === 'active',
              )

              return (
                <article key={group.id} className="surface-card profile-group-card">
                  <div className="profile-group-card__header">
                    <div>
                      <strong>{group.nombre}</strong>
                      <p>
                        {group.tipo} · {group.visibility} · rol {currentMember?.role || 'member'}
                      </p>
                    </div>
                    <span className="status-pill">{members.length} miembros</span>
                  </div>
                  <div className="profile-avatar-row">
                    {members.slice(0, 4).map((member) => (
                      <AvatarPreview key={member.id} value={member.avatar_url} />
                    ))}
                    {members.length > 4 ? (
                      <span className="avatar-badge">+{members.length - 4}</span>
                    ) : null}
                  </div>
                  <div className="modal-actions">
                    <button
                      className="pill-button"
                      type="button"
                      onClick={() => {
                        setShareGroupId(group.id)
                        setIsGroupShareOpen(true)
                      }}
                    >
                      Compartir
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => onOpenEntity?.({ type: 'group', id: group.id })}
                    >
                      Ver grupo
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="community-empty-copy">Todavía no perteneces a ningún grupo.</p>
        )}

        {pendingGroupsForCurrentUser.length > 0 ? (
          <div className="list-stack">
            {pendingGroupsForCurrentUser.map((group) => (
              <article key={group.id} className="surface-card profile-group-card">
                <div className="profile-group-card__header">
                  <div>
                    <strong>{group.nombre}</strong>
                    <p>{group.tipo} · solicitud pendiente de aprobación</p>
                  </div>
                  <span className="status-pill">Pendiente</span>
                </div>
                <div className="modal-actions">
                  <button
                    className="pill-button"
                    type="button"
                    onClick={() => onOpenEntity?.({ type: 'group', id: group.id })}
                  >
                    Ver grupo
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </article>

      <article className="surface-card">
        <SectionHeader
          title="🔖 Mis listas"
          actionLabel={isCreateListOpen ? 'Cancelar' : 'Nueva lista'}
          onAction={() => setIsCreateListOpen((current) => !current)}
        />
        {isCreateListOpen ? (
          <form className="profile-inline-form" onSubmit={handleCreateList}>
            <label className="field">
              <span>Nombre de la lista</span>
              <input
                type="text"
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                placeholder="Ej. Vermús pendientes"
              />
            </label>
            <div className="modal-actions">
              <button className="primary-button" type="submit">
                Guardar lista
              </button>
            </div>
          </form>
        ) : null}

        {isProfileSocialLoading ? (
          <EmptyState
            description="Cargando tus listas guardadas y datos sociales."
            title="Cargando..."
          />
        ) : inspirationLists.length > 0 ? (
          <div className="list-stack">
            {inspirationLists.map((list) => {
              const items = inspirationListItems.filter((item) => item.list_id === list.id)
              const thumbs = items
                .map((item) => dishEntries.find((entry) => entry.id === item.dish_entry_id)?.foto_url)
                .filter(Boolean)
                .slice(0, 3)

              return (
                <button
                  key={list.id}
                  className="surface-card surface-card--button profile-list-card"
                  type="button"
                  onClick={() => setSelectedListId(list.id)}
                >
                  <div>
                    <strong>{list.name}</strong>
                    <p>
                      {items.length} guardados
                      {list.is_default ? ' · Lista por defecto' : ''}
                    </p>
                  </div>
                  <div className="profile-list-card__thumbs">
                    {thumbs.length > 0 ? (
                      thumbs.map((thumb) => <img key={thumb} src={thumb} alt="" />)
                    ) : (
                      <span className="profile-list-card__empty">Sin fotos</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="community-empty-copy">
            Aún no has guardado platos para inspiración.
          </p>
        )}
      </article>

      <article className="surface-card">
        <SectionHeader title="🏆 Compartir mi ranking" />
        <div className="profile-share-builder">
          <div className="profile-share-builder__group">
            <span>Contenido</span>
            <div className="chip-row">
              {SHARE_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={`chip${shareType === option.id ? ' chip--active' : ''}`}
                  type="button"
                  onClick={() => setShareType(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="profile-share-builder__group">
            <span>Top</span>
            <div className="chip-row">
              {SHARE_COUNT_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={`chip${shareCount === option ? ' chip--active' : ''}`}
                  type="button"
                  onClick={() => setShareCount(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="profile-share-builder__group">
            <span>Contexto</span>
            <div className="chip-row">
              {shareContexts.map((option) => (
                <button
                  key={option.id}
                  className={`chip${shareContext === option.id ? ' chip--active' : ''}`}
                  type="button"
                  onClick={() => setShareContext(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <article className="profile-share-preview">
          <p className="profile-share-preview__eyebrow">Vista previa</p>
          <strong>
            {currentUserName} · {SHARE_TYPE_OPTIONS.find((option) => option.id === shareType)?.label}
          </strong>
          <p>
            {shareContexts.find((option) => option.id === shareContext)?.label} · Top {shareCount}
          </p>
          {sharePreview.length > 0 ? (
            <div className="list-stack">
              {sharePreview.map((item, index) => (
                <div key={`${shareType}-${item.id}-${index}`} className="profile-share-preview__row">
                  <span>#{index + 1}</span>
                  <strong>
                    {item.restaurantName ||
                      item.categoryName ||
                      item.dishTypeName ||
                      item.dishName ||
                      'Ranking'}
                  </strong>
                  <span>{formatScore(item.score ?? item.puntuacion_general ?? 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="community-empty-copy">
              No hay datos suficientes para esta combinación.
            </p>
          )}
        </article>

        <div className="modal-actions">
          <button
            className="pill-button"
            type="button"
            onClick={() => {
              onNavigate?.('report')
            }}
          >
            Abrir informe
          </button>
          <button
            className="pill-button"
            type="button"
            onClick={() => handleShareRanking()}
            disabled={isShareLoading}
          >
            {isShareLoading ? 'Cargando...' : 'Copiar enlace'}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => handleShareRanking({ shouldUseWebShare: true })}
            disabled={isShareLoading || !navigator.share}
          >
            Compartir
          </button>
        </div>
      </article>

      <article className="surface-card">
        <SectionHeader
          title="Ajustes"
          actionContent={<span>{isSettingsOpen ? 'Ocultar' : 'Ver'}</span>}
          onAction={() => setIsSettingsOpen((current) => !current)}
        />
        {isSettingsOpen ? (
          <div className="list-stack">
            <article className="settings-card">
              <strong>Perfil</strong>
              <p>Nombre y avatar con edición real sobre SQLite.</p>
              <div className="modal-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setIsProfileEditorOpen(true)}
                >
                  Editar perfil
                </button>
              </div>
            </article>
            <article className="settings-card">
              <strong>Cuenta</strong>
              <p>Email: {currentUser.email || 'Sin email asociado'}</p>
              <div className="modal-actions">
                <button
                  className="pill-button"
                  type="button"
                  onClick={() => setIsPasswordModalOpen(true)}
                >
                  Cambiar contraseña
                </button>
                <button className="danger-button" type="button" onClick={handleLogout}>
                  Cerrar sesión
                </button>
              </div>
            </article>
            <article className="settings-card">
              <strong>Pin por defecto</strong>
              <p>Se aplica al mapa salvo que un restaurante tenga override propio.</p>
              <div className="chip-row">
                {PIN_STYLES.map((style) => (
                  <button
                    key={style}
                    className={`chip${defaultPinStyle === style ? ' chip--active' : ''}`}
                    type="button"
                    onClick={() => setDefaultPinStyle(style)}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </article>
            <article className="settings-card">
              <strong>Menú inferior</strong>
              <p>Oculta los títulos y deja solo los iconos en la navegación principal.</p>
              <label className="filter-toggle">
                <input
                  type="checkbox"
                  checked={hideBottomNavLabels}
                  onChange={(event) =>
                    onHideBottomNavLabelsChange?.(event.target.checked)
                  }
                />
                <span>Ocultar títulos del menú</span>
              </label>
            </article>
            <article className="settings-card">
              <strong>Exportar CSV</strong>
              <p>Exporta tus valoraciones actuales con restaurante, fecha y nota.</p>
              <div className="modal-actions">
                <button className="pill-button" type="button" onClick={handleExportCsv}>
                  Exportar CSV
                </button>
              </div>
            </article>
            <article className="settings-card">
              <strong>Catálogo editable</strong>
              <p>Categorías y tipos de plato siguen teniendo detalle y edición reales.</p>
              <div className="chip-row">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    className="chip"
                    type="button"
                    onClick={() => onOpenEntity?.({ type: 'category', id: category.id })}
                  >
                    {category.icono} {category.nombre}
                  </button>
                ))}
                {dishTypes.map((dishType) => (
                  <button
                    key={dishType.id}
                    className="chip"
                    type="button"
                    onClick={() => onOpenEntity?.({ type: 'dishType', id: dishType.id })}
                  >
                    {dishType.nombre}
                  </button>
                ))}
              </div>
            </article>
          </div>
        ) : null}
      </article>

      {status.message ? (
        <div className={`status-banner status-banner--${status.tone || 'info'}`}>
          <strong>{status.tone === 'success' ? 'Estado' : 'Revisión'}</strong>
          <p>{status.message}</p>
        </div>
      ) : null}

      {isProfileEditorOpen ? (
        <ModalSheet title="Editar perfil" onClose={() => setIsProfileEditorOpen(false)}>
          <ProfileForm
            initialValues={currentUser}
            onCancel={() => setIsProfileEditorOpen(false)}
            onSaved={() => setIsProfileEditorOpen(false)}
          />
        </ModalSheet>
      ) : null}

      {isPasswordModalOpen ? (
        <ModalSheet
          title="Cambiar contraseña"
          onClose={() => {
            setIsPasswordModalOpen(false)
            setPasswordForm(INITIAL_PASSWORD_FORM)
          }}
        >
          <form className="form-stack" onSubmit={handlePasswordSubmit}>
            <label className="field">
              <span>Contraseña actual</span>
              <input
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Nueva contraseña</span>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Confirmar contraseña</span>
              <input
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
              />
            </label>
            <div className="modal-actions">
              <button
                className="pill-button"
                type="button"
                onClick={() => {
                  setIsPasswordModalOpen(false)
                  setPasswordForm(INITIAL_PASSWORD_FORM)
                }}
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={isPasswordSaving}
              >
                {isPasswordSaving ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </div>
          </form>
        </ModalSheet>
      ) : null}

      {isAchievementsOpen ? (
        <ModalSheet title="Logros y nivel" onClose={() => setIsAchievementsOpen(false)}>
          <div className="profile-achievement-sheet">
            <article className="surface-card">
              <strong>Racha semanal</strong>
              <p>🔥 {weeklyStreak} semanas consecutivas con actividad.</p>
            </article>
            <article className="surface-card">
              <strong>Nivel general</strong>
              <p>⭐ {userLevel}</p>
            </article>
            <div className="list-stack">
              {allAchievements.map((achievement) => (
                <article
                  key={achievement.badgeType}
                  className={`surface-card profile-achievement-card${
                    achievement.unlocked ? ' profile-achievement-card--unlocked' : ''
                  }`}
                >
                  <div className="profile-achievement-card__header">
                    <span>{achievement.icon}</span>
                    <div>
                      <strong>{achievement.title}</strong>
                      <p>{achievement.description}</p>
                    </div>
                  </div>
                  <div className="profile-achievement-card__progress">
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          (achievement.progress / Math.max(achievement.target, 1)) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p>
                    {achievement.helper}
                    {achievement.unlockedAt ? ` · ${formatDate(achievement.unlockedAt)}` : ''}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </ModalSheet>
      ) : null}

      {isSocialOpen ? (
        <ModalSheet
          title={selectedSocialTab === 'followers' ? 'Seguidores' : 'Siguiendo'}
          onClose={() => setIsSocialOpen(false)}
        >
          <div className="chip-row">
            <button
              className={`chip${selectedSocialTab === 'followers' ? ' chip--active' : ''}`}
              type="button"
              onClick={() => setSelectedSocialTab('followers')}
            >
              Seguidores
            </button>
            <button
              className={`chip${selectedSocialTab === 'following' ? ' chip--active' : ''}`}
              type="button"
              onClick={() => setSelectedSocialTab('following')}
            >
              Siguiendo
            </button>
          </div>
          <div className="list-stack">
            {(selectedSocialTab === 'followers' ? followers : following).length > 0 ? (
              (selectedSocialTab === 'followers' ? followers : following).map((follow) => {
                const userId =
                  selectedSocialTab === 'followers'
                    ? follow.follower_user_id
                    : follow.followed_user_id
                const user = usersById[userId]

                return (
                  <button
                    key={`${follow.follower_user_id}-${follow.followed_user_id}`}
                    className="surface-card surface-card--button profile-user-card"
                    type="button"
                    onClick={() => onOpenEntity?.({ type: 'user', id: userId })}
                  >
                    <AvatarPreview value={user?.avatar_url} />
                    <div>
                      <strong>{user?.nombre || 'Usuario'}</strong>
                      <p>Activo desde {formatDate(user?.created_at || follow.created_at)}</p>
                    </div>
                  </button>
                )
              })
            ) : (
              <p className="community-empty-copy">
                {selectedSocialTab === 'followers'
                  ? 'Todavía no tienes seguidores.'
                  : 'Todavía no sigues a nadie.'}
              </p>
            )}
          </div>
        </ModalSheet>
      ) : null}

      {isGroupShareOpen ? (
        <ModalSheet title="Compartir grupo" onClose={() => setIsGroupShareOpen(false)}>
          {(() => {
            const group = groupsForCurrentUser.find((item) => item.id === shareGroupId)

            if (!group) {
              return (
                <p className="community-empty-copy">No se ha encontrado el grupo.</p>
              )
            }

            return (
              <div className="profile-group-share">
                <article className="surface-card">
                  <strong>{group.nombre}</strong>
                  <p>
                    Código de invitación: <strong>{group.invite_code}</strong>
                  </p>
                  <p>
                    {group.visibility} · acceso {group.join_policy}
                  </p>
                </article>
                <div className="modal-actions">
                  <button
                    className="pill-button"
                    type="button"
                    onClick={() => copyText(group.invite_code, 'Guardado ✅ — Código copiado.')}
                  >
                    Copiar código
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => onOpenEntity?.({ type: 'group', id: group.id })}
                  >
                    Ver grupo
                  </button>
                </div>
              </div>
            )
          })()}
        </ModalSheet>
      ) : null}

      {selectedList ? (
        <ModalSheet title={selectedList.name} onClose={() => setSelectedListId('')}>
          <div className="profile-list-detail">
            <article className="surface-card">
              <strong>{selectedList.name}</strong>
              <p>
                {selectedListItems.length} guardados
                {selectedList.is_default ? ' · Lista por defecto' : ''}
              </p>
            </article>
            <ListDetailSection
              title="Por probar"
              items={selectedListItems.filter((item) => !item.tried)}
              emptyLabel="No hay platos pendientes en esta lista."
              onOpenEntry={(entry) => {
                setSelectedListId('')
                onOpenEntity?.({ type: 'dishEntry', id: entry.id })
              }}
              onRemove={handleRemoveListItem}
              onToggleTried={(item) => handleToggleTried(item, true)}
              restaurantsById={restaurantsById}
              dishTypesById={dishTypesById}
            />
            <ListDetailSection
              title="Ya probados"
              items={selectedListItems.filter((item) => item.tried)}
              emptyLabel="Todavía no has marcado platos como probados."
              onOpenEntry={(entry) => {
                setSelectedListId('')
                onOpenEntity?.({ type: 'dishEntry', id: entry.id })
              }}
              onRemove={handleRemoveListItem}
              onToggleTried={(item) => handleToggleTried(item, false)}
              restaurantsById={restaurantsById}
              dishTypesById={dishTypesById}
            />
          </div>
        </ModalSheet>
      ) : null}
    </section>
  )
}
