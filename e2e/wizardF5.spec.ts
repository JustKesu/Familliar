import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  createFighter,
  expectStep,
  fillUpToBackground,
  finishFromBackground,
  next,
  nextButton,
  speciesFeatSelect,
  takeStartingEquipment,
  wizardNav,
  type FighterOptions,
} from './wizard.ts'

/* F-5: fixes from the S1 + S2 review, the Magic Initiate list rule and Alert's initiative. */
const STORAGE_KEY = 'familliar:characters'

const humanStep = async (p: Page) => {
  await p.getByRole('checkbox', { name: 'Stealth', exact: true }).check()
  await p.getByRole('radio', { name: 'Medium', exact: true }).check()
}
const human = (name: string, extra: Partial<FighterOptions> = {}): FighterOptions => ({ name, level: 1, species: 'Human|XPHB', onSpeciesStep: humanStep, ...extra })
const SAGE = { radio: 'Sage (XPHB)', plusTwo: 'intelligence', plusOne: 'wisdom' }
const CRIMINAL = { radio: 'Criminal (XPHB)', plusTwo: 'dexterity', plusOne: 'constitution' }

const speciesCard = (page: Page): Locator => page.getByRole('group', { name: 'Species feat: Versatile (Human)' })
const speciesOption = (page: Page, feat: string): Locator => speciesFeatSelect(page).locator('option', { hasText: new RegExp(`^${feat} · `) })
const manageRow = (panel: Locator, name: string): Locator =>
  panel.getByRole('region', { name: 'My Feats' }).locator('.manage-spells__row').filter({ has: panel.page().locator('.manage-spells__name').getByText(name, { exact: true }) })

async function seed(page: Page, character: Record<string, unknown>): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: STORAGE_KEY, value: JSON.stringify([character]) },
  )
}

async function stepTo(page: Page, label: string, button: 'Next' | 'Back' = 'Next'): Promise<void> {
  for (let steps = 0; steps < 8 && !(await page.locator('[aria-current="step"]').textContent())?.includes(label); steps++) {
    await wizardNav(page).getByRole('button', { name: button, exact: true }).click()
  }
  await expectStep(page, label)
}

async function editToStep(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await stepTo(page, label)
}

