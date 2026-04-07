export function ToastCenter({ message, tone = 'success' }) {
  if (!message) {
    return null
  }

  return (
    <div className={`toast-center toast-center--${tone}`} role="status" aria-live="polite">
      {message}
    </div>
  )
}
