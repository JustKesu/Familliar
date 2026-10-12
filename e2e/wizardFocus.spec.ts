import { expect, test, type Page } from '@playwright/test'
import { createFighter, expectStep, fillUpToBackground, next, nextButton, takeFighterLevel4Mastery, wizardNav } from './wizard.ts'

/* F-21: a step change moves keyboard focus to the step heading; opening the wizard and a blocked Next do not. */

const heading = (page: Page) => page.getByRole('heading', { level: 2 })

test('F-21 a/b/d: new character — opening does not focus, Next and Back and the step bar do', async ({ page }) => {
  await page.goto('/#/new')
  await expectStep(page, 'Class and level')
  await expect(heading(page)).not.toBeFocused()

  await fillUpToBackground(page, { name: 'Wren', level: 1, species: 'Dwarf|XPHB' })
  await expectStep(page, 'Background')

  await wizardNav(page).getByRole('button', { name: 'Back', exact: true }).click()
  await expectStep(page, 'Species')
  await expect(heading(page)).toHaveText('Species')
  await expect(heading(page)).toBeFocused()

  await next(page)
  await expectStep(page, 'Background')
  await expect(heading(page)).toHaveText('Background')
  await expect(heading(page)).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(page.locator('.wizard__content :focus')).toHaveCount(1)
  await expect(page.locator('.wizard__bar :focus')).toHaveCount(0)

  await page.getByRole('navigation', { name: 'Wizard steps' }).getByRole('button', { name: /Species/ }).click()
  await expectStep(page, 'Species')
  await expect(heading(page)).toBeFocused()
})

test('F-22 8: Next from the bottom of a long step shows the new step heading', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 })
  await page.goto('/#/new')
  await fillUpToBackground(page, { name: 'Wren', level: 1, species: 'Dwarf|XPHB' })
  await wizardNav(page).getByRole('button', { name: 'Back', exact: true }).click()
  await expectStep(page, 'Species')
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(heading(page)).not.toBeInViewport()

  await next(page)
  await expectStep(page, 'Background')
  await expect(heading(page)).toBeFocused()
  await expect(heading(page)).toBeInViewport()
})

test('F-21 blocked Next does not move focus', async ({ page }) => {
  await page.goto('/#/new')
  await expectStep(page, 'Class and level')
  await expect(nextButton(page)).toBeDisabled()
  await expect(heading(page)).not.toBeFocused()
})

test('F-21 c: Level up — Next lands on the next step heading', async ({ page }) => {
  await createFighter(page, { name: 'Wren', level: 3, species: 'Dwarf|XPHB' })
  await page.getByRole('button', { name: 'Level up to 4' }).click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Fighter 3 → 4' }).click()
  await expect(page.locator('[aria-current="step"]')).toBeVisible()
  await expect(heading(page)).not.toBeFocused()

  await takeFighterLevel4Mastery(page)
  await next(page)
  await expect(heading(page)).toBeFocused()
})
