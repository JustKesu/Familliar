import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  createFighter,
  expectStep,
  featOption,
  fillUpToBackground,
  finishFromBackground,
  levelCard,
  next,
  nextButton,
  select,
  speciesFeatSelect,
  takeFighterLevel4Mastery,
  wizardNav,
  type FighterOptions,
} from './wizard.ts'

/* S1 (D271–D276): Human's Versatile origin feat, chosen on the Background step. */
const STORAGE_KEY = 'familliar:characters'
const humanStep = async (p: Page) => {
  await p.getByRole('checkbox', { name: 'Stealth', exact: true }).check()
  await p.getByRole('radio', { name: 'Medium', exact: true }).check()
}
const human = (name: string, extra: Partial<FighterOptions> = {}): FighterOptions => ({ name, level: 1, species: 'Human|XPHB', onSpeciesStep: humanStep, ...extra })
const FARMER = { radio: 'Farmer (XPHB)', plusTwo: 'constitution', plusOne: 'strength' }
const CHARLATAN = { radio: 'Charlatan (XPHB)', plusTwo: 'dexterity', plusOne: 'constitution' }
const CRIMINAL = { radio: 'Criminal (XPHB)', plusTwo: 'dexterity', plusOne: 'constitution' }

const speciesCard = (page: Page): Locator => page.getByRole('group', { name: 'Species feat: Versatile (Human)' })
const speciesOption = (page: Page, feat: string): Locator => speciesFeatSelect(page).locator('option', { hasText: new RegExp(`^${feat} · `) })
const features = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Features & Traits' })
const featRow = (page: Page, name: string): Locator =>
  features(page).getByRole('region', { name: 'Feats', exact: true }).locator('.sheet__group-row', { hasText: name })
const manageRow = (panel: Locator, name: string): Locator =>
  panel.getByRole('region', { name: 'My Feats' }).locator('.manage-spells__row').filter({ has: panel.page().locator('.manage-spells__name').getByText(name, { exact: true }) })

async function maxHp(page: Page): Promise<number> {
  const match = /\/\s*(\d+)/.exec(await page.locator('.sheet__hit-points-value').first().innerText())
  return match ? Number(match[1]) : NaN
}

async function openFeatures(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
}

async function openManageFeats(page: Page): Promise<Locator> {
  await openFeatures(page)
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Feats' })
}

async function editToBackground(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await next(page)
  await expectStep(page, 'Species')
  await next(page)
  await expectStep(page, 'Background')
}

async function saveEdit(page: Page): Promise<void> {
  const save = wizardNav(page).getByRole('button', { name: 'Save changes' })
  for (let steps = 0; steps < 10 && !(await save.isVisible()); steps++) await next(page)
  await save.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
}

const storedSpeciesFeats = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]').flatMap((c: { grantedFeats?: { origin: string }[] }) => (c.grantedFeats ?? []).filter((f) => f.origin === 'species')), STORAGE_KEY)

