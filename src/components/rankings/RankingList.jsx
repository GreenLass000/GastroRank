import { RankingCard } from './RankingCard.jsx'

export function RankingList({ entries, onSelect }) {
  if (entries.length === 0) {
    return (
      <article className="surface-card">
        <strong>Sin resultados todavía</strong>
        <p>Ajusta o resetea filtros para recuperar resultados en este contexto.</p>
      </article>
    )
  }

  return (
    <div className="list-stack">
      {entries.slice(0, 5).map((entry, index) => (
        <RankingCard
          key={entry.id}
          entry={entry}
          index={index}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
