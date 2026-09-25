import { expect, test, type Page } from '@playwright/test'
import { createFighter, expectStep, fillUpToBackground, finishFromBackground, next, select } from './wizard.ts'

const PENDING = /Choices not made yet: .+ — make them in Edit Character\./

async function openFeats(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
}

test('A3a+b: origin feat choices can wait; the sheet names them as not made yet', async ({ page }) => {
  const options = { name: 'Skilled Acolyte', level: 4, species: 'Dwarf|XPHB', feat: 'Skilled' }
  await fillUpToBackground(page, options)

  const originFeat = page.getByRole('group', { name: 'Origin feat: Magic Initiate; Cleric' })
  await expect(originFeat).toBeVisible()
  await expect(originFeat.getByText('You can make this choice later in Edit Character.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled()

  await finishFromBackground(page, options)

  await openFeats(page)
  // R6 (D184): the pending line sits under the feat's row, shown while the row is collapsed.
  const feats = page.getByRole('region', { name: 'Feats', exact: true })
  await expect(feats.locator('.sheet__group-row', { hasText: 'Skilled' }).locator('.sheet__group-row-source')).toHaveText('From Fighter 4')
  await expect(feats.locator('.sheet__group-row', { hasText: 'Magic Initiate; Cleric' }).locator('.sheet__group-row-source')).toHaveText('From Background')
  await expect(feats.getByText(PENDING)).toHaveCount(2)
})

test('A3c: a Prodigy language shows on the Proficiencies card with its feat as source', async ({ page }) => {
  await createFighter(page, {
    name: 'Prodigy Human',
    level: 4,
    // Prodigy requires a human, half-elf or half-orc; Human (XPHB) also asks for a skill and a size.
    species: 'Human|XPHB',
    onSpeciesStep: async (p) => {
      await p.getByRole('checkbox', { name: 'Stealth', exact: true }).check()
      await p.getByRole('radio', { name: 'Medium', exact: true }).check()
    },
    feat: 'Prodigy',
    onFeatStep: async (p) => {
      await p.getByLabel('Prodigy language', { exact: true }).selectOption({ label: 'Giant' })
    },
  })

  const card = page.locator('section', { has: page.getByRole('heading', { name: 'Proficiencies' }) })
  await expect(card.getByRole('listitem').filter({ hasText: 'LANGUAGES' })).toContainText('Giant')
  await page.getByRole('button', { name: 'Proficiencies details' }).click()
  await expect(page.getByRole('dialog', { name: 'Proficiencies' }).getByText('Giant — Prodigy (feat)')).toBeVisible()
})

test('A3d: completing the open choices in Edit Character clears the pending line', async ({ page }) => {
  await createFighter(page, { name: 'Finisher', level: 4, species: 'Dwarf|XPHB', feat: 'Skilled' })
  await openFeats(page)
  await expect(page.getByText(PENDING)).toHaveCount(2)

  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await next(page)
  await next(page)

  await expectStep(page, 'Background')
  const originFeat = page.getByRole('group', { name: 'Origin feat: Magic Initiate; Cleric' })
  await originFeat.getByRole('checkbox', { name: 'Guidance', exact: true }).first().check()
  await originFeat.getByRole('checkbox', { name: 'Light', exact: true }).first().check()
  await originFeat.getByRole('checkbox', { name: 'Bless', exact: true }).first().check()
  await select(originFeat, 'Ability').selectOption('wisdom')

  while (!(await page.getByRole('group', { name: 'Level 4' }).isVisible())) await next(page)
  await expectStep(page, 'Ability Score Improvement / Feat')
  for (const [slot, skill] of [['1', 'arcana'], ['2', 'history'], ['3', 'nature']]) {
    await page.getByLabel(`Skilled skill or tool ${slot}`, { exact: true }).selectOption(`skill:${skill}`)
  }

  while (!(await page.getByRole('button', { name: 'Save changes' }).isVisible())) await next(page)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)

  await openFeats(page)
  const feats = page.getByRole('region', { name: 'Feats', exact: true })
  await expect(feats.getByRole('button', { name: 'Skilled', exact: true })).toBeVisible()
  // The stored picks now show under the feat instead.
  await expect(feats.getByText('Skills: Arcana, History, Nature')).toBeVisible()
  await expect(page.getByText(/Choices not made yet/)).toHaveCount(0)
})
