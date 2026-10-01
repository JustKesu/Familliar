import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseLevelFeat, createFighter, expectStep, next, openLevelCard, wizardNav, type FighterOptions } from './wizard.ts'

/* W-9 (D295–D300): the Review step as cards, the level-up "What's new" card, and the stale-Expertise line. */

const STORAGE_KEY = 'familliar:characters'
const FIXTURE = 'e2e/fixtures/portrait-600x400.png'

const review = (page: Page) => page.getByRole('region', { name: 'Review', exact: true })
const card = (page: Page, name: string | RegExp) => review(page).getByRole('region', { name })
/** A Proficiencies / Spells / Hit points row: its 11px label picks the row, the text under it is what is read. */
const rowText = (scope: Locator, label: string) => scope.locator('.review__row').filter({ has: scope.page().locator('.review__label', { hasText: new RegExp(`^${label}$`) }) }).locator('.review__text')
const totals = (scope: Page | Locator) => scope.locator('.ability-table__total td').allTextContents()
const step = (page: Page) => page.locator('[aria-current="step"]')

async function nextUntil(page: Page, label: string): Promise<void> {
  for (let steps = 0; steps < 10 && !(await step(page).textContent())?.includes(label); steps++) await next(page)
  await expectStep(page, label)
}

const pia: FighterOptions = { name: 'Pia', level: 1, species: 'Dwarf|XPHB', classGear: true, stopAtReview: true }

test('W-9 a: a Fighter 1 Review shows the header and the Ability scores, Proficiencies, Feats, Hit points and Equipment cards, and no Spells card', async ({ page }) => {
  await createFighter(page, pia)

  await expect(review(page).getByRole('heading', { name: 'Pia', exact: true })).toBeVisible()
  await expect(review(page).locator('.review__line')).toHaveText('Dwarf · Fighter 1 · Acolyte')
  await expect(wizardNav(page).getByRole('button', { name: 'Create character' })).toBeVisible()

  // Strength 15, Dexterity 14, Constitution 13, Intelligence 12 + 1, Wisdom 10 + 2, Charisma 8 (Acolyte: Wisdom +2, Intelligence +1).
  expect(await totals(card(page, 'Ability scores'))).toEqual(['15', '14', '13', '13', '12', '8'])

  const proficiencies = card(page, 'Proficiencies')
  await expect(rowText(proficiencies, 'Skills')).toContainText('Athletics')
  await expect(rowText(proficiencies, 'Skills')).toContainText('Perception')
  await expect(rowText(proficiencies, 'Expertise')).toHaveText('—')
  await expect(rowText(proficiencies, 'Armor')).not.toHaveText('—')
  await expect(rowText(proficiencies, 'Languages')).toContainText('Common')
  await expect(rowText(proficiencies, 'Languages')).toContainText('Dwarvish')

  const feats = card(page, 'Feats')
  await expect(feats).toContainText('Magic Initiate')
  await expect(feats.locator('.review__origin')).toHaveText('Background')

  const hitPoints = card(page, 'Hit points')
  await expect(rowText(hitPoints, 'Hit dice')).toHaveText('1d10')
  // D300: d10 + Constitution modifier (from the Ability scores card), + 1 for Dwarven Toughness.
  const constitution = Number((await totals(card(page, 'Ability scores')))[2])
  await expect(rowText(hitPoints, 'Maximum')).toHaveText(String(10 + Math.floor((constitution - 10) / 2) + 1))

  await expect(card(page, 'Equipment')).toBeVisible()
  await expect(review(page).getByRole('heading', { name: 'Equipment', exact: true })).toBeVisible()
  await expect(review(page).locator('.start-table')).toContainText('Greatsword')

  await expect(card(page, 'Spells')).toHaveCount(0)
})

