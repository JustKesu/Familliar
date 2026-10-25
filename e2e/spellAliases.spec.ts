import { expect, test, type Page } from '@playwright/test'

/* SR-1 (D406). Warlock 9 seeded at schema 67; two expanded-list refs that resolve only through findSpell's alias table. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

function warlock(id: string, subclass: string) {
  return {
    schemaVersion: 67,
    id,
    name: id,
    classes: [{ className: 'Warlock', classSource: XPHB, subclass, level: 9 }],
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
  }
}

async function open(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
}

const spellName = (page: Page, name: string) =>
  page.getByRole('tabpanel', { name: 'Spells' }).locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) })

test('SR-1 a: Hexblade "branding smite" shows as Shining Smite', async ({ page }) => {
  await open(page, warlock('sr1-a', 'The Hexblade'))
  await expect(spellName(page, 'Shining Smite')).toHaveCount(1)
})

test('SR-1 b: Fathomless "summon elemental|tce" shows as Summon Elemental', async ({ page }) => {
  await open(page, warlock('sr1-b', 'The Fathomless'))
  await expect(spellName(page, 'Summon Elemental')).toHaveCount(1)
})
