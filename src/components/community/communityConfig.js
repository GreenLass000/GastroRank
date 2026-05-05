export const COMMUNITY_REACTIONS = [
  { id: 'quiero_probar', icon: '🤤', label: 'Quiero probar' },
  { id: 'ya_probe', icon: '✅', label: 'Ya probé' },
  { id: 'que_hambre', icon: '🔥', label: 'Qué hambre' },
  { id: 'mejorable', icon: '🛠️', label: 'Mejorable' },
  { id: 'paso', icon: '🙅', label: 'Paso' },
]

export function getReactionConfig(reactionType) {
  return (
    COMMUNITY_REACTIONS.find((reaction) => reaction.id === reactionType) ??
    COMMUNITY_REACTIONS[0]
  )
}
