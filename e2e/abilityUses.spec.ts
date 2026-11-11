import { expect, test, type Locator, type Page } from '@playwright/test'

/* AU-1 (D412): uses counted by an ability modifier, from the final score. Seeds at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

function seeded(id: string, classes: [string, string | null, number][], charisma: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: classes.map(([className, subclass, level]) => ({ className, classSource: XPHB, subclass, level })),
    levelOrder: classes.flatMap(([className, , level]) => Array.from({ length: level }, () => ({ className, classSource: XPHB }))),
    createdAtLevel: 1,
    abilityScores: { method: 'roll', scores: { strength: 10, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    ...extra,
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

const counter = (page: Page, name: string): Locator => page.getByRole('tabpanel', { name: 'Actions' }).getByRole('group', { name: `${name} uses`, exact: true }).first()
const boxes = (page: Page, name: string): Locator => counter(page, name).getByRole('button')
const used = (page: Page, name: string): Locator => counter(page, name).locator('.sheet__use-box--used')
const BARDIC = 'Bardic Inspiration'

async function shortRest(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Short Rest' })
  await drawer.getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(drawer).toHaveCount(0)
}

test('AU-1 a: Bard 1 with CHA 14 + 2 from the background shows 3 boxes per Long Rest; a Short Rest keeps a used box, a Long Rest restores it', async ({ page }) => {
  await openSheet(page, seeded('au1-a', [['Bard', null, 1]], 14, { abilityBonus: { charisma: 2, wisdom: 1 } }))
  await expect(boxes(page, BARDIC)).toHaveCount(3)
  await expect(counter(page, BARDIC)).toContainText('/ Long Rest')

  await counter(page, BARDIC).getByRole('button', { name: `Use ${BARDIC}` }).first().click()
  await expect(used(page, BARDIC)).toHaveCount(1)
  await shortRest(page)
  await expect(used(page, BARDIC)).toHaveCount(1)
  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(used(page, BARDIC)).toHaveCount(0)
})

test('AU-1 b: Bard 5 (Font of Inspiration) gets a used Bardic Inspiration box back on a Short Rest', async ({ page }) => {
  await openSheet(page, seeded('au1-b', [['Bard', null, 5]], 16))
  await expect(boxes(page, BARDIC)).toHaveCount(3)
  await counter(page, BARDIC).getByRole('button', { name: `Use ${BARDIC}` }).first().click()
  await expect(used(page, BARDIC)).toHaveCount(1)
  await shortRest(page)
  await expect(used(page, BARDIC)).toHaveCount(0)
})

test('AU-1 c: Bard 1 with CHA 8 still has 1 box', async ({ page }) => {
  await openSheet(page, seeded('au1-c', [['Bard', null, 1]], 8))
  await expect(boxes(page, BARDIC)).toHaveCount(1)
})

test('AU-1 d: Fighter 5 / Bard 6 with CHA 18 shows 4 boxes', async ({ page }) => {
  await openSheet(page, seeded('au1-d', [['Fighter', null, 5], ['Bard', null, 6]], 18))
  await expect(boxes(page, BARDIC)).toHaveCount(4)
})

test('AU-1 e: Warlock 3 Archfey with CHA 16 shows 3 Steps of the Fey boxes', async ({ page }) => {
  await openSheet(page, seeded('au1-e', [['Warlock', 'Archfey Patron', 3]], 16))
  await expect(boxes(page, 'Steps of the Fey')).toHaveCount(3)
})
