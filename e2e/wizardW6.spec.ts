import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseLevelAsi, createFighter, expectStep, fillUpToBackground, finishFromBackground, levelCard, next, nextButton, stepBar, takeFighterLevel4Mastery, wizardNav, type FighterOptions, featOrAsiSelect } from './wizard.ts'

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
const maximumBox = (page: Page): Locator => page.getByTestId('hit-points-max')
const maximum = async (page: Page): Promise<number> => Number(await maximumBox(page).innerText())
const averageAll = (page: Page): Locator => page.getByRole('button', { name: 'Use the average for every level', exact: true })
const manualInput = (page: Page, level: number): Locator => page.getByLabel(`Level ${level} manual result`, { exact: true })
const dieOf = (page: Page, level: number): Locator => row(page, level).getByRole('img', { name: new RegExp(`^Level ${level} rolled `) })

/** Seeds the saved character's hitPointLevels, reopens the sheet and walks Edit character to the Hit points step. */
async function editWithHitPointLevels(page: Page, name: string, entries: unknown[]): Promise<string> {
  await createFighter(page, { name, level: 3, species: 'Dwarf|XPHB' })
  const id = page.url().split('/').pop()!
  await page.evaluate(
    ([characterId, seeded]) => {
      const key = 'familliar:characters'
      const all = JSON.parse(localStorage.getItem(key)!) as { id: string; hitPointLevels?: unknown }[]
      all.find((character) => character.id === characterId)!.hitPointLevels = seeded
      localStorage.setItem(key, JSON.stringify(all))
    },
    [id, entries] as const,
  )
  await page.reload()
  await page.getByRole('button', { name: 'Edit character' }).click()
  await stepBar(page).getByRole('button', { name: /Hit points/ }).click()
  await expectStep(page, 'Hit points')
  return id
}

test('W-6 a: Fighter 3 — big maximum with its breakdown, three pills per level, none chosen until the average is applied', async ({ page }) => {
  await reachHitPoints(page, 3)
  await expect(page.getByText('Maximum hit points', { exact: true })).toBeVisible()
  await expect(maximumBox(page)).toHaveText(/^\d+$/)
  await expect(page.getByTestId('hit-points-running-total').getByRole('listitem').first()).toBeVisible()
  const levelOne = page.getByRole('row', { name: /^Level 1 / })
  await expect(levelOne).toContainText('Maximum die (d10)')
  await expect(levelOne.getByRole('radio')).toHaveCount(0)
  await expect(levelOne.getByRole('spinbutton')).toHaveCount(0)
  for (const level of [2, 3]) {
    await expect(method(page, level).getByRole('radio')).toHaveCount(3)
    await expect(pill(page, level, 'Roll (d10)')).not.toBeChecked()
  }
  await expect(pill(page, 2, 'Average (6)')).not.toBeChecked()
  await expect(nextButton(page)).toBeDisabled()

  await averageAll(page).click()
  for (const level of [2, 3]) await expect(pill(page, level, 'Average (6)')).toBeChecked()
  await expect(nextButton(page)).toBeEnabled()
})

test('W-6 b: ROLL on level 2 shows a die 1–10 and moves the maximum by the difference; REROLL stays in 1–10', async ({ page }) => {
  await reachHitPoints(page, 3)
  await averageAll(page).click()
  const before = await maximum(page)

  await pill(page, 2, 'Roll (d10)').check()
  const die = dieOf(page, 2)
  await expect(die).toBeVisible()
  const first = Number(await die.innerText())
  expect(first).toBeGreaterThanOrEqual(1)
  expect(first).toBeLessThanOrEqual(10)
  await expect(maximumBox(page)).toHaveText(String(before - 6 + first))

  for (let i = 0; i < 5; i++) {
    await row(page, 2).getByRole('button', { name: 'Reroll level 2', exact: true }).click()
    const value = Number(await die.innerText())
    expect(value).toBeGreaterThanOrEqual(1)
    expect(value).toBeLessThanOrEqual(10)
    await expect(maximumBox(page)).toHaveText(String(before - 6 + value))
  }
})

test('W-6 c: MANUAL on level 2 starts empty and locked; 0 and 11 stay locked; 7 unlocks and moves the maximum', async ({ page }) => {
  await reachHitPoints(page, 3)
  await averageAll(page).click()
  const before = await maximum(page)

  await pill(page, 2, 'Manual').check()
  const input = manualInput(page, 2)
  await expect(input).toHaveValue('')
  await expect(row(page, 2).getByText('Whole number 1–10', { exact: true })).toBeVisible()
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(nextButton(page)).toBeDisabled()

  await input.fill('0')
  await expect(nextButton(page)).toBeDisabled()
  await input.fill('11')
  await expect(nextButton(page)).toBeDisabled()
  await expect(row(page, 2).getByText('Whole number 1–10', { exact: true })).toBeVisible()

  await input.fill('7')
  await expect(nextButton(page)).toBeEnabled()
  await expect(row(page, 2).getByText('Whole number 1–10', { exact: true })).toHaveCount(0)
  await expect(maximumBox(page)).toHaveText(String(before - 6 + 7))
})

