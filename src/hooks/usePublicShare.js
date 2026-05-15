import { useCallback, useState } from 'react'
import { createPublicShareToken } from '../lib/api.js'

const DEFAULT_STATUS = { tone: '', message: '' }

function sanitizeFilters(filters = {}) {
  return Object.fromEntries(
    Object.entries(filters).filter(([key, value]) => {
      if (key === 'filterOrigin') {
        return false
      }

      if (value == null) {
        return false
      }

      if (Array.isArray(value) && value.length === 0) {
        return false
      }

      return true
    }),
  )
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('No se pudo copiar el enlace automáticamente.')
  }
}

export function usePublicShare() {
  const [isSharing, setIsSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState(DEFAULT_STATUS)

  const clearShareStatus = useCallback(() => {
    setShareStatus(DEFAULT_STATUS)
  }, [])

  const copyPublicShareLink = useCallback(
    async ({ context, filters, groupId = null, rankingType }) => {
      clearShareStatus()
      setIsSharing(true)

      try {
        const response = await createPublicShareToken({
          context,
          ranking_type: rankingType,
          filters: sanitizeFilters(filters),
          group_id: groupId,
        })
        const shareUrl = `${window.location.origin}/informe?share=${response.shareToken.token}`

        await copyText(shareUrl)
        setShareStatus({
          tone: 'success',
          message: 'Guardado ✅ — Enlace público copiado al portapapeles.',
        })

        return shareUrl
      } catch (error) {
        setShareStatus({
          tone: 'error',
          message: `Error al guardar ❌ — ${error instanceof Error ? error.message : 'No se pudo compartir el ranking.'}`,
        })
        return ''
      } finally {
        setIsSharing(false)
      }
    },
    [clearShareStatus],
  )

  return {
    clearShareStatus,
    copyPublicShareLink,
    isSharing,
    shareStatus,
  }
}
