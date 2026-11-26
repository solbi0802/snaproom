import { describe, expect, it } from 'vitest'
import { MAX_FILE_BYTES, validateFiles } from './validateFiles'

const jpg = { type: 'image/jpeg', size: 100 }

describe('photo selection constraints', () => {
  it('accepts the supported formats and the exact size limit', () => {
    expect(validateFiles([jpg, { type: 'image/png', size: MAX_FILE_BYTES }, { type: 'image/webp', size: 50 }])).toBeNull()
  })
  it('rejects a batch that would exceed four existing and new photos', () => {
    expect(validateFiles([jpg, jpg], 3)).toContain('4장')
  })
  it('rejects unsupported and empty files', () => {
    expect(validateFiles([{ type: 'text/plain', size: 10 }])).toContain('JPG')
    expect(validateFiles([{ ...jpg, size: 0 }])).toContain('내용이 없는')
  })
  it('rejects files above 20MB without trimming the batch', () => {
    expect(validateFiles([jpg, { ...jpg, size: MAX_FILE_BYTES + 1 }])).toContain('20MB')
  })
})
