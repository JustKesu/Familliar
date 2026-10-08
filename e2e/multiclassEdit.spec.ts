import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, expectStep, nextButton, select, stepBar, wizardNav } from './wizard.ts'

/* M9b (D333): Edit Character of a multiclass character. Seeded at schema 60 with a consistent levelOrder, as the wizard saves them. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
const HIT_DIE: Record<string, number> = { Warlock: 8, Sorcerer: 6, Wizard: 6, Cleric: 8, Fighter: 10, Rogue: 8 }

type Held = [className: string, subclass: string | null, level: number]

function build(id: string, held: Held[], extra: Record<string, unknown>, withHistory = true) {
  const levelOrder = held.flatMap(([className, , level]) => Array.from({ length: level }, () => ({ className, classSource: XPHB })))
  return {
    schemaVersion: 60,
    id,
    name: id,
    classes: held.map(([className, subclass, level]) => ({ className, classSource: XPHB, subclass, level })),
    ...(withHistory ? { levelOrder } : {}),
    createdAtLevel: 1,
    species: { name: 'Dwarf', source: XPHB },
    background: { name: 'Soldier', source: XPHB, skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
    abilityBonus: { strength: 2, dexterity: 1 },
    languages: [
      { name: 'Common', source: XPHB, grantedBy: 'automatic' },
      { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
    ],
    // Every level from 2 at the average of its own class's die (D323).
    hitPointLevels: levelOrder.slice(1).map((entry, index) => ({ level: index + 2, kind: 'average', dieResult: HIT_DIE[entry.className]! / 2 + 1 })),
    ...extra,
  }
}

const WARLOCK_SPELLS = ['Eldritch Blast', 'Minor Illusion', 'Prestidigitation', 'Hex', 'Armor of Agathys', 'Hold Person', 'Misty Step', 'Counterspell', 'Hunger of Hadar', 'Spider Climb']
const SORCERER_SPELLS = ['Fire Bolt', 'Light', 'Mage Hand', 'Ray of Frost', 'Burning Hands', 'Magic Missile', 'Shield', 'Chromatic Orb', 'Scorching Ray', 'Mirror Image']
const INVOCATIONS = ['Pact of the Blade', 'Agonizing Blast', 'Armor of Shadows', 'Repelling Blast', 'Mask of Many Faces']

const warlockSorcerer = (id: string) =>
  build(id, [['Warlock', 'Fiend Patron', 6], ['Sorcerer', 'Wild Magic Sorcery', 3]], {
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    classSkills: ['arcana', 'deception'],
    spellChoices: [
      { className: 'Warlock', classSource: XPHB, spells: refs(WARLOCK_SPELLS) },
      { className: 'Sorcerer', classSource: XPHB, spells: refs(SORCERER_SPELLS) },
    ],
    optionalFeatureChoices: [
      { featureType: 'EI', choices: refs(INVOCATIONS) },
      { featureType: 'MM', choices: refs(['Careful Spell', 'Quickened Spell']) },
    ],
    featAsiChoices: [{ level: 4, kind: 'asi', increases: { charisma: 2 } }],
  })

const WIZARD_SPELLS = ['Fire Bolt', 'Mage Hand', 'Prestidigitation', 'Magic Missile', 'Shield', 'Detect Magic', 'Mage Armor', 'Sleep', 'Misty Step']
const CLERIC_SPELLS = ['Guidance', 'Sacred Flame', 'Thaumaturgy', 'Command', 'Guiding Bolt', 'Healing Word', 'Shield of Faith', 'Spiritual Weapon', 'Prayer of Healing']

const wizardCleric = (id: string) =>
  build(id, [['Wizard', 'Bladesinger', 3], ['Cleric', 'Life Domain', 3]], {
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 } },
    classSkills: ['arcana', 'history'],
    expertiseSkills: [{ name: 'arcana' }],
    subclassSkills: [{ grantedBy: 'bladesinger', name: 'acrobatics' }],
    spellChoices: [
      { className: 'Wizard', classSource: XPHB, spells: refs(WIZARD_SPELLS) },
      { className: 'Cleric', classSource: XPHB, spells: refs(CLERIC_SPELLS) },
    ],
    classFeatureChoices: [{ className: 'Cleric', classSource: XPHB, featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Protector' }],
  })

const FIGHTER_ROGUE: Held[] = [
  ['Fighter', 'Champion', 4],
  ['Rogue', null, 1],
]
const fighterRogue = (id: string, withHistory = true) =>
  build(
    id,
    FIGHTER_ROGUE,
    {
      abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
      classSkills: ['perception', 'history'],
      masteries: refs(['Longsword', 'Greatsword', 'Handaxe', 'Battleaxe', 'Dagger', 'Shortsword']).map(({ name }) => ({ name })),
      fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }],
      expertiseSkills: [{ name: 'perception' }, { name: 'athletics' }],
      featAsiChoices: [{ level: 4, kind: 'asi', increases: { constitution: 2 } }],
      multiclassPicks: [{ className: 'Rogue', classSource: XPHB, kind: 'skill', name: 'stealth' }],
      languages: [
        { name: 'Common', source: XPHB, grantedBy: 'automatic' },
        { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
        { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
        { name: 'Giant', source: XPHB, grantedBy: 'thievesCant' },
      ],
    },
    withHistory,
  )

async function openSheet(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

async function stored(page: Page, id: string): Promise<Record<string, unknown>> {
  const all = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)) ?? '[]') as Record<string, unknown>[]
  return all.find((entry) => entry['id'] === id)!
}

const editButton = (page: Page): Locator => page.locator('.sheet__edit-character')
const switcher = (page: Page): Locator => page.getByRole('group', { name: 'Class to edit' })
const classTab = (page: Page, className: string): Locator => switcher(page).getByRole('button', { name: new RegExp(`^${className} \\d+`) })
const goToStep = (page: Page, name: RegExp): Promise<void> => stepBar(page).getByRole('button', { name }).click()
const saveButton = (page: Page): Locator => wizardNav(page).getByRole('button', { name: 'Save changes' })
const skillStatus = (page: Page, skill: string) => page.locator('.sheet__skills .sheet__row', { hasText: skill }).locator('.sheet__prof-mark').getAttribute('data-status')

async function switchTo(page: Page, className: string): Promise<void> {
  await goToStep(page, /Class and level/)
  await classTab(page, className).click()
  await expect(classTab(page, className)).toHaveAttribute('aria-pressed', 'true')
}

/** Next until the Review step, then Save; every step must already be complete. */
async function saveEdit(page: Page, id: string): Promise<void> {
  for (let steps = 0; steps < 12 && !(await saveButton(page).isVisible()); steps++) await nextButton(page).click()
  await saveButton(page).click()
  await expect(page).toHaveURL(new RegExp(`#/character/${id}$`))
}

