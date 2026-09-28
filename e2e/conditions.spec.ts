import { expect, test, type Locator, type Page } from '@playwright/test'

/* R12 (D214). Characters seeded into storage before the app loads, as in manageExtras.spec.ts. */
const STORAGE_KEY = 'familliar:characters'
const ABILITIES = { method: 'standardArray', scores: { strength: 10, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 15, charisma: 8 } }

function character(id: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 52,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
    abilityScores: ABILITIES,
    ...extra,
  }
}

async function openSheet(page: Page, subject: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([subject]) },
  )
  await page.goto(`/#/character/${subject.id}`)
}

const card = (page: Page): Locator => page.locator('.sheet__status-conditions')
const chips = (page: Page): Locator => card(page).locator('.sheet__chip')
const chip = (page: Page, text: string): Locator => chips(page).filter({ hasText: text })
const panel = (page: Page): Locator => page.getByRole('dialog', { name: 'Conditions' })
const toggle = (page: Page, name: string): Locator => panel(page).getByRole('button', { name: `Toggle ${name}`, exact: true })
const speed = (page: Page): Locator => page.locator('.sheet__speed .sheet__card-value')

async function openPanel(page: Page): Promise<void> {
  await card(page).getByRole('button', { name: '+ Add condition' }).click()
  await expect(panel(page)).toBeVisible()
}

test('R12 a: + Add condition lists the 15 conditions; Poisoned ON shows a chip', async ({ page }) => {
  await openSheet(page, character('r12-a'))
  await expect(chips(page)).toHaveCount(0)
  await openPanel(page)
  await expect(panel(page).locator('.manage-spells__row')).toHaveCount(15)
  await toggle(page, 'Poisoned').click()
  await expect(toggle(page, 'Poisoned')).toHaveAttribute('aria-pressed', 'true')
  await expect(chip(page, 'Poisoned')).toHaveCount(1)
})

test('R12 b: clicking the chip name opens the rule text', async ({ page }) => {
  await openSheet(page, character('r12-b', { play: { conditions: ['Poisoned'] } }))
  await chip(page, 'Poisoned').getByRole('button', { name: 'Poisoned', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Poisoned' })).toContainText('Disadvantage')
})

test('R12 c: × on a chip removes it', async ({ page }) => {
  await openSheet(page, character('r12-c', { play: { conditions: ['Poisoned', 'Prone'] } }))
  await expect(chips(page)).toHaveCount(2)
  await chip(page, 'Poisoned').getByRole('button', { name: 'Remove Poisoned' }).click()
  await expect(chips(page)).toHaveCount(1)
  await expect(chip(page, 'Prone')).toHaveCount(1)
})

test('R12 d: Exhaustion + twice gives "Exhaustion 2 −4 d20 · −10 ft" and leaves Speed alone', async ({ page }) => {
  await openSheet(page, character('r12-d'))
  const speedBefore = await speed(page).innerText()
  await openPanel(page)
  await panel(page).getByRole('button', { name: 'Increase Exhaustion' }).click()
  await panel(page).getByRole('button', { name: 'Increase Exhaustion' }).click()
  await expect(panel(page).getByLabel('Exhaustion level')).toHaveText('2')
  await expect(chip(page, 'Exhaustion 2')).toContainText('−4 d20')
  await expect(chip(page, 'Exhaustion 2')).toContainText('−10 ft')
  expect(await speed(page).innerText()).toBe(speedBefore)

  await page.keyboard.press('Escape')
  await chip(page, 'Exhaustion 2').getByRole('button', { name: 'Remove Exhaustion' }).click()
  await expect(chips(page)).toHaveCount(0)
})

test('R12 e: + is disabled at 6 and − at 0', async ({ page }) => {
  await openSheet(page, character('r12-e'))
  await openPanel(page)
  const minus = panel(page).getByRole('button', { name: 'Decrease Exhaustion' })
  const plus = panel(page).getByRole('button', { name: 'Increase Exhaustion' })
  await expect(minus).toBeDisabled()
  for (let level = 0; level < 6; level++) await plus.click()
  await expect(panel(page).getByLabel('Exhaustion level')).toHaveText('6')
  await expect(plus).toBeDisabled()
  await expect(minus).toBeEnabled()
})

test('R12 f: Long Rest lowers Exhaustion by 1 and keeps Poisoned; Short Rest changes nothing', async ({ page }) => {
  await openSheet(page, character('r12-f', { play: { conditions: ['Poisoned'], exhaustion: 2 } }))
  await expect(chip(page, 'Exhaustion 2')).toHaveCount(1)

  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  await page.getByRole('dialog', { name: 'Short Rest' }).getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(chip(page, 'Exhaustion 2')).toHaveCount(1)
  await expect(chip(page, 'Poisoned')).toHaveCount(1)

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(chip(page, 'Exhaustion 1')).toHaveCount(1)
  await expect(chip(page, 'Poisoned')).toHaveCount(1)

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(chip(page, 'Exhaustion')).toHaveCount(0)
  await expect(chip(page, 'Poisoned')).toHaveCount(1)
})

test('R12 g: conditions and exhaustion survive a reload', async ({ page }) => {
  await openSheet(page, character('r12-g'))
  await openPanel(page)
  await toggle(page, 'Prone').click()
  await panel(page).getByRole('button', { name: 'Increase Exhaustion' }).click()
  await page.reload()
  await expect(chip(page, 'Prone')).toHaveCount(1)
  await expect(chip(page, 'Exhaustion 1')).toHaveCount(1)
})

test('R12 h: a schema-51 character loads and shows no chips', async ({ page }) => {
  await openSheet(page, character('r12-h', { schemaVersion: 51 }))
  await expect(card(page).getByRole('button', { name: '+ Add condition' })).toBeEnabled()
  await expect(chips(page)).toHaveCount(0)
})
