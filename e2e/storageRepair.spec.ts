import { expect, test, type Page } from '@playwright/test'

/* F-8 (D320): stored data at schema 59 with a bad concentration and a manual feat without an id is repaired on read, not fatal. */
const STORAGE_KEY = 'familliar:characters'
const SCORES = { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 }

function seeded(id: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 59,
    id,
    name,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
    levelOrder: Array.from({ length: 4 }, () => ({ className: 'Fighter', classSource: 'XPHB' })),
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: SCORES },
    species: { name: 'Human', source: 'XPHB' },
    speciesSize: 'M',
    ...extra,
  }
}

async function seed(page: Page, characters: { id: string }[]): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify(characters) },
  )
}

const featsSection = (page: Page) => page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Feats', exact: true })

test('F-8: a bad concentration and an id-less manual feat load; removing the feat sticks across a reload', async ({ page }) => {
  await seed(page, [
    seeded('f8-good', 'Good One'),
    seeded('f8-bad', 'Bad One', {
      play: { concentratingOn: 'Bless' },
      grantedFeats: [{ origin: 'manual', name: 'Tough', source: 'XPHB' }],
    }),
  ])
  await page.goto('/#/')
  await expect(page.locator('.char-grid .char-card')).toHaveCount(2)
  await expect(page.locator('.char-grid')).toContainText('Good One')
  await expect(page.locator('.char-grid')).toContainText('Bad One')

  await page.getByRole('button', { name: 'Bad One', exact: true }).click()
  await expect(page.locator('.sheet__status-row .sheet__concentration')).not.toContainText('Bless')
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await expect(featsSection(page).locator('li').filter({ hasText: 'Tough' }).first()).toContainText('Added manually')

  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Manage Feats' })
  await panel.getByRole('region', { name: 'My Feats' }).getByRole('button', { name: 'Remove Tough', exact: true }).click()
  await expect(panel.getByRole('region', { name: 'My Feats' }).getByRole('button', { name: 'Remove Tough', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Close' }).click()

  await page.reload()
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await expect(featsSection(page).locator('li').filter({ hasText: 'Tough' })).toHaveCount(0)
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]') as { id: string; grantedFeats?: unknown[] }[], STORAGE_KEY)
  expect(stored.find((entry) => entry.id === 'f8-bad')?.grantedFeats).toBeUndefined()
})
