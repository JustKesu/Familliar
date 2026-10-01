import { expect, test, type Page } from '@playwright/test'
import {
  chooseLevelAsi,
  chooseLevelFeat,
  createFighter,
  expectStep,
  featOption,
  fillUpToBackground,
  finishFromBackground,
  levelCard,
  levelCardHeader,
  next,
  nextButton,
  select,
  stepBar,
  wizardNav,
  type FighterOptions,
} from './wizard.ts'

/* F-2a: feat prerequisites from lower levels (D253), invalid chosen feats (D254), one feat per name (D255), pruning on a lowered level (D256). */

const STORAGE_KEY = 'familliar:characters'
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

/** Rewrites the one stored character, then reloads the sheet — for states the wizard itself no longer lets a player build. */
async function patchStored(page: Page, patch: { strength?: number; featAsiLevel?: { level: number; name: string }; farmer?: boolean }): Promise<void> {
  await page.evaluate(
    ({ key, patch }) => {
      const [character] = JSON.parse(localStorage.getItem(key)!)
      if (patch.strength !== undefined) character.abilityScores.scores.strength = patch.strength
      if (patch.featAsiLevel) {
        character.featAsiChoices = character.featAsiChoices.map((choice: { level: number }) =>
          choice.level === patch.featAsiLevel!.level ? { level: choice.level, kind: 'feat', name: patch.featAsiLevel!.name, source: 'XPHB' } : choice,
        )
      }
      if (patch.farmer) character.background = { name: 'Farmer', source: 'XPHB', skillProficiencies: ['animal handling', 'nature'], toolProficiency: "Carpenter's Tools" }
      localStorage.setItem(key, JSON.stringify([character]))
    },
    { key: STORAGE_KEY, patch },
  )
  await page.reload()
}

async function storedFeatAsiLevels(page: Page): Promise<number[]> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!)[0].featAsiChoices.map((choice: { level: number }) => choice.level), STORAGE_KEY)
}

async function levelUpToAsi(page: Page, level: number): Promise<void> {
  await page.getByRole('button', { name: `Level up to ${level}` }).click()
  for (let steps = 0; steps < 8 && !(await levelCard(page, level).isVisible()); steps++) await next(page)
  await expect(levelCard(page, level)).toBeVisible()
}

test('F-2a 1 (D254): Tough on L4, then a background that grants Tough — the card says so and Next waits for another feat', async ({ page }) => {
  await reachAsi(page, 4)
  await chooseLevelFeat(page, 4, 'Tough')
  await expect(nextButton(page)).toBeEnabled()

  await stepBar(page).getByRole('button', { name: /Background/ }).click()
  await expectStep(page, 'Background')
  // A step with its choice made collapses the list into one summary button.
  await page.getByRole('button', { name: /^Background Background chosen/ }).click()
  await page.getByRole('radio', { name: 'Farmer (XPHB)' }).check()
  await select(page, '+2').selectOption('strength')
  await select(page, '+1').selectOption('constitution')
  await stepBar(page).getByRole('button', { name: /ASI \/ Feat/ }).click()
  await expectStep(page, 'ASI / Feat')

  await expect(levelCardHeader(page, 4)).toHaveAttribute('aria-expanded', 'true')
  await expect(levelCard(page, 4).getByText('Tough is already taken (Background) — choose another feat.', { exact: true })).toBeVisible()
  await expect(nextButton(page)).toBeDisabled()

  await chooseLevelFeat(page, 4, 'Alert')
  await expect(levelCard(page, 4).getByText(/is already taken/)).toHaveCount(0)
  await expect(nextButton(page)).toBeEnabled()
})

test('F-2a 2 (D253): a saved Fighter 7 with STR 11 + ASI +2 STR on L4 can take Great Weapon Master at level 8', async ({ page }) => {
  // createFighter fills L4 with +2 STR and L6 with +2 DEX; Acolyte adds no Strength.
  await createFighter(page, { name: 'Strong Later', level: 7, species: 'Dwarf|XPHB' })
  await patchStored(page, { strength: 11 })
  await expect(page.locator('.ability-card[data-ability="strength"] .ability-card__score')).toHaveText('13')

  await levelUpToAsi(page, 8)
  const gwm = featOption(page, 8, 'Great Weapon Master')
  await expect(gwm).toHaveJSProperty('disabled', false)
  await expect(gwm).toHaveText('Great Weapon Master · XPHB')
})

