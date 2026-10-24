import { expect, test, type Page } from '@playwright/test'

/* TGS2-4d (D388): Geleton acid resistance, Psi Warrior Telekinesis with INT, Magic action tags. Seeds at schema 64. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const TGS2 = 'GriffonsSaddlebag2'

function build(id: string, className: string, subclass: string | null, level: number, species = { name: 'Human', source: XPHB }) {
  return {
    schemaVersion: 64,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    species,
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    hitPointLevels: Array.from({ length: level - 1 }, (_, i) => ({ level: i + 2, kind: 'average', dieResult: 6 })),
  }
}

async function openSheet(page: Page, character: ReturnType<typeof build>, tab?: string): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  if (tab) await page.getByRole('tab', { name: tab }).click()
}

const actionRegion = (page: Page) => page.getByRole('tabpanel', { name: 'Actions' }).getByRole('region', { name: 'Action', exact: true })

test('TGS2-4d a: a Geleton shows Acid resistance', async ({ page }) => {
  await openSheet(page, build('tgs2-4d-a', 'Fighter', null, 1, { name: 'Geleton', source: TGS2 }))
  await expect(page.locator('.sheet__defenses')).toContainText('Resistant: Acid')
})

test('TGS2-4d b: Fighter 18 Psi Warrior — Telekinesis DC from Intelligence, not unresolved', async ({ page }) => {
  await openSheet(page, build('tgs2-4d-b', 'Fighter', 'Psi Warrior', 18), 'Spells')
  const row = page.getByRole('tabpanel', { name: 'Spells' }).locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: /^Telekinesis$/ }) })
  await expect(row.first()).toBeVisible()
  // INT 8 (-1) + PB 6 + 8.
  await expect(row.first().locator('.sheet__action-to-hit')).toContainText('DC 13')
  await expect(row.first()).not.toContainText(/unresolved/i)
})

test('TGS2-4d c: Bard 3 Mercantile — Magic Coin is under Action', async ({ page }) => {
  await openSheet(page, build('tgs2-4d-c', 'Bard', 'College of Mercantile', 3), 'Actions')
  await expect(actionRegion(page).locator('.sheet__group-row', { hasText: 'Magic Coin' })).toHaveCount(1)
})

test('TGS2-4d d: an Etherean — Veil Shift is under Action', async ({ page }) => {
  await openSheet(page, build('tgs2-4d-d', 'Fighter', null, 1, { name: 'Etherean', source: TGS2 }), 'Actions')
  await expect(actionRegion(page).locator('.sheet__group-row', { hasText: 'Veil Shift' })).toHaveCount(1)
})
