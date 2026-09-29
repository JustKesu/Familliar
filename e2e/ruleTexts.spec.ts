import { expect, test, type Locator, type Page } from '@playwright/test'

/* R15 (D223): collapsed rule texts in the four left-column detail drawers. Seeded as customItemBonuses.spec.ts. */
const STORAGE_KEY = 'familliar:characters'
const HINT = 'Need an extra bonus (a DM gift, homebrew)? Add it as a custom item in Manage Inventory.'

function fighter(id: string, inventory: Record<string, unknown>[] = []) {
  return {
    schemaVersion: 54,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    inventory,
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
}

async function drawer(page: Page, gear: string, title: string): Promise<Locator> {
  await page.getByRole('button', { name: gear, exact: true }).click()
  return page.getByRole('dialog', { name: title, exact: true })
}

const ruleRow = (scope: Locator, label: string): Locator =>
  scope.locator('details.drawer-row', { has: scope.page().locator('summary', { hasText: new RegExp(`^${label}$`) }) })
const section = (scope: Locator, title: string): Locator =>
  scope.locator('details.drawer-section', { has: scope.page().locator('summary', { hasText: new RegExp(`^${title}$`) }) })

async function expectToggles(row: Locator, phrase: string): Promise<void> {
  await expect(row).toHaveCount(1)
  await expect(row).not.toHaveAttribute('open')
  await expect(row.locator('.rule-text')).toBeHidden()
  await row.locator('summary').click()
  await expect(row.locator('.rule-text')).toContainText(phrase)
  await row.locator('summary').click()
  await expect(row.locator('.rule-text')).toBeHidden()
}

test('R15 a+e: Saving throws drawer — "Saving Throw" rule collapsed, expands and collapses; custom item sentence', async ({ page }) => {
  await open(page, fighter('r15-a'))
  const saves = await drawer(page, 'Saving throws details', 'Saving throws')
  await expectToggles(ruleRow(saves, 'Saving Throw'), 'represents an attempt to')
  await expect(saves.getByText(HINT)).toBeVisible()
})

test('R15 b+e: Skills drawer — Skill/Expertise rules, Acrobatics description expands; Stealth name opens its description', async ({ page }) => {
  await open(page, fighter('r15-b'))
  const skills = await drawer(page, 'Skills details', 'Skills')
  await expect(ruleRow(skills, 'Skill')).toHaveCount(1)
  await expect(ruleRow(skills, 'Expertise')).toHaveCount(1)
  await expectToggles(ruleRow(section(skills, 'Acrobatics'), 'Acrobatics description'), 'Stay on your feet')
  await expect(skills.getByText(HINT)).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Stealth breakdown', exact: true }).click()
  const stealth = page.getByRole('dialog', { name: 'Stealth', exact: true })
  await expectToggles(ruleRow(stealth, 'Stealth description'), 'Escape notice by moving quietly')
})

test('R15 c+e: Proficiencies drawer — "Proficiency" rule at the top, "Armor Training" in Armor, "Weapon" in Weapons', async ({ page }) => {
  await open(page, fighter('r15-c'))
  const proficiencies = await drawer(page, 'Proficiencies details', 'Proficiencies')
  await expectToggles(ruleRow(proficiencies, 'Proficiency'), 'If you have proficiency with something')
  await expectToggles(ruleRow(section(proficiencies, 'Armor'), 'Armor Training'), 'Armor training allows you')
  await expect(ruleRow(section(proficiencies, 'Weapons'), 'Weapon')).toHaveCount(1)
  await expect(proficiencies.getByText(HINT)).toBeVisible()
})

test('R15 d+e: Senses drawer — an attuned item with Blindsight 10 adds a Blindsight row with range, source and rule; none without it', async ({ page }) => {
  const charm = { name: 'Bat Charm', source: 'custom', quantity: 1, attuned: true, custom: { name: 'Bat Charm', kind: 'other', requiresAttunement: true, blindsight: 10 } }
  await open(page, fighter('r15-d', [charm]))
  const senses = await drawer(page, 'Senses details', 'Senses')
  await expect(ruleRow(senses, 'Passive Perception rule')).toHaveCount(1)
  const blindsight = section(senses, 'Blindsight')
  await expect(blindsight).toContainText('10 ft. — from item (Bat Charm)')
  await expectToggles(ruleRow(blindsight, 'Blindsight rule'), 'you can see within a specific range')
  await expect(senses.getByText(HINT)).toBeVisible()
})

test('R15 d: Senses drawer without the item lists no Blindsight', async ({ page }) => {
  await open(page, fighter('r15-d2'))
  const senses = await drawer(page, 'Senses details', 'Senses')
  await expect(ruleRow(senses, 'Passive Perception rule')).toHaveCount(1)
  await expect(section(senses, 'Blindsight')).toHaveCount(0)
})
