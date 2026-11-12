import { expect, test, type Locator, type Page } from '@playwright/test'

/* LH-1 (D418): Lay on Hands is a pool of 5 x Paladin level, back on a Long Rest only. Seeds at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const NAME = 'Lay on Hands'

function seeded(id: string, classes: [string, string | null, number][]) {
  const total = classes.reduce((sum, [, , level]) => sum + level, 0)
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: classes.map(([className, subclass, level]) => ({ className, classSource: XPHB, subclass, level })),
    levelOrder: classes.flatMap(([className, , level]) => Array.from({ length: level }, () => ({ className, classSource: XPHB }))),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    classSkills: ['athletics', 'perception'],
    hitPointLevels: Array.from({ length: total - 1 }, (_, index) => ({ level: index + 2, kind: 'average', dieResult: 6 })),
  }
}

async function openActions(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Actions' }).click()
}

const counter = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Actions' }).getByRole('group', { name: `${NAME} uses`, exact: true }).first()

test('LH-1 a: Paladin 1 shows 5 boxes', async ({ page }) => {
  await openActions(page, seeded('lh1-a', [['Paladin', null, 1]]))
  await expect(counter(page).getByRole('button')).toHaveCount(5)
  await expect(counter(page)).toContainText('/ Long Rest')
})

test('LH-1 a2: Paladin 7 / Warlock 5 shows a 0 / 35 counter', async ({ page }) => {
  await openActions(page, seeded('lh1-a2', [['Paladin', 'Oath of Devotion', 7], ['Warlock', 'Fiend Patron', 5]]))
  await expect(counter(page)).toContainText('0 / 35')

  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const features = page.getByRole('tabpanel', { name: 'Features & Traits' })
  await expect(features.getByText(NAME).first()).toBeVisible()
  await expect(features.getByRole('group', { name: `${NAME} uses`, exact: true }).first()).toContainText('0 / 35')
})

test('LH-1 b, c: spending 3 shows 3 / 35, a Short Rest keeps it, a Long Rest resets it', async ({ page }) => {
  await openActions(page, seeded('lh1-b', [['Paladin', 'Oath of Devotion', 7], ['Warlock', 'Fiend Patron', 5]]))
  const plus = counter(page).getByRole('button', { name: `Use ${NAME}` })
  for (let i = 0; i < 3; i++) await plus.click()
  await expect(counter(page)).toContainText('3 / 35')

  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Short Rest' })
  await drawer.getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(drawer).toHaveCount(0)
  await expect(counter(page)).toContainText('3 / 35')

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(counter(page)).toContainText('0 / 35')
})
