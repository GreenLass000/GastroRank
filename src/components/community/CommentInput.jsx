import { useMemo, useState } from 'react'

function replaceLastMention(text, replacement) {
  return text.replace(/@[\wáéíóúñ:-]*$/i, replacement)
}

export function CommentInput({
  dishName,
  mutualFollows,
  onSubmit,
  restaurantName,
}) {
  const [value, setValue] = useState('')
  const [mentions, setMentions] = useState([])
  const mentionMatch = value.match(/@([\wáéíóúñ:-]*)$/i)
  const query = mentionMatch?.[1]?.toLowerCase() ?? ''

  const suggestions = useMemo(() => {
    if (!mentionMatch) {
      return []
    }

    const userSuggestions = mutualFollows
      .filter((user) => user.nombre.toLowerCase().includes(query))
      .slice(0, 5)
      .map((user) => ({
        key: `user:${user.id}`,
        type: 'user',
        value: user.id,
        label: user.nombre,
        insertion: `@${user.nombre} `,
      }))

    const staticSuggestions = [
      {
        key: `restaurant:${restaurantName}`,
        type: 'restaurant',
        value: restaurantName,
        label: `restaurante:${restaurantName}`,
        insertion: `@restaurante:${restaurantName} `,
      },
      {
        key: `dish:${dishName}`,
        type: 'dish',
        value: dishName,
        label: `plato:${dishName}`,
        insertion: `@plato:${dishName} `,
      },
    ].filter((item) => item.value.toLowerCase().includes(query))

    return [...userSuggestions, ...staticSuggestions].slice(0, 6)
  }, [dishName, mentionMatch, mutualFollows, query, restaurantName])

  async function handleSubmit(event) {
    event.preventDefault()

    if (!value.trim()) {
      return
    }

    await onSubmit?.({
      text: value.trim(),
      mentions,
    })
    setValue('')
    setMentions([])
  }

  function handlePickSuggestion(suggestion) {
    setValue((current) => replaceLastMention(current, suggestion.insertion))
    setMentions((current) => {
      if (current.some((item) => item.type === suggestion.type && item.value === suggestion.value)) {
        return current
      }

      return [
        ...current,
        {
          type: suggestion.type,
          value: suggestion.value,
          label: suggestion.label,
        },
      ]
    })
  }

  return (
    <form className="community-comment-input" onSubmit={handleSubmit}>
      <textarea
        rows="3"
        placeholder="Añade un comentario y usa @ para mencionar..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {suggestions.length > 0 ? (
        <div className="community-mention-dropdown">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.key}
              type="button"
              onClick={() => handlePickSuggestion(suggestion)}
            >
              @{suggestion.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="community-comment-input__actions">
        <button className="primary-button" type="submit">
          Comentar
        </button>
      </div>
    </form>
  )
}
