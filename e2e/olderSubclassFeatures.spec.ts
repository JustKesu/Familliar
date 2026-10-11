import { expect, test, type Locator, type Page } from '@playwright/test'

/* F-17 (D343): an older subclass on a 2024 class shows its PHB-filed features. Seeded at schema 60; uses from the classes.json XPHB tables. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

function seeded(id: string, className: string, subclass: string, level: number) {
  return {
    schemaVersion: 60,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: 1,
    abilityScores: { method: 'roll', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 15, charisma: 15 } },
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
}

async function storedUses(page: Page): Promise<unknown> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0]?.play?.resourceUses, STORAGE_KEY)
}

const features = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Features & Traits' })
const actions = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Actions' })
const named = (scope: Locator, name: string): Locator =>
  scope.locator('.sheet__group-row-name, .sheet__feature-option-name').filter({ hasText: new RegExp(`^${name}$`) })
const actionRow = (page: Page, name: string): Locator =>
  actions(page).locator('.sheet__group-row').filter({ has: page.locator('.sheet__group-row-name', { hasText: new RegExp(`^${name}$`) }) })
const usedBoxes = (page: Page, pool: string): Locator => actions(page).getByRole('group', { name: `${pool} uses`, exact: true }).first().locator('.sheet__use-box--used')

test('F-17 a: Paladin 3 Oath of Conquest — Conquering Presence and Guided Strike once each; Guided Strike spends Channel Divinity', async ({ page }) => {
  await openSheet(page, seeded('f17-a', 'Paladin', 'Oath of Conquest', 3))
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const paladin = features(page).getByRole('region', { name: 'Paladin Features', exact: true })
  await expect(named(paladin, 'Conquering Presence')).toHaveCount(1)
  await expect(named(paladin, 'Guided Strike')).toHaveCount(1)
  // c: Aura of Conquest is a level 7 record of the same subclass.
  await expect(named(paladin, 'Aura of Conquest')).toHaveCount(0)

  await page.getByRole('tab', { name: 'Actions' }).click()
  const guided = actionRow(page, 'Guided Strike')
  await expect(guided).toHaveCount(1)
  await expect(actions(page).getByRole('group', { name: 'Channel Divinity uses', exact: true }).first().getByRole('button')).toHaveCount(2)
  await guided.getByRole('button', { name: 'Use Channel Divinity' }).first().click()
  await expect.poll(() => storedUses(page)).toEqual({ 'Channel Divinity': 1 })
  await expect(usedBoxes(page, 'Channel Divinity')).toHaveCount(1)
})

test('F-17 b: Druid 3 Circle of Wildfire — Summon Wildfire Spirit spends Wild Shape; Enhanced Bond (level 6) is not shown', async ({ page }) => {
  await openSheet(page, seeded('f17-b', 'Druid', 'Circle of Wildfire', 3))
  await page.getByRole('tab', { name: 'Actions' }).click()
  const summon = actionRow(page, 'Summon Wildfire Spirit')
  await expect(summon).toHaveCount(1)
  await expect(actions(page).getByRole('group', { name: 'Wild Shape uses', exact: true }).first().getByRole('button')).toHaveCount(2)
  await summon.getByRole('button', { name: 'Use Wild Shape' }).first().click()
  await expect.poll(() => storedUses(page)).toEqual({ 'Wild Shape': 1 })
  await expect(usedBoxes(page, 'Wild Shape')).toHaveCount(1)

  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const druid = features(page).getByRole('region', { name: 'Druid Features', exact: true })
  await expect(named(druid, 'Summon Wildfire Spirit')).toHaveCount(1)
  await expect(named(druid, 'Enhanced Bond')).toHaveCount(0)
})
