import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, wizardNav } from './wizard.ts'

/* F-20a/F-20b (D345): replacing one invocation, metamagic, maneuver, rune or Fighter style on a level up. Seeded at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
const ACOLYTE = { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" }
// Warlock 4: 3 cantrips, 5 prepared; Warlock 5: 6 prepared (classes.json).
const WARLOCK_SPELLS = ['Eldritch Blast', 'Minor Illusion', 'Prestidigitation', 'Hex', 'Armor of Agathys', 'Hold Person', 'Misty Step', 'Spider Climb', 'Counterspell']

function seeded(id: string, className: string, subclass: string, level: number, extra: Record<string, unknown>) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: level,
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: ACOLYTE,
    featAsiChoices: [{ level: 4, kind: 'asi', increases: { charisma: 2 } }],
    ...extra,
  }
}

/** Warlock 4 has 3 invocations, Warlock 5 has 5 (classes.json EI progression). */
function warlock(id: string, level: 4 | 5, invocations: string[], extra: Record<string, unknown> = {}) {
  return seeded(id, 'Warlock', 'Fiend Patron', level, {
    classSkills: ['arcana', 'deception'],
    spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(WARLOCK_SPELLS.slice(0, level === 4 ? 8 : 9)) }],
    optionalFeatureChoices: [{ featureType: 'EI', choices: refs(invocations) }],
    ...extra,
  })
}

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
  return (await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), STORAGE_KEY)).find((entry: Record<string, unknown>) => entry['id'] === id)
}

async function storedOptions(page: Page, id: string, featureType: string): Promise<{ choices: { name: string; level?: number }[]; spellChoices?: unknown[] }> {
  const options = (await stored(page, id))['optionalFeatureChoices'] as { featureType: string; choices: { name: string; level?: number }[] }[]
  return options.find((entry) => entry.featureType === featureType)!
}

const currentStep = (page: Page): Locator => page.locator('[aria-current="step"]')
const nextOf = (page: Page): Locator => wizardNav(page).getByRole('button', { name: 'Next', exact: true })
const replaceGroup = (page: Page): Locator => page.getByRole('group', { name: 'Replace one', exact: true })
const featureOptions = (page: Page): Locator => page.locator('.sheet__feature-options')

async function fillSpells(page: Page): Promise<void> {
  const addSpells = page.getByRole('region', { name: 'Add Spells' })
  for (const [label, button] of [
    ['Cantrips', /^Add /],
    ['Prepared', /^Prepare /],
  ] as const) {
    const counter = page.locator('.manage-spells__counter', { hasText: new RegExp(`^${label}:`) })
    if ((await counter.count()) === 0) continue
    for (;;) {
      const [, have, max] = (await counter.innerText()).match(/(\d+)\/(\d+)/)!.map(Number)
      if (have! >= max!) break
      await addSpells.getByRole('button', { name: button, disabled: false }).first().click()
      await expect(counter).toHaveText(new RegExp(`^${label}: ${have! + 1}/`))
    }
  }
}

async function openOptionList(page: Page, legend: string): Promise<void> {
  const toggle = page.getByRole('button', { name: new RegExp(`^${legend}`), expanded: false })
  if ((await toggle.count()) > 0) await toggle.click()
}

/** Opens Level up, takes `label` ("Warlock 4 → 5"), walks to the save; `options` runs on the class-options step. Returns the steps seen. */
async function levelUp(page: Page, label: string, level: number, options?: (page: Page) => Promise<void>, optionStep = /Eldritch Invocations|Metamagic/, onReview?: (page: Page) => Promise<void>): Promise<string[]> {
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: label, exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)
  const seen: string[] = []
  for (let i = 0; i < 12; i++) {
    const step = (await currentStep(page).textContent()) ?? ''
    seen.push(step)
    if (/Review and save/.test(step)) {
      await onReview?.(page)
      await wizardNav(page).getByRole('button', { name: `Save level ${level}` }).click()
      await expect(page).not.toHaveURL(/\/level-up/)
      return seen
    }
    if (/Spells/.test(step)) await fillSpells(page)
    if (optionStep.test(step)) await options?.(page)
    if (/Hit points/.test(step)) {
      await page.getByRole('radiogroup', { name: `Level ${level} hit points method`, exact: true }).getByRole('radio', { name: /^Average/ }).check()
    }
    await nextOf(page).click()
    await expect(currentStep(page)).not.toHaveText(step)
  }
  throw new Error(`Level up did not reach Review: ${seen.join(' / ')}`)
}