test('F-2a 3 (D253/D254): STR 12 + Athlete STR on L4 opens Great Weapon Master on L8; dropping Athlete flags L8 and locks Next', async ({ page }) => {
  await reachAsi(page, 8, [['Strength', '12'], ['Dexterity', '15'], ['Constitution', '13'], ['Intelligence', '14'], ['Wisdom', '10'], ['Charisma', '8']])
  // toBeDisabled() reads an <option> inside an <optgroup> as enabled; the DOM property is what the browser honours.
  await expect(featOption(page, 8, 'Great Weapon Master')).toHaveJSProperty('disabled', true)
  await chooseLevelFeat(page, 4, 'Athlete')
  await levelCard(page, 4).getByRole('combobox', { name: 'Level 4 ability', exact: true }).selectOption('strength')
  await chooseLevelAsi(page, 6, 'dexterity')
  await expect(featOption(page, 8, 'Great Weapon Master')).toHaveJSProperty('disabled', false)
  await chooseLevelFeat(page, 8, 'Great Weapon Master')
  await expect(nextButton(page)).toBeEnabled()

  await chooseLevelFeat(page, 4, 'Tough')
  await expect(levelCard(page, 8).getByText('Great Weapon Master no longer meets its prerequisite (needs STR 13) — choose another feat.', { exact: true })).toBeVisible()
  await expect(nextButton(page)).toBeDisabled()
})

test('F-2a 4 (D254): an old character with Tough on L4 and L8 — Edit Character flags only L8', async ({ page }) => {
  await createFighter(page, { name: 'Twice Tough', level: 8, species: 'Dwarf|XPHB', feat: 'Tough' })
  await patchStored(page, { featAsiLevel: { level: 8, name: 'Tough' } })

  await page.getByRole('button', { name: 'Edit character' }).click()
  await stepBar(page).getByRole('button', { name: /ASI \/ Feat/ }).click()
  await expectStep(page, 'ASI / Feat')
  await expect(levelCard(page, 8).getByText('Tough is already taken (level 4) — choose another feat.', { exact: true })).toBeVisible()
  await expect(levelCardHeader(page, 4)).toHaveAttribute('aria-expanded', 'false')
  await expect(levelCard(page, 4).getByText(/is already taken/)).toHaveCount(0)
  await expect(nextButton(page)).toBeDisabled()
})

test('F-2a 5 (D255): with Alert (XPHB) from the background, an Alert from another book is already taken too', async ({ page }) => {
  // feats.json holds each feat name in one book only (DATA.md); a PHB copy is added here to have two.
  await page.route('**/data/feats.json', async (route) => {
    const response = await route.fetch()
    const feats = (await response.json()) as { name: string; source: string; category: string }[]
    feats.push({ ...feats.find((feat) => feat.name === 'Alert' && feat.source === 'XPHB')!, source: 'PHB', category: 'G' })
    await route.fulfill({ response, json: feats })
  })
  await reachAsi(page, 4, STANDARD, { radio: 'Criminal (XPHB)', plusTwo: 'dexterity', plusOne: 'constitution' })
  const alerts = featOption(page, 4, 'Alert')
  await expect(alerts).toHaveCount(2)
  for (const book of ['XPHB', 'PHB']) {
    const alert = alerts.filter({ hasText: `Alert · ${book} ` })
    await expect(alert).toHaveText(`Alert · ${book} (already taken)`)
    await expect(alert).toHaveJSProperty('disabled', true)
  }
})

test('F-2a 6 (D254): level up over an invalid earlier level says to fix it in Edit Character and does not lock Next', async ({ page }) => {
  await createFighter(page, { name: 'Locked Tough', level: 5, species: 'Dwarf|XPHB', feat: 'Tough' })
  await patchStored(page, { farmer: true })

  await levelUpToAsi(page, 6)
  await expect(levelCard(page, 4).getByText('Tough is already taken (Background) — choose another feat. Fix it in Edit Character.', { exact: true })).toBeVisible()
  await chooseLevelAsi(page, 6, 'strength')
  await expect(nextButton(page)).toBeEnabled()
})

test('F-2a 7 (D256): a new Fighter 8 with feats on L4 and L6 lowered to level 4 keeps only L4 and saves', async ({ page }) => {
  const options: FighterOptions = { name: 'Lowered Feats', level: 8, species: 'Dwarf|XPHB', feat: 'Tough', laterFeat: { level: 6, feat: 'Alert' }, stopAtHitPoints: true }
  await fillUpToBackground(page, options)
  await finishFromBackground(page, options)

  await stepBar(page).getByRole('button', { name: /Class and level/ }).click()
  await select(page, 'Level').selectOption('4')
  await stepBar(page).getByRole('button', { name: /ASI \/ Feat/ }).click()
  await expectStep(page, 'ASI / Feat')
  await expect(page.getByRole('group', { name: /^Level \d+$/ })).toHaveCount(1)
  await expect(levelCardHeader(page, 4)).toHaveText('▸Level 4 — Tough')
  await next(page)

  await expectStep(page, 'Hit points')
  await page.getByRole('button', { name: /Use the average/ }).click()
  await next(page)
  await expectStep(page, 'Starting equipment')
  await page.getByRole('group', { name: /From your class/ }).getByRole('radio').last().check()
  await page.getByRole('group', { name: /From your background/ }).getByRole('radio').last().check()
  await next(page)
  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: 'Create character' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  expect(await storedFeatAsiLevels(page)).toEqual([4])
})
