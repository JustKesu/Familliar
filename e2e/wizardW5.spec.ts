import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  chooseLevelAsi,
  chooseLevelFeat,
  createFighter,
  expectStep,
  featOption,
  fillUpToBackground,
  levelCard,
  levelCardHeader,
  next,
  nextButton,
  select,
  stepBar,
  takeFighterLevel4Mastery,
  type FighterOptions,
} from './wizard.ts'

/* W-5: ASI / Feat step — ability table on top (W12), collapsible level cards (W16/W17), unavailable feats (W18). Acolyte gives +2 Wisdom, +1 Intelligence. */

const STANDARD = [['Strength', '15'], ['Dexterity', '14'], ['Constitution', '13'], ['Intelligence', '12'], ['Wisdom', '10'], ['Charisma', '8']]

async function reachAsi(page: Page, level: number, scores = STANDARD, background?: FighterOptions['background']): Promise<void> {
  await fillUpToBackground(page, { name: 'Wren', level, species: 'Dwarf|XPHB', ...(background ? { background } : {}) })
  await next(page)
  await expectStep(page, 'Proficiencies')
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await next(page)
  await expectStep(page, 'Ability scores')
  for (const [ability, score] of scores) await select(page, ability!).selectOption({ label: score! })
  await next(page)
  await expectStep(page, 'ASI / Feat')
}

function tableRow(page: Page, name: string): Locator {
  return page.locator('.ability-table tr', { has: page.getByRole('rowheader', { name, exact: true }) }).getByRole('cell')
}

const cards = (page: Page): Locator => page.getByRole('group', { name: /^Level \d+$/ })

async function reenterAsi(page: Page): Promise<void> {
  await stepBar(page).getByRole('button', { name: /Ability scores/ }).click()
  await expectStep(page, 'Ability scores')
  await next(page)
  await expectStep(page, 'ASI / Feat')
}

test('W-5 a: Fighter 4 — table on top, one open card; an ASI +2 STR shows in the table and unlocks Next', async ({ page }) => {
  await reachAsi(page, 4)
  await expect(tableRow(page, 'Base')).toHaveText(['15', '14', '13', '12', '10', '8'])
  await expect(tableRow(page, 'ASI / Feats')).toHaveText(['—', '—', '—', '—', '—', '—'])
  await expect(cards(page)).toHaveCount(1)
  await expect(levelCardHeader(page, 4)).toHaveText('▾Level 4 — Choose a feat or ASI')
  await expect(levelCardHeader(page, 4)).toHaveAttribute('aria-expanded', 'true')
  await expect(nextButton(page)).toBeDisabled()

  await chooseLevelAsi(page, 4, 'strength')
  await expect(tableRow(page, 'ASI / Feats')).toHaveText(['+2', '—', '—', '—', '—', '—'])
  await expect(tableRow(page, 'Total')).toHaveText(['17', '14', '13', '13', '12', '8'])
  await expect(tableRow(page, 'Modifier')).toHaveText(['+3', '+2', '+1', '+1', '+1', '−1'])
  await expect(levelCardHeader(page, 4)).toContainText('Level 4 — Ability Score Improvement (+2 STR)')
  await expect(nextButton(page)).toBeEnabled()
})

test('W-5 b: a half-feat asks for its ability until chosen; back on the step its card is collapsed with the summary', async ({ page }) => {
  await reachAsi(page, 4)
  await chooseLevelFeat(page, 4, 'Athlete')
  const missing = levelCard(page, 4).getByText('Choose an ability.', { exact: true })
  await expect(missing).toBeVisible()
  await expect(nextButton(page)).toBeDisabled()

  await levelCard(page, 4).getByRole('combobox', { name: 'Level 4 ability', exact: true }).selectOption('dexterity')
  await expect(missing).toHaveCount(0)
  await expect(tableRow(page, 'ASI / Feats')).toHaveText(['—', '+1', '—', '—', '—', '—'])
  await expect(nextButton(page)).toBeEnabled()

  await next(page)
  await expectStep(page, 'Hit points')
  await stepBar(page).getByRole('button', { name: /ASI \/ Feat/ }).click()
  await expectStep(page, 'ASI / Feat')
  await expect(levelCardHeader(page, 4)).toContainText('Level 4 — Athlete (+1 DEX)')
  await expect(levelCardHeader(page, 4)).toHaveAttribute('aria-expanded', 'false')
  await expect(levelCard(page, 4).getByRole('combobox')).toHaveCount(0)
})

test('W-5 c: with Strength 8, a Strength 13 feat is listed but disabled with the reason', async ({ page }) => {
  await reachAsi(page, 4, [['Strength', '8'], ['Dexterity', '14'], ['Constitution', '13'], ['Intelligence', '12'], ['Wisdom', '10'], ['Charisma', '15']])
  const gwm = featOption(page, 4, 'Great Weapon Master')
  // Tried again in F-2a: toBeDisabled() reads an <option> inside an <optgroup> as enabled; the DOM property is what the browser honours.
  await expect(gwm).toHaveJSProperty('disabled', true)
  await expect(gwm).toContainText('needs STR 13')
  await expect(featOption(page, 4, 'Athlete')).toHaveJSProperty('disabled', false)
})