async function openOptionList(page: Page, name: RegExp): Promise<void> {
  const toggle = page.getByRole('button', { name, expanded: false })
  if ((await toggle.count()) > 0) await toggle.first().click()
}

/** Fills the Spells step's counters with the first offered spells. */
async function fillSpells(page: Page): Promise<void> {
  const addSpells = page.getByRole('region', { name: 'Add Spells' })
  for (const [label, button] of [
    ['Cantrips', /^Add /],
    ['Prepared', /^Prepare /],
  ] as const) {
    const counter = page.locator('.manage-spells__counter', { hasText: new RegExp(`^${label}:`) })
    for (;;) {
      const [, have, max] = (await counter.innerText()).match(/(\d+)\/(\d+)/)!.map(Number)
      if (have! >= max!) break
      await addSpells.getByRole('button', { name: button, disabled: false }).first().click()
      await expect(counter).toHaveText(new RegExp(`^${label}: ${have! + 1}/`))
    }
  }
}

test('M9b a: Warlock 6 / Sorcerer 3 — swap an invocation and a Metamagic option through the class switcher; classes and levelOrder unchanged', async ({ page }) => {
  const seed = warlockSorcerer('m9b-a')
  await openSheet(page, seed)
  await editButton(page).click()
  await expectStep(page, 'Class and level')
  await expect(switcher(page).getByRole('button')).toHaveText(['Warlock 6 (Fiend Patron)', 'Sorcerer 3 (Wild Magic Sorcery)'])
  await expect(classTab(page, 'Warlock')).toHaveAttribute('aria-pressed', 'true')
  await expect(select(page, 'Class')).toHaveCount(0)

  await goToStep(page, /Eldritch Invocations/)
  await expectStep(page, 'Eldritch Invocations')
  await openOptionList(page, /^Eldritch Invocations/)
  await chooseButton(page, 'Mask of Many Faces').click()
  await chooseButton(page, "Devil's Sight").click()

  await switchTo(page, 'Sorcerer')
  await goToStep(page, /Metamagic/)
  await expectStep(page, 'Metamagic')
  await openOptionList(page, /^Metamagic/)
  await chooseButton(page, 'Quickened Spell').click()
  await chooseButton(page, 'Subtle Spell').click()

  // D331 in an Edit: the Sorcerer list marks what the Warlock's Fiend Patron always prepares.
  await goToStep(page, /Spells/)
  await page.getByRole('searchbox', { name: 'Search Sorcerer spells' }).fill('Suggestion')
  await expect(page.getByRole('region', { name: 'Add Spells' }).locator('.manage-spells__row', { hasText: 'Suggestion' }).locator('.manage-spells__note')).toHaveText(
    'Already prepared by Warlock',
  )

  await goToStep(page, /Review and save/)
  await expect(page.locator('.review__line')).toContainText('Warlock 6 / Sorcerer 3')
  await expect(page.getByRole('region', { name: 'Hit points' })).toContainText('6d8 + 3d6')
  await saveEdit(page, 'm9b-a')

  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const features = page.getByRole('tabpanel', { name: 'Features & Traits' })
  const invocations = features.locator('.sheet__feature-options').filter({ hasText: 'Agonizing Blast' })
  await expect(invocations).toContainText("Devil's Sight")
  await expect(invocations).not.toContainText('Mask of Many Faces')
  const metamagic = features.locator('.sheet__feature-options').filter({ hasText: 'Careful Spell' })
  await expect(metamagic).toContainText('Subtle Spell')
  await expect(metamagic).not.toContainText('Quickened Spell')

  const saved = await stored(page, 'm9b-a')
  expect(saved['classes']).toEqual(seed.classes)
  expect(saved['levelOrder']).toEqual(seed.levelOrder)
})