test('S1 a: a Human Fighter cannot leave Background until the species feat is chosen; Alert reaches initiative, Features & Traits and Manage Feats', async ({ page }) => {
  const options = human('Alert Human', { speciesFeat: null })
  await fillUpToBackground(page, options)
  await expect(speciesCard(page)).toBeVisible()
  await expect(nextButton(page)).toBeDisabled()
  await speciesFeatSelect(page).selectOption('Alert|XPHB')
  await expect(nextButton(page)).toBeEnabled()
  await finishFromBackground(page, options)

  // Alert's initiative proficiency is a D55 note only, as for every Alert (featEffects.ts PROSE_FEAT_EFFECT_TARGETS).
  await page.getByRole('button', { name: 'Initiative breakdown', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Initiative', exact: true })).toContainText('feat (Alert)')
  await page.keyboard.press('Escape')
  await openFeatures(page)
  await expect(featRow(page, 'Alert').locator('.sheet__group-row-source')).toHaveText('From Species')
  const panel = await openManageFeats(page)
  await expect(manageRow(panel, 'Alert')).toContainText('From Species')
})

test('S1 b: a non-repeatable background feat is disabled in the species dropdown; a repeatable Skilled stays allowed', async ({ page }) => {
  await fillUpToBackground(page, human('Farmer Human', { speciesFeat: null, background: FARMER }))
  await expect(speciesOption(page, 'Tough')).toHaveJSProperty('disabled', true)
  await expect(speciesOption(page, 'Tough')).toHaveText('Tough · XPHB (already taken: Background)')
  await expect(speciesOption(page, 'Alert')).toHaveJSProperty('disabled', false)

  await page.getByRole('radio', { name: CHARLATAN.radio }).check()
  await expect(page.getByRole('group', { name: 'Origin feat: Skilled' })).toBeVisible()
  await expect(speciesOption(page, 'Skilled')).toHaveJSProperty('disabled', false)
  await speciesFeatSelect(page).selectOption('Skilled|XPHB')
  await select(page, '+2').selectOption(CHARLATAN.plusTwo)
  await select(page, '+1').selectOption(CHARLATAN.plusOne)
  await expect(nextButton(page)).toBeEnabled()
})

test('S1 c: switching to a background that grants the chosen feat shows the reason and blocks Next', async ({ page }) => {
  await fillUpToBackground(page, human('Clash Human', { speciesFeat: 'Alert' }))
  await expect(nextButton(page)).toBeEnabled()

  await page.getByRole('radio', { name: CRIMINAL.radio }).check()
  await select(page, '+2').selectOption(CRIMINAL.plusTwo)
  await select(page, '+1').selectOption(CRIMINAL.plusOne)
  await expect(speciesCard(page)).toContainText('Alert is already taken (Background) — choose another feat.')
  await expect(nextButton(page)).toBeDisabled()

  await speciesFeatSelect(page).selectOption('Tough|XPHB')
  await expect(speciesCard(page)).not.toContainText('Alert is already taken')
  await expect(nextButton(page)).toBeEnabled()
})

test('S1 d: changing Human to Dwarf drops the species feat from the saved character', async ({ page }) => {
  const options = human('Turncoat', { speciesFeat: 'Alert' })
  await fillUpToBackground(page, options)
  await wizardNav(page).getByRole('button', { name: 'Back', exact: true }).click()
  await expectStep(page, 'Species')
  await select(page, 'Species').selectOption('Dwarf|XPHB')
  await next(page)
  await expectStep(page, 'Background')
  await expect(speciesCard(page)).toHaveCount(0)
  await finishFromBackground(page, { ...options, species: 'Dwarf|XPHB' })

  expect(await storedSpeciesFeats(page)).toEqual([])
  await openFeatures(page)
  await expect(featRow(page, 'Alert')).toHaveCount(0)
})

test('S1 e: Edit Character keeps the species feat and its sub-choices, and changing it is saved', async ({ page }) => {
  await createFighter(
    page,
    human('Skilled Human', {
      speciesFeat: 'Skilled',
      onBackgroundStep: async (p) => {
        for (const [slot, skill] of [['1', 'arcana'], ['2', 'history'], ['3', 'nature']]) {
          await speciesCard(p).getByLabel(`Skilled skill or tool ${slot}`, { exact: true }).selectOption(`skill:${skill}`)
        }
      },
    }),
  )
  expect(await storedSpeciesFeats(page)).toEqual([expect.objectContaining({ origin: 'species', name: 'Skilled', proficiencies: expect.objectContaining({ skills: ['arcana', 'history', 'nature'] }) })])

  let before = NaN
  await expect.poll(async () => (before = await maxHp(page))).toBeGreaterThan(0)

  await editToBackground(page)
  await expect(speciesFeatSelect(page)).toHaveValue('Skilled|XPHB')
  await expect(speciesCard(page).getByLabel('Skilled skill or tool 2', { exact: true })).toHaveValue('skill:history')
  await speciesFeatSelect(page).selectOption('Tough|XPHB')
  await saveEdit(page)

  expect(await storedSpeciesFeats(page)).toEqual([{ origin: 'species', name: 'Tough', source: 'XPHB' }])
  // Tough at character level 1: +2 max HP.
  await expect.poll(() => maxHp(page)).toBe(before + 2)
})

test('S1 f: an older Human without the species feat shows the not-chosen line, and Edit Character blocks Background until it is chosen', async ({ page }) => {
  await createFighter(page, human('Old Human'))
  await page.evaluate((key) => {
    const all = JSON.parse(localStorage.getItem(key) ?? '[]')
    for (const character of all) {
      const kept = (character.grantedFeats ?? []).filter((feat: { origin: string }) => feat.origin !== 'species')
      if (kept.length > 0) character.grantedFeats = kept
      else delete character.grantedFeats
    }
    localStorage.setItem(key, JSON.stringify(all))
  }, STORAGE_KEY)
  await page.reload()

  await openFeatures(page)
  const versatile = features(page).getByRole('region', { name: 'Species Traits', exact: true }).locator('.sheet__group-row', { hasText: 'Versatile' })
  await expect(versatile).toContainText('Origin feat not chosen yet — choose it in Edit Character.')

  await editToBackground(page)
  await expect(nextButton(page)).toBeDisabled()
  await speciesFeatSelect(page).selectOption('Healer|XPHB')
  await expect(nextButton(page)).toBeEnabled()
  await saveEdit(page)
  await openFeatures(page)
  await expect(features(page).getByText('Origin feat not chosen yet')).toHaveCount(0)
})

test('S1 g: the species feat is taken at an ASI level — disabled on level up, flagged "(Species)" when the edit makes them clash', async ({ page }) => {
  await createFighter(page, human('Level Human', { level: 3, speciesFeat: 'Alert' }))
  await page.getByRole('button', { name: 'Level up to 4' }).click()
  await takeFighterLevel4Mastery(page)
  for (let steps = 0; steps < 8 && !(await levelCard(page, 4).isVisible()); steps++) await next(page)
  await expect(featOption(page, 4, 'Alert')).toHaveJSProperty('disabled', true)
  await expect(featOption(page, 4, 'Alert')).toHaveText('Alert · XPHB (already taken)')

  await createFighter(page, human('Clash Level', { level: 4, speciesFeat: 'Alert', feat: 'Tough' }))
  await editToBackground(page)
  await speciesFeatSelect(page).selectOption('Tough|XPHB')
  for (let steps = 0; steps < 8 && !(await levelCard(page, 4).isVisible()); steps++) await next(page)
  await expect(levelCard(page, 4)).toContainText('Tough is already taken (Species) — choose another feat.')
  await expect(nextButton(page)).toBeDisabled()
})

test('S1 h: Manage Feats edits the sub-choices of Skilled taken as the species feat', async ({ page }) => {
  await createFighter(page, human('Manage Human', { speciesFeat: 'Skilled' }))
  const panel = await openManageFeats(page)
  const skilled = manageRow(panel, 'Skilled')
  await expect(skilled).toContainText('From Species')
  await skilled.getByRole('button', { name: 'Skilled text' }).click()
  for (const [slot, skill] of [['1', 'arcana'], ['2', 'history'], ['3', 'nature']]) {
    await skilled.getByLabel(`Skilled skill or tool ${slot}`, { exact: true }).selectOption(`skill:${skill}`)
  }
  await expect.poll(() => page.locator('.sheet__skills .sheet__row', { hasText: 'Arcana' }).locator('.sheet__prof-mark').getAttribute('data-status')).toBe('proficient')

  await page.reload()
  expect(await storedSpeciesFeats(page)).toEqual([expect.objectContaining({ origin: 'species', name: 'Skilled', proficiencies: expect.objectContaining({ skills: ['arcana', 'history', 'nature'] }) })])
})

test('S1 i: the species dropdown offers Origin feats only — none of the Dark Gifts', async ({ page }) => {
  await fillUpToBackground(page, human('Gift Human', { speciesFeat: null }))
  await page.getByRole('radio', { name: 'A Dark Gift feat instead' }).check()
  const darkGifts = (await page.getByRole('list', { name: 'Dark Gift feats' }).getByRole('listitem').allInnerTexts()).map((text) => text.split(' — ')[0].trim())
  expect(darkGifts.length).toBeGreaterThan(0)
  const offered = (await speciesFeatSelect(page).locator('option:not([value=""])').allInnerTexts()).map((text) => text.split(' · ')[0])
  expect(offered).toContain('Alert')
  for (const gift of darkGifts) expect(offered).not.toContain(gift)
})
