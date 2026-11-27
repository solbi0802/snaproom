import { expect, test } from '@playwright/test'
import { reorderPhotoByKeyboard } from './reorderPhoto'

test('mosaic follows a reordered photo and appears in the exported PNG', async ({ page, isMobile }) => {
  await page.goto('/')
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 64
    const context = canvas.getContext('2d')!
    context.fillStyle = 'red'
    context.fillRect(0, 0, 32, 64)
    context.fillStyle = 'blue'
    context.fillRect(32, 0, 32, 64)
    const split = canvas.toDataURL().split(',')[1]
    context.fillStyle = 'lime'
    context.fillRect(0, 0, 64, 64)
    return [split, canvas.toDataURL().split(',')[1]]
  })
  await page.locator('#photo-files').setInputFiles(encoded.map((data, index) => ({
    name: ['split.png', 'green.png'][index], mimeType: 'image/png', buffer: Buffer.from(data, 'base64'),
  })))
  await page.getByRole('button', { name: '사진 배치 시작' }).click()
  const canvas = page.getByRole('img', { name: '사진 배치 미리보기' })
  const readCanvas = (x: number) => canvas.evaluate((element: HTMLCanvasElement, x) =>
    [...element.getContext('2d')!.getImageData(x, 500, 1, 1).data], x)
  await expect.poll(() => readCanvas(240)).toEqual([255, 0, 0, 255])
  await page.getByRole('button', { name: '모자이크', exact: true }).click()
  await canvas.scrollIntoViewIfNeeded()
  const bounds = await canvas.boundingBox()
  if (!bounds) throw new Error('Canvas is unavailable')
  const point = (x: number, y: number) => ({ x: bounds.x + x * bounds.width / 1000, y: bounds.y + y * bounds.height / 1000 })
  const start = point(263, 510)
  const end = point(230, 490)
  if (isMobile) {
    const session = await page.context().newCDPSession(page)
    try {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] })
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } finally {
      await session.detach()
    }
  } else {
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 4 })
    await page.mouse.up()
  }
  await expect(page.getByRole('status')).toContainText('1번 사진에 모자이크를 적용했어요')
  await expect.poll(() => readCanvas(240)).not.toEqual([255, 0, 0, 255])
  await expect.poll(() => readCanvas(180)).toEqual([255, 0, 0, 255])

  await page.getByRole('button', { name: '사진 선택으로 돌아가기' }).click()
  await reorderPhotoByKeyboard(page.getByRole('button', { name: 'split.png 순서 변경' }), 'ArrowRight', 2)
  await page.getByRole('button', { name: '사진 배치 시작' }).click()
  await expect.poll(async () => (await readCanvas(734))[2]).toBeGreaterThan(0)
  const mosaicPixel = await readCanvas(734)
  await expect.poll(() => readCanvas(240)).toEqual([0, 255, 0, 255])
  await expect.poll(() => readCanvas(674)).toEqual([255, 0, 0, 255])
  await page.getByRole('button', { name: '저장 미리보기' }).click()
  const output = page.getByRole('img', { name: '저장할 PNG 이미지' })
  const previewPixel = await output.evaluate(async (image: HTMLImageElement) => {
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1000
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    return [...context.getImageData(734, 500, 1, 1).data]
  })
  expect(previewPixel).toEqual(mosaicPixel)

  await page.getByRole('button', { name: '배치로 돌아가기' }).click()
  await page.getByRole('button', { name: '마지막 모자이크 지우기' }).click()
  await expect.poll(() => readCanvas(734)).toEqual([255, 0, 0, 255])
})
