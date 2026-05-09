import { useEffect } from 'react'

export function ModalSheet({
  children,
  eyebrow,
  fullHeight = false,
  immersive = false,
  onClose,
  title,
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`modal-sheet${immersive ? ' modal-sheet--immersive' : ''}${
          fullHeight ? ' modal-sheet--full-height' : ''
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-sheet__handle" aria-hidden="true" />
        <div className="modal-sheet__header">
          <div>
            {eyebrow ? <p className="modal-sheet__eyebrow">{eyebrow}</p> : null}
            <h2>{title}</h2>
          </div>
          <button
            autoFocus
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
