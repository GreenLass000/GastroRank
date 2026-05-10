export function EmptyState({
  actionLabel = '',
  className = '',
  description,
  onAction,
  title,
}) {
  return (
    <article className={`surface-card empty-state${className ? ` ${className}` : ''}`}>
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button className="primary-button" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </article>
  )
}