test("W-5 d: the background's non-repeatable origin feat is disabled as already taken", async ({ page }) => {
  // Farmer grants Tough.
  await reachAsi(page, 4, STANDARD, { radio: 'Farmer (XPHB)', plusTwo: 'strength', plusOne: 'constitution' })
  const tough = featOption(page, 4, 'Tough')
  await expect(tough).toHaveJSProperty('disabled', true)
  await expect(tough).toHaveText('Tough · XPHB (already taken)')
})

test('W-5 e: Fighter 6 — Next waits for both cards; re-entering shows the complete card collapsed and the incomplete one open', async ({ page }) => {
  await reachAsi(page, 6)
  await expect(cards(page)).toHaveCount(2)
  await chooseLevelAsi(page, 4, 'strength')
  await expect(nextButton(page)).toBeDisabled()
  await chooseLevelFeat(page, 6, 'Athlete')
  await expect(nextButton(page)).toBeDisabled()

  await reenterAsi(page)
  await expect(levelCardHeader(page, 4)).toContainText('Level 4 — Ability Score Improvement (+2 STR)')
  await expect(levelCardHeader(page, 4)).toHaveAttribute('aria-expanded', 'false')
  await expect(levelCardHeader(page, 6)).toContainText('Level 6 — Athlete')
  await expect(levelCardHeader(page, 6)).toHaveAttribute('aria-expanded', 'true')
  await expect(nextButton(page)).toBeDisabled()

  await levelCard(page, 6).getByRole('combobox', { name: 'Level 6 ability', exact: true }).selectOption('strength')
  await expect(nextButton(page)).toBeEnabled()
})

test('W-5 f: Skilled shows "Choose …" until all three picks are made', async ({ page }) => {
  await reachAsi(page, 4)
  await chooseLevelFeat(page, 4, 'Skilled')
  const missing = levelCard(page, 4).getByText('Choose skills or tools.', { exact: true })
  await expect(missing).toBeVisible()
  for (const [slot, skill] of [['1', 'arcana'], ['2', 'history']]) {
    await page.getByLabel(`Skilled skill or tool ${slot}`, { exact: true }).selectOption(`skill:${skill}`)
  }
  await expect(missing).toBeVisible()
  await page.getByLabel('Skilled skill or tool 3', { exact: true }).selectOption('skill:nature')
  await expect(missing).toHaveCount(0)
})

test('W-5 g: Edit Character on a Fighter 4 with a feat — the card is collapsed with its summary and the table has the bonus', async ({ page }) => {
  await createFighter(page, {
    name: 'Edda',
    level: 4,
    species: 'Dwarf|XPHB',
    feat: 'Athlete',
    onFeatStep: async (p) => {
      await levelCard(p, 4).getByRole('combobox', { name: 'Level 4 ability', exact: true }).selectOption('dexterity')
    },
  })
  await page.getByRole('button', { name: 'Edit character' }).click()
  await stepBar(page).getByRole('button', { name: /ASI \/ Feat/ }).click()
  await expectStep(page, 'ASI / Feat')
  await expect(levelCardHeader(page, 4)).toContainText('Level 4 — Athlete (+1 DEX)')
  await expect(levelCardHeader(page, 4)).toHaveAttribute('aria-expanded', 'false')
  await expect(tableRow(page, 'ASI / Feats')).toHaveText(['—', '+1', '—', '—', '—', '—'])
  await expect(tableRow(page, 'Total')).toHaveText(['15', '15', '13', '13', '12', '8'])
})

test('W-5 h: Level up Fighter 3 → 4 — one open card for level 4 that works like a new character', async ({ page }) => {
  await createFighter(page, { name: 'Leveller', level: 3, species: 'Dwarf|XPHB' })
  await page.getByRole('button', { name: 'Level up to 4' }).click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).locator('.level-up-class__option').click()
  await takeFighterLevel4Mastery(page)
  for (let steps = 0; steps < 8 && !(await levelCard(page, 4).isVisible()); steps++) await next(page)
  await expect(cards(page)).toHaveCount(1)
  await expect(levelCardHeader(page, 4)).toHaveAttribute('aria-expanded', 'true')
  await expect(nextButton(page)).toBeDisabled()

  await chooseLevelAsi(page, 4, 'strength')
  await expect(tableRow(page, 'ASI / Feats')).toHaveText(['+2', '—', '—', '—', '—', '—'])
  await expect(tableRow(page, 'Total')).toHaveText(['17', '14', '13', '13', '12', '8'])
  await expect(nextButton(page)).toBeEnabled()
})
