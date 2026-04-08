import { useMemo, useState } from 'react'
import { useAppState } from '../../hooks/useAppState.js'
import {
  formatDate,
  formatRelativePrice,
  formatScore,
} from '../../lib/format.js'
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

export function EntityDetailSheet({ target, onClose }) {
  const appState = useAppState()
  const [isEditing, setIsEditing] = useState(false)

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
                {resolvedEntity.direccion_texto || 'Sin dirección'} •{' '}
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
            <span className="status-pill">
              {resolvedEntity.lat.toFixed(5)}, {resolvedEntity.lng.toFixed(5)}
            </span>
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
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsEditing(true)}
            >
              Editar valoración
            </button>
          </div>
        </article>
      </div>
    )
  }

  if (target.type === 'group') {
    const members = appState.groupMembers
      .filter((member) => member.group_id === resolvedEntity.id)
      .map((member) => ({
        ...member,
        userName:
          appState.users.find((user) => user.id === member.user_id)?.nombre ?? 'Usuario',
      }))

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
              Editar grupo
            </button>
          </div>
        </article>

        <SectionList
          title="Miembros"
          emptyDescription="No hay miembros visibles en este grupo."
          hasItems={members.length > 0}
        >
          {members.map((member) => (
            <article key={member.id} className="list-card">
              <strong>{member.userName}</strong>
              <p>
                {member.role} • {member.status}
              </p>
            </article>
          ))}
        </SectionList>
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
