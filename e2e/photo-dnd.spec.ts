import { expect, test } from '@playwright/test'

test('dragging the photo card changes the order on desktop and touch screens', async ({ page, isMobile }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '샘플 일러스트로 둘러보기' }).click()
  const photos = page.getByRole('region', { name: '선택한 사진' })
  const card = photos.getByRole('button', { name: '캔버스 가방 순서 변경' })
  const source = isMobile ? photos.getByRole('img', { name: '캔버스 가방' }) : photos.getByText('캔버스 가방', { exact: true })
  await source.scrollIntoViewIfNeeded()
  const from = await source.boundingBox()
  const target = isMobile ? '책상 위 소품' : '라탄 바구니'
  const to = await photos.getByRole('img', { name: target }).boundingBox()
  if (!from || !to) throw new Error('Source or destination photo is unavailable')
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  const end = { x: to.x + to.width / 2, y: to.y + to.height - 12 }

  if (isMobile) {
    const session = await page.context().newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    for (const progress of [.15, .5, 1]) {
      const point = { x: start.x + (end.x - start.x) * progress, y: start.y + (end.y - start.y) * progress }
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] })
    }
    await expect(page.getByRole('status', { name: '', exact: true })).toHaveText('2번째 위치예요.')
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await session.detach()
  } else {
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(end.x, end.y, { steps: 12 })
    await page.mouse.up()
  }

  const expectedOrder = isMobile
    ? ['책상 위 소품', '캔버스 가방', '라탄 바구니', '작은 화분']
    : ['책상 위 소품', '라탄 바구니', '캔버스 가방', '작은 화분']
  await expect.poll(() => photos.getByRole('img').evaluateAll(images => images.map(image => image.getAttribute('alt')))).toEqual(expectedOrder)

  const remove = photos.getByRole('button', { name: '캔버스 가방 제거' })
  const imageBounds = await photos.getByRole('img', { name: '캔버스 가방' }).boundingBox()
  const removeBounds = await remove.boundingBox()
  if (!imageBounds || !removeBounds) throw new Error('Photo or remove button is unavailable')
  expect(removeBounds.y - imageBounds.y).toBeLessThan(removeBounds.height / 2)
  expect(imageBounds.x + imageBounds.width - removeBounds.x - removeBounds.width).toBeLessThan(removeBounds.width / 2)
  await remove.click()
  await expect(photos.getByRole('img', { name: '캔버스 가방' })).toHaveCount(0)
})