test('F-2b: while Manual is empty the big maximum is a dash, and a typed 7 brings the number back', async ({ page }) => {
  await reachHitPoints(page, 3)
  await averageAll(page).click()
  const before = await maximum(page)

  await pill(page, 2, 'Manual').check()
  await expect(maximumBox(page)).toHaveText('—')
  await manualInput(page, 2).fill('7')
  await expect(maximumBox(page)).toHaveText(String(before - 6 + 7))
})

test('F-2b: Manual "1e1" is not a whole number — the row stays invalid and Next stays locked', async ({ page }) => {
  await reachHitPoints(page, 3)
  await averageAll(page).click()
  await pill(page, 2, 'Manual').check()
  await manualInput(page, 2).fill('1e1')
  await expect(manualInput(page, 2)).toHaveAttribute('aria-invalid', 'true')
  await expect(maximumBox(page)).toHaveText('—')
  await expect(nextButton(page)).toBeDisabled()
})

test('F-2b: the Reroll buttons are named after their level', async ({ page }) => {
  await reachHitPoints(page, 3)
  await pill(page, 2, 'Roll (d10)').check()
  await pill(page, 3, 'Roll (d10)').check()
  await expect(page.getByRole('button', { name: 'Reroll level 2', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reroll level 3', exact: true })).toBeVisible()
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

test('W-6 e: level up Fighter 3 → 4 — only the level 4 row, no Level 1 row (D323), no apply-to-all button', async ({ page }) => {
  await createFighter(page, { name: 'Leveller', level: 3, species: 'Dwarf|XPHB' })
  await page.getByRole('button', { name: 'Level up to 4' }).click()
  await takeFighterLevel4Mastery(page)
  await next(page)
  await expectStep(page, 'ASI / Feat')
  await chooseLevelAsi(page, 4, 'strength')
  await next(page)
  await expectStep(page, 'Hit points')
  await expect(page.getByRole('radiogroup', { name: /hit points method/ })).toHaveCount(1)
  await expect(method(page, 4).getByRole('radio')).toHaveCount(3)
  await expect(method(page, 2)).toHaveCount(0)
  await expect(page.getByRole('row', { name: /^Level 1 / })).toHaveCount(0)
  await expect(averageAll(page)).toHaveCount(0)
  await expect(nextButton(page)).toBeDisabled()
  await pill(page, 4, 'Average (6)').check()
  await expect(nextButton(page)).toBeEnabled()
})

test('W-6 f: Edit Character on a character with a manual value 0 — the row shows the error, Next is locked until 5 is entered, then it saves', async ({ page }) => {
  const id = await editWithHitPointLevels(page, 'Old', [
    { level: 2, kind: 'manual', dieResult: 0 },
    { level: 3, kind: 'average', dieResult: 6 },
  ])
  await expect(manualInput(page, 2)).toHaveValue('')
  await expect(manualInput(page, 2)).toHaveAttribute('aria-invalid', 'true')
  await expect(row(page, 2).getByText('Whole number 1–10', { exact: true })).toBeVisible()
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

test('F-2b: a saved "average" row holding 5 on a d10 shows "Average is 6" and one click on AVERAGE fixes it', async ({ page }) => {
  await editWithHitPointLevels(page, 'Legacy', [
    { level: 2, kind: 'average', dieResult: 5 },
    { level: 3, kind: 'average', dieResult: 6 },
  ])
  await expect(pill(page, 2, 'Average (6)')).toBeChecked()
  await expect(row(page, 2).getByText('Average is 6', { exact: true })).toBeVisible()
  await expect(nextButton(page)).toBeDisabled()

  await pill(page, 2, 'Average (6)').click()
  await expect(row(page, 2).getByText('Average is 6', { exact: true })).toHaveCount(0)
  await expect(nextButton(page)).toBeEnabled()
})

test('F-2b: Fighter 20 — the level 4 card offers no Epic Boon, the level 19 card does', async ({ page }) => {
  const options: FighterOptions = { name: 'Epic', level: 20, species: 'Dwarf|XPHB', stopAtAsi: true }
  await fillUpToBackground(page, options)
  await finishFromBackground(page, options)
  await expectStep(page, 'ASI / Feat')

  await expect(levelCard(page, 4)).toBeVisible()
  await expect(levelCard(page, 19)).toBeVisible()
  const enabledBoons = (level: number): Locator => featOrAsiSelect(page, level).locator('option:not([disabled])', { hasText: /^Boon of / })
  await expect(enabledBoons(19).first()).toBeAttached()
  await expect(enabledBoons(4)).toHaveCount(0)
})
