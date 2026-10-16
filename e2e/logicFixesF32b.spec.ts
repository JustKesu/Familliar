import { expect, test, type Locator, type Page } from '@playwright/test'
import { stepBar } from './wizard.ts'

/* F-32b. Seeded at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

function seeded(id: string, classes: { className: string; level: number }[], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: classes.map(({ className, level }) => ({ className, classSource: XPHB, subclass: null, level })),
    levelOrder: classes.flatMap(({ className, level }) => Array.from({ length: level }, () => ({ className, classSource: XPHB }))),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 8 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    classSkills: ['athletics', 'perception'],
    ...extra,
  }
}

async function open(page: Page, subject: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([subject]) },
  )
  await page.goto(`/#/character/${subject.id}`)
}

const speed = (page: Page): Locator => page.locator('.sheet__speed .sheet__card-value')
const conditionsPanel = (page: Page): Locator => page.getByRole('dialog', { name: 'Conditions' })

async function openConditions(page: Page): Promise<void> {
  await page.locator('.sheet__status-conditions').getByRole('button', { name: '+ Add condition' }).click()
  await expect(conditionsPanel(page)).toBeVisible()
}

test('F-32b a: Restrained sets Speed to 0 ft., turning it off restores 30 ft.', async ({ page }) => {
  await open(page, seeded('f32b-a', [{ className: 'Fighter', level: 1 }]))
  await expect(speed(page)).toHaveText(/^30 ft\b/)
  await openConditions(page)
  const restrained = conditionsPanel(page).getByRole('button', { name: 'Toggle Restrained', exact: true })
  await restrained.click()
  await expect(speed(page)).toHaveText(/^0 ft\b/)
  await restrained.click()
  await expect(speed(page)).toHaveText(/^30 ft\b/)
})

test('F-32b b: Exhaustion 3 gives Speed 15 ft. and a breakdown line naming Exhaustion', async ({ page }) => {
  await open(page, seeded('f32b-b', [{ className: 'Fighter', level: 1 }]))
  await openConditions(page)
  for (let level = 0; level < 3; level++) await conditionsPanel(page).getByRole('button', { name: 'Increase Exhaustion' }).click()
  await expect(conditionsPanel(page).getByLabel('Exhaustion level')).toHaveText('3')
  await page.keyboard.press('Escape')
  await expect(speed(page)).toHaveText(/^15 ft\b/)
  await page.getByRole('button', { name: 'Speed breakdown', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Speed', exact: true })
  await expect(drawer.locator('.drawer__value')).toHaveText('15 ft.')
  await expect(drawer.getByRole('listitem').filter({ hasText: /^Exhaustion 3: −15 ft\.$/ })).toHaveCount(1)
})

test('F-32b c: Fighter 1 / Rogue 1 Edit — "Fighter skills (first class)" heading only while Rogue is active', async ({ page }) => {
  await open(page, seeded('f32b-c', [{ className: 'Fighter', level: 1 }, { className: 'Rogue', level: 1 }]))
  await page.locator('.sheet__edit-character').click()
  await stepBar(page).getByRole('button', { name: /Class and level/ }).click()
  const tab = (className: string): Locator => page.getByRole('group', { name: 'Class to edit' }).getByRole('button', { name: new RegExp(`^${className} \\d+`) })
  const heading = page.getByRole('heading', { name: 'Fighter skills (first class)', exact: true })

  await tab('Rogue').click()
  await expect(tab('Rogue')).toHaveAttribute('aria-pressed', 'true')
  await expect(heading).toBeVisible()

  await tab('Fighter').click()
  await expect(tab('Fighter')).toHaveAttribute('aria-pressed', 'true')
  await expect(heading).toHaveCount(0)
})
