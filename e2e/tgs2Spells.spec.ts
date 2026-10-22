import { expect, test, type Locator, type Page } from '@playwright/test'

/* TGS2-4a (D370): Way of the Aether and Steel Hawk spells from the hand table. Subclass source GriffonsSaddlebag2; seeds at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const ACOLYTE = { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" }

function seeded(id: string, className: string, subclass: string, level: number, extra: Record<string, unknown>) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: ACOLYTE,
    hitPointLevels: Array.from({ length: level - 1 }, (_, index) => ({ level: index + 2, kind: 'average', dieResult: 6 })),
    featAsiChoices: [4, 8, 12, 16].filter((asi) => asi <= level).map((asi) => ({ level: asi, kind: 'asi', increases: { wisdom: 2 } })),
    spellChoices: [],
    ...extra,
  }
}

const monk = (id: string, level: number) =>
  seeded(id, 'Monk', 'Way of the Aether', level, { classSkills: ['acrobatics', 'stealth'], toolChoices: [{ grantedBy: 'monk', name: "Smith's Tools" }] })

const fighter = (id: string) =>
  seeded(id, 'Fighter', 'Steel Hawk', 3, {
    classSkills: ['athletics', 'perception'],
    masteries: ['Longsword', 'Greatsword', 'Handaxe'].map((name) => ({ name })),
    fightingStyles: [{ name: 'Defense', source: XPHB, className: 'Fighter', classSource: XPHB }],
  })

async function openSpells(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
}

const panel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const named = (page: Page, name: string) => ({ has: page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })
const row = (page: Page, name: string): Locator => panel(page).locator('.sheet__spell-row', named(page, name))
const kindRow = (page: Page, name: string, kind: 'cast' | 'use'): Locator => panel(page).locator(`.sheet__spell-row--${kind}`, named(page, name))

test('TGS2-4a a: Monk 3 Way of the Aether lists Mage Hand, not Spare the Dying', async ({ page }) => {
  await openSpells(page, monk('tgs2-4a-a', 3))
  await expect(row(page, 'Mage Hand')).toHaveCount(1)
  await expect(row(page, 'Spare the Dying')).toHaveCount(0)
})

test('TGS2-4a b: Monk 6 Way of the Aether — Spare the Dying; Gentle Repose and See Invisibility each USE for 2 Focus Points', async ({ page }) => {
  await openSpells(page, monk('tgs2-4a-b', 6))
  await expect(row(page, 'Spare the Dying')).toHaveCount(1)
  for (const name of ['Gentle Repose', 'See Invisibility']) {
    await expect(kindRow(page, name, 'use')).toContainText('2 Focus Point ·')
    await expect(kindRow(page, name, 'cast')).toHaveCount(0)
  }
  const use = kindRow(page, 'Gentle Repose', 'use')
  await expect(use.locator('.sheet__spell-notes')).toContainText('Focus Point 6 / 6')
  await use.getByRole('button', { name: 'Use Gentle Repose', exact: true }).click()
  await expect(use.locator('.sheet__spell-notes')).toContainText('Focus Point 4 / 6')
  await expect(kindRow(page, 'See Invisibility', 'use').locator('.sheet__spell-notes')).toContainText('Focus Point 4 / 6')
})

test('TGS2-4a c: Monk 17 Way of the Aether — Etherealness USE 1/LR spends the Sight Beyond Sight tracker; a Long Rest restores it', async ({ page }) => {
  await openSpells(page, monk('tgs2-4a-c', 17))
  const use = kindRow(page, 'Etherealness', 'use')
  await expect(use).toContainText('1/long rest')
  await expect(use.getByRole('group', { name: 'Sight Beyond Sight uses', exact: true })).toHaveCount(1)
  await use.getByRole('button', { name: 'Use Etherealness', exact: true }).click()
  await expect(use.getByRole('button', { name: 'Use Etherealness', exact: true })).toBeDisabled()

  await page.getByRole('tab', { name: 'Actions' }).click()
  const tracker = page.getByRole('tabpanel', { name: 'Actions' }).getByRole('group', { name: 'Sight Beyond Sight uses', exact: true }).first()
  await expect(tracker.getByRole('button')).toHaveCount(1)
  await expect(tracker.locator('.sheet__use-box--used')).toHaveCount(1)

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(tracker.locator('.sheet__use-box--used')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(kindRow(page, 'Etherealness', 'use').getByRole('button', { name: 'Use Etherealness', exact: true })).toBeEnabled()
})

test('TGS2-4a d: Fighter 3 Steel Hawk lists Animal Messenger as a ritual only, with no slot cast, DC 11 CHA from Wisdom', async ({ page }) => {
  await openSpells(page, fighter('tgs2-4a-d'))
  await expect(row(page, 'Animal Messenger')).toHaveCount(1)
  await expect(row(page, 'Animal Messenger')).toContainText('Ritual')
  await expect(kindRow(page, 'Animal Messenger', 'cast')).toHaveCount(0)
  await expect(kindRow(page, 'Animal Messenger', 'use')).toHaveCount(0)
  // D371: cast with the subclass Wisdom — WIS 12 (+1), PB +2.
  await expect(row(page, 'Animal Messenger').locator('.sheet__action-to-hit')).toContainText('DC 11 CHA')
  await expect(row(page, 'Animal Messenger')).not.toContainText(/unresolved/i)
})
