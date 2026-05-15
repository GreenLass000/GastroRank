import { CommunityCard } from './CommunityCard.jsx'

export function CommunityGrid({ entries, onOpenEntry, onReactEntry, onSaveEntry }) {
  return (
    <div className="community-grid">
      {entries.map((entry) => (
        <CommunityCard
          key={entry.id}
          entry={entry}
          onOpen={onOpenEntry}
          onReact={onReactEntry}
          onSave={onSaveEntry}
        />
      ))}
    </div>
  )
}
