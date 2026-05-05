import { CommunityCard } from './CommunityCard.jsx'

export function CommunityGrid({ entries, onOpenEntry, onSaveEntry }) {
  return (
    <div className="community-grid">
      {entries.map((entry) => (
        <CommunityCard
          key={entry.id}
          entry={entry}
          onOpen={onOpenEntry}
          onSave={onSaveEntry}
        />
      ))}
    </div>
  )
}
