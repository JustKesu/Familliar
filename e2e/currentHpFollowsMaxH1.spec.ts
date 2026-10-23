import { expect, test, type Locator, type Page } from '@playwright/test'

/* H-1 (D381). A Fighter 3 seeded at schema 63, CON 13: max HP 10 + 6 + 6 + 3 = 25. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

function fighter(id: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 63,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: XPHB, subclass: null, level: 3 }],
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    ...extra,
  }
}

const vitalityPin = { name: 'Vitality Pin', source: 'custom', quantity: 1, custom: { name: 'Vitality Pin', kind: 'other', requiresAttunement: true, bonuses: [{ target: 'maxHitPoints', amount: 6 }] } }

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
const storedCurrentHp = (page: Page): Promise<number | undefined> => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0].currentHp, STORAGE_KEY)

async function openInventory(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Inventory' })
}

/* "Stays" can only be seen after the follow-up write would have landed; the maximum is shown first, then a short settle. */
async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(500)
}

test('H-1 a: at full HP, Tough taken in Manage Feats raises current with the maximum', async ({ page }) => {
  await open(page, fighter('h1-a', { currentHp: 25 }))
  await expect.poll(() => hpPair(page)).toBe('25/25')
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Manage Feats' })
  await dialog.getByRole('searchbox', { name: 'Search feats' }).fill('Tough')
  await dialog.getByRole('region', { name: 'Add Feats' }).getByRole('button', { name: 'Add Tough', exact: true }).first().click()
  await page.keyboard.press('Escape')
  await expect.poll(() => hpPair(page)).toBe('31/31')
})

test('H-1 b: with damage taken, attuning a +6 max HP item moves current +6 and ending attunement -6', async ({ page }) => {
  await open(page, fighter('h1-b', { currentHp: 19, inventory: [vitalityPin] }))
  await expect.poll(() => hpPair(page)).toBe('19/25')
  const panel = await openInventory(page)
  await panel.getByRole('button', { name: 'Attune to Vitality Pin' }).click()
  await expect.poll(() => storedCurrentHp(page)).toBe(25)
  await panel.getByRole('button', { name: 'End attunement to Vitality Pin' }).click()
  await expect.poll(() => storedCurrentHp(page)).toBe(19)
  await page.keyboard.press('Escape')
  await expect.poll(() => hpPair(page)).toBe('19/25')
})

test('H-1 c: at 0 HP a higher maximum leaves current at 0', async ({ page }) => {
  await open(page, fighter('h1-c', { currentHp: 0, inventory: [vitalityPin] }))
  const panel = await openInventory(page)
  await panel.getByRole('button', { name: 'Attune to Vitality Pin' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Hit points details' }).first().click()
  await expect(page.locator('.drawer__value').first()).toHaveText('0 / 31')
  await settle(page)
  expect(await storedCurrentHp(page)).toBe(0)
})

test('H-1 d: setting Max HP override by hand does not move current', async ({ page }) => {
  await open(page, fighter('h1-d', { currentHp: 20 }))
  await expect.poll(() => hpPair(page)).toBe('20/25')
  await page.getByRole('button', { name: 'Hit points details' }).first().click()
  const override = page.getByRole('spinbutton', { name: 'Max HP override' })
  await override.fill('40')
  await override.press('Enter')
  await page.keyboard.press('Escape')
  await expect.poll(() => hpPair(page)).toBe('20/40')
  await settle(page)
  expect(await storedCurrentHp(page)).toBe(20)
})