test('M9b b: Wizard 3 / Cleric 3 — the Cleric changes Life Domain to Light Domain; Light spells shown, Life gone, Wizard spells unchanged', async ({ page }) => {
  const seed = wizardCleric('m9b-b')
  await openSheet(page, seed)
  await editButton(page).click()
  await switchTo(page, 'Cleric')
  await openOptionList(page, /^Subclass/)
  await chooseButton(page, 'Light Domain').click()
  await expect(classTab(page, 'Cleric')).toHaveText('Cleric 3 (Light Domain)')
  await goToStep(page, /Spells/)
  await expectStep(page, 'Spells')
  await expect(page.getByRole('searchbox', { name: 'Search Cleric spells' })).toBeVisible()
  await fillSpells(page)
  await saveEdit(page, 'm9b-b')

  await expect(page.locator('.sheet__classes')).toHaveText('Wizard 3 (Bladesinger) / Cleric 3 (Light Domain)')
  await page.getByRole('tab', { name: 'Spells' }).click()
  const spells = page.getByRole('tabpanel', { name: 'Spells' })
  await expect(spells.locator('.sheet__action-subtitle', { hasText: /^Light Domain\b/ }).first()).toBeVisible()
  await expect(spells.locator('.sheet__spell-name', { hasText: /^Faerie Fire$/ }).first()).toBeVisible()
  await expect(spells.locator('.sheet__action-subtitle', { hasText: /^Life Domain\b/ })).toHaveCount(0)

  const saved = await stored(page, 'm9b-b')
  const wizard = (saved['spellChoices'] as { className: string }[]).find((entry) => entry.className === 'Wizard')
  expect(wizard).toEqual({ className: 'Wizard', classSource: XPHB, spells: refs(WIZARD_SPELLS) })
  expect(saved['levelOrder']).toEqual(seed.levelOrder)
})