test('F-20a a, d: Warlock 4 → 5 replaces Agonizing Blast with Repelling Blast; Remove level 5 keeps Repelling Blast', async ({ page }) => {
  await openSheet(page, warlock('f20a-a', 4, ['Agonizing Blast', 'Armor of Shadows', "Devil's Sight"]))
  await levelUp(page, 'Warlock 4 → 5', 5, async (p) => {
    await replaceGroup(p).getByRole('button', { name: 'Replace Agonizing Blast', exact: true }).click()
    await expect(replaceGroup(p)).toContainText('Replacing Agonizing Blast')
    await openOptionList(p, 'Eldritch Invocations')
    await chooseButton(p, 'Repelling Blast').click()
    await chooseButton(p, 'Pact of the Blade').click()
    await expect(nextOf(p)).toBeDisabled()
    await chooseButton(p, 'Mask of Many Faces').click()
    await expect(nextOf(p)).toBeEnabled()
  })

  // EI progression: 5 invocations at Warlock 5.
  const invocations = await storedOptions(page, 'f20a-a', 'EI')
  expect(invocations.choices.map((choice) => choice.name).sort()).toEqual(['Armor of Shadows', "Devil's Sight", 'Mask of Many Faces', 'Pact of the Blade', 'Repelling Blast'])
  expect(invocations.choices.find((choice) => choice.name === 'Repelling Blast')!.level).toBeUndefined()
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const listed = featureOptions(page).filter({ hasText: 'Armor of Shadows' })
  await expect(listed).toContainText('Repelling Blast')
  await expect(listed).not.toContainText('Agonizing Blast')

  // d: the replacement took the creation pick's (absent) stamp, so it survives Remove level 5.
  await page.getByRole('button', { name: 'Remove level 5', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 5?' })
  await expect(dialog).toContainText('Mask of Many Faces')
  await expect(dialog).not.toContainText('Repelling Blast')
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect((await storedOptions(page, 'f20a-a', 'EI')).choices.map((choice) => choice.name).sort()).toEqual(['Armor of Shadows', "Devil's Sight", 'Repelling Blast'])
  await expect(featureOptions(page).filter({ hasText: 'Armor of Shadows' })).toContainText('Repelling Blast')
})

test('F-20a b: Pact of the Blade cannot be replaced while Thirsting Blade needs it', async ({ page }) => {
  await openSheet(page, warlock('f20a-b', 5, ['Pact of the Blade', 'Thirsting Blade', 'Agonizing Blast', 'Armor of Shadows', "Devil's Sight"]))
  await levelUp(page, 'Warlock 5 → 6', 6, async (p) => {
    const blade = replaceGroup(p).getByRole('listitem').filter({ hasText: 'Replace Pact of the Blade' })
    await expect(blade.getByRole('button')).toBeDisabled()
    await expect(blade).toContainText('Required by Thirsting Blade.')
    await expect(replaceGroup(p).getByRole('button', { name: 'Replace Thirsting Blade', exact: true })).toBeEnabled()
  })
})

test('F-20a c: replacing Pact of the Tome drops its spells', async ({ page }) => {
  const tome = { optionName: 'Pact of the Tome', cantrips: refs(['Guidance', 'Light', 'Sacred Flame']), spells: refs(['Detect Magic', 'Find Familiar']) }
  const held = refs(['Pact of the Tome', 'Agonizing Blast', 'Armor of Shadows', "Devil's Sight", 'Mask of Many Faces'])
  await openSheet(page, warlock('f20a-c', 5, [], { optionalFeatureChoices: [{ featureType: 'EI', choices: held, spellChoices: [tome] }] }))
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Spells' })).toContainText('Guidance')

  await levelUp(page, 'Warlock 5 → 6', 6, async (p) => {
    await replaceGroup(p).getByRole('button', { name: 'Replace Pact of the Tome', exact: true }).click()
    await openOptionList(p, 'Eldritch Invocations')
    await chooseButton(p, 'Pact of the Blade').click()
    await expect(nextOf(p)).toBeEnabled()
  })

  const invocations = await storedOptions(page, 'f20a-c', 'EI')
  expect(invocations.choices.map((choice) => choice.name)).toContain('Pact of the Blade')
  expect(invocations.choices.map((choice) => choice.name)).not.toContain('Pact of the Tome')
  expect(invocations.spellChoices).toBeUndefined()
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Spells' })).not.toContainText('Guidance')
})

test('F-20a e: Warlock 5 → 6 walks the invocations step with nothing to add; Next works without a swap', async ({ page }) => {
  const invocations = ['Agonizing Blast', 'Armor of Shadows', "Devil's Sight", 'Mask of Many Faces', 'Pact of the Blade']
  await openSheet(page, warlock('f20a-e', 5, invocations))
  const steps = await levelUp(page, 'Warlock 5 → 6', 6, async (p) => {
    await expect(replaceGroup(p)).toBeVisible()
    await expect(nextOf(p)).toBeEnabled()
  })
  expect(steps.some((step) => /Eldritch Invocations/.test(step))).toBe(true)
  expect((await storedOptions(page, 'f20a-e', 'EI')).choices.map((choice) => choice.name)).toEqual(invocations)
})

test('F-20a f: Sorcerer 4 → 5 replaces Careful Spell with Distant Spell', async ({ page }) => {
  // Sorcerer 4: 5 cantrips, 7 prepared (classes.json).
  await openSheet(
    page,
    seeded('f20a-f', 'Sorcerer', 'Wild Magic Sorcery', 4, {
      classSkills: ['arcana', 'deception'],
      spellChoices: [
        {
          className: 'Sorcerer',
          classSource: XPHB,
          spells: refs(['Fire Bolt', 'Light', 'Mage Hand', 'Ray of Frost', 'Prestidigitation', 'Burning Hands', 'Magic Missile', 'Shield', 'Chromatic Orb', 'Scorching Ray', 'Mirror Image', 'Misty Step']),
        },
      ],
      optionalFeatureChoices: [{ featureType: 'MM', choices: refs(['Careful Spell', 'Quickened Spell']) }],
    }),
  )
  await levelUp(page, 'Sorcerer 4 → 5', 5, async (p) => {
    await replaceGroup(p).getByRole('button', { name: 'Replace Careful Spell', exact: true }).click()
    await expect(nextOf(p)).toBeDisabled()
    await openOptionList(p, 'Metamagic')
    await chooseButton(p, 'Distant Spell').click()
    await expect(nextOf(p)).toBeEnabled()
  })
  expect((await storedOptions(page, 'f20a-f', 'MM')).choices.map((choice) => choice.name)).toEqual(['Quickened Spell', 'Distant Spell'])
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const metamagic = featureOptions(page).filter({ hasText: 'Quickened Spell' })
  await expect(metamagic).toContainText('Distant Spell')
  await expect(metamagic).not.toContainText('Careful Spell')
})

const CLASS_STEP = /Class and level/
const FIGHTER_MASTERIES = ['Longsword', 'Greatsword', 'Handaxe', 'Battleaxe']

/** Fighter 4 as the wizard saves it: ASI at 4, four masteries, one style. */
function fighter(id: string, subclass: string, extra: Record<string, unknown>) {
  return seeded(id, 'Fighter', subclass, 4, {
    createdAtLevel: 1,
    classSkills: ['athletics', 'perception'],
    masteries: FIGHTER_MASTERIES.map((name) => ({ name })),
    fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }],
    featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }],
    hitPointLevels: [2, 3, 4].map((level) => ({ level, kind: 'average', dieResult: 6 })),
    ...extra,
  })
}

