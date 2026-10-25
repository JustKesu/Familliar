import { expect, test, type Page } from '@playwright/test'

/* BF-1 (D404). A Fighter 19 seeded at schema 63, CON 13: max HP 10 + 18 × 6 + 19 = 137; Boon of Fortitude adds a flat 40. */
const STORAGE_KEY = 'familliar:characters'

function fighter(id: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 63,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 19 }],
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    ...extra,
  }
}

// Strength, not Constitution, so the boon's +1 does not move the HP total.
const boon = { level: 19, kind: 'feat', name: 'Boon of Fortitude', source: 'XPHB', chosenAbility: 'strength' }

async function open(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

const hpPair = (page: Page): Promise<string> => page.locator('.sheet__hit-points-value').first().innerText().then((text) => text.replace(/\s+/g, ''))

test('BF-1 a: Boon of Fortitude as the level 19 feat raises max HP by 40 with a named breakdown line', async ({ page }) => {
  await open(page, fighter('bf1-a', { currentHp: 177, featAsiChoices: [boon] }))
  await expect.poll(() => hpPair(page)).toBe('177/177')
  await page.getByRole('button', { name: 'Hit points details' }).first().click()
  await expect(page.getByRole('dialog')).toContainText('Boon of Fortitude (+40): +40')
})

test('BF-1 b: the same character without the boon has the lower maximum', async ({ page }) => {
  await open(page, fighter('bf1-b', { currentHp: 137, featAsiChoices: [] }))
  await expect.poll(() => hpPair(page)).toBe('137/137')
  await page.getByRole('button', { name: 'Hit points details' }).first().click()
  await expect(page.getByRole('dialog')).not.toContainText('Boon of Fortitude')
})

test('BF-1 c: taking the boon in Manage Feats moves current HP with the maximum (D381)', async ({ page }) => {
  await open(page, fighter('bf1-c', { currentHp: 130, featAsiChoices: [] }))
  await expect.poll(() => hpPair(page)).toBe('130/137')
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Manage Feats' })
  await dialog.getByRole('searchbox', { name: 'Search feats' }).fill('Boon of Fortitude')
  await dialog.getByRole('region', { name: 'Add Feats' }).getByRole('button', { name: 'Add Boon of Fortitude', exact: true }).first().click()
  await page.keyboard.press('Escape')
  await expect.poll(() => hpPair(page)).toBe('170/177')
})
