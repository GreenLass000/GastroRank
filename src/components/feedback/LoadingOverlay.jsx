export function LoadingOverlay({ message }) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="loading-overlay__card">
        <div className="loading-spinner" aria-hidden="true" />
        <strong>{message}</strong>
      </div>
    </div>
  )
}
