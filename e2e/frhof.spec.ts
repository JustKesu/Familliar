import { expect, test } from '@playwright/test'
import { expectStep, fillUpToBackground, next, select, type FighterOptions } from './wizard.ts'

/* D201: FRHoF (Heroes of Faerûn) in reduced scope — subclasses, spells, items, Epic Boons and General feats only. */

test('D201 a: Wizard 3 offers Bladesinger (FRHoF) and not Bladesinging (TCE)', async ({ page }) => {
  await page.goto('/#/new')
  await select(page, 'Class').selectOption('Wizard|XPHB')
  await select(page, 'Level').selectOption('3')
  await expect(page.getByRole('radio', { name: 'Bladesinger', exact: true })).toHaveCount(1)
  await expect(page.getByRole('radio', { name: 'Bladesinging', exact: true })).toHaveCount(0)
})

test('D201 b: the Wizard spell step offers Wardaway (FRHoF) and it can be picked', async ({ page }) => {
  await page.goto('/#/new')
  await page.getByLabel('Character name').fill('Faerunian Wizard')
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
  const wardaway = page.getByRole('button', { name: 'Prepare Wardaway', exact: true })
  await expect(wardaway).toHaveCount(1)
  await wardaway.click()
  await expect(page.getByRole('button', { name: 'Unprepare Wardaway', exact: true }).first()).toBeVisible()
})

test('D201 c: a level 19 character is offered FRHoF Epic Boons, no FRHoF Origin feat and no faction General feat in any feat group', async ({ page }) => {
  const options: FighterOptions = { name: 'D201 Fighter', level: 19, species: 'Dwarf|XPHB' }
  await fillUpToBackground(page, options)
  await next(page)
  await expectStep(page, 'Languages')
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await next(page)
  await expectStep(page, 'Ability scores')
  for (const [ability, score] of [['Strength', '15'], ['Dexterity', '14'], ['Constitution', '13'], ['Intelligence', '12'], ['Wisdom', '10'], ['Charisma', '8']]) {
    await select(page, ability).selectOption({ label: score })
  }
  await next(page)
  await expectStep(page, 'ASI / Feat')

  // Fighter ASI levels; taken in order because a later grant only registers once the earlier ones are set.
  for (const level of [4, 6, 8, 12, 14, 16, 19]) {
    const group = page.getByRole('group', { name: new RegExp(`^Level ${level}\\b`) })
    await group.getByRole('radio', { name: 'Feat', exact: true }).check()
    // FRHoF O feats, and the General feats that need one (D201).
    for (const name of ['Harper Agent', 'Zhentarim Ruffian', 'Spellfire Spark', 'Harper Teamwork', 'Zhentarim Tactics', 'Dragonscarred', 'Enclave Magic', 'Spellfire Adept', 'Cold Caster']) {
      await expect(group.getByRole('radio', { name, exact: true })).toHaveCount(0)
    }
  }
  await expect(page.getByRole('group', { name: /^Level 19\b/ }).getByRole('radio', { name: 'Boon of Bloodshed', exact: true })).toHaveCount(1)
  await expect(page.getByRole('group', { name: /^Level 4\b/ }).getByRole('radio', { name: 'Fairy Trickster', exact: true })).toHaveCount(1)
})

test('D201 d: no FRHoF background and no FRHoF language is offered', async ({ page }) => {
  await fillUpToBackground(page, { name: 'D201 Fighter', level: 1, species: 'Dwarf|XPHB' })
  await expect(page.getByRole('radio', { name: 'Acolyte (XPHB)' })).toBeChecked()
  await expect(page.getByRole('radio', { name: /\(FRHoF\)/ })).toHaveCount(0)
  await next(page)
  await expectStep(page, 'Languages')
  await expect(page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' })).toHaveCount(1)
  await expect(page.getByRole('checkbox', { name: /\(FRHoF\)/ })).toHaveCount(0)
})