test('M9b c: Fighter 4 / Rogue 1 — Strength and Dexterity below 13 show both prerequisite notes, and the save still works', async ({ page }) => {
  await openSheet(page, fighterRogue('m9b-c'))
  await editButton(page).click()
  await goToStep(page, /Ability scores/)
  await expectStep(page, 'Ability scores')
  const notes = page.locator('.ability-prerequisite-note')
  await expect(notes).toHaveCount(0)
  // Standard array swaps: STR 8 (+2 Soldier = 10), DEX 10 (+1 = 11).
  await select(page, 'Strength').selectOption({ label: '8' })
  await select(page, 'Dexterity').selectOption({ label: '10' })
  await expect(notes).toHaveText([
    'Below the multiclass prerequisite of Fighter (Strength 13 or Dexterity 13). Rules check this only when entering a class.',
    'Below the multiclass prerequisite of Rogue (Dexterity 13). Rules check this only when entering a class.',
  ])
  await saveEdit(page, 'm9b-c')
  await expect(page.locator('.ability-card[data-ability="strength"] .ability-card__score')).toHaveText('10')
  await expect(page.locator('.ability-card[data-ability="dexterity"] .ability-card__score')).toHaveText('11')
  await expect(page.locator('.sheet__classes')).toHaveText('Fighter 4 (Champion) / Rogue 1')
})

