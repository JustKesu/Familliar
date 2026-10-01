import { expect, type Locator, type Page } from '@playwright/test'

export async function expectStep(page: Page, label: string): Promise<void> {
  await expect(page.locator('[aria-current="step"]')).toContainText(label)
}

/** getByLabel on a `<label>` wrapping a `<select>` matches against the option texts too; the role's accessible name is just the label. */
export function select(scope: Page | Locator, label: string): Locator {
  return scope.getByRole('combobox', { name: label, exact: true })
}

/** W10: Next/Back/Cancel/save exist in the sticky bar and under the step; specs always use the row under the step. */
export function wizardNav(page: Page): Locator {
  return page.getByRole('group', { name: 'Step navigation', exact: true })
}

/**
 * W5: the CHOOSE / CHOSEN button of a Class-step list row; aria-pressed carries the state. Its name is
 * "Choose <name>", or "Choose <name> (<book>)" when two books share the name (F-1) — then the XPHB row.
 */
export function chooseButton(scope: Page | Locator, name: string, book = 'XPHB'): Locator {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return scope.getByRole('button', { name: new RegExp(`^Choose ${escaped}( \\(${book}\\))?$`) })
}

/** The ▸ toggle of the same row, which shows and hides its rule text. */
export function textToggle(scope: Page | Locator, name: string): Locator {
  return scope.getByRole('button', { name: `${name} text`, exact: true })
}

/** W-7: the option cards of one Starting equipment section; each card has one CHOOSE / CHOSEN button, "Choose class option A". */
export function equipmentSection(page: Page, origin: 'class' | 'background'): Locator {
  return page.getByRole('group', { name: origin === 'class' ? /^From your class/ : /^From your background/ })
}

export function equipmentChoose(page: Page, origin: 'class' | 'background', option: string): Locator {
  return equipmentSection(page, origin).getByRole('button', { name: `Choose ${origin} option ${option}`, exact: true })
}

/** The first or last option card of a section, whatever its letter — for specs that only need to get past the step. */
export function equipmentChooseAny(page: Page, origin: 'class' | 'background', which: 'first' | 'last'): Locator {
  const buttons = equipmentSection(page, origin).getByRole('button', { name: new RegExp(`^Choose ${origin} option `) })
  return which === 'first' ? buttons.first() : buttons.last()
}

/** The Starting equipment step as most specs need it: last option of the class (first with `classGear`) and last of the background. */
export async function takeStartingEquipment(page: Page, classGear = false): Promise<void> {
  await equipmentChooseAny(page, 'class', classGear ? 'first' : 'last').click()
  await equipmentChooseAny(page, 'background', 'last').click()
}

export function stepBar(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Wizard steps' })
}

export function nextButton(page: Page): Locator {
  return wizardNav(page).getByRole('button', { name: 'Next', exact: true })
}

/** W-3: a Fighter levelling 3 → 4 knows one more weapon mastery, and the class step's Next waits for it. */
export async function takeFighterLevel4Mastery(page: Page): Promise<void> {
  await chooseButton(page, 'Battleaxe').first().click()
}

/** For a hand-seeded Fighter 3 saved without any class pick: class skills (W-4), fighting style plus the four masteries a level 4 Fighter knows. */
export async function takeAllFighterLevel4Picks(page: Page): Promise<void> {
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
  await chooseButton(page, 'Defense').click()
  for (const weapon of ['Longsword', 'Greatsword', 'Handaxe', 'Battleaxe']) await chooseButton(page, weapon).first().click()
}

/** W16: an ASI level's card; its accessible name is exactly "Level N" whatever its header summary says. */
export function levelCard(scope: Page | Locator, level: number): Locator {
  return scope.getByRole('group', { name: `Level ${level}`, exact: true })
}

/** The card's ▸/▾ header button, named by its summary ("Level 4 — Athlete (+1 DEX)"). */
export function levelCardHeader(scope: Page | Locator, level: number): Locator {
  return levelCard(scope, level).getByRole('button', { name: new RegExp(`^Level ${level} — `) })
}

/** W17: a complete card starts collapsed when the step is entered. */
export async function openLevelCard(scope: Page | Locator, level: number): Promise<void> {
  const header = levelCardHeader(scope, level)
  if ((await header.getAttribute('aria-expanded')) === 'false') await header.click()
}

export function featOrAsiSelect(scope: Page | Locator, level: number): Locator {
  return levelCard(scope, level).getByRole('combobox', { name: `Level ${level} feat or ASI`, exact: true })
}

/** The dropdown option of a feat, "Name · Book" plus any reason it cannot be taken. */
export function featOption(scope: Page | Locator, level: number, feat: string): Locator {
  const escaped = feat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return featOrAsiSelect(scope, level).locator('option', { hasText: new RegExp(`^${escaped} · `) })
}

export async function chooseLevelFeat(scope: Page | Locator, level: number, feat: string): Promise<void> {
  const value = await featOption(scope, level, feat).first().getAttribute('value')
  await featOrAsiSelect(scope, level).selectOption(value!)
}

export async function chooseLevelAsi(scope: Page | Locator, level: number, ability: string): Promise<void> {
  await featOrAsiSelect(scope, level).selectOption('asi')
  await levelCard(scope, level).getByRole('combobox', { name: `Level ${level} +2 ability`, exact: true }).selectOption(ability)
}

export async function next(page: Page): Promise<void> {
  await nextButton(page).click()
}

const FIGHTER_ASI_LEVELS = [4, 6, 8, 12, 14, 16, 19]

