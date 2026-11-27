import { expect, test } from '@playwright/test'

test('a sticker can be moved, resized, exported, and deleted', async ({ page, isMobile }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '샘플 일러스트로 둘러보기' }).click()
  await page.getByRole('button', { name: '사진 배치 시작' }).click()
  await page.getByRole('button', { name: '스티커', exact: true }).click()
  await page.getByRole('button', { name: '별 추가' }).click()

  const sticker = page.getByRole('button', { name: '1. 별 스티커' })
  await expect(sticker).toHaveAttribute('aria-pressed', 'true')
  await sticker.scrollIntoViewIfNeeded()
  const bounds = await sticker.boundingBox()
  if (!bounds) throw new Error('Sticker is unavailable')
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  const end = { x: start.x + 30, y: start.y + 20 }
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
    await page.mouse.move(end.x, end.y, { steps: 5 })
    await page.mouse.up()
  }

  const center = () => sticker.evaluate(element => ({
    x: Math.round((parseFloat(element.style.left) + parseFloat(element.style.width) / 2) * 10),
    y: Math.round((parseFloat(element.style.top) + parseFloat(element.style.height) / 2) * 10),
  }))
  await expect.poll(async () => (await center()).x).toBeGreaterThan(550)
  const moved = await center()
  await sticker.press('Shift+ArrowDown')
  await expect.poll(async () => (await center()).y).toBe(moved.y + 50)

  const size = page.getByRole('slider', { name: '스티커 크기' })
  await size.press('End')
  await expect(size).toHaveValue('400')
  const point = await center()

  const preview = page.getByRole('img', { name: '저장할 PNG 이미지' })
  const previewPixel = () => preview.evaluate(async (image: HTMLImageElement, { x, y }) => {
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    return [...context.getImageData(x, y, 1, 1).data]
  }, point)
  await page.getByRole('button', { name: '저장 미리보기' }).click()
  await expect(preview).toBeVisible()
  await expect(sticker).toHaveCount(0)
  await expect.poll(previewPixel).toEqual([255, 208, 91, 255])

  await page.getByRole('button', { name: '배치로 돌아가기' }).click()
  await expect(sticker).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '선택한 스티커 삭제' }).click()
  await expect(sticker).toHaveCount(0)
  await page.getByRole('button', { name: '저장 미리보기' }).click()
  await expect.poll(previewPixel).not.toEqual([255, 208, 91, 255])
})
