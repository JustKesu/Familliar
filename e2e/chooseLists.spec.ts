import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, createFighter, expectStep, select, stepBar, textToggle, wizardNav } from './wizard.ts'

/* W5 (D-W5): the Class step's rule-text lists are CHOOSE / CHOSEN rows with the text folded behind ▸. */

const STORAGE_KEY = 'familliar:characters'
const row = (page: Page, name: string): Locator => page.locator('.choice-row', { has: chooseButton(page, name) })
const chosen = (page: Page, name: string): Locator => chooseButton(page, name)

async function fillFighterBasics(page: Page, level: number): Promise<void> {
  await page.goto('/#/new')
  await page.getByLabel('Character name').fill('Brann')
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await select(page, 'Level').selectOption(String(level))
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
}

async function pickMasteries(page: Page, weapons: string[]): Promise<void> {
  for (const weapon of weapons) await chooseButton(page, weapon).first().click()
}

test('W-2 a: subclass rows are names only; ▸ shows and hides the text; CHOOSE moves the choice', async ({ page }) => {
  await fillFighterBasics(page, 3)
  await pickMasteries(page, ['Longsword', 'Greatsword', 'Handaxe'])
  await chooseButton(page, 'Defense').click()

  const champion = row(page, 'Champion')
  await expect(champion.locator('.choice-row__text')).toHaveCount(0)
  await textToggle(page, 'Champion').click()
  await expect(champion.locator('.choice-row__text')).toBeVisible()
  await expect(champion.locator('.choice-row__text')).not.toBeEmpty()
  await textToggle(page, 'Champion').click()
  await expect(champion.locator('.choice-row__text')).toHaveCount(0)

  await expect(chooseButton(page, 'Champion')).toHaveText('Choose')
  await chooseButton(page, 'Champion').click()
  await expect(chooseButton(page, 'Champion')).toHaveText('Chosen')
  await expect(chooseButton(page, 'Champion')).toHaveAttribute('aria-pressed', 'true')

  await chooseButton(page, 'Battle Master').click()
  await expect(chooseButton(page, 'Battle Master')).toHaveText('Chosen')
  await expect(chooseButton(page, 'Champion')).toHaveText('Choose')
  await expect(chooseButton(page, 'Champion')).toHaveAttribute('aria-pressed', 'false')

  // Clicking CHOSEN does nothing: it stays chosen.
  await chooseButton(page, 'Battle Master').click()
  await expect(chooseButton(page, 'Battle Master')).toHaveAttribute('aria-pressed', 'true')
})

test('W-2 b: fighting style is a single choice — CHOOSE moves it, CHOSEN stays', async ({ page }) => {
  await fillFighterBasics(page, 1)
  await chooseButton(page, 'Defense').click()
  await expect(chosen(page, 'Defense')).toHaveText('Chosen')

  await chooseButton(page, 'Archery').click()
  await expect(chosen(page, 'Archery')).toHaveText('Chosen')
  await expect(chosen(page, 'Defense')).toHaveText('Choose')

  await chooseButton(page, 'Archery').click()
  await expect(chosen(page, 'Archery')).toHaveAttribute('aria-pressed', 'true')
})

test('W-2 c: weapon mastery shows FULL, disables the rest, and CHOSEN frees a slot again', async ({ page }) => {
  await fillFighterBasics(page, 1)
  await pickMasteries(page, ['Longsword', 'Greatsword', 'Handaxe'])
  await expect(page.getByText('3 / 3 · FULL')).toBeVisible()
  await expect(chooseButton(page, 'Battleaxe')).toBeDisabled()

  await chooseButton(page, 'Longsword').click()
  await expect(chooseButton(page, 'Longsword')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('2 / 3')).toBeVisible()
  await expect(chooseButton(page, 'Battleaxe')).toBeEnabled()

  await chooseButton(page, 'Battleaxe').click()
  await expect(chooseButton(page, 'Battleaxe')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('3 / 3 · FULL')).toBeVisible()
})

