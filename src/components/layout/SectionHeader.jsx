export function SectionHeader({
  actionAriaLabel = '',
  actionClassName = '',
  actionContent = null,
  actionLabel,
  onAction,
  title,
}) {
  const resolvedActionContent = actionContent ?? actionLabel

  return (
    <div className="section-header">
      <h2>{title}</h2>
      {resolvedActionContent && onAction ? (
        <button
          type="button"
          className={actionClassName}
          aria-label={actionAriaLabel || undefined}
          onClick={onAction}
        >
          {resolvedActionContent}
        </button>
      ) : null}
    </div>
  )
}
