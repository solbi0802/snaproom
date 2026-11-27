import { expect, test } from '@playwright/test'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=', 'base64')

test('a mixed drop keeps existing and readable photos in order', async ({ page }) => {
  await page.goto('/')
  await page.locator('#photo-files').setInputFiles({ name: 'existing.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('img', { name: 'existing.png' })).toBeVisible()

  const dataTransfer = await page.evaluateHandle((bytes) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(['not a PNG'], 'broken.png', { type: 'image/png' }))
    transfer.items.add(new File([new Uint8Array(bytes)], 'dropped.png', { type: 'image/png' }))
    return transfer
  }, [...png])
  await page.getByRole('region', { name: '사진을 여기에 끌어 놓으세요' }).dispatchEvent('drop', { dataTransfer })

  const selected = page.getByRole('region', { name: '선택한 사진' })
  await expect(page.getByRole('alert')).toContainText('사진 1장을 열 수 없어요')
  await expect(page.getByRole('status')).toContainText('현재 2장')
  await expect(selected.getByRole('img').nth(0)).toHaveAttribute('alt', 'existing.png')
  await expect(selected.getByRole('img').nth(1)).toHaveAttribute('alt', 'dropped.png')
  await dataTransfer.dispose()
})

test('photos can be reordered or replaced at capacity without losing a photo on failure', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '샘플 일러스트로 둘러보기' }).click()
  const selected = page.getByRole('region', { name: '선택한 사진' })
  await selected.getByRole('button', { name: '책상 위 소품 앞쪽으로 이동' }).click()
  await expect(selected.getByRole('img').first()).toHaveAttribute('alt', '책상 위 소품')

  const replace = selected.getByRole('button', { name: '책상 위 소품 교체' })
  const failedSelection = page.waitForEvent('filechooser')
  await replace.click()
  await (await failedSelection).setFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') })
  await expect(page.getByRole('alert')).toContainText('사진 1장을 열 수 없어요')
  await expect(selected.getByRole('img').first()).toHaveAttribute('alt', '책상 위 소품')

  const validSelection = page.waitForEvent('filechooser')
  await replace.click()
  await (await validSelection).setFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png })
  await expect(selected.getByRole('img').first()).toHaveAttribute('alt', 'replacement.png')
  await expect(page.getByRole('status')).toContainText('현재 4장')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

for (const selection of ['batch', 'one-by-one'] as const) {
  test(`the live count follows all selected photos (${selection})`, async ({ page }) => {
    await page.goto('/')
    const files = ['first.png', 'second.png', 'third.png'].map(name => ({
      name, mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=', 'base64'),
    }))
    const input = page.locator('#photo-files')
    const status = page.getByRole('status')
    if (selection === 'batch') {
      await input.setInputFiles(files)
    } else {
      for (const [index, file] of files.entries()) {
        await input.setInputFiles(file)
        await expect(status).toContainText(`${index + 1}장`)
      }
    }
    await expect(status).toContainText('현재 3장')
    await expect(page.getByRole('heading', { name: '선택한 사진' })).toContainText('3 / 4')
    await page.getByRole('button', { name: 'second.png 제거' }).click()
    await expect(status).toContainText('현재 2장')
    await page.getByRole('button', { name: '모두 비우기' }).click()
    await expect(status).toContainText('현재 0장')
  })
}

test('sample selection, removal, and reset work without network uploads', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('사진 가져오기')
  await page.getByRole('button', { name: '샘플 일러스트로 둘러보기' }).click()
  await expect(page.getByRole('heading', { name: '선택한 사진' })).toContainText('4 / 4')
  await expect(page.getByRole('button', { name: '사진 선택하기' })).toBeDisabled()
  await page.screenshot({ path: `.cache/${testInfo.project.name}-samples.png`, fullPage: true })
  await page.getByRole('button', { name: '캔버스 가방 제거' }).click()
  await expect(page.getByRole('heading', { name: '선택한 사진' })).toContainText('3 / 4')
  await page.getByRole('button', { name: '모두 비우기' }).click()
  await expect(page.getByRole('heading', { name: '선택한 사진' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '사진 선택하기' })).toBeEnabled()
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(hasOverflow).toBe(false)
})

test('an unsupported file keeps the existing selection intact', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '샘플 일러스트로 둘러보기' }).click()
  await page.getByRole('button', { name: '캔버스 가방 제거' }).click()
  await page.locator('#photo-files').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photo') })
  await expect(page.getByRole('alert')).toContainText('JPG')
  await expect(page.getByRole('heading', { name: '선택한 사진' })).toContainText('3 / 4')
})

test('a local PNG renders and can be removed', async ({ page }) => {
  await page.goto('/')
  await page.locator('#photo-files').setInputFiles({
    name: 'photo.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=', 'base64'),
  })
  const photo = page.getByRole('img', { name: 'photo.png' })
  await expect(photo).toBeVisible()
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1)
  await page.getByRole('button', { name: 'photo.png 제거' }).click()
  await expect(photo).toHaveCount(0)
})
