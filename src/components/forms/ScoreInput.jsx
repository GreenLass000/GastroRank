import { useEffect, useRef, useState } from 'react'
import { formatScore } from '../../lib/format.js'
import { getScoreTone } from '../../lib/scoring.js'

export function ScoreInput({ label, name, value, onChange }) {
  const numericValue = typeof value === 'number' ? value : 0
  const tone = getScoreTone(numericValue)
  const [isEditingExactValue, setIsEditingExactValue] = useState(false)
  const [exactValue, setExactValue] = useState(formatScore(numericValue))
  const inputRef = useRef(null)

  useEffect(() => {
    setExactValue(formatScore(numericValue))
  }, [numericValue])

  useEffect(() => {
    if (isEditingExactValue) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditingExactValue])

  function commitExactValue() {
    const parsedValue = Number(exactValue)
    const safeValue = Number.isNaN(parsedValue)
      ? numericValue
      : Math.min(10, Math.max(0, parsedValue))

    onChange(name, Number(safeValue.toFixed(1)))
    setIsEditingExactValue(false)
  }

  function handleExactValueKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitExactValue()
    }

    if (event.key === 'Escape') {
      setExactValue(formatScore(numericValue))
      setIsEditingExactValue(false)
    }
  }

  return (
    <article className="score-card">
      <div className="ranking-card__meta">
        <strong className="score-card__label">{label}</strong>
        {isEditingExactValue ? (
          <input
            ref={inputRef}
            className="score-card__exact-input"
            type="number"
            inputMode="decimal"
            min="0"
            max="10"
            step="0.1"
            value={exactValue}
            onBlur={commitExactValue}
            onChange={(event) => setExactValue(event.target.value)}
            onKeyDown={handleExactValueKeyDown}
          />
        ) : (
          <button
            className={`ranking-card__score ranking-card__score--${tone} score-card__score-button`}
            type="button"
            onClick={() => setIsEditingExactValue(true)}
          >
            {formatScore(numericValue)}
          </button>
        )}
      </div>

      <input
        className="score-card__range"
        type="range"
        min="0"
        max="10"
        step="0.1"
        value={numericValue}
        onChange={(event) => onChange(name, Number(event.target.value))}
      />
    </article>
  )
}
