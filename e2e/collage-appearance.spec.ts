import { expect, test } from '@playwright/test'

test('RGB, color picker, and spacing stay in sync with the PNG and undo history', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '샘플 일러스트로 둘러보기' }).click()
  await page.getByRole('button', { name: '사진 배치 시작' }).click()

  const picker = page.getByLabel('배경색', { exact: true })
  const red = page.getByRole('spinbutton', { name: '배경색 R' })
  const green = page.getByRole('spinbutton', { name: '배경색 G' })
  const blue = page.getByRole('spinbutton', { name: '배경색 B' })
  const gap = page.getByRole('slider', { name: '사진 여백' })
  const undo = page.getByRole('button', { name: '실행 취소' })
  const canvas = page.getByRole('img', { name: '사진 배치 미리보기' })
  const canvasPixel = () => canvas.evaluate((element: HTMLCanvasElement) =>
    [...element.getContext('2d')!.getImageData(30, 30, 1, 1).data])

  await expect(undo).toBeDisabled()
  await picker.fill('#345678')
  await expect(red).toHaveValue('52')
  await expect(green).toHaveValue('86')
  await expect(blue).toHaveValue('120')
  await red.fill('999')
  await red.press('Enter')
  await expect(red).toHaveValue('255')
  await expect(picker).toHaveValue('#ff5678')
  await gap.press('End')
  await expect(gap).toHaveValue('64')
  await expect.poll(canvasPixel).toEqual([255, 86, 120, 255])

  await page.getByRole('button', { name: '저장 미리보기' }).click()
  const image = page.getByRole('img', { name: '저장할 PNG 이미지' })
  const pngPixel = () => image.evaluate(async (element: HTMLImageElement) => {
    await element.decode()
    const canvas = document.createElement('canvas')
    canvas.width = element.naturalWidth
    canvas.height = element.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(element, 0, 0)
    return [...context.getImageData(30, 30, 1, 1).data]
  })
  await expect.poll(pngPixel).toEqual([255, 86, 120, 255])
  await page.getByRole('button', { name: '배치로 돌아가기' }).click()
  await undo.click()
  await expect(gap).toHaveValue('12')
  await expect.poll(canvasPixel).not.toEqual([255, 86, 120, 255])
  await undo.click()
  await expect(picker).toHaveValue('#345678')
  await undo.click()
  await expect(picker).toHaveValue('#ffffff')
  await expect(undo).toBeDisabled()
})
