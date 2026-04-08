import { useState } from 'react'
import { PIN_STYLES } from '../lib/constants.js'
import { SectionHeader } from '../components/layout/SectionHeader.jsx'
import { GroupForm } from '../components/forms/GroupForm.jsx'
import { useAppState } from '../hooks/useAppState.js'
import { formatDate } from '../lib/format.js'

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

export function ProfileScreen({ onOpenEntity }) {
  const {
    categories,
    currentGroup,
    currentUser,
    defaultPinStyle,
    dishTypes,
    groupsForCurrentUser,
    profileStats,
    setDefaultPinStyle,
  } = useAppState()
  const [isCreatorVisible, setIsCreatorVisible] = useState(false)
  const stats = [
    { id: 'dish', label: 'Platos', value: String(profileStats.totalPlatos) },
    {
      id: 'restaurants',
      label: 'Restaurantes',
      value: String(profileStats.totalRestaurantes),
    },
    { id: 'groups', label: 'Grupos', value: String(profileStats.grupos) },
  ]

  return (
    <section className="screen" aria-label="Pantalla de perfil">
      <article className="screen__hero">
        <button
          className="profile-row profile-row--button"
          type="button"
          onClick={() => onOpenEntity?.({ type: 'user', id: currentUser.id })}
        >
          <div className="ranking-card__title">
            <AvatarPreview value={currentUser.avatar_url} />
            <div>
              <h2>{currentUser.nombre}</h2>
              <p>Perfil activo con edición real de nombre y avatar.</p>
            </div>
          </div>
        </button>
      </article>

      <div className="stat-grid">
        {stats.map((stat) => (
          <article key={stat.id} className="stat-card">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </div>

      <SectionHeader
        title="Mis grupos"
        actionLabel={isCreatorVisible ? 'Cancelar' : 'Crear grupo'}
        onAction={() => setIsCreatorVisible((current) => !current)}
      />
      {isCreatorVisible ? (
        <GroupForm
          onCancel={() => setIsCreatorVisible(false)}
          onSaved={() => setIsCreatorVisible(false)}
        />
      ) : null}
      <div className="list-stack">
        {groupsForCurrentUser.map((group) => (
          <button
            key={group.id}
            className="surface-card surface-card--button"
            type="button"
            onClick={() => onOpenEntity?.({ type: 'group', id: group.id })}
          >
            <strong>{group.nombre}</strong>
            <p>
              {group.tipo} • código {group.invite_code} • creado{' '}
              {formatDate(group.created_at)}
            </p>
            <p>
              {group.visibility} • acceso {group.join_policy}
            </p>
          </button>
        ))}
      </div>

      <SectionHeader title="Ajustes" />
      <div className="list-stack">
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
          <strong>Grupo activo</strong>
          {currentGroup ? (
            <p>
              {currentGroup.nombre} • visibilidad {currentGroup.visibility} • política{' '}
              {currentGroup.join_policy}
            </p>
          ) : (
            <p>No tienes ningún grupo activo todavía.</p>
          )}
        </article>
      </div>

      <SectionHeader title="Catálogo editable" />
      <div className="list-stack">
        {categories.map((category) => (
          <button
            key={category.id}
            className="list-card list-card--button"
            type="button"
            onClick={() => onOpenEntity?.({ type: 'category', id: category.id })}
          >
            <strong>
              {category.icono} {category.nombre}
            </strong>
            <p>Categoría editable desde detalle.</p>
          </button>
        ))}
        {dishTypes.map((dishType) => (
          <button
            key={dishType.id}
            className="list-card list-card--button"
            type="button"
            onClick={() => onOpenEntity?.({ type: 'dishType', id: dishType.id })}
          >
            <strong>{dishType.nombre}</strong>
            <p>{dishType.alias || 'Sin alias'}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
