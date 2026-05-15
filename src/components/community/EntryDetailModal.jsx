import { useEffect, useState } from 'react'
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
  onDeleteComment,
  onOpenRestaurant,
  onReact,
  onSave,
  onUpdateComment,
}) {
  const [editingCommentId, setEditingCommentId] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [deleteCommentId, setDeleteCommentId] = useState('')
  const [commentActionError, setCommentActionError] = useState('')
  const [isCommentActionLoading, setIsCommentActionLoading] = useState(false)

  useEffect(() => {
    setEditingCommentId('')
    setCommentDraft('')
    setDeleteCommentId('')
    setCommentActionError('')
    setIsCommentActionLoading(false)
  }, [entry?.id])

  async function handleSaveComment(comment) {
    const trimmed = commentDraft.trim()

    if (!trimmed) {
      setCommentActionError('El comentario no puede quedar vacío.')
      return
    }

    try {
      setCommentActionError('')
      setIsCommentActionLoading(true)
      await onUpdateComment?.(comment.id, {
        text: trimmed,
        mentions: comment.mentions ?? [],
      })
      setEditingCommentId('')
      setCommentDraft('')
    } catch (error) {
      setCommentActionError(
        error instanceof Error ? error.message : 'No se pudo editar el comentario.',
      )
    } finally {
      setIsCommentActionLoading(false)
    }
  }

  async function handleDeleteComment(comment) {
    try {
      setCommentActionError('')
      setIsCommentActionLoading(true)
      await onDeleteComment?.(comment.id)
      setDeleteCommentId('')
    } catch (error) {
      setCommentActionError(
        error instanceof Error ? error.message : 'No se pudo borrar el comentario.',
      )
    } finally {
      setIsCommentActionLoading(false)
    }
  }

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
            {commentActionError ? (
              <p className="community-comment__error">{commentActionError}</p>
            ) : null}
            {comments.length > 0 ? (
              comments.map((comment) => (
                <article key={comment.id} className="community-comment">
                  <div className="community-comment__header">
                    <strong>{comment.user?.nombre ?? 'Usuario'}</strong>
                    {comment.canEdit ? (
                      <div className="community-comment__actions">
                        <button
                          className="pill-button"
                          type="button"
                          onClick={() => {
                            setDeleteCommentId('')
                            setCommentActionError('')
                            setEditingCommentId(comment.id)
                            setCommentDraft(comment.text)
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="pill-button"
                          type="button"
                          onClick={() => {
                            setEditingCommentId('')
                            setCommentDraft('')
                            setCommentActionError('')
                            setDeleteCommentId((current) =>
                              current === comment.id ? '' : comment.id,
                            )
                          }}
                        >
                          Borrar
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {editingCommentId === comment.id ? (
                    <div className="community-comment__editor">
                      <textarea
                        value={commentDraft}
                        onChange={(event) => setCommentDraft(event.target.value)}
                        rows="3"
                      />
                      <div className="community-comment__actions">
                        <button
                          className="pill-button"
                          type="button"
                          onClick={() => {
                            setEditingCommentId('')
                            setCommentDraft('')
                            setCommentActionError('')
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          className="primary-button"
                          type="button"
                          disabled={isCommentActionLoading}
                          onClick={() => handleSaveComment(comment)}
                        >
                          {isCommentActionLoading ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p>{comment.text}</p>
                  )}
                  {deleteCommentId === comment.id ? (
                    <div className="community-comment__confirm">
                      <p>¿Seguro que quieres borrar este comentario?</p>
                      <div className="community-comment__actions">
                        <button
                          className="pill-button"
                          type="button"
                          onClick={() => setDeleteCommentId('')}
                        >
                          Cancelar
                        </button>
                        <button
                          className="primary-button"
                          type="button"
                          disabled={isCommentActionLoading}
                          onClick={() => handleDeleteComment(comment)}
                        >
                          {isCommentActionLoading ? 'Guardando...' : 'Sí, borrar'}
                        </button>
                      </div>
                    </div>
                  ) : null}
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
