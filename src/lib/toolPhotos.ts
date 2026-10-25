import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

interface ToolPhotoRecord {
  original: Blob
  thumbnail: Blob
}

interface ToolPhotoDatabase extends DBSchema {
  photos: {
    key: string
    value: ToolPhotoRecord
  }
}

let databasePromise: Promise<IDBPDatabase<ToolPhotoDatabase>> | undefined

function getDatabase() {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('Энэ хөтөч зураг хадгалах сан дэмжихгүй байна.'))
  }
  if (!databasePromise) {
    databasePromise = openDB<ToolPhotoDatabase>('minetool-manager-photos', 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('photos')) database.createObjectStore('photos')
      },
    }).catch(error => {
      databasePromise = undefined
      throw error
    })
  }
  return databasePromise
}

async function createThumbnail(image: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(image)
    const maxDimension = 640
    const scale = Math.min(1, maxDimension / bitmap.width, maxDimension / bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return image
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const thumbnail = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.78))
    return thumbnail ?? image
  } catch {
    return image
  }
}

export async function saveToolPhoto(toolId: string, image: File): Promise<void> {
  const thumbnail = await createThumbnail(image)
  const database = await getDatabase()
  await database.put('photos', { original: image, thumbnail }, toolId)
}

export async function getToolPhoto(toolId: string, size: 'original' | 'thumbnail' = 'thumbnail'): Promise<Blob | undefined> {
  const database = await getDatabase()
  const record = await database.get('photos', toolId)
  return record?.[size]
}

export async function deleteToolPhoto(toolId: string): Promise<void> {
  const database = await getDatabase()
  await database.delete('photos', toolId)
}