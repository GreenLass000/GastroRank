export function StatusBanner({ tone = 'info', title, detail }) {
  return (
    <div className={`status-banner status-banner--${tone}`} role="status">
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}
