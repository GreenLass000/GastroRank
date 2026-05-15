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
import { GroupForm } from '../components/forms/GroupForm.jsx'
import { useScreenQueryState } from '../hooks/useScreenQueryState.js'
import { fetchCommunityFeed } from '../lib/api.js'
import { useAppState } from '../hooks/useAppState.js'

const DEFAULT_FILTERS = {
  categoryIds: [],
  dishTypeIds: [],
  priceRange: [],
  minScore: null,
  datePreset: '',
}

const COMMUNITY_QUERY_SCHEMA = {
  tab: {
    queryKey: 'cm_tab',
    defaultValue: 'amigos',
    parse: (value) => (value === 'explorar' || value === 'amigos' ? value : 'amigos'),
  },
  page: {
    queryKey: 'cm_page',
    defaultValue: 1,
    parse: (value) => {
      const parsed = Number.parseInt(value, 10)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
    },
  },
  categoryIds: {
    queryKey: 'cm_cat',
    defaultValue: [],
    parse: (value) => value.split(',').filter(Boolean),
    serialize: (value) => value.join(','),
    shouldPersist: (value) => value.length > 0,
  },
  dishTypeIds: {
    queryKey: 'cm_type',
    defaultValue: [],
    parse: (value) => value.split(',').filter(Boolean),
    serialize: (value) => value.join(','),
    shouldPersist: (value) => value.length > 0,
  },
  priceRange: {
    queryKey: 'cm_price',
    defaultValue: [],
    parse: (value) => value.split(',').filter(Boolean),
    serialize: (value) => value.join(','),
    shouldPersist: (value) => value.length > 0,
  },
  minScore: {
    queryKey: 'cm_score',
    defaultValue: null,
    parse: (value) => {
      const parsed = Number.parseInt(value, 10)
      return Number.isFinite(parsed) ? parsed : null
    },
    shouldPersist: (value) => value != null,
  },
  datePreset: {
    queryKey: 'cm_date',
    defaultValue: '',
    shouldPersist: (value) => Boolean(value),
  },
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

function buildSocialProfiles({ currentUserId, follows, users }) {
  const followingIds = new Set(
    follows
      .filter((follow) => follow.follower_user_id === currentUserId)
      .map((follow) => follow.followed_user_id),
  )
  const followerIds = new Set(
    follows
      .filter((follow) => follow.followed_user_id === currentUserId)
      .map((follow) => follow.follower_user_id),
  )

  return users
    .filter((user) => user.id !== currentUserId)
    .filter((user) => followingIds.has(user.id) || followerIds.has(user.id))
    .map((user) => {
      const isFollowing = followingIds.has(user.id)
      const followsYou = followerIds.has(user.id)
      const isMutual = isFollowing && followsYou

      return {
        ...user,
        followsYou,
        isFollowing,
        isMutual,
        relationLabel: isMutual
          ? 'Amistad mutua'
          : isFollowing
            ? 'Siguiendo'
            : 'Te sigue',
      }
    })
    .sort((left, right) => {
      if (left.isMutual !== right.isMutual) {
        return Number(right.isMutual) - Number(left.isMutual)
      }

      if (left.isFollowing !== right.isFollowing) {
        return Number(right.isFollowing) - Number(left.isFollowing)
      }

      return left.nombre.localeCompare(right.nombre, 'es')
    })
}

export function ComunidadScreen({ onOpenEntity, onOpenSearch }) {
  const {
    addComment,
    addGroupMember,
    addReaction,
    categories,
    comments,
    createInspirationList,
    currentUser,
    dishEntries,
    dishTypes,
    follows,
    followUser,
    groupMembers,
    groupsForCurrentUser,
    inspirationLists,
    joinGroupByInviteCode,
    loadComments,
    loadFollows,
    loadInspirationLists,
    loadRecommendations,
    markRecommendationSeen,
    mutualFollows,
    recommendations,
    removeComment,
    removeReaction,
    restaurants,
    saveToList,
    socialLoadState,
    unfollowUser,
    updateComment,
    users,
    pendingGroupsForCurrentUser,
  } = useAppState()
  const [queryState, setQueryState] = useScreenQueryState(COMMUNITY_QUERY_SCHEMA)
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
  const [pendingFriendId, setPendingFriendId] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteStatus, setInviteStatus] = useState({ tone: '', message: '' })
  const [isJoiningGroup, setIsJoiningGroup] = useState(false)
  const [isGroupFormOpen, setIsGroupFormOpen] = useState(false)
  const [pendingGroupId, setPendingGroupId] = useState('')
  const [selectedUserByGroupId, setSelectedUserByGroupId] = useState({})
  const [groupStatusById, setGroupStatusById] = useState({})
  const { tab, page, categoryIds, dishTypeIds, priceRange, minScore, datePreset } =
    queryState
  const filters = useMemo(
    () => ({
      categoryIds,
      dishTypeIds,
      priceRange,
      minScore,
      datePreset,
    }),
    [categoryIds, datePreset, dishTypeIds, minScore, priceRange],
  )
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
  const socialProfiles = useMemo(
    () =>
      buildSocialProfiles({
        currentUserId: currentUser.id,
        follows,
        users,
      }),
    [currentUser.id, follows, users],
  )
  const groupMembersByGroupId = useMemo(
    () =>
      groupMembers.reduce((acc, member) => {
        acc[member.group_id] ??= []
        acc[member.group_id].push(member)
        return acc
      }, {}),
    [groupMembers],
  )
  const manageableGroups = useMemo(
    () =>
      groupsForCurrentUser.filter((group) => {
        const currentMembership = groupMembers.find(
          (member) =>
            member.group_id === group.id &&
            member.user_id === currentUser.id &&
            member.status === 'active',
        )

        return ['owner', 'admin'].includes(currentMembership?.role ?? '')
      }),
    [currentUser.id, groupMembers, groupsForCurrentUser],
  )
  const candidateUsersByGroupId = useMemo(() => {
    return manageableGroups.reduce((acc, group) => {
      const memberIds = new Set(
        (groupMembersByGroupId[group.id] ?? [])
          .filter((member) => member.status === 'active')
          .map((member) => member.user_id),
      )

      acc[group.id] = socialProfiles.filter((user) => !memberIds.has(user.id))
      return acc
    }, {})
  }, [groupMembersByGroupId, manageableGroups, socialProfiles])

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
    setQueryState({
      ...DEFAULT_FILTERS,
      page: 1,
    })
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

  async function handleToggleFollow(user) {
    try {
      setPendingFriendId(user.id)

      if (user.isFollowing) {
        await unfollowUser(user.id)
        return
      }

      await followUser(user.id)
    } finally {
      setPendingFriendId('')
    }
  }

  async function handleJoinGroup(event) {
    event.preventDefault()
    setInviteStatus({ tone: '', message: '' })

    try {
      setIsJoiningGroup(true)
      const response = await joinGroupByInviteCode(inviteCode)
      setInviteCode('')
      setInviteStatus({
        tone: 'success',
        message:
          response.groupMember?.status === 'pending'
            ? 'Solicitud enviada ✅'
            : 'Guardado ✅',
      })
    } catch (error) {
      setInviteStatus({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo entrar en el grupo.',
      })
    } finally {
      setIsJoiningGroup(false)
    }
  }

  async function handleAddMember(groupId) {
    const targetUserId = selectedUserByGroupId[groupId]

    if (!targetUserId) {
      setGroupStatusById((current) => ({
        ...current,
        [groupId]: {
          tone: 'error',
          message: 'Selecciona antes a la persona que quieres añadir.',
        },
      }))
      return
    }

    try {
      setPendingGroupId(groupId)
      await addGroupMember(groupId, { user_id: targetUserId })
      setSelectedUserByGroupId((current) => ({
        ...current,
        [groupId]: '',
      }))
      setGroupStatusById((current) => ({
        ...current,
        [groupId]: { tone: 'success', message: 'Guardado ✅' },
      }))
    } catch (error) {
      setGroupStatusById((current) => ({
        ...current,
        [groupId]: {
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'No se pudo añadir la persona al grupo.',
        },
      }))
    } finally {
      setPendingGroupId('')
    }
  }

  async function handleOpenRecommendation(item) {
    await markRecommendationSeen(item.id)
    setDismissedRecommendationIds((current) => [...current, item.id])
    setSelectedEntry(item.entry)
  }

  async function handleEditComment(commentId, payload) {
    await updateComment(commentId, payload)

    if (selectedEntry?.id) {
      await loadComments(selectedEntry.id)
    }
  }

  async function handleDeleteComment(commentId) {
    await removeComment(commentId)
  }

  const selectedComments = selectedEntry
    ? comments
        .filter((comment) => comment.dish_entry_id === selectedEntry.id)
        .map((comment) => ({
          ...comment,
          canEdit: comment.user_id === currentUser.id,
        }))
    : []

  return (
    <section className="screen screen--explore" aria-label="Pantalla de explorar">
      <div className="community-screen__hub">
        <article className="surface-card community-screen__social-card">
          <div className="section-header">
            <div>
              <h2>Tu red</h2>
              <p className="screen-note">
                {socialProfiles.length > 0
                  ? `${socialProfiles.filter((user) => user.isMutual).length} amistades mutuas activas`
                  : 'Empieza siguiendo perfiles para mover la comunidad.'}
              </p>
            </div>
            <button className="pill-button" type="button" onClick={onOpenSearch}>
              Buscar amigos
            </button>
          </div>

          {socialProfiles.length > 0 ? (
            <div className="community-screen__social-list">
              {socialProfiles.slice(0, 6).map((user) => (
                <article key={user.id} className="community-screen__social-item">
                  <div>
                    <strong>{user.nombre}</strong>
                    <p>{user.bio || user.relationLabel}</p>
                  </div>
                  <button
                    className="pill-button"
                    type="button"
                    disabled={pendingFriendId === user.id}
                    onClick={() => handleToggleFollow(user)}
                  >
                    {pendingFriendId === user.id
                      ? 'Cargando...'
                      : user.isFollowing
                        ? 'Dejar de seguir'
                        : 'Seguir'}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="community-empty-copy">
              Aún no tienes conexiones activas. Usa Buscar amigos para empezar.
            </p>
          )}
        </article>

        <article className="surface-card community-screen__social-card">
          <div className="section-header">
            <div>
              <h2>Grupos</h2>
              <p className="screen-note">
                {groupsForCurrentUser.length > 0
                  ? `${groupsForCurrentUser.length} grupos activos`
                  : 'Crea uno o entra con código.'}
              </p>
            </div>
            <button
              className="pill-button"
              type="button"
              onClick={() => setIsGroupFormOpen((current) => !current)}
            >
              {isGroupFormOpen ? 'Cerrar' : 'Crear grupo'}
            </button>
          </div>

          {isGroupFormOpen ? (
            <div className="community-screen__group-form">
              <GroupForm
                onCancel={() => setIsGroupFormOpen(false)}
                onSaved={() => setIsGroupFormOpen(false)}
              />
            </div>
          ) : null}

          <form className="community-screen__join-group" onSubmit={handleJoinGroup}>
            <label className="field">
              <span>Entrar con código</span>
              <input
                type="text"
                maxLength="6"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                placeholder="ABC123"
              />
            </label>
            <button className="primary-button" type="submit" disabled={isJoiningGroup}>
              {isJoiningGroup ? 'Cargando...' : 'Unirme'}
            </button>
          </form>

          {inviteStatus.message ? (
            <div className={`status-banner status-banner--${inviteStatus.tone || 'info'}`}>
              <strong>{inviteStatus.tone === 'success' ? 'Estado' : 'Revisión'}</strong>
              <p>{inviteStatus.message}</p>
            </div>
          ) : null}

          {groupsForCurrentUser.length > 0 ? (
            <div className="community-screen__group-list">
              {groupsForCurrentUser.map((group) => {
                const activeMembers = (groupMembersByGroupId[group.id] ?? []).filter(
                  (member) => member.status === 'active',
                )
                const canManageGroup = manageableGroups.some(
                  (manageableGroup) => manageableGroup.id === group.id,
                )
                const candidates = candidateUsersByGroupId[group.id] ?? []
                const status = groupStatusById[group.id]

                return (
                  <article key={group.id} className="community-screen__group-item">
                    <div className="community-screen__group-head">
                      <div>
                        <strong>{group.nombre}</strong>
                        <p>
                          {group.tipo} · {activeMembers.length} miembros · código{' '}
                          <strong>{group.invite_code}</strong>
                        </p>
                      </div>
                      <button
                        className="pill-button"
                        type="button"
                        onClick={() => onOpenEntity?.({ type: 'group', id: group.id })}
                      >
                        Ver
                      </button>
                    </div>

                    {canManageGroup ? (
                      <div className="community-screen__group-actions">
                        <label className="field">
                          <span>Añadir persona</span>
                          <select
                            value={selectedUserByGroupId[group.id] ?? ''}
                            onChange={(event) =>
                              setSelectedUserByGroupId((current) => ({
                                ...current,
                                [group.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Selecciona un contacto</option>
                            {candidates.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.nombre} · {user.relationLabel}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="primary-button"
                          type="button"
                          disabled={pendingGroupId === group.id || candidates.length === 0}
                          onClick={() => handleAddMember(group.id)}
                        >
                          {pendingGroupId === group.id ? 'Guardando...' : 'Añadir'}
                        </button>
                      </div>
                    ) : null}

                    {canManageGroup && candidates.length === 0 ? (
                      <p className="community-empty-copy">
                        No tienes más contactos disponibles para añadir aquí ahora mismo.
                      </p>
                    ) : null}

                    {status?.message ? (
                      <p
                        className={`community-screen__inline-status community-screen__inline-status--${status.tone}`}
                      >
                        {status.message}
                      </p>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="community-empty-copy">
              Aún no perteneces a ningún grupo. Crea uno o usa un código de invitación.
            </p>
          )}

          {pendingGroupsForCurrentUser.length > 0 ? (
            <div className="community-screen__group-list">
              {pendingGroupsForCurrentUser.map((group) => (
                <article key={group.id} className="community-screen__group-item">
                  <div className="community-screen__group-head">
                    <div>
                      <strong>{group.nombre}</strong>
                      <p>{group.tipo} · solicitud pendiente de aprobación</p>
                    </div>
                    <button
                      className="pill-button"
                      type="button"
                      onClick={() => onOpenEntity?.({ type: 'group', id: group.id })}
                    >
                      Ver
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </article>
      </div>

      <div className="community-screen__subtabs">
        <button
          className={`community-screen__subtab${tab === 'explorar' ? ' community-screen__subtab--active' : ''}`}
          type="button"
          onClick={() => {
            setQueryState({ tab: 'explorar', page: 1 })
          }}
        >
          Explorar
        </button>
        <button
          className={`community-screen__subtab${tab === 'amigos' ? ' community-screen__subtab--active' : ''}`}
          type="button"
          onClick={() => {
            setQueryState({ tab: 'amigos', page: 1 })
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
          setQueryState({
            ...nextFilters,
            page: 1,
          })
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
              onReactEntry={(entry) => {
                setSelectedEntry(entry)
              }}
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
          onReactEntry={(entry) => {
            setSelectedEntry(entry)
          }}
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
        onChange={(nextPage) => setQueryState({ page: nextPage })}
      />

      {selectedEntry ? (
        <EntryDetailModal
          comments={selectedComments}
          entry={selectedEntry}
          isSaving={isSaving}
          mutualFollows={mutualFollows}
          onClose={() => setSelectedEntry(null)}
          onComment={handleComment}
          onDeleteComment={handleDeleteComment}
          onOpenRestaurant={(restaurant) => {
            setSelectedEntry(null)
            onOpenEntity?.({ type: 'restaurant', id: restaurant.id })
          }}
          onReact={handleReact}
          onSave={handleSaveEntry}
          onUpdateComment={handleEditComment}
        />
      ) : null}
    </section>
  )
}
