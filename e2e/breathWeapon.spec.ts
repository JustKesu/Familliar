import { expect, test, type Locator, type Page } from '@playwright/test'

/* S3 (D313). Characters seeded into storage before the app loads, as in manageFeats.spec.ts. */
const STORAGE_KEY = 'familliar:characters'
const ABILITIES = { method: 'standardArray', scores: { strength: 15, dexterity: 13, constitution: 14, intelligence: 12, wisdom: 10, charisma: 8 } }

function dragonborn(id: string, level: number) {
  return {
    schemaVersion: 56,
    id,
    name: `Dragonborn ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: level >= 3 ? 'Champion' : null, level }],
    abilityScores: ABILITIES,
    species: { name: 'Dragonborn (Black)', source: 'XPHB' },
  }
}

async function openBreathWeapon(page: Page, id: string, level: number): Promise<Locator> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([dragonborn(id, level)]) },
  )
  await page.goto(`/#/character/${id}`)
  await page.getByRole('tab', { name: 'Actions' }).click()
  return page.getByRole('tabpanel', { name: 'Actions' }).getByRole('region', { name: 'Action' }).locator('.sheet__group-row', { hasText: 'Breath Weapon' })
}

test('S3 a: Fighter 1, CON 14 — both areas, DC 12 DEX, 1d10 Acid', async ({ page }) => {
  const row = await openBreathWeapon(page, 's3-a', 1)
  await expect(row).toContainText('15-foot cone / 30-foot line')
  await expect(row.locator('.sheet__action-dc')).toHaveText('DC 12 DEX')
  await expect(row.getByRole('button', { name: 'Roll Breath Weapon damage' })).toHaveText('1d10')
  await expect(row.locator('.sheet__action-damage-type')).toHaveText(/Acid/)
})

test('S3 b: Fighter 5 — 2d10, DC 13 DEX', async ({ page }) => {
  const row = await openBreathWeapon(page, 's3-b', 5)
  await expect(row.locator('.sheet__action-dc')).toHaveText('DC 13 DEX')
  await expect(row.getByRole('button', { name: 'Roll Breath Weapon damage' })).toHaveText('2d10')
})

test('S3 c: the damage button adds a Breath Weapon damage entry to the roll history', async ({ page }) => {
  const row = await openBreathWeapon(page, 's3-c', 1)
  await row.getByRole('button', { name: 'Roll Breath Weapon damage' }).click()
  await page.getByRole('button', { name: 'Rolls', exact: true }).click()
  const history = page.getByRole('dialog', { name: 'Roll history' }).getByRole('listitem')
  await expect(history.filter({ hasText: 'Breath Weapon damage' })).toHaveCount(1)
})
