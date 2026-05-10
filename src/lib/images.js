const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024
const IMAGE_COMPRESSION_THRESHOLD_BYTES = 1024 * 1024
const IMAGE_COMPRESSION_MIME_TYPE = 'image/jpeg'
const IMAGE_COMPRESSION_QUALITY = 0.82

const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']

export const IMAGE_INPUT_ACCEPT =
  '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif'

function revokeObjectUrl(url) {
  if (url) {
    URL.revokeObjectURL(url)
  }
}

function getFileExtension(fileName) {
  const segments = fileName.toLowerCase().split('.')
  return segments.length > 1 ? segments[segments.length - 1] : ''
}

export function normalizeImageUrl(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function dataUrlToFile(dataUrl, fileName = 'imagen.jpg') {
  const normalizedValue = normalizeImageUrl(dataUrl)
  const [header, body] = normalizedValue.split(',')

  if (!header?.startsWith('data:image/') || !body) {
    throw new Error('La imagen preparada no tiene un formato válido.')
  }

  const mimeType = header.slice(5, header.indexOf(';')) || 'image/jpeg'
  const binary = window.atob(body)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new File([bytes], fileName, { type: mimeType })
}

export function isImagePreviewable(value) {
  const normalizedValue = normalizeImageUrl(value)

  if (!normalizedValue) {
    return false
  }

  return (
    normalizedValue.startsWith('data:image/') ||
    normalizedValue.startsWith('blob:') ||
    normalizedValue.startsWith('http://') ||
    normalizedValue.startsWith('https://') ||
    normalizedValue.startsWith('/')
  )
}

export function validateImageFile(file) {
  if (!(file instanceof File)) {
    throw new Error('Selecciona una imagen válida.')
  }

  const mimeType = file.type.toLowerCase()
  const extension = getFileExtension(file.name)
  const hasAllowedMimeType =
    mimeType !== '' && ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)
  const hasAllowedExtension = ALLOWED_IMAGE_EXTENSIONS.includes(extension)

  if (!hasAllowedMimeType && !hasAllowedExtension) {
    throw new Error(
      'Formato no permitido. Usa jpg, jpeg, png, webp o heic.',
    )
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('La imagen supera el límite de 25MB.')
  }
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () =>
      reject(new Error('No se pudo leer la imagen seleccionada.'))
    reader.readAsDataURL(file)
  })
}

async function loadImageBitmapFromFile(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file)
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      revokeObjectUrl(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      revokeObjectUrl(objectUrl)
      reject(new Error('No se pudo leer la imagen seleccionada.'))
    }
    image.src = objectUrl
  })
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo comprimir la imagen.'))
          return
        }

        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

async function compressImageFile(file) {
  const imageSource = await loadImageBitmapFromFile(file)
  const width = imageSource.width
  const height = imageSource.height
  const maxSide = Math.max(width, height)
  const scale = maxSide > 1800 ? 1800 / maxSide : 1
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('No se pudo preparar la compresión de la imagen.')
  }

  context.drawImage(imageSource, 0, 0, canvas.width, canvas.height)

  const compressedBlob = await canvasToBlob(
    canvas,
    IMAGE_COMPRESSION_MIME_TYPE,
    IMAGE_COMPRESSION_QUALITY,
  )

  return new File([compressedBlob], file.name, {
    type: IMAGE_COMPRESSION_MIME_TYPE,
  })
}

export async function readImageFile(file) {
  validateImageFile(file)

  let nextFile = file

  if (file.size > IMAGE_COMPRESSION_THRESHOLD_BYTES) {
    try {
      const compressedFile = await compressImageFile(file)
      if (compressedFile.size < file.size) {
        nextFile = compressedFile
      }
    } catch {
      nextFile = file
    }
  }

  return {
    fileName: nextFile.name,
    value: await fileToDataUrl(nextFile),
  }
}
