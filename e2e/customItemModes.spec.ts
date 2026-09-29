import { expect, test, type Locator, type Page } from '@playwright/test'
import { next } from './wizard.ts'

/*
 * R14a2 (D216). A Human Fighter 3 seeded at the current schema, as customItemBonuses.spec.ts:
 * walking speed 30, no darkvision, no granted senses, max HP 25.
 */
const STORAGE_KEY = 'familliar:characters'
const NOT_ATTUNED = 'requires attunement and you are not attuned to it'

function fighter(id: string, inventory: Record<string, unknown>[] = [], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 54,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
    species: { name: 'Human', source: 'XPHB' },
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    inventory,
    ...extra,
  }
}

function customRow(name: string, definition: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { name, source: 'custom', quantity: 1, custom: { name, kind: 'other', ...definition }, ...extra }
}

async function open(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

async function openManage(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Inventory' })
}

const speedDrawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Speed', exact: true })
const grantedSenses = (page: Page): Locator => page.locator('.sheet__senses-card .sheet__senses')
const hitPoints = (page: Page): Locator => page.locator('.sheet__hit-points-value').first()

async function openSpeed(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Speed breakdown', exact: true }).click()
  return speedDrawer(page)
}

test('R14a2 a: Fly speed 60 and Swim speed 30 on Add Custom Item show in the Speed drawer, naming the item; walking speed stays 30', async ({ page }) => {
  await open(page, fighter('r14a2-a'))
  const panel = await openManage(page)
  await panel.locator('summary', { hasText: 'Create a custom item' }).click()
  await panel.getByLabel('Custom item name').fill('Storm Cloak')
  await panel.getByRole('spinbutton', { name: 'Custom item fly speed' }).fill('60')
  await panel.getByRole('spinbutton', { name: 'Custom item swim speed' }).fill('30')
  await panel.getByRole('button', { name: 'Add custom item' }).click()
  await page.keyboard.press('Escape')

  const drawer = await openSpeed(page)
  await expect(drawer.locator('.drawer__value')).toHaveText('30 ft., fly 60 ft., swim 30 ft.')
  await expect(drawer).toContainText('Storm Cloak')
  await expect(drawer).toContainText('fly 60 ft.')
  await expect(drawer).toContainText('swim 30 ft.')
  await expect(drawer).toContainText('Human')
})

test('R14a2 b: Truesight 30 and Blindsight 10 are listed on the Senses card, each "from item"', async ({ page }) => {
  await open(page, fighter('r14a2-b', [customRow('Seer Lens', { truesight: 30, blindsight: 10 })]))
  await expect(grantedSenses(page)).toContainText('Truesight: 30 ft. — from item (Seer Lens)')
  await expect(grantedSenses(page)).toContainText('Blindsight: 10 ft. — from item (Seer Lens)')
})

test('R14a2 c: an item that requires attunement applies nothing until Attune, and says so meanwhile', async ({ page }) => {
  const cloak = customRow('Storm Cloak', { requiresAttunement: true, flySpeed: 60, truesight: 30 })
  await open(page, fighter('r14a2-c', [cloak]))

  await expect(grantedSenses(page)).toContainText(`Truesight: from item (Storm Cloak) — not applied: ${NOT_ATTUNED}`)
  await expect(grantedSenses(page)).not.toContainText('30 ft.')
  let drawer = await openSpeed(page)
  await expect(drawer.locator('.drawer__value')).toHaveText('30 ft.')
  await expect(drawer).toContainText(`Storm Cloak: considered (fly 60 ft.) — not applied: ${NOT_ATTUNED}`)
  await page.keyboard.press('Escape')

  const panel = await openManage(page)
  await panel.getByRole('button', { name: 'Attune to Storm Cloak' }).click()
  await page.keyboard.press('Escape')

  await expect(grantedSenses(page)).toContainText('Truesight: 30 ft. — from item (Storm Cloak)')
  drawer = await openSpeed(page)
  await expect(drawer.locator('.drawer__value')).toHaveText('30 ft., fly 60 ft.')
})

test('R14a2 d: a Max HP +1 per level item at full HP — Level up to 5 leaves current HP equal to the new maximum', async ({ page }) => {
  const pin = customRow('Lucky Pin', { bonuses: [{ target: 'maxHitPoints', amount: 1, perLevel: true }] })
  // Fighter 4 with a stored level-4 feat: 10 + 3 × 6 + 4 × 1 = 32, +4 from the pin = 36. Level 5 is 44 (+7 level, +1 pin).
  const character = fighter('r14a2-d', [pin], {
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 4 }],
    featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }],
    currentHp: 36,
  })
  await open(page, character)
  await expect(hitPoints(page)).toHaveText('36 / 36')

  await page.getByRole('button', { name: 'Level up to 5' }).click()
  const save = page.getByRole('button', { name: 'Save level 5' })
  for (let steps = 0; steps < 8 && !(await save.isVisible()); steps++) {
    const average = page.getByRole('radio', { name: 'Average (6)' })
    if (await average.isVisible()) await average.check()
    await next(page)
  }
  await save.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  await expect(hitPoints(page)).toHaveText('44 / 44')
})
