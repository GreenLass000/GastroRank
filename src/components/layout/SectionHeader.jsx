export function SectionHeader({ actionLabel, onAction, title }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