test('M9b d: a multiclass character without a level history — Edit disabled with the reason, the edit URL returns to the sheet', async ({ page }) => {
  await openSheet(page, fighterRogue('m9b-d', false))
  await expect(editButton(page)).toBeDisabled()
  await expect(editButton(page)).toHaveAttribute('title', 'Edit unavailable: Cannot tell which class each level came from (no level history).')
  await page.goto('/#/character/m9b-d/edit')
  await expect(page).toHaveURL(/#\/character\/m9b-d$/)
  await expect(editButton(page)).toBeVisible()
  await expect(page.locator('.char-create')).toHaveCount(0)
})

test('M9b e: an unfinished stashed Cleric blocks Save and is named on Review; finishing it enables Save', async ({ page }) => {
  await openSheet(page, wizardCleric('m9b-e'))
  await editButton(page).click()
  await switchTo(page, 'Cleric')
  await openOptionList(page, /^Subclass/)
  await chooseButton(page, 'Light Domain').click()
  // The class step's requirements for Light Domain have loaded.
  await expect(nextButton(page)).toBeEnabled()
  await classTab(page, 'Wizard').click()
  await expect(classTab(page, 'Wizard')).toHaveAttribute('aria-pressed', 'true')

  await goToStep(page, /Review and save/)
  await expectStep(page, 'Review and save')
  await expect(saveButton(page)).toBeDisabled()
  await expect(page.locator('.review__unfinished')).toHaveText(
    'Cleric has unfinished choices: choose 3 more cantrips, choose 6 more spells. Switch to Cleric in step Class to finish them.',
  )

  await switchTo(page, 'Cleric')
  await goToStep(page, /Spells/)
  await fillSpells(page)
  await goToStep(page, /Review and save/)
  await expect(page.locator('.review__unfinished')).toHaveCount(0)
  await expect(saveButton(page)).toBeEnabled()
})

test('M9b f: Fighter 4 / Rogue 1 — the Rogue multiclass skill changed on Proficiencies is saved', async ({ page }) => {
  await openSheet(page, fighterRogue('m9b-f'))
  await expect.poll(() => skillStatus(page, 'Stealth')).toBe('proficient')
  await editButton(page).click()
  await goToStep(page, /Proficiencies/)
  await expectStep(page, 'Proficiencies')
  const skill = select(page, 'Rogue multiclass skill:')
  await expect(skill).toHaveValue('stealth')
  await skill.selectOption('deception')
  await saveEdit(page, 'm9b-f')

  await expect.poll(() => skillStatus(page, 'Deception')).toBe('proficient')
  await expect.poll(() => skillStatus(page, 'Stealth')).toBe('none')
  const saved = await stored(page, 'm9b-f')
  expect(saved['multiclassPicks']).toEqual([{ className: 'Rogue', classSource: XPHB, kind: 'skill', name: 'deception' }])
})

test('M9b h: Cancel — switching classes alone leaves nothing to discard; a change in a stashed class asks first', async ({ page }) => {
  await openSheet(page, warlockSorcerer('m9b-h'))
  const dialog = page.getByRole('alertdialog', { name: 'Discard your changes?' })
  await editButton(page).click()
  await switchTo(page, 'Sorcerer')
  await switchTo(page, 'Warlock')
  await wizardNav(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page).toHaveURL(/#\/character\/m9b-h$/)
  await expect(dialog).toHaveCount(0)

  await editButton(page).click()
  await switchTo(page, 'Sorcerer')
  await goToStep(page, /Metamagic/)
  await openOptionList(page, /^Metamagic/)
  await chooseButton(page, 'Quickened Spell').click()
  await switchTo(page, 'Warlock')
  await wizardNav(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toBeVisible()
})

test('M9b g: single-class Edit still changes the class (the level stays fixed) and saves', async ({ page }) => {
  const fighter = build('m9b-g', [['Fighter', null, 1]], {
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
    classSkills: ['perception', 'history'],
    masteries: [{ name: 'Longsword' }, { name: 'Greatsword' }, { name: 'Handaxe' }],
    fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }],
  })
  await openSheet(page, fighter)
  await editButton(page).click()
  await expectStep(page, 'Class and level')
  await expect(switcher(page)).toHaveCount(0)
  await expect(select(page, 'Level')).toBeDisabled()
  await select(page, 'Class').selectOption('Rogue|XPHB')
  for (const skill of ['Acrobatics', 'Deception', 'Insight', 'Stealth']) await page.getByRole('checkbox', { name: skill, exact: true }).check()
  await openOptionList(page, /^Weapon masteries/)
  for (const weapon of ['Dagger', 'Shortsword']) await chooseButton(page, weapon).first().click()
  await nextButton(page).click()
  await nextButton(page).click()
  await nextButton(page).click()

  await expectStep(page, 'Expertise')
  for (const skill of ['Stealth', 'Deception']) await page.getByRole('checkbox', { name: new RegExp(`^${skill} `) }).check()
  await nextButton(page).click()
  await expectStep(page, 'Proficiencies')
  await select(page, "Thieves' Cant language:").selectOption({ index: 1 })
  await saveEdit(page, 'm9b-g')

  await expect(page.locator('.sheet__classes')).toHaveText('Rogue 1')
  await expect.poll(() => skillStatus(page, 'Stealth')).toBe('expertise')
})

/* F-11 (D334): fixes from the review of M8 to M9b. */
const SCORES = { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } }
const toolsCard = (page: Page): Locator => page.locator('section', { has: page.getByRole('heading', { name: 'Proficiencies' }) }).getByRole('listitem').filter({ hasText: 'TOOLS' })

