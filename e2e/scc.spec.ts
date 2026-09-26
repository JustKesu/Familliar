import { expect, test, type Page } from '@playwright/test'
import { expectStep, fillUpToBackground, finishFromBackground, next, select, type FighterOptions } from './wizard.ts'

/* D199: SCC (Strixhaven) — spells and items in, feats extracted but hidden, backgrounds and Owlin out. */
const STORAGE_KEY = 'familliar:characters'

async function openSaved(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

const BARD = {
  schemaVersion: 48,
  id: 'd199-bard',
  name: 'Strixhaven Bard',
  classes: [{ className: 'Bard', classSource: 'XPHB', subclass: null, level: 1 }],
  abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 16 } },
  spellChoices: [{ className: 'Bard', classSource: 'XPHB', spells: [{ name: 'Vicious Mockery', source: 'XPHB' }, { name: 'Silvery Barbs', source: 'SCC' }] }],
}

test('D199 a: the Wizard spell step offers Silvery Barbs (SCC) and it can be picked', async ({ page }) => {
  await page.goto('/#/new')
  await page.getByLabel('Character name').fill('Strixhaven Wizard')
  await select(page, 'Class').selectOption('Wizard|XPHB')
  await select(page, 'Level').selectOption('1')
  await page.getByRole('checkbox', { name: 'Arcana', exact: true }).check()
  await page.getByRole('checkbox', { name: 'History', exact: true }).check()
  await next(page)
  await expectStep(page, 'Species')
  await select(page, 'Species').selectOption('Dwarf|XPHB')
  await next(page)
  await expectStep(page, 'Background')
  await page.getByRole('radio', { name: 'Acolyte (XPHB)' }).check()
  await select(page, '+2').selectOption('intelligence')
  await select(page, '+1').selectOption('wisdom')
  await next(page)
  await expectStep(page, 'Languages')
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await next(page)
  await expectStep(page, 'Ability scores')
  for (const [ability, score] of [['Strength', '8'], ['Dexterity', '14'], ['Constitution', '13'], ['Intelligence', '15'], ['Wisdom', '12'], ['Charisma', '10']]) {
    await select(page, ability).selectOption({ label: score })
  }
  await next(page)
  await expectStep(page, 'Spells')
  const barbs = page.getByRole('checkbox', { name: 'Silvery Barbs', exact: true })
  await expect(barbs).toHaveCount(1)
  await barbs.check()
  await expect(barbs).toBeChecked()
})

test('D199 b: a Bard who knows Silvery Barbs (SCC) sees it resolved in 1st Level with CAST and its text', async ({ page }) => {
  await openSaved(page, BARD)
  await page.getByRole('tab', { name: 'Spells' }).click()
  const first = page.getByRole('tabpanel', { name: 'Spells' }).getByRole('region', { name: '1st Level', exact: true })
  const row = first.locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: /^Silvery Barbs$/ }) })
  await expect(row).toHaveCount(1)
  await expect(row.locator('.sheet__spell-unresolved')).toHaveCount(0)
  await expect(row.getByRole('button', { name: 'Cast Silvery Barbs' })).toBeEnabled()
  await row.locator('.sheet__spell-name').click()
  await expect(row.locator('.sheet__spell-row-text')).toContainText('reroll')
})

test('D199 c: an SCC item (Lorehold Primer) is added from the Inventory tab and shows its attunement requirement', async ({ page }) => {
  await openSaved(page, { ...BARD, id: 'd199-inventory' })
  await page.getByRole('tab', { name: 'Inventory' }).click()
  const inventory = page.locator('.sheet__inventory')
  await inventory.getByRole('button', { name: /^Add an item/ }).click()
  await inventory.getByRole('searchbox', { name: 'Search Add an item' }).fill('lorehold')
  await inventory.getByRole('checkbox', { name: 'Lorehold Primer (SCC)', exact: true }).check()
  const row = page.locator('.sheet__inventory-list > li').filter({ has: page.getByRole('spinbutton', { name: 'Quantity of Lorehold Primer', exact: true }) })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Requires attunement by a spellcaster')
})

test('D199 d: no Owlin species, no SCC background, and neither SCC feat at the level 4 feat choice', async ({ page }) => {
  const options: FighterOptions = {
    name: 'D199 Fighter',
    level: 4,
    species: 'Dwarf|XPHB',
    onSpeciesStep: async (p) => {
      await expect(select(p, 'Species').locator('option', { hasText: 'Dwarf' }).first()).toBeAttached()
      await expect(select(p, 'Species').locator('option', { hasText: 'Owlin' })).toHaveCount(0)
    },
    feat: 'Tough',
    onFeatStep: async (p) => {
      const level4 = p.getByRole('group', { name: 'Level 4' })
      await expect(level4.getByRole('radio', { name: 'Tough', exact: true })).toBeChecked()
      await expect(level4.getByRole('radio', { name: /Strixhaven/ })).toHaveCount(0)
    },
  }
  await fillUpToBackground(page, options)
  await expect(page.getByRole('radio', { name: 'Acolyte (XPHB)' })).toBeChecked()
  await expect(page.getByRole('radio', { name: /\(SCC\)|Student/ })).toHaveCount(0)
  await finishFromBackground(page, options)
})
