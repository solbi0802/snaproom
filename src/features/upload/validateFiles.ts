export const MAX_PHOTOS = 4
export const MAX_FILE_BYTES = 20 * 1024 * 1024
const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

type FileMetadata = Pick<File, 'type' | 'size'>

export function validateFiles(files: readonly FileMetadata[], existingCount = 0): string | null {
  if (files.length === 0) return null
  if (files.length + existingCount > MAX_PHOTOS) return '사진은 최대 4장까지 선택할 수 있어요.'
  if (files.some(file => !supportedTypes.has(file.type))) return 'JPG, PNG, WebP 사진을 선택해 주세요.'
  if (files.some(file => file.size > MAX_FILE_BYTES)) return '사진 한 장의 크기는 20MB 이하여야 해요.'
  if (files.some(file => file.size === 0)) return '내용이 없는 파일이에요. 다른 사진을 선택해 주세요.'
  return null
}
