import { expect, type Locator, type Page } from '@playwright/test'

export async function expectStep(page: Page, label: string): Promise<void> {
  await expect(page.locator('[aria-current="step"]')).toContainText(label)
}

/** getByLabel on a `<label>` wrapping a `<select>` matches against the option texts too; the role's accessible name is just the label. */
export function select(scope: Page | Locator, label: string): Locator {
  return scope.getByRole('combobox', { name: label, exact: true })
}

export async function next(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Next', exact: true }).click()
}

export interface FighterOptions {
  name: string
  level: number
  /** `<option value>` of the species select, e.g. "Dwarf|XPHB". */
  species: string
  /** Runs on the species step for a species that asks for more (skill, size). */
  onSpeciesStep?: (page: Page) => Promise<void>
  /** Feat taken at level 4; its own sub-choices are left empty. */
  feat?: string
  /** Runs on the featAsi step after the feat is picked. */
  onFeatStep?: (page: Page) => Promise<void>
  /** The class's first starting-equipment option (Fighter: Greatsword, Flail, Javelins…) instead of the last. */
  classGear?: boolean
  /** Subclass radio at level 3+; Champion when absent. */
  subclass?: string
  /** Runs on the class step after the subclass is picked (its own options). */
  onClassStep?: (page: Page) => Promise<void>
  /** Runs on the Languages step (a subclass's tool or skill pick). */
  onLanguagesStep?: (page: Page) => Promise<void>
}

/** Fighter with background Acolyte; stops on the Background step so the caller can inspect it. */
export async function fillUpToBackground(page: Page, options: FighterOptions): Promise<void> {
  await page.goto('/#/new')
  await expectStep(page, 'Class and level')
  await page.getByLabel('Character name').fill(options.name)
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await select(page, 'Level').selectOption(String(options.level))
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
  for (const weapon of ['Longsword', 'Greatsword', 'Handaxe']) {
    await page.getByRole('checkbox', { name: new RegExp(`^${weapon} —`) }).first().check()
  }
  await page.getByRole('radio', { name: 'Defense', exact: true }).first().check()
  if (options.level >= 3) await page.getByRole('radio', { name: options.subclass ?? 'Champion', exact: true }).first().check()
  await options.onClassStep?.(page)
  await next(page)

  await expectStep(page, 'Species')
  await select(page, 'Species').selectOption(options.species)
  await options.onSpeciesStep?.(page)
  await next(page)

  await expectStep(page, 'Background')
  await page.getByRole('radio', { name: 'Acolyte (XPHB)' }).check()
  await select(page, '+2').selectOption('wisdom')
  await select(page, '+1').selectOption('intelligence')
}

/** Continues from the Background step to the saved sheet. */
export async function finishFromBackground(page: Page, options: FighterOptions): Promise<void> {
  await next(page)

  await expectStep(page, 'Languages')
  await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
  await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
  await options.onLanguagesStep?.(page)
  await next(page)

  await expectStep(page, 'Ability scores')
  const scores: [string, string][] = [['Strength', '15'], ['Dexterity', '14'], ['Constitution', '13'], ['Intelligence', '12'], ['Wisdom', '10'], ['Charisma', '8']]
  for (const [ability, score] of scores) {
    await select(page, ability).selectOption({ label: score })
  }
  await next(page)

  if (options.level >= 4) {
    await expectStep(page, 'Ability Score Improvement / Feat')
    const level4 = page.getByRole('group', { name: 'Level 4' })
    if (options.feat) {
      await level4.getByRole('radio', { name: 'Feat', exact: true }).check()
      await level4.getByRole('radio', { name: options.feat, exact: true }).first().check()
      await options.onFeatStep?.(page)
    } else {
      await level4.getByRole('radio', { name: 'Ability Score Improvement' }).check()
      await level4.getByRole('combobox').first().selectOption('strength')
    }
    await next(page)
  }

  if (options.level >= 2) {
    await expectStep(page, 'Hit points')
    await page.getByRole('button', { name: /Use the average/ }).click()
    await next(page)
  }

  await expectStep(page, 'Starting equipment')
  const classOptions = page.getByRole('group', { name: /From your class/ }).getByRole('radio')
  await (options.classGear ? classOptions.first() : classOptions.last()).check()
  await page.getByRole('group', { name: /From your background/ }).getByRole('radio').last().check()
  await next(page)

  await expectStep(page, 'Review and save')
  await page.getByRole('button', { name: 'Create character' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
}

export async function createFighter(page: Page, options: FighterOptions): Promise<void> {
  await fillUpToBackground(page, options)
  await finishFromBackground(page, options)
}
