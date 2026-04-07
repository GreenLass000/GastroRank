import { PIN_STYLES } from '../lib/constants.js'
import { SectionHeader } from '../components/layout/SectionHeader.jsx'
import { useAppState } from '../hooks/useAppState.js'
import { formatDate } from '../lib/format.js'

export function ProfileScreen() {
  const {
    currentGroup,
    currentUser,
    defaultPinStyle,
    groupsForCurrentUser,
    profileStats,
    setDefaultPinStyle,
  } = useAppState()
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
        <div className="profile-row">
          <div className="ranking-card__title">
            <span className="avatar-badge" aria-hidden="true">
              {currentUser.avatar_url}
            </span>
            <div>
              <h2>{currentUser.nombre}</h2>
              <p>Perfil activo cargado desde el seed sincronizado con SQLite.</p>
            </div>
          </div>
        </div>
      </article>

      <div className="stat-grid">
        {stats.map((stat) => (
          <article key={stat.id} className="stat-card">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </article>
        ))}
      </div>

      <SectionHeader title="Mis grupos" actionLabel="Crear grupo" />
      <div className="list-stack">
        {groupsForCurrentUser.map((group) => (
          <article key={group.id} className="surface-card">
            <strong>{group.nombre}</strong>
            <p>
              {group.tipo} • código {group.invite_code} • creado{' '}
              {formatDate(group.created_at)}
            </p>
          </article>
        ))}
      </div>

      <SectionHeader title="Ajustes" actionLabel="Guardar" />
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
          <p>
            {currentGroup.nombre} • visibilidad {currentGroup.visibility} •{' '}
            política {currentGroup.join_policy}
          </p>
        </article>
      </div>
    </section>
  )
}
