export function SectionHeader({ actionLabel, onAction, title }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {actionLabel ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
