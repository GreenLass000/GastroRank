import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../../hooks/useAppState.js'
import {
  formatDate,
  formatRelativePrice,
  formatScore,
  formatShortAddress,
} from '../../lib/format.js'
import { generateGoogleMapsUrl } from '../../lib/maps.js'
import { getScoreTone } from '../../lib/scoring.js'
import { AddDishWizard } from '../forms/AddDishWizard.jsx'
import { CategoryForm } from '../forms/CategoryForm.jsx'
import { DishTypeForm } from '../forms/DishTypeForm.jsx'
import { GroupForm } from '../forms/GroupForm.jsx'
import { ProfileForm } from '../forms/ProfileForm.jsx'
import { RestaurantForm } from '../forms/RestaurantForm.jsx'

function AvatarPreview({ value }) {
  if (!value) {
    return <span className="avatar-badge">👤</span>
  }

  if (
    value.startsWith('data:image/') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/')
  ) {
    return (
      <span className="avatar-badge avatar-badge--image">
        <img src={value} alt="" />
      </span>
    )
  }

  return <span className="avatar-badge">{value}</span>
}

function SectionList({ children, emptyDescription, hasItems, title }) {
  return (
    <article className="surface-card">
      <div className="section-header">
        <h2>{title}</h2>
      </div>
      <div className="list-stack">
        {hasItems ? children : (
          <article className="surface-card">
            <p>{emptyDescription}</p>
          </article>
        )}
      </div>
    </article>
  )
}

