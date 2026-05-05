import { COMMUNITY_REACTIONS, getReactionConfig } from './communityConfig.js'

export function ReactionRow({
  mode = 'compact',
  onReact,
  reactionsSummary = [],
  userReactionType = '',
}) {
  const compactSummary =
    mode === 'compact' ? reactionsSummary.slice(0, 3) : reactionsSummary

  const items =
    mode === 'compact'
      ? compactSummary
      : COMMUNITY_REACTIONS.map((reaction) => ({
          reaction_type: reaction.id,
          count:
            reactionsSummary.find((item) => item.reaction_type === reaction.id)?.count ?? 0,
        }))

  return (
    <div className={`community-reaction-row community-reaction-row--${mode}`}>
      {items.map((item) => {
        const reaction = getReactionConfig(item.reaction_type)
        const isActive = userReactionType === reaction.id

        return (
          <button
            key={reaction.id}
            className={`community-reaction-chip${isActive ? ' community-reaction-chip--active' : ''}`}
            type="button"
            onClick={() => onReact?.(reaction.id)}
          >
            <span aria-hidden="true">{reaction.icon}</span>
            <span>{mode === 'modal' ? reaction.label : item.count}</span>
            {mode === 'modal' ? <strong>{item.count}</strong> : null}
          </button>
        )
      })}
    </div>
  )
}
