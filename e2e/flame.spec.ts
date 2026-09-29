import { expect, test } from '@playwright/test'
import { createFighter } from './wizard.ts'

/* R16 (D224): the cursor flame canvas behind the app and its toggle. */

const canvas = (page: import('@playwright/test').Page) => page.locator('canvas[data-flame-canvas]')

test('R16 a: on the sheet the canvas is aria-hidden and pointer-transparent, and a roll button in the left column still works', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New character' }).click()
  await createFighter(page, { name: 'Flame Tester', level: 1, species: 'Dwarf|XPHB' })

  await expect(canvas(page)).toHaveCount(1)
  await expect(canvas(page)).toHaveAttribute('aria-hidden', 'true')
  await expect(canvas(page)).toHaveCSS('pointer-events', 'none')

  await page.mouse.move(40, 300)
  await page.mouse.move(200, 320, { steps: 5 })
  await page.locator('.sheet__left-column').getByRole('button', { name: /^Roll /i }).first().click()
  await expect(page.locator('.roll-toast')).toBeVisible()
})

test('R16 b: the toggle removes the canvas, persists across a reload and turns it back on', async ({ page }) => {
  await page.goto('/')
  await expect(canvas(page)).toHaveCount(1)

  await page.getByRole('button', { name: 'Flame: On' }).click()
  await expect(page.getByRole('button', { name: 'Flame: Off' })).toHaveAttribute('aria-pressed', 'false')
  await expect(canvas(page)).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Flame: Off' })).toBeVisible()
  await expect(canvas(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Flame: Off' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Flame: On' })).toBeVisible()
  await expect(canvas(page)).toHaveCount(1)
})

test('R16 c: with reduced motion requested the canvas is not mounted, even with the flame on', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Flame: On' })).toBeVisible()
  await expect(canvas(page)).toHaveCount(0)

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(canvas(page)).toHaveCount(1)
})

test('R16 d: the toggle is in the top bar on the character list and in the wizard', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Flame: On' })).toBeVisible()
  await page.getByRole('button', { name: 'New character' }).click()
  await expect(page.getByRole('button', { name: 'Flame: On' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Light', exact: true })).toBeVisible()
})
