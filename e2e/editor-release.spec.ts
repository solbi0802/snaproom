import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('local files export a PNG containing the layout, background, mosaic, and sticker', async ({ page }) => {
  const uploads: string[] = []
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && ['POST', 'PUT', 'PATCH'].includes(request.method())) uploads.push(request.url())
  })

  await page.goto('/')
  const images = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const context = canvas.getContext('2d')!
    context.fillStyle = 'red'
    context.fillRect(0, 0, 32, 64)
    context.fillStyle = 'blue'
    context.fillRect(32, 0, 32, 64)
    const png = canvas.toDataURL('image/png').split(',')[1]
    context.fillStyle = 'lime'
    context.fillRect(0, 0, 64, 64)
    const webp = canvas.toDataURL('image/webp').split(',')[1]
    context.fillStyle = '#ff8000'
    context.fillRect(0, 0, 64, 64)
    const jpg = canvas.toDataURL('image/jpeg').split(',')[1]
    return [
      { name: 'split.png', mimeType: 'image/png', data: png },
      { name: 'green.webp', mimeType: 'image/webp', data: webp },
      { name: 'orange.jpg', mimeType: 'image/jpeg', data: jpg },
    ]
  })
  await page.locator('#photo-files').setInputFiles(images.map(({ data, ...file }) => ({
    ...file, buffer: Buffer.from(data, 'base64'),
  })))
  await expect(page.getByRole('heading', { name: '선택한 사진' })).toContainText('3 / 4')
  await page.getByRole('button', { name: '사진 배치 시작' }).click()
  await page.getByRole('button', { name: '첫 사진 강조' }).click()
  await page.getByLabel('배경색', { exact: true }).fill('#345678')
  await page.getByRole('slider', { name: '사진 여백' }).press('End')

  const canvas = page.getByRole('img', { name: '사진 배치 미리보기' })
  const readCanvas = (x: number, y: number) => canvas.evaluate((element: HTMLCanvasElement, [x, y]) =>
    [...element.getContext('2d')!.getImageData(x, y, 1, 1).data], [x, y])
  await expect.poll(() => readCanvas(5, 5)).toEqual([52, 86, 120, 255])
  const beforeMosaic = await readCanvas(260, 380)
  expect(beforeMosaic[0]).toBeGreaterThan(150)
  await page.getByRole('button', { name: '모자이크', exact: true }).click()
  await page.getByText('숫자로 영역 지정', { exact: true }).click()
  await page.getByLabel('왼쪽 (%)').fill('48')
  await page.getByLabel('위쪽 (%)').fill('30')
  await page.getByLabel('너비 (%)').fill('4')
  await page.getByLabel('높이 (%)').fill('14')
  await page.getByRole('button', { name: '영역 적용' }).click()
  await expect(page.getByRole('status')).toHaveText('1번 사진에 모자이크를 적용했어요.')
  await expect.poll(async () => (await readCanvas(260, 380))[2]).toBeGreaterThan(beforeMosaic[2] + 30)
  const mosaicPixel = await readCanvas(260, 380)
  expect(mosaicPixel[0]).toBeGreaterThan(30)

  await page.getByRole('button', { name: '스티커', exact: true }).click()
  await page.getByRole('button', { name: '별 추가' }).click()
  await expect(page.getByRole('button', { name: '1. 별 스티커' })).toHaveAttribute('aria-pressed', 'true')
  const selectionCorner = await readCanvas(420, 420)
  await page.getByRole('button', { name: '저장 미리보기' }).click()
  await expect(page.getByRole('img', { name: '저장할 PNG 이미지' })).toBeVisible()

  const result = page.waitForEvent('download')
  await page.getByRole('link', { name: 'PNG 다운로드' }).click()
  const download = await result
  expect(download.suggestedFilename()).toBe('snaproom-collage.png')
  const path = await download.path()
  if (!path) throw new Error('Downloaded PNG is unavailable')
  const png = await readFile(path)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  const output = await page.evaluate(async data => {
    const bytes = Uint8Array.from(atob(data), character => character.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const pixel = (x: number, y: number) => [...context.getImageData(x, y, 1, 1).data]
    return {
      size: [canvas.width, canvas.height],
      background: pixel(500, 100),
      mosaic: pixel(260, 380),
      greenPhoto: pixel(700, 200),
      orangePhoto: pixel(700, 750),
      sticker: pixel(500, 500),
      selectionCorner: pixel(420, 420),
    }
  }, png.toString('base64'))
  expect(output.size).toEqual([1000, 1000])
  expect(output.background).toEqual([52, 86, 120, 255])
  expect(output.mosaic).toEqual(mosaicPixel)
  expect(output.greenPhoto[1]).toBeGreaterThan(240)
  expect(output.orangePhoto[0]).toBeGreaterThan(240)
  expect(output.orangePhoto[2]).toBeLessThan(20)
  expect(output.sticker).toEqual([255, 208, 91, 255])
  expect(output.selectionCorner).toEqual(selectionCorner)
  expect(uploads).toEqual([])
})

test('an export failure keeps the current edits and permits a retry', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob
    let failNextExport = true
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (!failNextExport) return original.call(this, callback, type, quality)
      failNextExport = false
      queueMicrotask(() => callback(null))
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: '샘플 일러스트로 둘러보기' }).click()
  await page.getByRole('button', { name: '사진 배치 시작' }).click()
  const color = page.getByLabel('배경색', { exact: true })
  await color.fill('#345678')
  await page.getByRole('button', { name: '스티커', exact: true }).click()
  await page.getByRole('button', { name: '별 추가' }).click()

  const save = page.getByRole('button', { name: '저장 미리보기' })
  await save.click()
  await expect(page.getByRole('alert')).toContainText('PNG를 만들 수 없어요.')
  await expect(save).toBeEnabled()
  await expect(color).toHaveValue('#345678')
  await expect(page.getByRole('button', { name: '1. 별 스티커' })).toHaveAttribute('aria-pressed', 'true')
  await save.click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('img', { name: '저장할 PNG 이미지' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'PNG 다운로드' })).toHaveAttribute('href', /^blob:/)
})