const BASE = {
  schemaVersion: 56,
  createdAtLevel: 1,
  abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 } },
  languages: [
    { name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
    { name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
    { name: 'Elvish', source: 'XPHB', grantedBy: 'creation' },
  ],
}
const ACOLYTE = { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" }
const wizardSpells = (cantrips: string[]) => [
  { className: 'Wizard', classSource: 'XPHB', spells: [...cantrips, 'Magic Missile', 'Shield', 'Sleep', 'Detect Magic'].map((name) => ({ name, source: 'XPHB' })) },
]

test('F-5 a: a Sage Human — the species Magic Initiate disables the Wizard list the background already uses; Cleric works', async ({ page }) => {
  await fillUpToBackground(page, human('Twice Initiate', { background: SAGE, speciesFeat: 'Magic Initiate' }))
  const wizard = speciesCard(page).getByRole('radio', { name: /^Wizard/ })
  await expect(wizard).toBeDisabled()
  await expect(speciesCard(page).locator('label', { has: page.getByRole('radio', { name: /^Wizard/ }) })).toHaveText('Wizard (already chosen: Background)')
  await speciesCard(page).getByRole('radio', { name: /^Cleric/ }).check()
  await expect(speciesCard(page).getByText('0 of 2 cantrips chosen.')).toBeVisible()
  await expect(speciesCard(page).getByRole('checkbox', { name: /^Sacred Flame/ })).toBeEnabled()
})

test('F-5 b: Edit Character of a Rogue whose stored Expertise is in a skill it is not proficient in — the step says why and blocks Next until fixed', async ({ page }) => {
  // The class Expertise pool is class, background and species skills (D49), so a seeded save is the reachable path.
  await seed(page, {
    ...BASE,
    id: 'f5-rogue',
    name: 'Stale Rogue',
    classes: [{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 1 }],
    masteries: [{ name: 'Dagger' }, { name: 'Shortsword' }],
    species: { name: 'Dwarf', source: 'XPHB' },
    background: ACOLYTE,
    abilityBonus: { wisdom: 2, intelligence: 1 },
    classSkills: ['perception', 'stealth', 'acrobatics', 'deception'],
    expertiseSkills: [{ name: 'arcana' }, { name: 'stealth' }],
  })
  await page.goto('/#/character/f5-rogue')
  await editToStep(page, 'Expertise')
  await expect(page.getByRole('alert')).toHaveText('Not proficient in Arcana any more — uncheck it and choose another skill for Expertise.')
  await expect(nextButton(page)).toBeDisabled()
  // click, not uncheck(): the stale row disappears once unchecked.
  await page.getByRole('checkbox', { name: /^Arcana/ }).click()
  await page.getByRole('checkbox', { name: /^Perception/ }).check()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(nextButton(page)).toBeEnabled()
})

test('F-5 c: a level 2 Human swaps the species feat Alert → Tough after Hit points and is saved at full HP of the new maximum', async ({ page }) => {
  const options = human('Late Tough', { level: 2, speciesFeat: 'Alert', stopAtHitPoints: true })
  await fillUpToBackground(page, options)
  await finishFromBackground(page, options)
  await page.getByRole('button', { name: /Use the average/ }).click()
  await next(page)
  await expectStep(page, 'Starting equipment')

  await stepTo(page, 'Background', 'Back')
  await speciesFeatSelect(page).selectOption('Tough|XPHB')
  await stepTo(page, 'Starting equipment')
  await takeStartingEquipment(page)
  await next(page)
  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: 'Create character' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)

  // CON 13: level 1 is 10 + 1, level 2 averages 6 + 1, Tough adds 2 × 2.
  await expect(page.locator('.sheet__hit-points-value').first()).toContainText(/22\s*\/\s*22/)
})

test('F-5 d: Edit Character of a Human with a manual Alert — Alert is disabled in the species dropdown with the reason', async ({ page }) => {
  await createFighter(page, human('Manual Alert'))
  await page.evaluate((key) => {
    const all = JSON.parse(localStorage.getItem(key) ?? '[]')
    for (const character of all) character.grantedFeats = [...(character.grantedFeats ?? []), { origin: 'manual', id: 'f5d', name: 'Alert', source: 'XPHB' }]
    localStorage.setItem(key, JSON.stringify(all))
  }, STORAGE_KEY)
  await page.reload()
  await editToStep(page, 'Background')
  await expect(speciesOption(page, 'Alert')).toHaveJSProperty('disabled', true)
  await expect(speciesOption(page, 'Alert')).toHaveText('Alert · XPHB (already taken: Added manually)')
  await expect(nextButton(page)).toBeEnabled()
})

test('F-5 e: Alert from the Criminal background adds the Proficiency Bonus to initiative, on its own breakdown line', async ({ page }) => {
  await createFighter(page, { name: 'Alert Criminal', level: 1, species: 'Dwarf|XPHB', background: CRIMINAL })
  // DEX 14 + 2 = 16 (+3), Proficiency Bonus +2.
  await expect(page.getByRole('button', { name: 'Roll initiative' })).toHaveText('+5')
  await page.getByRole('button', { name: 'Initiative breakdown', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Initiative', exact: true })).toContainText('feat (Alert): +2')
})

const HIGH_ELF_WIZARD = {
  ...BASE,
  classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 1 }],
  species: { name: 'Elf; High Elf Lineage', source: 'XPHB' },
  speciesSkills: ['perception'],
  speciesSpellcastingAbility: 'intelligence',
  background: ACOLYTE,
  abilityBonus: { intelligence: 2, wisdom: 1 },
  classSkills: ['arcana', 'history'],
  spellChoices: wizardSpells(['Fire Bolt', 'Mage Hand', 'Light']),
}

test('F-5 f: a stored malformed speciesCantrip is dropped on read — the list loads, the character opens, Spells says the cantrip is not chosen', async ({ page }) => {
  await seed(page, { ...HIGH_ELF_WIZARD, id: 'f5-broken', name: 'Broken Cantrip', speciesCantrip: 'Prestidigitation' })
  await page.goto('/#/')
  await expect(page.locator('.char-grid')).toContainText('Broken Cantrip')
  await page.goto('/#/character/f5-broken')
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Spells' })).toContainText('Cantrip not chosen yet — choose it in Edit Character.')
})

test('F-5 (finding 10): the sheet’s Manage Spells does not offer the species cantrip again', async ({ page }) => {
  await seed(page, { ...HIGH_ELF_WIZARD, id: 'f5-manage-spells', name: 'Prestidigitator', speciesCantrip: { name: 'Prestidigitation', source: 'XPHB' } })
  await page.goto('/#/character/f5-manage-spells')
  await page.getByRole('tab', { name: 'Spells' }).click()
  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  const offered = page
    .getByRole('dialog', { name: 'Manage Spells' })
    .getByRole('region', { name: 'Add Spells' })
    .locator('.manage-spells__row', { has: page.locator('.manage-spells__name', { hasText: /^Prestidigitation$/ }) })
  await expect(offered).toContainText('(already have it from your species cantrip)')
  await expect(offered.locator('.manage-spells__button')).toBeDisabled()
})

test('F-5 (finding 10): the background Magic Initiate does not offer the species cantrip', async ({ page }) => {
  await fillUpToBackground(page, {
    name: 'Sage Elf',
    level: 1,
    species: 'Elf|XPHB',
    speciesCantrip: 'Fire Bolt|XPHB',
    background: SAGE,
    onSpeciesStep: async (p) => {
      await p.getByRole('combobox', { name: 'Elven Lineage', exact: true }).selectOption('High Elf')
      await p.getByRole('checkbox', { name: 'Insight', exact: true }).check()
      await p.getByRole('combobox', { name: 'Spellcasting ability', exact: true }).selectOption('Intelligence')
    },
  })
  const fireBolt = page.getByRole('group', { name: 'Origin feat: Magic Initiate; Wizard' }).getByRole('checkbox', { name: /^Fire Bolt/ })
  await expect(fireBolt).toBeDisabled()
  await expect(page.getByRole('group', { name: 'Origin feat: Magic Initiate; Wizard' })).toContainText('Fire Bolt (already have it from your species cantrip)')
})

test('F-5 (findings 1 + 8): Manage Feats — a manual Magic Initiate cannot reuse the background’s Wizard list and does not offer known spells', async ({ page }) => {
  await seed(page, {
    ...BASE,
    id: 'f5-manage-feats',
    name: 'Khoravar Sage',
    classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 1 }],
    species: { name: 'Khoravar', source: 'EFA' },
    speciesSpellcastingAbility: 'intelligence',
    speciesCantrip: { name: 'Sacred Flame', source: 'XPHB' },
    background: { name: 'Sage', source: 'XPHB', skillProficiencies: ['arcana', 'history'], toolProficiency: "Calligrapher's Supplies" },
    abilityBonus: { intelligence: 2, wisdom: 1 },
    classSkills: ['investigation', 'medicine'],
    spellChoices: wizardSpells(['Fire Bolt', 'Mage Hand', 'Light']),
    grantedFeats: [{ origin: 'manual', name: 'Magic Initiate', source: 'XPHB' }],
  })
  await page.goto('/#/character/f5-manage-feats')
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  const row = manageRow(page.getByRole('dialog', { name: 'Manage Feats' }), 'Magic Initiate')
  await row.getByRole('button', { name: 'Magic Initiate text' }).click()
  const wizard = row.getByRole('radio', { name: /^Wizard/ })
  await expect(wizard).toBeDisabled()
  await expect(row.locator('label', { has: page.getByRole('radio', { name: /^Wizard/ }) })).toHaveText('Wizard (already chosen: Background)')

  await row.getByRole('radio', { name: /^Cleric/ }).check()
  await expect(row.getByRole('checkbox', { name: /^Sacred Flame/ })).toBeDisabled()
  await expect(row).toContainText('Sacred Flame (already have it from your species cantrip)')
  await expect(row.getByRole('checkbox', { name: /^Light/ })).toBeDisabled()
  await expect(row).toContainText('Light (already have it from the Spells step)')
})
