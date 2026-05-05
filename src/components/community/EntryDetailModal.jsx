import { formatDate, formatRelativePrice, formatScore } from '../../lib/format.js'
import { CommentInput } from './CommentInput.jsx'
import { ReactionRow } from './ReactionRow.jsx'

function buildNotes(entry) {
  return entry.notas || 'Sin notas adicionales.'
}

export function EntryDetailModal({
  comments,
  entry,
  isSaving,
  mutualFollows,
  onClose,
  onComment,
  onOpenRestaurant,
  onReact,
  onSave,
}) {
  if (!entry) {
    return null
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-sheet community-entry-modal"
        role="dialog"
        aria-modal="true"
        aria-label={entry.nombre_plato ?? entry.dishType?.nombre ?? 'Detalle de plato'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-sheet__handle" aria-hidden="true" />
        <div className="modal-sheet__header">
          <h2>{entry.nombre_plato ?? entry.dishType?.nombre ?? 'Plato'}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {entry.foto_url ? (
          <img
            className="community-entry-modal__image"
            src={entry.foto_url}
            alt={entry.nombre_plato ?? entry.dishType?.nombre ?? 'Plato'}
          />
        ) : null}

        <div className="community-entry-modal__body">
          <button
            className="community-entry-modal__restaurant"
            type="button"
            onClick={() => onOpenRestaurant?.(entry.restaurant)}
          >
            {entry.restaurant?.nombre ?? 'Restaurante'} · Ver restaurante completo →
          </button>

          <div className="community-entry-modal__meta">
            <span className="status-pill">General {formatScore(entry.puntuacion_general ?? 0)}</span>
            <span className="status-pill">
              {entry.author?.nombre ?? 'Usuario'} · {formatDate(entry.created_at)}
            </span>
            {typeof entry.precio_plato === 'number' ? (
              <span className="status-pill">{formatRelativePrice(entry.precio_plato)}</span>
            ) : null}
          </div>

          <div className="community-entry-modal__scores">
            <span>Sabor {formatScore(entry.sabor ?? 0)}</span>
            <span>Textura {formatScore(entry.textura ?? 0)}</span>
            <span>Presentación {formatScore(entry.presentacion ?? 0)}</span>
            <span>Calidad/precio {formatScore(entry.calidad_precio ?? 0)}</span>
          </div>

          <p>{buildNotes(entry)}</p>

          <ReactionRow
            mode="modal"
            reactionsSummary={entry.reactions_summary ?? []}
            userReactionType={entry.user_reaction?.reaction_type ?? ''}
            onReact={onReact}
          />

          <button className="primary-button community-entry-modal__save" type="button" onClick={() => onSave?.(entry)} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar para inspo'}
          </button>

          <div className="community-entry-modal__comments">
            <strong>Comentarios</strong>
            {comments.length > 0 ? (
              comments.map((comment) => (
                <article key={comment.id} className="community-comment">
                  <strong>{comment.user?.nombre ?? 'Usuario'}</strong>
                  <p>{comment.text}</p>
                </article>
              ))
            ) : (
              <p className="community-empty-copy">Todavía no hay comentarios.</p>
            )}
            <CommentInput
              dishName={entry.nombre_plato ?? entry.dishType?.nombre ?? 'Plato'}
              mutualFollows={mutualFollows}
              onSubmit={onComment}
              restaurantName={entry.restaurant?.nombre ?? 'Restaurante'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
