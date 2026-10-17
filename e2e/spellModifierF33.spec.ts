import { expect, test, type Locator, type Page } from '@playwright/test'

/* F-33 (D361). Seeded at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

function caster(id: string, className: string, level: number, key: 'wisdom' | 'intelligence', score: number, spells: { name: string; source: string }[]) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass: null, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 10, charisma: 12, [key]: score } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    classSkills: className === 'Cleric' ? ['history', 'medicine'] : ['arcana', 'history'],
    spellChoices: [{ className, classSource: XPHB, spells }],
  }
}

const xphb = (...names: string[]) => names.map((name) => ({ name, source: XPHB }))

async function open(page: Page, subject: { id: string }, tab: 'Spells' | 'Actions'): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([subject]) },
  )
  await page.goto(`/#/character/${subject.id}`)
  await page.getByRole('tab', { name: tab }).click()
}

const section = (page: Page, label: string): Locator => page.getByRole('tabpanel', { name: 'Spells' }).getByRole('region', { name: label, exact: true })
const effect = (scope: Locator, name: string): Locator =>
  scope.locator('.sheet__spell-row', { has: scope.page().locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) }).locator('.sheet__spell-effect')

test('F-33 a: Cleric 5 WIS 16 — Spiritual Weapon 1d8 + 3, cast at 3rd level 2d8 + 3, and 1d8 + 3 in Actions', async ({ page }) => {
  await open(page, caster('f33-a', 'Cleric', 5, 'wisdom', 16, xphb('Guidance', 'Spiritual Weapon')), 'Spells')
  await expect(effect(section(page, '2nd Level'), 'Spiritual Weapon').getByRole('button', { name: 'Roll Spiritual Weapon damage' })).toHaveText('1d8 + 3')
  await expect(effect(section(page, '3rd Level'), 'Spiritual Weapon').getByRole('button', { name: 'Roll Spiritual Weapon damage' })).toHaveText('2d8 + 3')

  await page.getByRole('tab', { name: 'Actions' }).click()
  const row = page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: 'Spiritual Weapon breakdown', exact: true }) })
  await expect(row.getByRole('button', { name: 'Roll Spiritual Weapon damage' })).toHaveText('1d8 + 3')
})

test('F-33 b: Cleric 5 WIS 16 — Cure Wounds heals 2d8 + 3 and the roll adds the 3', async ({ page }) => {
  await open(page, caster('f33-b', 'Cleric', 5, 'wisdom', 16, xphb('Guidance', 'Cure Wounds')), 'Spells')
  const dice = effect(section(page, '1st Level'), 'Cure Wounds').getByRole('button', { name: 'Roll Cure Wounds healing' })
  await expect(dice).toHaveText('2d8 + 3')
  await dice.click()
  await expect(page.locator('.roll-toast')).toContainText('+ 3 =')
})

test('F-33 c: Wizard 5 INT 16 — Green-Flame Blade shows the modifier, never "{{"', async ({ page }) => {
  await open(page, caster('f33-c', 'Wizard', 5, 'intelligence', 16, [{ name: 'Green-Flame Blade', source: 'TCE' }]), 'Spells')
  const cell = effect(section(page, 'Cantrips'), 'Green-Flame Blade')
  await expect(cell).toContainText('1d8 + 3')
  await expect(cell).not.toContainText('{{')
})

test('F-33 d: Cleric 5 WIS 10 — Cure Wounds shows the dice alone, no "+ 0"', async ({ page }) => {
  await open(page, caster('f33-d', 'Cleric', 5, 'wisdom', 10, xphb('Guidance', 'Cure Wounds')), 'Spells')
  const cell = effect(section(page, '1st Level'), 'Cure Wounds')
  await expect(cell.getByRole('button', { name: 'Roll Cure Wounds healing' })).toHaveText('2d8')
  await expect(cell).not.toContainText('+ 0')
})