test('W-2 d: searching the subclass list filters by name and the chosen one stays chosen after clearing', async ({ page }) => {
  await fillFighterBasics(page, 3)
  await chooseButton(page, 'Champion').click()

  const search = page.getByRole('searchbox', { name: 'Search Subclass' })
  await search.fill('Battle')
  await expect(chooseButton(page, 'Battle Master')).toBeVisible()
  await expect(chooseButton(page, 'Eldritch Knight')).toHaveCount(0)
  await expect(chooseButton(page, 'Champion')).toHaveAttribute('aria-pressed', 'true')

  await search.fill('')
  await expect(chooseButton(page, 'Eldritch Knight')).toBeVisible()
  await expect(chooseButton(page, 'Champion')).toHaveAttribute('aria-pressed', 'true')
})

test('W-2 e + g: Edit Character shows the saved picks CHOSEN; a level up locks the earlier masteries', async ({ page }) => {
  await createFighter(page, { name: 'Edda', level: 3, species: 'Dwarf|XPHB' })

  await test.step('e: Edit Character', async () => {
    await page.getByRole('button', { name: 'Edit character' }).click()
    await expectStep(page, 'Class and level')
    await page.getByRole('button', { name: /^Subclass/ }).click()
    await page.getByRole('button', { name: /^Fighting style/ }).click()
    await expect(chooseButton(page, 'Champion')).toHaveAttribute('aria-pressed', 'true')
    await expect(chooseButton(page, 'Champion')).toHaveText('Chosen')
    await expect(chooseButton(page, 'Defense')).toHaveAttribute('aria-pressed', 'true')
    await expect(chooseButton(page, 'Defense')).toHaveText('Chosen')
    await wizardNav(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('button', { name: 'Level up to 4' })).toBeVisible()
  })

  await test.step('g: Level up to 4', async () => {
    await page.getByRole('button', { name: 'Level up to 4' }).click()
    await expectStep(page, 'Class and level')
    for (const weapon of ['Longsword', 'Greatsword', 'Handaxe']) {
      await expect(chooseButton(page, weapon)).toHaveAttribute('aria-pressed', 'true')
      await expect(chooseButton(page, weapon)).toBeDisabled()
    }
    await expect(page.getByText('(chosen at an earlier level)').first()).toBeVisible()
    await expect(chooseButton(page, 'Battleaxe')).toBeEnabled()
  })
})

test('W-2 f: Class options step on a saved Warlock — invocations use CHOOSE / CHOSEN with the counter', async ({ page }) => {
  const warlock = {
    schemaVersion: 48,
    id: 'w2-warlock',
    name: 'Warlock w2',
    classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: 'Fiend Patron', level: 3 }],
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    species: { name: 'Dwarf', source: 'XPHB' },
    background: { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    abilityBonus: { charisma: 2, constitution: 1 },
    languages: [
      { name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
      { name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
      { name: 'Elvish', source: 'XPHB', grantedBy: 'creation' },
    ],
    classSkills: ['arcana', 'deception'],
    spellChoices: [{ className: 'Warlock', classSource: 'XPHB', spells: ['Eldritch Blast', 'Minor Illusion', 'Hex', 'Armor of Agathys', 'Hold Person', 'Misty Step'].map((name) => ({ name, source: 'XPHB' })) }],
    optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Pact of the Blade' }, { name: 'Agonizing Blast' }, { name: 'Armor of Shadows' }] }],
  }
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    { key: STORAGE_KEY, value: JSON.stringify([warlock]) },
  )
  await page.goto('/#/character/w2-warlock')
  await page.getByRole('button', { name: 'Edit character' }).click()
  await stepBar(page).getByRole('button', { name: /Eldritch Invocations/ }).click()

  await page.getByRole('button', { name: /^Eldritch Invocations/, expanded: false }).click()
  await expect(chooseButton(page, 'Pact of the Blade')).toHaveAttribute('aria-pressed', 'true')
  await expect(chooseButton(page, 'Agonizing Blast')).toHaveText('Chosen')
  await expect(page.getByText('3 / 3 · FULL')).toBeVisible()
  await expect(chooseButton(page, "Devil's Sight")).toBeDisabled()

  await chooseButton(page, 'Agonizing Blast').click()
  await expect(chooseButton(page, 'Agonizing Blast')).toHaveText('Choose')
  await expect(page.getByText('2 / 3')).toBeVisible()
  await expect(chooseButton(page, "Devil's Sight")).toBeEnabled()
})
