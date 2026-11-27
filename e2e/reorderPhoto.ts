import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

export async function reorderPhotoByKeyboard(handle: Locator, direction: 'ArrowLeft' | 'ArrowRight', targetPosition: number) {
  await handle.press('Space')
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await handle.press(direction)
  await expect(handle.page().getByRole('status', { name: '', exact: true })).toHaveText(`${targetPosition}번째 위치예요.`)
  await handle.press('Space')
}
