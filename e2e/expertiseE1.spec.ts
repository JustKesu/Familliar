import { expect, test, type Page } from '@playwright/test'
import { createFighter, expectStep, nextButton, speciesFeatSelect, wizardNav, type FighterOptions } from './wizard.ts'

/* E-1 (D292–D294): the Expertise pool is every skill proficiency the character has, not only class, background and species skills. */
const STORAGE_KEY = 'familliar:characters'

const humanStep = async (p: Page) => {
  await p.getByRole('checkbox', { name: 'Stealth', exact: true }).check()
  await p.getByRole('radio', { name: 'Medium', exact: true }).check()
}
const skilledHuman: FighterOptions = {
  name: 'Skilled Rogue',
  level: 1,
  species: 'Human|XPHB',
  onSpeciesStep: humanStep,
  speciesFeat: 'Skilled',
  onBackgroundStep: async (p) => {
    const card = p.getByRole('group', { name: 'Species feat: Versatile (Human)' })
    for (const [slot, skill] of [['1', 'arcana'], ['2', 'history'], ['3', 'nature']]) {
      await card.getByLabel(`Skilled skill or tool ${slot}`, { exact: true }).selectOption(`skill:${skill}`)
    }
  },
}

/** The app only creates Fighters, so the saved Human Fighter is turned into a level-1 Rogue; Arcana comes from the species feat alone. */
async function seedHumanRogue(page: Page, expertise: string[]): Promise<void> {
  await createFighter(page, skilledHuman)
  await page.evaluate(
    ({ key, expertise }) => {
      const all = JSON.parse(localStorage.getItem(key) ?? '[]')
      for (const character of all) {
        character.classes = [{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 1 }]
        delete character.fightingStyle
        character.masteries = [{ name: 'Dagger' }, { name: 'Shortsword' }]
        character.classSkills = ['perception', 'acrobatics', 'deception', 'athletics']
        character.languages = [...character.languages, { name: 'Draconic', source: 'XPHB', grantedBy: 'thievesCant' }]
        if (expertise.length > 0) character.expertiseSkills = expertise.map((name) => ({ name }))
      }
      localStorage.setItem(key, JSON.stringify(all))
    },
    { key: STORAGE_KEY, expertise },
  )
  await page.reload()
}

async function stepTo(page: Page, label: string): Promise<void> {
  for (let steps = 0; steps < 8 && !(await page.locator('[aria-current="step"]').textContent())?.includes(label); steps++) {
    await nextButton(page).click()
  }
  await expectStep(page, label)
}

async function editToStep(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await stepTo(page, label)
}

async function saveEdit(page: Page): Promise<void> {
  const save = wizardNav(page).getByRole('button', { name: 'Save changes' })
  for (let steps = 0; steps < 10 && !(await save.isVisible()); steps++) await nextButton(page).click()
  await save.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
}

const skillStatus = (page: Page, skill: string) => page.locator('.sheet__skills .sheet__row', { hasText: skill }).locator('.sheet__prof-mark').getAttribute('data-status')

test('E-1 a: a skill granted only by the species feat Skilled is offered in Expertise and shows as expertise on the sheet', async ({ page }) => {
  await seedHumanRogue(page, [])
  await expect.poll(() => skillStatus(page, 'Arcana')).toBe('proficient')

  await editToStep(page, 'Expertise')
  await expect(page.getByRole('checkbox', { name: /^Arcana \(from Skilled\)/ })).toBeVisible()
  await page.getByRole('checkbox', { name: /^Arcana/ }).check()
  await page.getByRole('checkbox', { name: /^Perception/ }).check()
  await expect(nextButton(page)).toBeEnabled()
  await saveEdit(page)

  await expect.poll(() => skillStatus(page, 'Arcana')).toBe('expertise')
})

test('E-1 b: swapping the species feat to one without skills leaves Arcana "(not proficient)" in Expertise and blocks Next until it is replaced', async ({ page }) => {
  await seedHumanRogue(page, ['arcana', 'perception'])
  await expect.poll(() => skillStatus(page, 'Arcana')).toBe('expertise')

  await editToStep(page, 'Background')
  await speciesFeatSelect(page).selectOption('Lucky|XPHB')
  await nextButton(page).click()
  await expectStep(page, 'Expertise')

  await expect(page.getByRole('alert')).toHaveText('Not proficient in Arcana any more — uncheck it and choose another skill for Expertise.')
  await expect(page.getByText('(not proficient)')).toBeVisible()
  await expect(nextButton(page)).toBeDisabled()
  // click, not uncheck(): the stale row disappears once unchecked.
  await page.getByRole('checkbox', { name: /^Arcana/ }).click()
  await page.getByRole('checkbox', { name: /^Acrobatics/ }).check()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(nextButton(page)).toBeEnabled()
})

test("E-1 c: a Khoravar's extra skill is offered in Expertise", async ({ page }) => {
  await page.addInitScript(
    ({ key, value }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
    },
    {
      key: STORAGE_KEY,
      value: JSON.stringify([
        {
          schemaVersion: 56,
          id: 'e1-khoravar',
          name: 'Khoravar Rogue',
          createdAtLevel: 1,
          classes: [{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 1 }],
          masteries: [{ name: 'Dagger' }, { name: 'Shortsword' }],
          abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 } },
          languages: [
            { name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
            { name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
            { name: 'Elvish', source: 'XPHB', grantedBy: 'creation' },
          ],
          species: { name: 'Khoravar', source: 'EFA' },
          speciesSkills: ['arcana'],
          speciesSize: 'M',
          speciesSpellcastingAbility: 'intelligence',
          speciesCantrip: { name: 'Sacred Flame', source: 'XPHB' },
          background: { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
          abilityBonus: { wisdom: 2, intelligence: 1 },
          classSkills: ['perception', 'stealth', 'acrobatics', 'deception'],
        },
      ]),
    },
  )
  await page.goto('/#/character/e1-khoravar')
  await editToStep(page, 'Expertise')
  await expect(page.getByRole('checkbox', { name: /^Arcana \(from Khoravar\)/ })).toBeVisible()
})