function normalizeTextValue(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function EntityDetailSheet({ target, onClose }) {
  const appState = useAppState()
  const [isEditing, setIsEditing] = useState(false)
  const [memberStatus, setMemberStatus] = useState({ tone: '', message: '' })
  const [memberActionId, setMemberActionId] = useState('')
  const [candidateQuery, setCandidateQuery] = useState('')
  const [transferTargetUserId, setTransferTargetUserId] = useState('')

  useEffect(() => {
    setIsEditing(false)
    setMemberStatus({ tone: '', message: '' })
    setMemberActionId('')
    setCandidateQuery('')
    setTransferTargetUserId('')
  }, [target?.id, target?.type])

  const resolvedEntity = useMemo(() => {
    if (!target) {
      return null
    }

    if (target.type === 'restaurant') {
      return appState.restaurants.find((restaurant) => restaurant.id === target.id) ?? null
    }

    if (target.type === 'dishEntry') {
      return appState.dishEntries.find((entry) => entry.id === target.id) ?? null
    }

    if (target.type === 'group') {
      return appState.groups.find((group) => group.id === target.id) ?? null
    }

    if (target.type === 'category') {
      return appState.categories.find((category) => category.id === target.id) ?? null
    }

    if (target.type === 'dishType') {
      return appState.dishTypes.find((dishType) => dishType.id === target.id) ?? null
    }

    if (target.type === 'user') {
      return appState.users.find((user) => user.id === target.id) ?? null
    }

    return null
  }, [
    appState.categories,
    appState.dishEntries,
    appState.dishTypes,
    appState.groups,
    appState.restaurants,
    appState.users,
    target,
  ])

  if (!target || !resolvedEntity) {
    return (
      <div className="detail-stack">
        <article className="surface-card">
          <strong>Elemento no disponible</strong>
          <p>Puede haber cambiado o dejado de estar cargado en la sesión actual.</p>
        </article>
      </div>
    )
  }

  if (isEditing) {
    if (target.type === 'restaurant') {
      return (
        <RestaurantForm
          initialValues={resolvedEntity}
          mode="edit"
          onClose={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false)
          }}
        />
      )
    }

    if (target.type === 'dishEntry') {
      return (
        <AddDishWizard
          entryToEdit={resolvedEntity}
          mode="edit"
          onClose={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false)
          }}
        />
      )
    }

    if (target.type === 'group') {
      return (
        <GroupForm
          initialValues={resolvedEntity}
          mode="edit"
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false)
          }}
        />
      )
    }

    if (target.type === 'category') {
      return (
        <CategoryForm
          initialValues={resolvedEntity}
          mode="edit"
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false)
          }}
        />
      )
    }

    if (target.type === 'dishType') {
      return (
        <DishTypeForm
          initialValues={resolvedEntity}
          mode="edit"
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false)
          }}
        />
      )
    }

    if (target.type === 'user') {
      return (
        <ProfileForm
          initialValues={resolvedEntity}
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false)
          }}
        />
      )
    }
  }

  if (target.type === 'restaurant') {
    const restaurantEntries = appState.dishEntries
      .filter((entry) => entry.restaurant_id === resolvedEntity.id)
      .sort((left, right) => right.puntuacion_general - left.puntuacion_general)
    const restaurantMapsUrl =
      resolvedEntity.google_maps_url || generateGoogleMapsUrl(resolvedEntity)
    const topEntries = restaurantEntries.slice(0, 3).map((entry) => ({
      ...entry,
      dishTypeName:
        appState.dishTypes.find((dishType) => dishType.id === entry.tipo_plato_id)?.nombre ??
        entry.nombre_plato ??
        'Plato',
    }))

    return (
      <div className="detail-stack">
        <article className="surface-card">
          <div className="ranking-card__meta">
            <div>
              <strong>{resolvedEntity.nombre}</strong>
              <p>
                {formatShortAddress(resolvedEntity.direccion_texto)} •{' '}
                {resolvedEntity.precio_rango}
              </p>
            </div>
            <span
              className={`ranking-card__score ranking-card__score--${getScoreTone(resolvedEntity.restaurant_score)}`}
            >
              {formatScore(resolvedEntity.restaurant_score)}
            </span>
          </div>
          {resolvedEntity.cover_photo_url ? (
            <img
              className="detail-image"
              src={resolvedEntity.cover_photo_url}
              alt={resolvedEntity.nombre}
            />
          ) : null}
          {resolvedEntity.notas ? <p>{resolvedEntity.notas}</p> : null}
          <div className="detail-grid">
            <span className="status-pill">
              {resolvedEntity.total_entries} platos valorados
            </span>
            {resolvedEntity.direccion_texto ? (
              <span className="status-pill">
                {formatShortAddress(resolvedEntity.direccion_texto)}
              </span>
            ) : null}
            {(resolvedEntity.tags ?? []).map((tag) => (
              <span key={tag} className="status-pill">
                #{tag}
              </span>
            ))}
          </div>
          <div className="modal-actions">
            <button className="pill-button" type="button" onClick={onClose}>
              Cerrar
            </button>
            {restaurantMapsUrl ? (
              <button
                className="pill-button"
                type="button"
                onClick={() => {
                  window.open(restaurantMapsUrl, '_blank', 'noreferrer')
                }}
              >
                🗺 Cómo llegar
              </button>
            ) : null}
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsEditing(true)}
            >
              Editar restaurante
            </button>
          </div>
        </article>

        <SectionList
          title="Mejores platos"
          emptyDescription="Todavía no hay platos valorados aquí."
          hasItems={topEntries.length > 0}
        >
          {topEntries.map((entry) => (
            <article key={entry.id} className="list-card">
              <div className="ranking-card__meta">
                <div>
                  <strong>{entry.dishTypeName}</strong>
                  <p>{formatDate(entry.fecha)} • {entry.visibility}</p>
                </div>
                <span
                  className={`ranking-card__score ranking-card__score--${getScoreTone(entry.puntuacion_general)}`}
                >
                  {formatScore(entry.puntuacion_general)}
                </span>
              </div>
            </article>
          ))}
        </SectionList>
      </div>
    )
  }

  if (target.type === 'dishEntry') {
    const restaurant =
      appState.restaurants.find((item) => item.id === resolvedEntity.restaurant_id) ?? null
    const dishType =
      appState.dishTypes.find((item) => item.id === resolvedEntity.tipo_plato_id) ?? null
    const category =
      appState.categories.find((item) => item.id === resolvedEntity.categoria_id) ?? null
    const author =
      appState.users.find((item) => item.id === resolvedEntity.created_by_user_id) ?? null
    const canEditEntry = resolvedEntity.created_by_user_id === appState.currentUser?.id

    return (
      <div className="detail-stack">
        <article className="surface-card">
          <div className="ranking-card__meta">
            <div>
              <strong>{resolvedEntity.nombre_plato || dishType?.nombre || 'Plato'}</strong>
              <p>
                {restaurant?.nombre || 'Restaurante'} • {formatDate(resolvedEntity.fecha)}
              </p>
            </div>
            <span
              className={`ranking-card__score ranking-card__score--${getScoreTone(resolvedEntity.puntuacion_general)}`}
            >
              {formatScore(resolvedEntity.puntuacion_general)}
            </span>
          </div>
          {resolvedEntity.foto_url ? (
            <img className="detail-image" src={resolvedEntity.foto_url} alt="" />
          ) : null}
          <div className="detail-grid">
            <span className="status-pill">Autor: {author?.nombre || 'Usuario'}</span>
            <span className="status-pill">Tipo: {dishType?.nombre || 'Plato'}</span>
            <span className="status-pill">
              Categoría: {category?.icono || '🍽️'} {category?.nombre || 'Sin categoría'}
            </span>
            <span className="status-pill">Visibilidad: {resolvedEntity.visibility}</span>
          </div>
          <div className="detail-grid">
            <span className="status-pill">Sabor {formatScore(resolvedEntity.sabor)}</span>
            <span className="status-pill">Textura {formatScore(resolvedEntity.textura)}</span>
            <span className="status-pill">
              Presentación {formatScore(resolvedEntity.presentacion)}
            </span>
            <span className="status-pill">
              Calidad/precio {formatScore(resolvedEntity.calidad_precio)}
            </span>
          </div>
          <p>Precio del plato: {formatRelativePrice(resolvedEntity.precio_plato)}</p>
          {resolvedEntity.notas ? <p>{resolvedEntity.notas}</p> : null}
          <div className="modal-actions">
            <button className="pill-button" type="button" onClick={onClose}>
              Cerrar
            </button>
            {canEditEntry ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                Editar valoración
              </button>
            ) : null}
          </div>
        </article>
      </div>
    )
  }

  if (target.type === 'group') {
    const currentUserId = appState.currentUser?.id ?? ''
    const members = appState.groupMembers
      .filter((member) => member.group_id === resolvedEntity.id)
      .map((member) => ({
        ...member,
        user:
          appState.users.find((user) => user.id === member.user_id) ?? null,
        userName:
          appState.users.find((user) => user.id === member.user_id)?.nombre ?? 'Usuario',
      }))
    const currentMembership = members.find((member) => member.user_id === currentUserId) ?? null
    const canManageGroup = ['owner', 'admin'].includes(currentMembership?.role ?? '')
    const canTransferOwnership = currentMembership?.role === 'owner'
    const activeMembers = members.filter((member) => member.status === 'active')
    const pendingMembers = members.filter((member) => member.status === 'pending')
    const relationLookup = new Set(
      (appState.follows ?? []).map(
        (follow) => `${follow.follower_user_id}:${follow.followed_user_id}`,
      ),
    )
    const memberUserIds = new Set(members.map((member) => member.user_id))
    const filteredCandidateUsers = appState.users
      .filter((user) => !memberUserIds.has(user.id))
      .filter((user) => {
        const normalizedQuery = normalizeTextValue(candidateQuery)

        if (!normalizedQuery) {
          return true
        }

        return normalizeTextValue(`${user.nombre} ${user.bio ?? ''}`).includes(normalizedQuery)
      })
      .map((user) => {
        const isFollowing = relationLookup.has(`${currentUserId}:${user.id}`)
        const followsYou = relationLookup.has(`${user.id}:${currentUserId}`)
        const rank = isFollowing && followsYou ? 0 : isFollowing ? 1 : followsYou ? 2 : 3

        return {
          ...user,
          relationLabel: isFollowing && followsYou
            ? 'Amistad mutua'
            : isFollowing
              ? 'Siguiendo'
              : followsYou
                ? 'Te sigue'
                : 'Usuario de la comunidad',
          relationRank: rank,
        }
      })
      .sort(
        (left, right) =>
          left.relationRank - right.relationRank ||
          left.nombre.localeCompare(right.nombre, 'es'),
      )
      .slice(0, 8)
    const transferCandidates = activeMembers.filter((member) => member.user_id !== currentUserId)

    async function handleUpdateMember(memberId, payload) {
      try {
        setMemberStatus({ tone: '', message: '' })
        setMemberActionId(memberId)
        await appState.updateGroupMember(resolvedEntity.id, memberId, payload)
        setMemberStatus({ tone: 'success', message: 'Guardado ✅' })
      } catch (error) {
        setMemberStatus({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'No se pudo actualizar el miembro.',
        })
      } finally {
        setMemberActionId('')
      }
    }

    async function handleRemoveMember(memberId) {
      try {
        setMemberStatus({ tone: '', message: '' })
        setMemberActionId(memberId)
        await appState.removeGroupMember(resolvedEntity.id, memberId)
        setMemberStatus({ tone: 'success', message: 'Guardado ✅' })
      } catch (error) {
        setMemberStatus({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'No se pudo quitar el miembro.',
        })
      } finally {
        setMemberActionId('')
      }
    }

    async function handleAddMember(userId) {
      try {
        setMemberStatus({ tone: '', message: '' })
        setMemberActionId(`add:${userId}`)
        await appState.addGroupMember(resolvedEntity.id, { user_id: userId })
        setMemberStatus({ tone: 'success', message: 'Guardado ✅' })
      } catch (error) {
        setMemberStatus({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'No se pudo añadir la persona al grupo.',
        })
      } finally {
        setMemberActionId('')
      }
    }

    async function handleLeaveGroup() {
      try {
        setMemberStatus({ tone: '', message: '' })
        setMemberActionId('leave')
        await appState.leaveGroup(resolvedEntity.id)
        onClose?.()
      } catch (error) {
        setMemberStatus({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'No se pudo salir del grupo.',
        })
      } finally {
        setMemberActionId('')
      }
    }

    async function handleTransferOwnership() {
      if (!transferTargetUserId) {
        setMemberStatus({
          tone: 'error',
          message: 'Selecciona antes a la persona que recibirá el ownership.',
        })
        return
      }

      try {
        setMemberStatus({ tone: '', message: '' })
        setMemberActionId('transfer')
        await appState.transferGroupOwnership(resolvedEntity.id, transferTargetUserId)
        setTransferTargetUserId('')
        setMemberStatus({ tone: 'success', message: 'Guardado ✅' })
      } catch (error) {
        setMemberStatus({
          tone: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'No se pudo transferir el ownership.',
        })
      } finally {
        setMemberActionId('')
      }
    }

    return (
      <div className="detail-stack">
        <article className="surface-card">
          <strong>{resolvedEntity.nombre}</strong>
          <p>
            {resolvedEntity.tipo} • {resolvedEntity.visibility} • acceso{' '}
            {resolvedEntity.join_policy}
          </p>
          <div className="detail-grid">
            <span className="status-pill">Código {resolvedEntity.invite_code}</span>
            <span className="status-pill">Creado {formatDate(resolvedEntity.created_at)}</span>
            <span className="status-pill">{activeMembers.length} activos</span>
            {pendingMembers.length > 0 ? (
              <span className="status-pill">{pendingMembers.length} pendientes</span>
            ) : null}
          </div>
          {memberStatus.message ? (
            <p className={`detail-note detail-note--${memberStatus.tone || 'info'}`}>
              {memberStatus.message}
            </p>
          ) : null}
          <div className="modal-actions">
            <button className="pill-button" type="button" onClick={onClose}>
              Cerrar
            </button>
            {canManageGroup ? (
              <button
                className="primary-button"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                Editar grupo
              </button>
            ) : null}
            {currentMembership && currentMembership.role !== 'owner' ? (
              <button
                className="pill-button"
                type="button"
                disabled={memberActionId === 'leave'}
                onClick={handleLeaveGroup}
              >
                {memberActionId === 'leave'
                  ? 'Guardando...'
                  : currentMembership.status === 'pending'
                    ? 'Cancelar solicitud'
                    : 'Salir del grupo'}
              </button>
            ) : null}
          </div>
          {currentMembership?.role === 'owner' ? (
            <p className="detail-note">
              Transfiere antes el ownership si quieres salir del grupo.
            </p>
          ) : null}
        </article>

        {canTransferOwnership ? (
          <article className="surface-card">
            <div className="section-header">
              <h2>Transferir ownership</h2>
            </div>
            <div className="detail-inline-form">
              <label className="field">
                <span>Nueva persona owner</span>
                <select
                  value={transferTargetUserId}
                  onChange={(event) => setTransferTargetUserId(event.target.value)}
                >
                  <option value="">Selecciona una persona activa</option>
                  {transferCandidates.map((member) => (
                    <option key={member.id} value={member.user_id}>
                      {member.userName} · {member.role}
                    </option>
                  ))}
                </select>
              </label>
              <div className="modal-actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={memberActionId === 'transfer' || transferCandidates.length === 0}
                  onClick={handleTransferOwnership}
                >
                  {memberActionId === 'transfer'
                    ? 'Guardando...'
                    : 'Transferir ownership'}
                </button>
              </div>
            </div>
          </article>
        ) : null}

        {canManageGroup ? (
          <article className="surface-card">
            <div className="section-header">
              <h2>Añadir personas</h2>
            </div>
            <div className="detail-inline-form">
              <label className="field">
                <span>Buscar en comunidad</span>
                <input
                  type="search"
                  value={candidateQuery}
                  onChange={(event) => setCandidateQuery(event.target.value)}
                  placeholder="Nombre o bio..."
                />
              </label>
              {filteredCandidateUsers.length > 0 ? (
                <div className="list-stack">
                  {filteredCandidateUsers.map((user) => (
                    <article key={user.id} className="list-card">
                      <div className="detail-member-card__meta">
                        <div>
                          <strong>{user.nombre}</strong>
                          <p>{user.bio || user.relationLabel}</p>
                        </div>
                        <button
                          className="pill-button"
                          type="button"
                          disabled={memberActionId === `add:${user.id}`}
                          onClick={() => handleAddMember(user.id)}
                        >
                          {memberActionId === `add:${user.id}` ? 'Guardando...' : 'Añadir'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="detail-note">
                  No hay personas disponibles con esa búsqueda.
                </p>
              )}
            </div>
          </article>
        ) : null}

        <SectionList
          title="Miembros activos"
          emptyDescription="No hay miembros visibles en este grupo."
          hasItems={activeMembers.length > 0}
        >
          {activeMembers.map((member) => (
            <article key={member.id} className="list-card">
              <strong>{member.userName}</strong>
              <p>
                {member.role} • {member.status}
              </p>
              {canManageGroup && member.role !== 'owner' && member.user_id !== currentUserId ? (
                <div className="modal-actions">
                  <button
                    className="pill-button"
                    type="button"
                    disabled={memberActionId === member.id}
                    onClick={() =>
                      handleUpdateMember(member.id, {
                        role: member.role === 'admin' ? 'member' : 'admin',
                      })
                    }
                  >
                    {memberActionId === member.id
                      ? 'Guardando...'
                      : member.role === 'admin'
                        ? 'Quitar admin'
                        : 'Hacer admin'}
                  </button>
                  <button
                    className="pill-button"
                    type="button"
                    disabled={memberActionId === member.id}
                    onClick={() => handleRemoveMember(member.id)}
                  >
                    Quitar
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </SectionList>

        {canManageGroup ? (
          <SectionList
            title="Solicitudes pendientes"
            emptyDescription="No hay solicitudes pendientes ahora mismo."
            hasItems={pendingMembers.length > 0}
          >
            {pendingMembers.map((member) => (
              <article key={member.id} className="list-card">
                <strong>{member.userName}</strong>
                <p>Solicitud pendiente</p>
                <div className="modal-actions">
                  <button
                    className="pill-button"
                    type="button"
                    disabled={memberActionId === member.id}
                    onClick={() => handleUpdateMember(member.id, { status: 'active' })}
                  >
                    {memberActionId === member.id ? 'Guardando...' : 'Aprobar'}
                  </button>
                  <button
                    className="pill-button"
                    type="button"
                    disabled={memberActionId === member.id}
                    onClick={() => handleRemoveMember(member.id)}
                  >
                    Rechazar
                  </button>
                </div>
              </article>
            ))}
          </SectionList>
        ) : null}
      </div>
    )
  }

  if (target.type === 'category') {
    const relatedDishTypes = appState.dishTypes.filter(
      (dishType) => dishType.categoria_id === resolvedEntity.id,
    )
    const relatedEntries = appState.dishEntries.filter(
      (entry) => entry.categoria_id === resolvedEntity.id,
    )

    return (
      <div className="detail-stack">
        <article className="surface-card">
          <strong>
            {resolvedEntity.icono} {resolvedEntity.nombre}
          </strong>
          <p>Scope {resolvedEntity.scope}</p>
          <div className="detail-grid">
            <span className="status-pill">{relatedDishTypes.length} tipos asociados</span>
            <span className="status-pill">{relatedEntries.length} entradas</span>
          </div>
          <div className="modal-actions">
            <button className="pill-button" type="button" onClick={onClose}>
              Cerrar
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsEditing(true)}
            >
              Editar categoría
            </button>
          </div>
        </article>

        <SectionList
          title="Tipos de plato asociados"
          emptyDescription="Todavía no hay tipos de plato en esta categoría."
          hasItems={relatedDishTypes.length > 0}
        >
          {relatedDishTypes.map((dishType) => (
            <article key={dishType.id} className="list-card">
              <strong>{dishType.nombre}</strong>
              <p>{dishType.alias || 'Sin alias'}</p>
            </article>
          ))}
        </SectionList>
      </div>
    )
  }

  if (target.type === 'dishType') {
    const category =
      appState.categories.find((item) => item.id === resolvedEntity.categoria_id) ?? null
    const relatedEntries = appState.dishEntries
      .filter((entry) => entry.tipo_plato_id === resolvedEntity.id)
      .sort((left, right) => right.puntuacion_general - left.puntuacion_general)
      .slice(0, 5)
      .map((entry) => ({
        ...entry,
        restaurantName:
          appState.restaurants.find((restaurant) => restaurant.id === entry.restaurant_id)
            ?.nombre ?? 'Restaurante',
      }))

    return (
      <div className="detail-stack">
        <article className="surface-card">
          <strong>{resolvedEntity.nombre}</strong>
          <p>
            {resolvedEntity.alias || 'Sin alias'} • {category?.icono || '🍽️'}{' '}
            {category?.nombre || 'Sin categoría'}
          </p>
          <div className="detail-grid">
            <span className="status-pill">{relatedEntries.length} entradas recientes</span>
            <span className="status-pill">Scope {resolvedEntity.scope}</span>
          </div>
          <div className="modal-actions">
            <button className="pill-button" type="button" onClick={onClose}>
              Cerrar
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsEditing(true)}
            >
              Editar tipo
            </button>
          </div>
        </article>

        <SectionList
          title="Últimas valoraciones relacionadas"
          emptyDescription="Todavía no hay valoraciones para este tipo de plato."
          hasItems={relatedEntries.length > 0}
        >
          {relatedEntries.map((entry) => (
            <article key={entry.id} className="list-card">
              <div className="ranking-card__meta">
                <div>
                  <strong>{entry.restaurantName}</strong>
                  <p>{formatDate(entry.fecha)} • {entry.visibility}</p>
                </div>
                <span
                  className={`ranking-card__score ranking-card__score--${getScoreTone(entry.puntuacion_general)}`}
                >
                  {formatScore(entry.puntuacion_general)}
                </span>
              </div>
            </article>
          ))}
        </SectionList>
      </div>
    )
  }

  return (
    <div className="detail-stack">
      <article className="surface-card">
        <div className="profile-row">
          <div className="ranking-card__title">
            <AvatarPreview value={resolvedEntity.avatar_url} />
            <div>
              <strong>{resolvedEntity.nombre}</strong>
              <p>Perfil activo</p>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="pill-button" type="button" onClick={onClose}>
            Cerrar
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => setIsEditing(true)}
          >
            Editar perfil
          </button>
        </div>
      </article>
    </div>
  )
}
