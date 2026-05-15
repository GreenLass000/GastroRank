export function BottomNav({ activeId, hideLabels = false, items, onChange }) {
  return (
    <nav
      className={`bottom-nav${hideLabels ? ' bottom-nav--icons-only' : ''}`}
      aria-label="Navegación principal"
    >
      {items.map((item) => {
        const isActive = item.id === activeId

        return (
          <button
            key={item.id}
            className={`bottom-nav__button${isActive ? ' bottom-nav__button--active' : ''}`}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            {!hideLabels ? <span className="bottom-nav__label">{item.label}</span> : null}
          </button>
        )
      })}
    </nav>
  )
}