const battleMaster = (id: string, extra: Record<string, unknown> = {}) =>
  fighter(id, 'Battle Master', {
    optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Trip Attack', source: XPHB }, { name: 'Riposte', source: XPHB }, { name: 'Parry', level: 3, source: XPHB }] }],
    toolChoices: [{ grantedBy: 'battleMaster', name: "Smith's Tools" }],
    subclassSkills: [{ grantedBy: 'battleMaster', name: 'history' }],
    ...extra,
  })

const names = (picks: { name: string }[]): string[] => picks.map((pick) => pick.name)

test('F-20b g, k: Battle Master 4 → 5 adds no maneuver yet replaces Parry; Remove level 5 keeps the new maneuver', async ({ page }) => {
  await openSheet(page, battleMaster('f20b-g'))
  await levelUp(
    page,
    'Fighter 4 → 5',
    5,
    async (p) => {
      // The Fighting Style has its own "Replace one" on the same step; the maneuver one is the group naming a maneuver.
      const maneuvers = replaceGroup(p).filter({ hasText: 'Parry' })
      await maneuvers.getByRole('button', { name: 'Replace Parry', exact: true }).click()
      await expect(maneuvers).toContainText('Replacing Parry')
      await expect(nextOf(p)).toBeDisabled()
      await openOptionList(p, 'Maneuvers')
      await chooseButton(p, 'Feinting Attack').first().click()
      await expect(nextOf(p)).toBeEnabled()
    },
    CLASS_STEP,
  )

  // Maneuvers stay at 3 (the count changes at 7); the replacement took Parry's level 3 stamp, not 5.
  const maneuvers = (await storedOptions(page, 'f20b-g', 'MV:B')).choices
  expect(names(maneuvers)).toEqual(['Trip Attack', 'Riposte', 'Feinting Attack'])
  expect(maneuvers.find((pick) => pick.name === 'Feinting Attack')!.level).toBe(3)
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const listed = featureOptions(page).filter({ hasText: 'Trip Attack' })
  await expect(listed).toContainText('Feinting Attack')
  await expect(listed).not.toContainText('Parry')

  await page.getByRole('button', { name: 'Remove level 5', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 5?' })
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(names((await storedOptions(page, 'f20b-g', 'MV:B')).choices)).toEqual(['Trip Attack', 'Riposte', 'Feinting Attack'])
  await expect(featureOptions(page).filter({ hasText: 'Trip Attack' })).toContainText('Feinting Attack')
})

test('F-20b h: Rune Knight 4 → 5 replaces Stone Rune with Fire Rune', async ({ page }) => {
  await openSheet(page, fighter('f20b-h', 'Rune Knight', { optionalFeatureChoices: [{ featureType: 'RN', choices: [{ name: 'Cloud Rune', source: 'TCE' }, { name: 'Stone Rune', source: 'TCE' }] }] }))
  await levelUp(
    page,
    'Fighter 4 → 5',
    5,
    async (p) => {
      await replaceGroup(p).getByRole('button', { name: 'Replace Stone Rune', exact: true }).click()
      await expect(nextOf(p)).toBeDisabled()
      await openOptionList(p, 'Runes')
      await chooseButton(p, 'Fire Rune').first().click()
      await expect(nextOf(p)).toBeEnabled()
    },
    CLASS_STEP,
  )

  expect(names((await storedOptions(page, 'f20b-h', 'RN')).choices)).toEqual(['Cloud Rune', 'Fire Rune'])
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  // Runes are listed as their own rows, not in a .sheet__feature-options line.
  await expect(page.getByRole('button', { name: 'Fire Rune', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cloud Rune', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stone Rune', exact: true })).toHaveCount(0)
})

test('F-20b i: Fighter 4 replaces Archery with Defense — AC gains Defense, the bow loses Archery', async ({ page }) => {
  const gear = [
    { name: 'Longbow', source: XPHB, quantity: 1, equipped: 'held' },
    { name: 'Chain Mail', source: XPHB, quantity: 1, equipped: 'worn' },
  ]
  await openSheet(page, fighter('f20b-i', 'Champion', { fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Archery', source: XPHB }], inventory: gear }))
  await levelUp(
    page,
    'Fighter 4 → 5',
    5,
    async (p) => {
      await replaceGroup(p).getByRole('button', { name: 'Replace Archery', exact: true }).click()
      await expect(nextOf(p)).toBeDisabled()
      await openOptionList(p, 'Fighting style')
      await chooseButton(p, 'Defense').click()
      await expect(nextOf(p)).toBeEnabled()
    },
    CLASS_STEP,
  )

  expect((await stored(page, 'f20b-i'))['fightingStyles']).toEqual([{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }])
  await page.getByRole('button', { name: 'Armour Class breakdown', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Defense (Fighting Style): +1')
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Actions' }).click()
  await page.getByRole('button', { name: 'Longbow breakdown', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toContainText('Archery')
})

/* RV-1 (D390): the level-up Review lists what a swap took away. */
const whatsNew = (page: Page): Locator => page.getByRole('region', { name: /What.s new/ })

test('RV-1 a: Warlock swap — Review shows Options added and Options removed', async ({ page }) => {
  await openSheet(page, warlock('rv1-a', 4, ['Agonizing Blast', 'Armor of Shadows', "Devil's Sight"]))
  await levelUp(
    page,
    'Warlock 4 → 5',
    5,
    async (p) => {
      await replaceGroup(p).getByRole('button', { name: 'Replace Agonizing Blast', exact: true }).click()
      await openOptionList(p, 'Eldritch Invocations')
      await chooseButton(p, 'Repelling Blast').click()
      await chooseButton(p, 'Pact of the Blade').click()
      await chooseButton(p, 'Mask of Many Faces').click()
    },
    undefined,
    async (p) => {
      await expect(whatsNew(p)).toContainText(/Options added\s*:?\s*Mask of Many Faces, Pact of the Blade, Repelling Blast/)
      await expect(whatsNew(p)).toContainText(/Options removed\s*:?\s*Agonizing Blast/)
    },
  )
})

test('RV-1 b: no swap — no Options removed row', async ({ page }) => {
  await openSheet(page, warlock('rv1-b', 5, ['Agonizing Blast', 'Armor of Shadows', "Devil's Sight", 'Mask of Many Faces', 'Repelling Blast']))
  await levelUp(page, 'Warlock 5 → 6', 6, undefined, undefined, async (p) => {
    await expect(whatsNew(p)).toBeVisible()
    await expect(whatsNew(p)).not.toContainText('Options removed')
  })
})

test('RV-1 c: Battle Master swaps a maneuver and the Fighting Style — one row names both', async ({ page }) => {
  await openSheet(page, battleMaster('rv1-c'))
  await levelUp(
    page,
    'Fighter 4 → 5',
    5,
    async (p) => {
      await replaceGroup(p).filter({ hasText: 'Parry' }).getByRole('button', { name: 'Replace Parry', exact: true }).click()
      await openOptionList(p, 'Maneuvers')
      await chooseButton(p, 'Feinting Attack').first().click()
      await replaceGroup(p).filter({ hasText: 'Defense' }).getByRole('button', { name: 'Replace Defense', exact: true }).click()
      await openOptionList(p, 'Fighting style')
      await chooseButton(p, 'Archery').click()
      await expect(nextOf(p)).toBeEnabled()
    },
    CLASS_STEP,
    async (p) => {
      await expect(whatsNew(p)).toContainText(/Options removed\s*:?\s*Defense, Parry/)
      await expect(whatsNew(p)).toContainText(/Options added\s*:?\s*Archery, Feinting Attack/)
    },
  )
})

test('RV-1 d: Keep before Review — no Options removed row', async ({ page }) => {
  await openSheet(page, warlock('rv1-d', 5, ['Agonizing Blast', 'Armor of Shadows', "Devil's Sight", 'Mask of Many Faces', 'Repelling Blast']))
  await levelUp(
    page,
    'Warlock 5 → 6',
    6,
    async (p) => {
      await replaceGroup(p).getByRole('button', { name: 'Replace Agonizing Blast', exact: true }).click()
      await replaceGroup(p).getByRole('button', { name: 'Keep Agonizing Blast', exact: true }).click()
      await expect(nextOf(p)).toBeEnabled()
    },
    undefined,
    async (p) => {
      await expect(whatsNew(p)).not.toContainText('Options removed')
    },
  )
})

/* F-22 (D347): Remove level also removes what lost its prerequisite; D348: Pact of the Chain takes its familiar along. */
const removeLevel = async (page: Page, level: number, expected: { listed: string[]; unlisted?: string[] }): Promise<void> => {
  await page.getByRole('button', { name: `Remove level ${level}`, exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: `Remove level ${level}?` })
  for (const line of expected.listed) await expect(dialog.locator('li', { hasText: line })).toHaveCount(1)
  for (const text of expected.unlisted ?? []) await expect(dialog).not.toContainText(text)
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

const swapToThirstingBlade = (order: string[]) => async (p: Page) => {
  await replaceGroup(p).getByRole('button', { name: 'Replace Agonizing Blast', exact: true }).click()
  await openOptionList(p, 'Eldritch Invocations')
  for (const name of order) await chooseButton(p, name).click()
  await expect(nextOf(p)).toBeEnabled()
}

test('F-22 1a: Warlock 4 → 5 swaps into Thirsting Blade before the new picks; Remove level 5 lists and removes it', async ({ page }) => {
  await openSheet(page, warlock('f22-1a', 4, ['Pact of the Blade', 'Agonizing Blast', 'Armor of Shadows']))
  await levelUp(page, 'Warlock 4 → 5', 5, swapToThirstingBlade(['Thirsting Blade', "Devil's Sight", 'Mask of Many Faces']))
  const after = (await storedOptions(page, 'f22-1a', 'EI')).choices
  // The replacement clicked first inherits Agonizing Blast's (absent) creation stamp.
  expect(after.find((choice) => choice.name === 'Thirsting Blade')!.level).toBeUndefined()

  await removeLevel(page, 5, { listed: ["EI option: Devil's Sight", 'EI option: Mask of Many Faces', 'EI option: Thirsting Blade (prerequisite no longer met)'] })
  expect(names((await storedOptions(page, 'f22-1a', 'EI')).choices)).toEqual(['Pact of the Blade', 'Armor of Shadows'])
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await expect(featureOptions(page).filter({ hasText: 'Armor of Shadows' })).not.toContainText('Thirsting Blade')
})

test('F-22 1b: the other click order — Thirsting Blade carries the level 5 stamp and Remove level 5 cascades nothing', async ({ page }) => {
  await openSheet(page, warlock('f22-1b', 4, ['Pact of the Blade', 'Agonizing Blast', 'Armor of Shadows']))
  await levelUp(page, 'Warlock 4 → 5', 5, swapToThirstingBlade(["Devil's Sight", 'Thirsting Blade', 'Mask of Many Faces']))
  expect((await storedOptions(page, 'f22-1b', 'EI')).choices.find((choice) => choice.name === 'Thirsting Blade')!.level).toBe(5)

  await removeLevel(page, 5, { listed: ['EI option: Thirsting Blade', 'EI option: Mask of Many Faces'], unlisted: ['prerequisite no longer met', "Devil's Sight"] })
  expect(names((await storedOptions(page, 'f22-1b', 'EI')).choices)).toEqual(['Pact of the Blade', 'Armor of Shadows', "Devil's Sight"])
})

const IMP = { name: 'Imp', source: 'XMM' }
const CHAIN_INVOCATIONS = ['Pact of the Chain', 'Agonizing Blast', 'Armor of Shadows', "Devil's Sight", 'Mask of Many Faces']

test('F-22 2a (D348): swapping out Pact of the Chain on Warlock 5 → 6 removes the Imp familiar', async ({ page }) => {
  await openSheet(page, warlock('f22-2a', 5, CHAIN_INVOCATIONS, { familiar: IMP }))
  await levelUp(page, 'Warlock 5 → 6', 6, async (p) => {
    await replaceGroup(p).getByRole('button', { name: 'Replace Pact of the Chain', exact: true }).click()
    await openOptionList(p, 'Eldritch Invocations')
    await chooseButton(p, 'Pact of the Blade').click()
    await expect(nextOf(p)).toBeEnabled()
  })
  const saved = await stored(page, 'f22-2a')
  expect(names((saved['optionalFeatureChoices'] as { choices: { name: string }[] }[])[0]!.choices)).not.toContain('Pact of the Chain')
  expect(saved['familiar']).toBeUndefined()
})

test('F-22 2b (D348): Keep after Replace Pact of the Chain keeps the familiar', async ({ page }) => {
  await openSheet(page, warlock('f22-2b', 5, CHAIN_INVOCATIONS, { familiar: IMP }))
  await levelUp(page, 'Warlock 5 → 6', 6, async (p) => {
    await replaceGroup(p).getByRole('button', { name: 'Replace Pact of the Chain', exact: true }).click()
    await replaceGroup(p).getByRole('button', { name: 'Keep Pact of the Chain', exact: true }).click()
    await expect(nextOf(p)).toBeEnabled()
  })
  const saved = await stored(page, 'f22-2b')
  expect(saved['familiar']).toEqual(IMP)
  expect(names((saved['optionalFeatureChoices'] as { choices: { name: string }[] }[])[0]!.choices)).toContain('Pact of the Chain')
})

test('F-22 2c (D348): Remove level that drops Pact of the Chain lists and removes the familiar', async ({ page }) => {
  const choices = [...refs(['Agonizing Blast', 'Armor of Shadows', "Devil's Sight"]), { name: 'Pact of the Chain', source: XPHB, level: 5 }, { name: 'Mask of Many Faces', source: XPHB, level: 5 }]
  await openSheet(page, warlock('f22-2c', 5, [], { createdAtLevel: 4, optionalFeatureChoices: [{ featureType: 'EI', choices }], familiar: IMP }))
  await removeLevel(page, 5, { listed: ['EI option: Pact of the Chain', 'Familiar: Imp'] })
  expect((await stored(page, 'f22-2c'))['familiar']).toBeUndefined()
})

test('F-23 (D351): Remove level that drops Pact of the Tome by its stamp lists and removes its spells', async ({ page }) => {
  const tome = { optionName: 'Pact of the Tome', cantrips: refs(['Guidance', 'Light', 'Sacred Flame']), spells: refs(['Detect Magic', 'Find Familiar']) }
  const choices = [...refs(['Agonizing Blast', 'Armor of Shadows', "Devil's Sight"]), { name: 'Pact of the Tome', source: XPHB, level: 5 }, { name: 'Mask of Many Faces', source: XPHB, level: 5 }]
  await openSheet(page, warlock('f23', 5, [], { createdAtLevel: 4, optionalFeatureChoices: [{ featureType: 'EI', choices, spellChoices: [tome] }] }))
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Spells' })).toContainText('Guidance')

  const tomeLines = ['Guidance', 'Light', 'Sacred Flame', 'Detect Magic', 'Find Familiar'].map((spell) => `Pact of the Tome spell: ${spell}`)
  await removeLevel(page, 5,{ listed: ['EI option: Pact of the Tome', ...tomeLines] })
  const after = await storedOptions(page, 'f23', 'EI')
  expect(names(after.choices)).toEqual(['Agonizing Blast', 'Armor of Shadows', "Devil's Sight"])
  expect(after.spellChoices).toBeUndefined()
  await page.getByRole('tab', { name: 'Spells' }).click()
  const spells = page.getByRole('tabpanel', { name: 'Spells' })
  for (const spell of ['Guidance', 'Sacred Flame', 'Detect Magic', 'Find Familiar']) await expect(spells).not.toContainText(spell)
})

test('F-24 (D352): Remove level that drops Pact of the Tome by its stamp ends concentration on a Tome spell', async ({ page }) => {
  const tome = { optionName: 'Pact of the Tome', cantrips: refs(['Guidance', 'Light', 'Sacred Flame']), spells: refs(['Detect Magic', 'Find Familiar']) }
  const choices = [...refs(['Agonizing Blast', 'Armor of Shadows', "Devil's Sight"]), { name: 'Pact of the Tome', source: XPHB, level: 5 }, { name: 'Mask of Many Faces', source: XPHB, level: 5 }]
  const concentrationCard = page.locator('.sheet__status-row .sheet__concentration')
  await openSheet(page, warlock('f24', 5, [], { createdAtLevel: 4, optionalFeatureChoices: [{ featureType: 'EI', choices, spellChoices: [tome] }], play: { concentratingOn: { name: 'Detect Magic', source: XPHB } } }))
  await expect(concentrationCard).toContainText('Detect Magic')

  await removeLevel(page, 5, { listed: ['Pact of the Tome spell: Detect Magic', 'Concentration: Detect Magic'] })
  await expect(concentrationCard).not.toContainText('Detect Magic')
  expect((await stored(page, 'f24'))['play']).toBeUndefined()
})

test('F-22 7: Keep after Replace Pact of the Tome restores its spells', async ({ page }) => {
  const tome = { optionName: 'Pact of the Tome', cantrips: refs(['Guidance', 'Light', 'Sacred Flame']), spells: refs(['Detect Magic', 'Find Familiar']) }
  const held = refs(['Pact of the Tome', 'Agonizing Blast', 'Armor of Shadows', "Devil's Sight", 'Mask of Many Faces'])
  await openSheet(page, warlock('f22-7', 5, [], { optionalFeatureChoices: [{ featureType: 'EI', choices: held, spellChoices: [tome] }] }))
  await levelUp(page, 'Warlock 5 → 6', 6, async (p) => {
    await replaceGroup(p).getByRole('button', { name: 'Replace Pact of the Tome', exact: true }).click()
    await replaceGroup(p).getByRole('button', { name: 'Keep Pact of the Tome', exact: true }).click()
    await expect(nextOf(p)).toBeEnabled()
  })
  expect((await storedOptions(page, 'f22-7', 'EI')).spellChoices).toEqual([tome])
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Spells' })).toContainText('Guidance')
})

test('F-22 6 (D346 rule 3): a Fighter whose style was saved untagged (before schema 58) is not offered to replace it', async ({ page }) => {
  const untagged = [{ name: 'Archery', source: XPHB }]
  await openSheet(page, fighter('f22-6', 'Champion', { fightingStyles: untagged }))
  const steps = await levelUp(
    page,
    'Fighter 4 → 5',
    5,
    async (p) => {
      await expect(p.getByRole('button', { name: 'Replace Archery', exact: true })).toHaveCount(0)
    },
    CLASS_STEP,
  )
  // Fighter 5 adds nothing to the class step, so with no swappable style it is not walked at all.
  expect(steps.some((step) => CLASS_STEP.test(step))).toBe(false)
  // The save tags the adopted style as the Fighter's (D318/D334); it is kept, not replaced.
  expect(names((await stored(page, 'f22-6'))['fightingStyles'] as { name: string }[])).toEqual(['Archery'])
})

test('F-20b j: levelling the Fighter of a Fighter/Paladin offers only the Fighter style', async ({ page }) => {
  await openSheet(
    page,
    fighter('f20b-j', 'Champion', {
      classes: [
        { className: 'Fighter', classSource: XPHB, subclass: 'Champion', level: 4 },
        { className: 'Paladin', classSource: XPHB, subclass: null, level: 2 },
      ],
      levelOrder: [...Array.from({ length: 4 }, () => ({ className: 'Fighter', classSource: XPHB })), ...Array.from({ length: 2 }, () => ({ className: 'Paladin', classSource: XPHB }))],
      abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 8, constitution: 13, intelligence: 10, wisdom: 12, charisma: 14 } },
      fightingStyles: [
        { className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB },
        { className: 'Paladin', classSource: XPHB, name: 'Dueling', source: XPHB },
      ],
      hitPointLevels: [2, 3, 4, 5, 6].map((level) => ({ level, kind: 'average', dieResult: 6 })),
    }),
  )
  await levelUp(
    page,
    'Fighter 4 → 5',
    7,
    async (p) => {
      await expect(replaceGroup(p).getByRole('button', { name: 'Replace Defense', exact: true })).toBeVisible()
      await expect(replaceGroup(p).getByRole('button')).toHaveCount(1)
      await expect(replaceGroup(p)).not.toContainText('Dueling')
    },
    CLASS_STEP,
  )
  const styles = (await stored(page, 'f20b-j'))['fightingStyles'] as { className: string; name: string }[]
  expect(styles.map((style) => `${style.className}:${style.name}`).sort()).toEqual(['Fighter:Defense', 'Paladin:Dueling'])
})