test('F-11 a: Rogue 1 / Fighter 3 Battle Master with a Smith’s Tools pick — Edit, Save unchanged, the pick and the proficiency stay', async ({ page }) => {
  const seed = build('f11-a', [['Rogue', null, 1], ['Fighter', 'Battle Master', 3]], {
    abilityScores: SCORES,
    classSkills: ['acrobatics', 'deception', 'insight', 'stealth'],
    expertiseSkills: [{ name: 'stealth', level: 1 }, { name: 'acrobatics', level: 1 }],
    masteries: ['Dagger', 'Shortsword', 'Longsword', 'Greatsword', 'Handaxe'].map((name) => ({ name })),
    fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }],
    optionalFeatureChoices: [{ featureType: 'MV:B', choices: refs(['Parry', 'Precision Attack', 'Riposte']).map((pick) => ({ ...pick, level: 3 })) }],
    toolChoices: [{ grantedBy: 'battleMaster', name: "Smith's Tools" }],
    subclassSkills: [{ grantedBy: 'battleMaster', name: 'history' }],
    languages: [
      { name: 'Common', source: XPHB, grantedBy: 'automatic' },
      { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Giant', source: XPHB, grantedBy: 'thievesCant' },
    ],
  })
  await openSheet(page, seed)
  await expect(toolsCard(page)).toContainText("Smith's Tools")
  await editButton(page).click()
  await goToStep(page, /Proficiencies/)
  await expectStep(page, 'Proficiencies')
  await expect(select(page, 'Battle Master tool:')).toHaveValue("Smith's Tools")
  await saveEdit(page, 'f11-a')

  await expect(toolsCard(page)).toContainText("Smith's Tools")
  expect((await stored(page, 'f11-a'))['toolChoices']).toEqual([{ grantedBy: 'battleMaster', name: "Smith's Tools" }])
})

