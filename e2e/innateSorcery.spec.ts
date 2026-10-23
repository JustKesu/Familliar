import { expect, test, type Locator, type Page } from '@playwright/test'

/* B-3 (D374): Innate Sorcery's two uses per Long Rest, single class and multiclass. Seeds at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const NAME = 'Innate Sorcery'

function seeded(id: string, classes: [string, number][]) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: classes.map(([className, level]) => ({ className, classSource: XPHB, subclass: null, level })),
    levelOrder: classes.flatMap(([className, level]) => Array.from({ length: level }, () => ({ className, classSource: XPHB }))),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
  }
}

async function openSheet(page: Page, character: { id: string }): Promise<void> {
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
const boxes = (page: Page): Locator => counter(page).getByRole('button')
const used = (page: Page): Locator => counter(page).locator('.sheet__use-box--used')

test('B-3 a: Sorcerer 1 shows an Innate Sorcery uses group with 2 boxes', async ({ page }) => {
  await openSheet(page, seeded('b3-a', [['Sorcerer', 1]]))
  await expect(boxes(page)).toHaveCount(2)
})

test('B-3 b: a spent Innate Sorcery use survives a Short Rest and comes back on a Long Rest', async ({ page }) => {
  await openSheet(page, seeded('b3-b', [['Sorcerer', 1]]))
  await counter(page).getByRole('button', { name: `Use ${NAME}` }).first().click()
  await expect(used(page)).toHaveCount(1)

  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Short Rest' })
  await drawer.getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(drawer).toHaveCount(0)
  await expect(used(page)).toHaveCount(1)

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(used(page)).toHaveCount(0)
})

test('B-3 c: Warlock 6 / Sorcerer 3 shows 2 Innate Sorcery boxes', async ({ page }) => {
  await openSheet(page, seeded('b3-c', [['Warlock', 6], ['Sorcerer', 3]]))
  await expect(boxes(page)).toHaveCount(2)
})
