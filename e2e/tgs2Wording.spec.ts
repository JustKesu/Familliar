import { expect, test, type Locator, type Page } from '@playwright/test'

/* TGS2-4c (D387): 2024 wording and action tags in the TGS2 homebrew text. Seeds at schema 64. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

function build(id: string, className: string, subclass: string, level: number) {
  return {
    schemaVersion: 64,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    hitPointLevels: Array.from({ length: level - 1 }, (_, i) => ({ level: i + 2, kind: 'average', dieResult: 6 })),
  }
}

async function openSheet(page: Page, character: ReturnType<typeof build>, tab: string): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: tab }).click()
}

const featureRow = (region: Locator, page: Page, name: string): Locator =>
  region.locator('.sheet__group-row').filter({ has: page.locator('.sheet__group-row-name', { hasText: new RegExp(`^${name}$`) }) })

test('TGS2-4c a: Monk 6 Aether — Spectral Guide speaks of Focus Points, not ki', async ({ page }) => {
  await openSheet(page, build('tgs2-w-monk', 'Monk', 'Way of the Aether', 6), 'Features & Traits')
  const monk = page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Monk Features', exact: true })
  await featureRow(monk, page, 'Spectral Guide').locator('.sheet__group-row-toggle').click()
  await expect(monk.getByText('2 Focus Points')).toHaveCount(1)
  await expect(monk.getByText(/ki points?/i)).toHaveCount(0)
})

test('TGS2-4c b: Fighter 3 Steel Hawk — Launch is a Bonus Action row', async ({ page }) => {
  await openSheet(page, build('tgs2-w-fighter', 'Fighter', 'Steel Hawk', 3), 'Actions')
  const bonus = page.getByRole('tabpanel', { name: 'Actions' }).getByRole('region', { name: 'Bonus Action' })
  await expect(bonus.locator('.sheet__group-row', { hasText: 'Launch' })).toHaveCount(1)
})

test('TGS2-4c c: Paladin 3 Spelldrinker — Absorb Magic is a Reaction, Expeditious Command a Bonus Action, both still spend Channel Divinity', async ({ page }) => {
  await openSheet(page, build('tgs2-w-paladin', 'Paladin', 'Oath of the Spelldrinker', 3), 'Actions')
  const panel = page.getByRole('tabpanel', { name: 'Actions' })
  const absorb = panel.getByRole('region', { name: 'Reaction' }).locator('.sheet__group-row', { hasText: 'Absorb Magic' })
  const command = panel.getByRole('region', { name: 'Bonus Action' }).locator('.sheet__group-row', { hasText: 'Expeditious Command' })
  await expect(absorb).toHaveCount(1)
  await expect(command).toHaveCount(1)
  for (const row of [absorb, command]) {
    await expect(row.getByRole('group', { name: 'Channel Divinity uses', exact: true })).toHaveCount(1)
  }
})

test('TGS2-4c d: Bard 14 Mercantile — Shrewd Consumer links Utilize', async ({ page }) => {
  await openSheet(page, build('tgs2-w-bard', 'Bard', 'College of Mercantile', 14), 'Features & Traits')
  const bard = page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Bard Features', exact: true })
  await featureRow(bard, page, 'Shrewd Consumer').locator('.sheet__group-row-toggle').click()
  await expect(bard.getByText('Utilize')).toHaveCount(1)
  await expect(bard.getByText('Use an Object')).toHaveCount(0)
})
