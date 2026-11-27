import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('individual photos keep their own edits and download at original dimensions', async ({ page }) => {
  await page.goto('/')
  const inputs = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 640
    const context = canvas.getContext('2d')!
    context.fillStyle = 'red'
    context.fillRect(0, 0, 640, 640)
    context.fillStyle = 'blue'
    context.fillRect(640, 0, 640, 640)
    context.clearRect(0, 0, 10, 10)
    const wide = canvas.toDataURL().split(',')[1]

    canvas.width = 320
    context.fillStyle = 'lime'
    context.fillRect(0, 0, 320, 640)
    return [wide, canvas.toDataURL().split(',')[1]]
  })
  await page.locator('#photo-files').setInputFiles(inputs.map((data, index) => ({
    name: ['wide.png', 'tall.png'][index], mimeType: 'image/png', buffer: Buffer.from(data, 'base64'),
  })))
  const start = page.getByRole('button', { name: '개별 편집 시작' })
  await start.click()

  const group = page.getByRole('navigation', { name: '편집할 사진' })
  const wide = group.getByRole('button', { name: '1번 사진 wide.png' })
  const tall = group.getByRole('button', { name: '2번 사진 tall.png' })
  const canvas = page.getByRole('img', { name: '개별 사진 미리보기' })
  const undo = page.getByRole('button', { name: '실행 취소' })
  await expect(wide).toHaveAttribute('aria-pressed', 'true')
  await expect(canvas).toHaveAttribute('height', '500')
  await expect(page.getByText('PNG · 1280 × 640')).toBeVisible()
  await expect(page.getByRole('group', { name: '사진 레이아웃' })).toHaveCount(0)

  await page.getByRole('button', { name: '모자이크', exact: true }).click()
  await page.getByText('숫자로 영역 지정').click()
  await page.getByLabel('왼쪽 (%)').fill('48')
  await page.getByLabel('너비 (%)').fill('4')
  await page.getByRole('button', { name: '영역 적용' }).click()
  await expect(page.getByRole('status')).toContainText('현재 사진에 모자이크를 적용했어요.')
  await page.getByRole('button', { name: '스티커', exact: true }).click()
  await page.getByRole('button', { name: '별 추가' }).click()

  async function downloadPhoto(filename: string, points: readonly (readonly [number, number])[]) {
    await page.getByRole('button', { name: '저장 미리보기' }).click()
    const result = page.waitForEvent('download')
    await page.getByRole('link', { name: 'PNG 다운로드' }).click()
    const download = await result
    expect(download.suggestedFilename()).toBe(filename)
    const path = await download.path()
    if (!path) throw new Error('Downloaded PNG is unavailable')
    return page.evaluate(async ({ png, points }) => {
      const bytes = Uint8Array.from(atob(png), character => character.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const output = document.createElement('canvas')
      output.width = bitmap.width
      output.height = bitmap.height
      const context = output.getContext('2d')!
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      return {
        size: [output.width, output.height],
        pixels: points.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data]),
      }
    }, { png: (await readFile(path)).toString('base64'), points })
  }

  await tall.click()
  await expect(tall).toHaveAttribute('aria-pressed', 'true')
  await expect(canvas).toHaveAttribute('width', '500')
  await expect(undo).toBeDisabled()
  const tallOutput = await downloadPhoto('tall-edited.png', [[160, 320], [0, 0], [319, 639]])
  expect(tallOutput.size).toEqual([320, 640])
  expect(tallOutput.pixels).toEqual(Array.from({ length: 3 }, () => [0, 255, 0, 255]))

  await wide.click()
  await expect(undo).toBeEnabled()
  const wideOutput = await downloadPhoto('wide-edited.png', [[625, 208], [640, 320], [0, 0], [1279, 639]])
  expect(wideOutput.size).toEqual([1280, 640])
  expect(wideOutput.pixels[0][0]).toBeGreaterThan(30)
  expect(wideOutput.pixels[0][2]).toBeGreaterThan(30)
  expect(wideOutput.pixels[1]).toEqual([255, 208, 91, 255])
  expect(wideOutput.pixels[2]).toEqual([0, 0, 0, 0])
  expect(wideOutput.pixels[3]).toEqual([0, 0, 255, 255])

  await page.getByRole('button', { name: '개별 편집으로 돌아가기' }).click()
  await undo.click()
  await expect(undo).toBeEnabled()
  await page.getByRole('button', { name: '사진 선택으로 돌아가기' }).click()
  await expect(start).toBeFocused()
  await page.getByRole('button', { name: '사진 배치 시작' }).click()
  await expect(page.getByRole('img', { name: '사진 배치 미리보기' })).toHaveAttribute('width', '1000')
  await expect(undo).toBeDisabled()
  await page.getByRole('button', { name: '사진 선택으로 돌아가기' }).click()
  await start.click()
  await expect(wide).toHaveAttribute('aria-pressed', 'true')
  await expect(undo).toBeEnabled()
})


test('individual sample photos display the complete illustration', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '샘플 일러스트로 둘러보기' }).click()
  await page.getByRole('button', { name: '개별 편집 시작' }).click()
  const canvas = page.getByRole('img', { name: '개별 사진 미리보기' })
  await expect(page.getByText('PNG · 600 × 600')).toBeVisible()
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d')!
    return [...context.getImageData(500, 500, 1, 1).data]
  })).toEqual([189, 140, 102, 255])
})
