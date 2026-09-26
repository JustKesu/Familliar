import { expect, test, type Locator, type Page } from '@playwright/test'
import { createFighter } from './wizard.ts'

/* D200: Strixhaven Initiate — college, cantrip pair, ability and the L1 spell, all fed into the existing feat-spell path. */
const STORAGE_KEY = 'familliar:characters'

async function openSaved(page: Page, character: { id: string; [key: string]: unknown }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

function spellRow(page: Page, name: string): Locator {
  return page.getByRole('tabpanel', { name: 'Spells' }).locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }) })
}

async function expectInitiateSpells(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Spells' }).click()
  for (const name of ['Druidcraft', 'Mage Hand', 'Entangle']) {
    const row = spellRow(page, name)
    await expect(row).toHaveCount(1)
    await expect(row.locator('.sheet__spell-unresolved')).toHaveCount(0)
    await expect(row).toContainText('Strixhaven Initiate')
  }
}

test('D200 a: taking Strixhaven Initiate at level 4 — college, cantrip pair, ability and L1 spell resolve on the sheet and survive a reload', async ({ page }) => {
  await createFighter(page, {
    name: 'D200 Fighter',
    level: 4,
    species: 'Dwarf|XPHB',
    feat: 'Strixhaven Initiate',
    onFeatStep: async (p) => {
      const level4 = p.getByRole('group', { name: 'Level 4' })
      await expect(level4.getByRole('radio', { name: /Prismari|Quandrix/ })).toHaveCount(2)
      await level4.getByRole('radio', { name: 'Quandrix' }).check()
      await expect(level4.getByRole('radio', { name: /^(Druidcraft|Guidance|Mage Hand) \+/ })).toHaveCount(3)
      await level4.getByRole('radio', { name: 'Druidcraft + Mage Hand' }).check()
      await level4.getByLabel('Spellcasting ability').selectOption('wisdom')
      await level4.getByRole('checkbox', { name: 'Entangle', exact: true }).check()
      // The Quandrix list is druid/wizard: a bard-only 1st-level spell is not offered.
      await expect(level4.getByRole('checkbox', { name: 'Dissonant Whispers', exact: true })).toHaveCount(0)
    },
  })
  await expectInitiateSpells(page)
  await page.reload()
  await expectInitiateSpells(page)
})

const INITIATE = {
  schemaVersion: 48,
  id: 'd200-initiate',
  name: 'Quandrix Fighter',
  classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
  abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
  featAsiChoices: [
    {
      level: 4,
      kind: 'feat',
      name: 'Strixhaven Initiate',
      source: 'SCC',
      chosenAbility: 'wisdom',
      blockName: 'Quandrix 2',
      filterChoiceSpells: { cantrips: [], spells: [{ name: 'Entangle', source: 'XPHB' }] },
    },
  ],
}

test('D200 b: a saved Strixhaven Initiate with a chosen block reloads with the same cantrips and spell', async ({ page }) => {
  await openSaved(page, INITIATE)
  await expectInitiateSpells(page)
  await expect(spellRow(page, 'Guidance')).toHaveCount(0)
})

test('D200 d: a Strixhaven Initiate with no college yet is a normal pending feat, granting no spells (D57)', async ({ page }) => {
  const { blockName: _block, filterChoiceSpells: _spells, chosenAbility: _ability, ...bare } = INITIATE.featAsiChoices[0]
  await openSaved(page, { ...INITIATE, id: 'd200-pending', featAsiChoices: [bare] })
  await expect(page.getByRole('heading', { name: 'Quandrix Fighter' })).toBeVisible()
  await page.getByRole('tab', { name: 'Features' }).click()
  await expect(page.getByText(/college/i).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(spellRow(page, 'Druidcraft')).toHaveCount(0)
})
