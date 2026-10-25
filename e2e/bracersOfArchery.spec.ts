import { expect, test, type Locator, type Page } from '@playwright/test'

/* BA-1 (D402). A level 1 Fighter, STR 16 (+3) DEX 14 (+2): bows use DEX, so Longbow 1d8 + 2 base. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

function fighter(id: string, inventory: Record<string, unknown>[]) {
  return {
    schemaVersion: 66,
    id,
    name: id,
    classes: [{ className: 'Fighter', classSource: XPHB, subclass: null, level: 1 }],
    abilityScores: { method: 'standardArray', scores: { strength: 16, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 10, charisma: 12 } },
    inventory,
  }
}

const held = (name: string, extra: Record<string, unknown> = {}) => ({ name, source: XPHB, quantity: 1, equipped: 'held', ...extra })
const bracers = (attuned: boolean) => ({ name: 'Bracers of Archery', source: 'XDMG', quantity: 1, ...(attuned ? { attuned: true } : {}) })

async function open(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

async function actionRow(page: Page, label: string): Promise<Locator> {
  await page.getByRole('tab', { name: 'Actions' }).click()
  return page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: `${label} breakdown`, exact: true }) })
}

test('BA-1 a, b, c: attuned Bracers add +2 to Longbow and a magic Shortbow, nothing else', async ({ page }) => {
  await open(page, fighter('ba1-a', [bracers(true), held('Longbow'), held('Shortbow', { magicBonus: 1 }), held('Light Crossbow'), held('Mace')]))

  const longbow = await actionRow(page, 'Longbow')
  await expect(longbow.locator('.sheet__action-damage')).toContainText('1d8 + 4')
  await longbow.getByRole('button', { name: 'Longbow breakdown', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Bracers of Archery: +2')
  await page.keyboard.press('Escape')

  // DEX +2, the bow's own +1, Bracers +2.
  await expect((await actionRow(page, 'Shortbow +1')).locator('.sheet__action-damage')).toContainText('1d6 + 5')
  await expect((await actionRow(page, 'Light Crossbow')).locator('.sheet__action-damage')).toContainText('1d8 + 2')
  await expect((await actionRow(page, 'Mace')).locator('.sheet__action-damage')).toContainText('1d6 + 3')
})

test('BA-1 d: Bracers that are not attuned add nothing', async ({ page }) => {
  await open(page, fighter('ba1-d', [bracers(false), held('Longbow')]))
  await expect((await actionRow(page, 'Longbow')).locator('.sheet__action-damage')).toContainText('1d8 + 2')
})
