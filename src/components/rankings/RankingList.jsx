import { RankingCard } from './RankingCard.jsx'

export function RankingList({
  entries,
  expandedEntryId = '',
  onToggle,
  renderExpandedContent,
}) {
  if (entries.length === 0) {
    return (
      <article className="surface-card">
        <strong>Sin resultados todavía</strong>
        <p>Ajusta o resetea filtros para recuperar resultados en este contexto.</p>
      </article>
    )
  }

  return (
    <div className="list-stack rankings-list">
      {entries.map((entry, index) => {
        const isExpanded = entry.id === expandedEntryId

        return (
          <div key={entry.id} className="rankings-list__item">
            <RankingCard
              entry={entry}
              index={index}
              isExpanded={isExpanded}
              onToggle={onToggle}
            />
            {isExpanded && renderExpandedContent ? renderExpandedContent(entry) : null}
          </div>
        )
      })}
    </div>
  )
}
