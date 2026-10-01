import { expect, test, type Locator, type Page } from '@playwright/test'
import { featOrAsiSelect, next, takeAllFighterLevel4Picks } from './wizard.ts'

/*
 * R14e2 (D222). The Fighter 3 of itemAbilityScores.spec.ts: STR 15, DEX 14, CON 13, max HP 25 (CON +1 × 3 levels).
 */
const STORAGE_KEY = 'familliar:characters'

function fighter(id: string, inventory: Record<string, unknown>[], scores: Record<string, number> = {}, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 54,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
    species: { name: 'Human', source: 'XPHB' },
    abilityScores: { method: 'roll', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10, ...scores } },
    inventory,
    ...extra,
  }
}

const customRow = (name: string, definition: Record<string, unknown>) => ({ name, source: 'custom', quantity: 1, custom: { name, kind: 'other', ...definition } })

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

const score = (page: Page, ability: string): Locator => page.locator(`.ability-card[data-ability="${ability}"] .ability-card__score`)

async function maxHp(page: Page): Promise<number> {
  const match = /\/\s*(\d+)/.exec(await page.locator('.sheet__hit-points-value').first().innerText())
  return match ? Number(match[1]) : NaN
}

async function expectAbilityBreakdown(page: Page, label: string, text: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: `${label} score breakdown`, exact: true }).click()
  await expect(page.getByRole('dialog', { name: label, exact: true })).toContainText(text)
  await page.keyboard.press('Escape')
}

const row = (panel: Locator, n: number) => ({
  ability: panel.getByRole('combobox', { name: `Custom item ability score ${n} ability` }),
  kind: panel.getByRole('combobox', { name: `Custom item ability score ${n} kind` }),
  number: panel.getByRole('spinbutton', { name: `Custom item ability score ${n} number` }),
  max: panel.getByRole('spinbutton', { name: `Custom item ability score ${n} max` }),
})

test('R14e2 a: a custom "Set to 19" Strength without attunement applies from the pack and names the item', async ({ page }) => {
  await open(page, fighter('r14e2-a', [customRow('Ogre Glove', { abilityScores: [{ ability: 'strength', kind: 'set', value: 19 }] })]))
  await expect(score(page, 'strength')).toHaveText('19')
  await expectAbilityBreakdown(page, 'Strength', 'Ogre Glove: set to 19')
})

test('R14e2 b: an attunement item "Add 2, max 20" to Constitution is inert until attuned, then stops at 20 and lifts max HP', async ({ page }) => {
  const stone = customRow('Vigor Stone', { requiresAttunement: true, abilityScores: [{ ability: 'constitution', kind: 'add', amount: 2, max: 20 }] })
  await open(page, fighter('r14e2-b', [stone], { constitution: 19 }))
  await expect(score(page, 'constitution')).toHaveText('19')
  await expectAbilityBreakdown(page, 'Constitution', 'considered (+2, maximum 20) — not applied: not attuned')

  const panel = await openManage(page)
  await panel.getByRole('button', { name: 'Attune to Vigor Stone' }).click()
  await page.keyboard.press('Escape')
  await expect(score(page, 'constitution')).toHaveText('20')
  await expectAbilityBreakdown(page, 'Constitution', 'capped at 20')
  // CON +4 → +5 adds 1 × 3 levels to 34.
  await expect.poll(() => maxHp(page)).toBe(37)
})

test('R14e2 c: custom "Set to 21" beside an attuned Belt of Hill Giant Strength leaves one with no effect; editing it to 23 wins', async ({ page }) => {
  const belt = { name: 'Belt of Hill Giant Strength', source: 'XDMG', quantity: 1, attuned: true }
  await open(page, fighter('r14e2-c', [belt, customRow('Ogre Glove', { abilityScores: [{ ability: 'strength', kind: 'set', value: 21 }] })]))
  await expect(score(page, 'strength')).toHaveText('21')
  await expectAbilityBreakdown(page, 'Strength', 'no effect')

  const panel = await openManage(page)
  await panel.getByRole('region', { name: 'My Inventory' }).getByRole('button', { name: 'Edit Ogre Glove' }).click()
  await row(panel, 1).number.fill('23')
  await panel.getByRole('button', { name: 'Save changes' }).click()
  await page.keyboard.press('Escape')
  await expect(score(page, 'strength')).toHaveText('23')
  await expectAbilityBreakdown(page, 'Strength', 'Ogre Glove: set to 23')
})

test('R14e2 d: Max appears only for Add and starts at 20, a used ability is not offered again, an empty number disables Add', async ({ page }) => {
  await open(page, fighter('r14e2-d', []))
  const panel = await openManage(page)
  await panel.locator('summary', { hasText: 'Create a custom item' }).click()
  await panel.getByLabel('Custom item name').fill('Test Item')
  await panel.getByRole('button', { name: '+ Add ability score' }).click()
  const first = row(panel, 1)
  await expect(first.max).toHaveCount(0)
  await first.kind.selectOption({ label: 'Add' })
  await expect(first.max).toHaveValue('20')
  await first.ability.selectOption({ label: 'Strength' })

  await panel.getByRole('button', { name: '+ Add ability score' }).click()
  await expect(row(panel, 2).ability.locator('option[value="strength"]')).toHaveCount(0)
  await expect(row(panel, 2).ability.locator('option[value="dexterity"]')).toHaveCount(1)

  await expect(panel.getByRole('button', { name: 'Add custom item' })).toBeDisabled()
  await first.number.fill('2')
  await row(panel, 2).ability.selectOption({ label: 'Dexterity' })
  await row(panel, 2).number.fill('19')
  await expect(panel.getByRole('button', { name: 'Add custom item' })).toBeEnabled()
  await row(panel, 2).number.fill('')
  await expect(panel.getByRole('button', { name: 'Add custom item' })).toBeDisabled()
})

test('R14e2 e: Level up shows the base Strength, not the custom item', async ({ page }) => {
  const glove = customRow('Ogre Glove', { abilityScores: [{ ability: 'strength', kind: 'set', value: 21 }] })
  await open(page, fighter('r14e2-e', [glove], {}, { classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 3 }] }))
  await expect(score(page, 'strength')).toHaveText('21')
  await page.getByRole('button', { name: 'Level up to 4' }).click()
  await takeAllFighterLevel4Picks(page)
  const level4 = page.getByRole('group', { name: 'Level 4' })
  for (let steps = 0; steps < 8 && !(await level4.isVisible()); steps++) await next(page)
  await featOrAsiSelect(page, 4).selectOption('asi')
  const strength = level4.getByRole('combobox', { name: 'Level 4 +2 ability', exact: true }).locator('option[value="strength"]')
  await expect(strength).toBeEnabled()
})