test('F-11 b: Fighter 3 / Rogue 1 with a style stored without a class (pre-58) — Edit saves unchanged, one style tagged with the Fighter', async ({ page }) => {
  const seed = build('f11-b', [['Fighter', 'Champion', 3], ['Rogue', null, 1]], {
    abilityScores: SCORES,
    classSkills: ['perception', 'history'],
    masteries: ['Longsword', 'Greatsword', 'Handaxe', 'Dagger', 'Shortsword'].map((name) => ({ name })),
    fightingStyles: [{ name: 'Defense' }],
    expertiseSkills: [{ name: 'perception' }, { name: 'athletics' }],
    multiclassPicks: [{ className: 'Rogue', classSource: XPHB, kind: 'skill', name: 'stealth' }],
    languages: [
      { name: 'Common', source: XPHB, grantedBy: 'automatic' },
      { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Giant', source: XPHB, grantedBy: 'thievesCant' },
    ],
  })
  await openSheet(page, seed)
  await editButton(page).click()
  await expectStep(page, 'Class and level')
  await expect(nextButton(page)).toBeEnabled()
  await saveEdit(page, 'f11-b')

  const styles = (await stored(page, 'f11-b'))['fightingStyles'] as { className?: string; name: string }[]
  expect(styles).toHaveLength(1)
  expect(styles[0]).toMatchObject({ className: 'Fighter', classSource: XPHB, name: 'Defense' })
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Features & Traits' }).getByText('Defense').first()).toBeVisible()
})

test('F-11 c: Fighter 4 / Rogue 1 — Expertise Stealth swapped to Athletics in Edit, then Remove level of Rogue takes Athletics expertise with it', async ({ page }) => {
  const seed: Record<string, unknown> & { id: string } = { ...fighterRogue('f11-c'), expertiseSkills: [{ name: 'perception', level: 5 }, { name: 'stealth', level: 5 }] }
  await openSheet(page, seed)
  await editButton(page).click()
  await goToStep(page, /Expertise/)
  await expectStep(page, 'Expertise')
  await page.getByRole('checkbox', { name: /^Stealth / }).uncheck()
  await page.getByRole('checkbox', { name: /^Athletics / }).check()
  await saveEdit(page, 'f11-c')
  expect((await stored(page, 'f11-c'))['expertiseSkills']).toEqual([{ name: 'perception', level: 5 }, { name: 'athletics', level: 5 }])

  await page.getByRole('button', { name: 'Remove level 5', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 5?' })
  await expect(dialog.locator('li', { hasText: 'Expertise: athletics' })).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)

  await expect(page.locator('.sheet__classes')).toHaveText('Fighter 4 (Champion)')
  expect(JSON.stringify((await stored(page, 'f11-c'))['expertiseSkills'] ?? [])).not.toContain('athletics')
})

test('F-11 d: Warlock 6 / Sorcerer 3 → 4 level up — the ASI / Feat step shows the Level 4 and Level 10 cards and Hit points the new level only', async ({ page }) => {
  const extras = (featAsiChoices: unknown[]) => ({
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    classSkills: ['arcana', 'deception'],
    spellChoices: [
      { className: 'Warlock', classSource: XPHB, spells: refs(WARLOCK_SPELLS) },
      { className: 'Sorcerer', classSource: XPHB, spells: refs(SORCERER_SPELLS) },
    ],
    optionalFeatureChoices: [
      { featureType: 'EI', choices: refs(INVOCATIONS) },
      { featureType: 'MM', choices: refs(['Careful Spell', 'Quickened Spell']) },
    ],
    featAsiChoices,
  })
  const asi = (level: number) => ({ level, kind: 'asi', increases: { charisma: 2 } })
  const level10Row = (target: Page) => target.getByRole('radiogroup', { name: 'Level 10 hit points method', exact: true })
  const cards = (target: Page) => target.getByRole('group', { name: /^Level \d+$/ })

  // The level up of Sorcerer 3 → 4 on its own: one card, one row.
  await openSheet(page, build('f11-d-up', [['Warlock', 'Fiend Patron', 6], ['Sorcerer', 'Wild Magic Sorcery', 3]], extras([asi(4)])))
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Sorcerer 3 → 4', exact: true }).click()
  await expectStep(page, 'Spells')
  await fillSpells(page)
  await nextButton(page).click()
  await expectStep(page, 'ASI / Feat')
  // The ASI step lists every ASI level the character has, as Edit does; only Hit points narrows to the new level.
  await expect(cards(page)).toHaveCount(2)
  await expect(page.getByRole('group', { name: 'Level 4', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Level 10', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Level 10 feat or ASI', exact: true }).selectOption('asi')
  await page.getByRole('combobox', { name: 'Level 10 +2 ability', exact: true }).selectOption('strength')
  await nextButton(page).click()
  await expectStep(page, 'Hit points')
  await expect(page.getByRole('cell', { name: 'Level 10 · Sorcerer' })).toBeVisible()
  await expect(page.locator('.hit-points-picker__table tbody tr')).toHaveCount(1)
  await level10Row(page).getByRole('radio', { name: 'Average (4)' }).check()
  await expect(level10Row(page).getByRole('radio', { name: 'Average (4)' })).toBeChecked()
})

test('F-11 d: the character that level up produces — Edit shows the same Level 10 card and row, plus Level 4 and every earlier Hit points row', async ({ page }) => {
  const seed = build('f11-d', [['Warlock', 'Fiend Patron', 6], ['Sorcerer', 'Wild Magic Sorcery', 4]], {
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    classSkills: ['arcana', 'deception'],
    spellChoices: [
      { className: 'Warlock', classSource: XPHB, spells: refs(WARLOCK_SPELLS) },
      { className: 'Sorcerer', classSource: XPHB, spells: refs(SORCERER_SPELLS) },
    ],
    optionalFeatureChoices: [
      { featureType: 'EI', choices: refs(INVOCATIONS) },
      { featureType: 'MM', choices: refs(['Careful Spell', 'Quickened Spell']) },
    ],
    featAsiChoices: [4, 10].map((level) => ({ level, kind: 'asi', increases: { charisma: 2 } })),
  })
  await openSheet(page, seed)
  await editButton(page).click()
  await goToStep(page, /ASI \/ Feat/)
  await expectStep(page, 'ASI / Feat')
  await expect(page.getByRole('group', { name: /^Level \d+$/ })).toHaveCount(2)
  await expect(page.getByRole('group', { name: 'Level 4', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Level 10', exact: true })).toBeVisible()
  await goToStep(page, /Hit points/)
  await expectStep(page, 'Hit points')
  await expect(page.getByRole('cell', { name: 'Level 4 · Warlock' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Level 7 · Sorcerer' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Level 10 · Sorcerer' })).toBeVisible()
  // Level 1 plus levels 2 to 10.
  await expect(page.locator('.hit-points-picker__table tbody tr')).toHaveCount(10)
  await expect(page.getByRole('radiogroup', { name: 'Level 10 hit points method', exact: true }).getByRole('radio', { name: 'Average (4)' })).toBeChecked()
})
