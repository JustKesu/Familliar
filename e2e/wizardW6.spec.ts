import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseLevelAsi, createFighter, expectStep, fillUpToBackground, finishFromBackground, levelCard, next, nextButton, stepBar, takeFighterLevel4Mastery, wizardNav, type FighterOptions } from './wizard.ts'

/* W-6: Hit points step — maximum with breakdown, method pills per level (W19), manual value validation (W20). Fighter = d10, average 6. */

async function reachHitPoints(page: Page, level: number): Promise<void> {
  const options: FighterOptions = { name: 'Hale', level, species: 'Dwarf|XPHB', stopAtHitPoints: true }
  await fillUpToBackground(page, options)
  await finishFromBackground(page, options)
  await expectStep(page, 'Hit points')
}

const method = (page: Page, level: number): Locator => page.getByRole('radiogroup', { name: `Level ${level} hit points method`, exact: true })
const row = (page: Page, level: number): Locator => page.locator('tr', { has: method(page, level) })
const pill = (page: Page, level: number, name: string): Locator => method(page, level).getByRole('radio', { name, exact: true })
const maximum = async (page: Page): Promise<number> => Number(await page.locator('.hit-points-picker__number').innerText())
const averageAll = (page: Page): Locator => page.getByRole('button', { name: 'Use the average for every level', exact: true })
const manualInput = (page: Page, level: number): Locator => page.getByLabel(`Level ${level} manual result`, { exact: true })

test('W-6 a: Fighter 3 — big maximum with its breakdown, three pills per level, none chosen until the average is applied', async ({ page }) => {
  await reachHitPoints(page, 3)
  await expect(page.locator('.hit-points-picker__label')).toHaveText('Maximum hit points')
  await expect(page.locator('.hit-points-picker__number')).toHaveText(/^\d+$/)
  await expect(page.locator('.hit-points-picker__running-total li').first()).toBeVisible()
  for (const level of [2, 3]) {
    await expect(method(page, level).getByRole('radio')).toHaveCount(3)
    await expect(pill(page, level, 'Roll (d10)')).not.toBeChecked()
  }
  await expect(pill(page, 2, 'Average (6)')).not.toBeChecked()
  await expect(nextButton(page)).toBeDisabled()

  await averageAll(page).click()
  for (const level of [2, 3]) {
    await expect(pill(page, level, 'Average (6)')).toBeChecked()
    await expect(row(page, level).locator('.roll-mode__option--active')).toHaveText('Average (6)')
  }
  await expect(nextButton(page)).toBeEnabled()
})

test('W-6 b: ROLL on level 2 shows a die 1–10 and moves the maximum by the difference; REROLL stays in 1–10', async ({ page }) => {
  await reachHitPoints(page, 3)
  await averageAll(page).click()
  const before = await maximum(page)

  await pill(page, 2, 'Roll (d10)').check()
  const die = row(page, 2).locator('.hit-points-picker__die')
  await expect(die).toBeVisible()
  const first = Number(await die.innerText())
  expect(first).toBeGreaterThanOrEqual(1)
  expect(first).toBeLessThanOrEqual(10)
  await expect(page.locator('.hit-points-picker__number')).toHaveText(String(before - 6 + first))

  for (let i = 0; i < 5; i++) {
    await row(page, 2).getByRole('button', { name: 'Reroll', exact: true }).click()
    const value = Number(await die.innerText())
    expect(value).toBeGreaterThanOrEqual(1)
    expect(value).toBeLessThanOrEqual(10)
    await expect(page.locator('.hit-points-picker__number')).toHaveText(String(before - 6 + value))
  }
})

