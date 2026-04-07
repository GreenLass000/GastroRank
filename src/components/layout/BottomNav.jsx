export function BottomNav({ activeId, items, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {items.map((item) => {
        const isActive = item.id === activeId

        return (
          <button
            key={item.id}
            className={`bottom-nav__button${isActive ? ' bottom-nav__button--active' : ''}`}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
