import { expect, test, type Locator, type Page } from '@playwright/test'

/* PSI-1 (D398): Psi Warrior and Soulknife each keep their own Psionic Energy Die pool. Seeded at schema 66. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const PLAIN = 'Psionic Energy Die'
const FIGHTER = 'Psionic Energy Die (Fighter)'
const ROGUE = 'Psionic Energy Die (Rogue)'

function seeded(id: string, classes: [string, string, number][], currentHp: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 66,
    id,
    name: id,
    classes: classes.map(([className, subclass, level]) => ({ className, classSource: XPHB, subclass, level })),
    levelOrder: classes.flatMap(([className, , level]) => Array.from({ length: level }, () => ({ className, classSource: XPHB }))),
    createdAtLevel: 1,
    currentHp,
    abilityScores: { method: 'roll', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 14, wisdom: 14, charisma: 15 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    ...extra,
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

const storedUses = (page: Page): Promise<unknown> => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0]?.play?.resourceUses, STORAGE_KEY)
const actions = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Actions' })
const counter = (page: Page, name: string): Locator => actions(page).getByRole('group', { name: `${name} uses`, exact: true }).first()
const boxes = (page: Page, name: string): Locator => counter(page, name).getByRole('button')
const used = (page: Page, name: string): Locator => counter(page, name).locator('.sheet__use-box--used')
const row = (page: Page, feature: string): Locator => actions(page).locator('.sheet__group-row', { hasText: feature }).first()

async function shortRest(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Short Rest' })
  await drawer.getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(drawer).toHaveCount(0)
}

test('PSI-1 a: Rogue 3 Soulknife alone has a plain pool of 4; a Short Rest returns one die, a Long Rest all', async ({ page }) => {
  await openActions(page, seeded('psi1-a', [['Rogue', 'Soulknife', 3]], 21, { play: { resourceUses: { [PLAIN]: 3 } } }))
  await expect(boxes(page, PLAIN)).toHaveCount(4)
  await expect(actions(page).getByRole('group', { name: `${ROGUE} uses` })).toHaveCount(0)
  await expect(used(page, PLAIN)).toHaveCount(3)

  await shortRest(page)
  await expect(used(page, PLAIN)).toHaveCount(2)
  expect(await storedUses(page)).toEqual({ [PLAIN]: 2 })

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(used(page, PLAIN)).toHaveCount(0)
})

test('PSI-1 b: Fighter 3 Psi Warrior / Rogue 3 Soulknife has two pools of 4; each subclass feature spends its own', async ({ page }) => {
  await openActions(page, seeded('psi1-b', [['Fighter', 'Psi Warrior', 3], ['Rogue', 'Soulknife', 3]], 43))
  await expect(boxes(page, FIGHTER)).toHaveCount(4)
  await expect(boxes(page, ROGUE)).toHaveCount(4)
  await expect(actions(page).getByRole('group', { name: `${PLAIN} uses`, exact: true })).toHaveCount(0)

  await row(page, 'Protective Field').getByRole('button', { name: `Use ${FIGHTER}` }).first().click()
  await expect.poll(() => storedUses(page)).toEqual({ [FIGHTER]: 1 })
  await row(page, 'Psi-Bolstered Knack').getByRole('button', { name: `Use ${ROGUE}` }).first().click()
  await expect.poll(() => storedUses(page)).toEqual({ [FIGHTER]: 1, [ROGUE]: 1 })
})

test('PSI-1 b2: a Short Rest returns one die to each of the two pools', async ({ page }) => {
  await openActions(page, seeded('psi1-b2', [['Fighter', 'Psi Warrior', 3], ['Rogue', 'Soulknife', 3]], 43, { play: { resourceUses: { [FIGHTER]: 3, [ROGUE]: 2 } } }))
  await expect(used(page, FIGHTER)).toHaveCount(3)
  await expect(used(page, ROGUE)).toHaveCount(2)

  await shortRest(page)
  await expect(used(page, FIGHTER)).toHaveCount(2)
  await expect(used(page, ROGUE)).toHaveCount(1)
  expect(await storedUses(page)).toEqual({ [FIGHTER]: 2, [ROGUE]: 1 })
})

test('PSI-1 c: Fighter 3 Psi Warrior alone keeps the plain pool of 4; Protective Field spends it and a Short Rest returns one die', async ({ page }) => {
  await openActions(page, seeded('psi1-c', [['Fighter', 'Psi Warrior', 3]], 25))
  await expect(boxes(page, PLAIN)).toHaveCount(4)
  await expect(actions(page).getByRole('group', { name: `${FIGHTER} uses` })).toHaveCount(0)

  await row(page, 'Protective Field').getByRole('button', { name: `Use ${PLAIN}` }).first().click()
  await row(page, 'Protective Field').getByRole('button', { name: `Use ${PLAIN}` }).first().click()
  await expect.poll(() => storedUses(page)).toEqual({ [PLAIN]: 2 })

  await shortRest(page)
  await expect(used(page, PLAIN)).toHaveCount(1)
  expect(await storedUses(page)).toEqual({ [PLAIN]: 1 })
})
