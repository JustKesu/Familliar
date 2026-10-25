import { expect, test, type Locator, type Page } from '@playwright/test'

/* TL-1 (D405): a feature with two independent use limits gets one set of boxes per limit. Seeded at schema 60. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const FREE_SPELL = 'Natural Recovery (free spell)'
const SLOTS = 'Natural Recovery (slot recovery)'

const druid = (id: string, extra: Record<string, unknown> = {}) => ({
  schemaVersion: 60,
  id,
  name: id,
  classes: [{ className: 'Druid', classSource: XPHB, subclass: 'Circle of the Land', level: 6 }],
  levelOrder: Array.from({ length: 6 }, () => ({ className: 'Druid', classSource: XPHB })),
  createdAtLevel: 1,
  abilityScores: { method: 'roll', scores: { strength: 10, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 15, charisma: 8 } },
  species: { name: 'Human', source: XPHB },
  speciesSize: 'M',
  background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
  ...extra,
})

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

async function storedUses(page: Page): Promise<unknown> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0]?.play?.resourceUses, STORAGE_KEY)
}

const actions = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Actions' })
const counter = (scope: Locator, name: string): Locator => scope.getByRole('group', { name: `${name} uses`, exact: true }).first()
const used = (scope: Locator, name: string): Locator => counter(scope, name).locator('.sheet__use-box--used')

test('TL-1 a: Circle of the Land Druid 6 shows two Natural Recovery rows with one box each, on Actions and Features', async ({ page }) => {
  await openActions(page, druid('tl1-a'))
  const row = actions(page).locator('.sheet__group-row', { hasText: 'Natural Recovery' }).first()
  await expect(counter(row, FREE_SPELL).getByRole('button')).toHaveCount(1)
  await expect(counter(row, SLOTS).getByRole('button')).toHaveCount(1)
  await expect(row.locator('.sheet__use-limit-label')).toHaveText(['free spell', 'slot recovery'])
  await expect(actions(page).getByRole('group', { name: 'Natural Recovery uses', exact: true })).toHaveCount(0)

  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const features = page.getByRole('tabpanel', { name: 'Features & Traits' })
  await expect(counter(features, FREE_SPELL).getByRole('button')).toHaveCount(1)
  await expect(counter(features, SLOTS).getByRole('button')).toHaveCount(1)
})

test('TL-1 b: using one limit leaves the other alone', async ({ page }) => {
  await openActions(page, druid('tl1-b'))
  await counter(actions(page), FREE_SPELL).getByRole('button', { name: `Use ${FREE_SPELL}` }).click()
  await expect(used(actions(page), FREE_SPELL)).toHaveCount(1)
  await expect(used(actions(page), SLOTS)).toHaveCount(0)
  await expect.poll(() => storedUses(page)).toEqual({ [FREE_SPELL]: 1 })
})

test('TL-1 c: a Short Rest keeps both (Long Rest limits), a Long Rest restores both', async ({ page }) => {
  await openActions(page, druid('tl1-c', { play: { resourceUses: { [FREE_SPELL]: 1, [SLOTS]: 1 } } }))
  await expect(used(actions(page), FREE_SPELL)).toHaveCount(1)
  await expect(used(actions(page), SLOTS)).toHaveCount(1)

  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Short Rest' })
  await drawer.getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(drawer).toHaveCount(0)
  await expect(used(actions(page), FREE_SPELL)).toHaveCount(1)
  await expect(used(actions(page), SLOTS)).toHaveCount(1)

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(used(actions(page), FREE_SPELL)).toHaveCount(0)
  await expect(used(actions(page), SLOTS)).toHaveCount(0)
})

test('TL-1 d: a one-limit feature keeps its single unlabelled set; an old bare "Natural Recovery" count shows nowhere', async ({ page }) => {
  await openActions(page, druid('tl1-d', { play: { resourceUses: { 'Natural Recovery': 1 } } }))
  const row = actions(page).locator('.sheet__group-row', { hasText: 'Wild Resurgence' }).first()
  await expect(counter(row, 'Wild Resurgence').getByRole('button')).toHaveCount(1)
  await expect(row.locator('.sheet__use-limits')).toHaveCount(0)
  await expect(used(actions(page), FREE_SPELL)).toHaveCount(0)
  await expect(used(actions(page), SLOTS)).toHaveCount(0)
})