test('F-6: creating through the UI saves current hit points equal to the maximum the Review showed', async ({ page }) => {
  await createFighter(page, pia)
  const shown = Number(await rowText(card(page, 'Hit points'), 'Maximum').innerText())

  await wizardNav(page).getByRole('button', { name: 'Create character' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  const hitPoints = page.locator('.sheet__hit-points-value').first()
  await expect(hitPoints).toHaveText(new RegExp(`^\\s*${shown}\\s*/\\s*${shown}\\b`))
})

test('W-9 b: the header shows the uploaded portrait', async ({ page }) => {
  await createFighter(page, {
    ...pia,
    onClassStep: async (p) => {
      const chooser = p.waitForEvent('filechooser')
      await p.getByRole('button', { name: 'Portrait (optional)', exact: true }).click()
      await (await chooser).setFiles(FIXTURE)
      await p.getByRole('dialog', { name: 'Crop portrait' }).getByRole('button', { name: 'Apply' }).click()
    },
  })
  await expect(review(page).getByAltText('Portrait of Pia')).toBeVisible()
  await expect(review(page).locator('.review__portrait')).toHaveText('')
})

test('W-9 b: without a portrait the header shows the first letter of the name', async ({ page }) => {
  await createFighter(page, { ...pia, name: 'Quill' })
  await expect(review(page).locator('.review__portrait img')).toHaveCount(0)
  await expect(review(page).locator('.review__portrait')).toHaveText('Q')
})

test('W-9 c: a card heading opens the step that sets it, and Next comes back to Review with the same totals', async ({ page }) => {
  await createFighter(page, pia)
  const before = await totals(review(page))

  await card(page, 'Ability scores').getByRole('button', { name: 'Ability scores', exact: true }).click()
  await expectStep(page, 'Ability scores')
  expect(await totals(page)).toEqual(before)

  await nextUntil(page, 'Review and save')
  await expect(review(page)).toBeVisible()
  expect(await totals(review(page))).toEqual(before)

  // D301: the Proficiencies card leads to the step the bar calls "Proficiencies".
  await card(page, 'Proficiencies').getByRole('button', { name: 'Proficiencies', exact: true }).click()
  await expectStep(page, 'Proficiencies')
  await nextUntil(page, 'Review and save')
})

test('W-9 d: a level up to 2 opens Review with the "What\'s new" card; headings of steps outside the walk are plain text', async ({ page }) => {
  await createFighter(page, { ...pia, stopAtReview: false })
  const oldMax = Number(/\/\s*(\d+)/.exec(await page.locator('.sheet__hit-points-value').first().innerText())![1])

  await page.getByRole('button', { name: 'Level up to 2' }).click()
  let newMax = 0
  for (let steps = 0; steps < 8 && !(await step(page).textContent())?.includes('Review and save'); steps++) {
    const average = page.getByRole('radio', { name: 'Average (6)' })
    if (await average.isVisible()) {
      await average.check()
      newMax = Number(await page.getByTestId('hit-points-max').textContent())
    }
    await next(page)
  }
  await expectStep(page, 'Review and save')
  expect(newMax).toBeGreaterThan(oldMax)

  const whatsNew = card(page, /^Level 2 — What.s new$/)
  await expect(whatsNew).toBeVisible()
  const actionSurge = whatsNew.getByRole('button', { name: 'Action Surge', exact: true })
  await expect(whatsNew.getByRole('button', { name: 'Tactical Mind', exact: true })).toBeVisible()
  await expect(actionSurge).toHaveAttribute('aria-expanded', 'false')
  await expect(whatsNew).not.toContainText('one additional action')
  await actionSurge.click()
  await expect(actionSurge).toHaveAttribute('aria-expanded', 'true')
  await expect(whatsNew).toContainText('one additional action')
  await expect(rowText(whatsNew, 'Hit points')).toHaveText(`+${newMax - oldMax} → ${newMax}`)

  await expect(wizardNav(page).getByRole('button', { name: 'Save level 2' })).toBeVisible()
  await expect(wizardNav(page).getByRole('button', { name: 'Create character' })).toHaveCount(0)

  // Hit points is in this walk, Ability scores is not: the first heading is a button, the second only a heading.
  await expect(review(page).getByRole('heading', { name: 'Ability scores', exact: true })).toBeVisible()
  await expect(review(page).getByRole('button', { name: 'Ability scores', exact: true })).toHaveCount(0)
  await expect(card(page, 'Hit points').getByRole('button', { name: 'Hit points', exact: true })).toBeVisible()
  await expect(review(page).getByRole('heading', { name: 'Equipment', exact: true })).toHaveCount(0)

  await wizardNav(page).getByRole('button', { name: 'Save level 2' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  await expect(page.locator('.sheet__hit-points-value').first()).toContainText(`/ ${newMax}`)
})

/** A Rogue 4 whose Arcana comes only from the level-4 Skilled feat, with Expertise in it. Class skills avoid Arcana; the Rogue list does not hold it. */
const ROGUE = {
  schemaVersion: 56,
  id: 'w9-rogue',
  name: 'Mira',
  createdAtLevel: 1,
  classes: [{ className: 'Rogue', classSource: 'XPHB', subclass: 'Thief', level: 4 }],
  masteries: [{ name: 'Dagger' }, { name: 'Shortsword' }],
  abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 15, constitution: 13, intelligence: 14, wisdom: 12, charisma: 10 } },
  languages: [
    { name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
    { name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
    { name: 'Elvish', source: 'XPHB', grantedBy: 'creation' },
    { name: 'Draconic', source: 'XPHB', grantedBy: 'thievesCant' },
  ],
  species: { name: 'Dwarf', source: 'XPHB' },
  background: { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
  abilityBonus: { wisdom: 2, intelligence: 1 },
  classSkills: ['perception', 'stealth', 'acrobatics', 'deception'],
  expertiseSkills: [{ name: 'arcana' }, { name: 'perception' }],
  featAsiChoices: [{ level: 4, kind: 'feat', name: 'Skilled', source: 'XPHB', proficiencies: { skills: ['arcana', 'history', 'nature'] } }],
  hitPointLevels: [2, 3, 4].map((level) => ({ level, kind: 'average', dieResult: 5 })),
}

test('W-9 e: Expertise in a skill the character no longer has is explained on Review, which blocks Save and links to the Expertise step', async ({ page }) => {
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: STORAGE_KEY, value: JSON.stringify([ROGUE]) },
  )
  await page.goto('/#/character/w9-rogue')
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await nextUntil(page, 'ASI / Feat')

  await openLevelCard(page, 4)
  await chooseLevelFeat(page, 4, 'Tough')
  await nextUntil(page, 'Review and save')

  await expect(review(page).getByRole('alert')).toContainText('Expertise in Arcana needs a proficiency you no longer have.')
  await expect(wizardNav(page).getByRole('button', { name: 'Save changes' })).toBeDisabled()
  // F-6: only a level up shows "What's new".
  await expect(card(page, /What.s new/)).toHaveCount(0)

  await review(page).getByRole('button', { name: 'Go to Expertise', exact: true }).click()
  await expectStep(page, 'Expertise')
  await expect(page.getByText('(not proficient)')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /^Arcana/ })).toBeChecked()
})

test('F-6: a level up whose walk has no Expertise step explains a stale Expertise, points to Edit Character and still saves', async ({ page }) => {
  // The Skilled feat is gone (removed on the sheet), so Arcana is no longer proficient; Rogue 4 → 5 grants no Expertise.
  const stale = { ...ROGUE, id: 'f6-rogue', featAsiChoices: [{ level: 4, kind: 'feat', name: 'Tough', source: 'XPHB' }] }
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: STORAGE_KEY, value: JSON.stringify([stale]) },
  )
  await page.goto('/#/character/f6-rogue')
  await page.getByRole('button', { name: 'Level up to 5' }).click()
  for (let steps = 0; steps < 8 && !(await step(page).textContent())?.includes('Review and save'); steps++) {
    const average = page.getByRole('radio', { name: /^Average/ })
    if (await average.isVisible()) await average.check()
    await next(page)
  }
  await expectStep(page, 'Review and save')

  const alert = review(page).getByRole('alert')
  await expect(alert).toContainText('Expertise in Arcana needs a proficiency you no longer have.')
  await expect(alert).toContainText('Fix it in Edit Character.')
  await expect(review(page).getByRole('button', { name: 'Go to Expertise' })).toHaveCount(0)
  await expect(wizardNav(page).getByRole('button', { name: 'Save level 5' })).toBeEnabled()
  await wizardNav(page).getByRole('button', { name: 'Save level 5' }).click()
  await expect(page).toHaveURL(/#\/character\/f6-rogue$/)
})