export interface FighterOptions {
  name: string
  level: number
  /** `<option value>` of the species select, e.g. "Dwarf|XPHB". */
  species: string
  /** Runs on the species step for a species that asks for more (skill, size). */
  onSpeciesStep?: (page: Page) => Promise<void>
  /** S1 (D271): Human's Versatile origin feat, chosen on the Background step; Lucky for a Human when absent, null leaves it unchosen. */
  speciesFeat?: string | null
  /** Feat taken at level 4; its own sub-choices are left empty. */
  feat?: string
  /** Runs on the featAsi step after the feat is picked. */
  onFeatStep?: (page: Page) => Promise<void>
  /** A feat at a Fighter ASI slot above 4 (all slots up to `level` are filled, the others with an ASI). */
  laterFeat?: { level: number; feat: string; onFeatStep?: (page: Page) => Promise<void> }
  /** The class's first starting-equipment option (Fighter: Greatsword, Flail, Javelins…) instead of the last. */
  classGear?: boolean
  /** Subclass radio at level 3+; Champion when absent. */
  subclass?: string
  /** Runs on the class step after the subclass is picked (its own options). */
  onClassStep?: (page: Page) => Promise<void>
  /** Runs on the Languages step (a subclass's tool or skill pick). */
  onLanguagesStep?: (page: Page) => Promise<void>
  /** Background radio and its +2/+1 abilities; Acolyte (Wisdom/Intelligence) when absent. */
  background?: { radio: string; plusTwo: string; plusOne: string }
  /** W-7: runs on the Background step after the abilities (a background's tool pick, e.g. Soldier's gaming set). */
  onBackgroundStep?: (page: Page) => Promise<void>
  /** W-6: finishFromBackground returns on the Hit points step instead of filling it in. */
  stopAtHitPoints?: boolean
  /** F-2b: finishFromBackground returns on the ASI / Feat step with every card still empty. */
  stopAtAsi?: boolean
  /** W-7: finishFromBackground returns on the Starting equipment step with nothing taken. */
  stopAtEquipment?: boolean
}

/** Fighter with background Acolyte unless `background` says otherwise; stops on the Background step so the caller can inspect it. */
export async function fillUpToBackground(page: Page, options: FighterOptions): Promise<void> {
  await page.goto('/#/new')
  await expectStep(page, 'Class and level')
  await page.getByLabel('Character name').fill(options.name)
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await select(page, 'Level').selectOption(String(options.level))
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
  // W-3: the step's Next needs the exact mastery count — Fighter gets 3, 4 from level 4, 5 from 10, 6 from 16.
  const masteryCount = options.level >= 16 ? 6 : options.level >= 10 ? 5 : options.level >= 4 ? 4 : 3
  for (const weapon of ['Longsword', 'Greatsword', 'Handaxe', 'Battleaxe', 'Flail', 'Glaive'].slice(0, masteryCount)) {
    await chooseButton(page, weapon).first().click()
  }
  await chooseButton(page, 'Defense').click()
  if (options.level >= 3) await chooseButton(page, options.subclass ?? 'Champion').click()
  await options.onClassStep?.(page)
  await next(page)

  await expectStep(page, 'Species')
  await select(page, 'Species').selectOption(options.species)
  await options.onSpeciesStep?.(page)
  await next(page)

  await expectStep(page, 'Background')
  const background = options.background ?? { radio: 'Acolyte (XPHB)', plusTwo: 'wisdom', plusOne: 'intelligence' }
  await page.getByRole('radio', { name: background.radio }).check()
  await select(page, '+2').selectOption(background.plusTwo)
  await select(page, '+1').selectOption(background.plusOne)
  const speciesFeat = options.speciesFeat === undefined ? (options.species === 'Human|XPHB' ? 'Lucky' : null) : options.speciesFeat
  if (speciesFeat) await speciesFeatSelect(page).selectOption(`${speciesFeat}|XPHB`)
  await options.onBackgroundStep?.(page)
}

/** S1 (D272): the Background step's dropdown for the species' origin feat. */
export function speciesFeatSelect(page: Page): Locator {
  return select(page, 'Species origin feat')
}

/** Continues from the Background step to the saved sheet. */
export async function finishFromBackground(page: Page, options: FighterOptions): Promise<void> {
  await next(page)

  await expectStep(page, 'Proficiencies')
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
    await expectStep(page, 'ASI / Feat')
    if (options.stopAtAsi) return
    const asiLevels = FIGHTER_ASI_LEVELS.filter((l) => l <= options.level)
    for (const [index, level] of asiLevels.entries()) {
      // `feat` / `onFeatStep` belong to level 4 when the character reaches it, else to the first slot (a level-19 epic boon).
      const own = level === 4 ? options : level === options.laterFeat?.level ? options.laterFeat : undefined
      const feat = level === 4 ? options.feat : options.laterFeat?.level === level ? options.laterFeat.feat : undefined
      if (feat) {
        await chooseLevelFeat(page, level, feat)
        await own?.onFeatStep?.(page)
      } else {
        await chooseLevelAsi(page, level, ['strength', 'dexterity', 'constitution', 'wisdom', 'charisma', 'intelligence'][index % 6]!)
      }
    }
    await next(page)
  }

  if (options.level >= 2) {
    await expectStep(page, 'Hit points')
    if (options.stopAtHitPoints) return
    await page.getByRole('button', { name: /Use the average/ }).click()
    await next(page)
  }

  await expectStep(page, 'Starting equipment')
  if (options.stopAtEquipment) return
  await takeStartingEquipment(page, options.classGear)
  await next(page)

  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: 'Create character' }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
}

export async function createFighter(page: Page, options: FighterOptions): Promise<void> {
  await fillUpToBackground(page, options)
  await finishFromBackground(page, options)
}