test('W-6 c: MANUAL on level 2 starts empty and locked; 0 and 11 stay locked; 7 unlocks and moves the maximum', async ({ page }) => {
  await reachHitPoints(page, 3)
  await averageAll(page).click()
  const before = await maximum(page)

  await pill(page, 2, 'Manual').check()
  const input = manualInput(page, 2)
  await expect(input).toHaveValue('')
  await expect(row(page, 2).getByText('1–10', { exact: true })).toBeVisible()
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(nextButton(page)).toBeDisabled()

  await input.fill('0')
  await expect(nextButton(page)).toBeDisabled()
  await input.fill('11')
  await expect(nextButton(page)).toBeDisabled()
  await expect(row(page, 2).getByText('1–10', { exact: true })).toBeVisible()

  await input.fill('7')
  await expect(nextButton(page)).toBeEnabled()
  await expect(row(page, 2).getByText('1–10', { exact: true })).toHaveCount(0)
  await expect(page.locator('.hit-points-picker__number')).toHaveText(String(before - 6 + 7))
})

test('W-6 d: "Use the average for every level" puts every row back on AVERAGE', async ({ page }) => {
  await reachHitPoints(page, 3)
  await averageAll(page).click()
  await pill(page, 2, 'Roll (d10)').check()
  await pill(page, 3, 'Manual').check()
  await expect(pill(page, 2, 'Average (6)')).not.toBeChecked()

  await averageAll(page).click()
  for (const level of [2, 3]) await expect(pill(page, level, 'Average (6)')).toBeChecked()
  await expect(manualInput(page, 3)).toHaveCount(0)
  await expect(nextButton(page)).toBeEnabled()
})

test('W-6 e: level up Fighter 3 → 4 — only the level 4 row, same pills, no apply-to-all button', async ({ page }) => {
  await createFighter(page, { name: 'Leveller', level: 3, species: 'Dwarf|XPHB' })
  await page.getByRole('button', { name: 'Level up to 4' }).click()
  await takeFighterLevel4Mastery(page)
  for (let steps = 0; steps < 8 && !(await method(page, 4).isVisible()); steps++) {
    if (await levelCard(page, 4).isVisible()) await chooseLevelAsi(page, 4, 'strength')
    await next(page)
  }
  await expectStep(page, 'Hit points')
  await expect(page.getByRole('radiogroup', { name: /hit points method/ })).toHaveCount(1)
  await expect(method(page, 4).getByRole('radio')).toHaveCount(3)
  await expect(method(page, 2)).toHaveCount(0)
  await expect(averageAll(page)).toHaveCount(0)
  await expect(nextButton(page)).toBeDisabled()
  await pill(page, 4, 'Average (6)').check()
  await expect(nextButton(page)).toBeEnabled()
})

test('W-6 f: Edit Character on a character with a manual value 0 — the row shows the error, Next is locked until 5 is entered, then it saves', async ({ page }) => {
  await createFighter(page, { name: 'Old', level: 3, species: 'Dwarf|XPHB' })
  const id = page.url().split('/').pop()!
  await page.evaluate((characterId) => {
    const key = 'familliar:characters'
    const all = JSON.parse(localStorage.getItem(key)!) as { id: string; hitPointLevels?: unknown }[]
    const target = all.find((character) => character.id === characterId)!
    target.hitPointLevels = [
      { level: 2, kind: 'manual', dieResult: 0 },
      { level: 3, kind: 'average', dieResult: 6 },
    ]
    localStorage.setItem(key, JSON.stringify(all))
  }, id)
  await page.reload()

  await page.getByRole('button', { name: 'Edit character' }).click()
  await stepBar(page).getByRole('button', { name: /Hit points/ }).click()
  await expectStep(page, 'Hit points')
  await expect(manualInput(page, 2)).toHaveValue('')
  await expect(manualInput(page, 2)).toHaveAttribute('aria-invalid', 'true')
  await expect(row(page, 2).getByText('1–10', { exact: true })).toBeVisible()
  await expect(nextButton(page)).toBeDisabled()

  await manualInput(page, 2).fill('5')
  await expect(nextButton(page)).toBeEnabled()
  await next(page)
  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)

  const stored = await page.evaluate((characterId) => {
    const all = JSON.parse(localStorage.getItem('familliar:characters')!) as { id: string; hitPointLevels: unknown }[]
    return all.find((character) => character.id === characterId)!.hitPointLevels
  }, id)
  expect(stored).toContainEqual({ level: 2, kind: 'manual', dieResult: 5 })
})
