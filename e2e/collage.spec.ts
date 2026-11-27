import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { reorderPhotoByKeyboard } from './reorderPhoto'

test('photo order and layout survive the PNG preview and the download is a 1000px PNG', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '샘플 일러스트로 둘러보기' }).click()
  await reorderPhotoByKeyboard(page.getByRole('button', { name: '책상 위 소품 순서 변경' }), 'ArrowLeft', 1)
  await page.getByRole('button', { name: '사진 배치 시작' }).click()
  await page.getByRole('button', { name: '첫 사진 강조' }).click()
  const canvas = page.getByRole('img', { name: '사진 배치 미리보기' })
  const isDeskInFeaturedCell = () => canvas.evaluate((element: HTMLCanvasElement) => {
    const pixel = element.getContext('2d')?.getImageData(30, 100, 1, 1).data
    return pixel && [...pixel].join(',')
  })
  await expect.poll(isDeskInFeaturedCell).toBe('226,226,214,255')
  await page.getByRole('button', { name: '저장 미리보기' }).click()
  await expect(page.getByRole('img', { name: '저장할 PNG 이미지' })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'PNG 다운로드' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('snaproom-collage.png')
  const downloadPath = await download.path()
  if (!downloadPath) throw new Error('Downloaded PNG is unavailable')
  const png = await readFile(downloadPath)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.readUInt32BE(16)).toBe(1000)
  expect(png.readUInt32BE(20)).toBe(1000)

  await page.getByRole('button', { name: '배치로 돌아가기' }).click()
  await expect(page.getByRole('button', { name: '첫 사진 강조' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(isDeskInFeaturedCell).toBe('226,226,214,255')
  await page.getByRole('button', { name: '사진 선택으로 돌아가기' }).click()
  await expect(page.getByRole('region', { name: '선택한 사진' }).getByRole('img').first()).toHaveAttribute('alt', '책상 위 소품')
})
