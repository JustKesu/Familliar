import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, next, wizardNav } from './wizard.ts'

/* F-19 (D344): Kensei weapons (Monk 3/6/11/17) and Samurai's Elegant Courtier save (Fighter 7). Seeded at schema 61. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const ACOLYTE = { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" }

function seeded(id: string, className: string, subclass: string | null, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 61,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass, level }],
    levelOrder: Array.from({ length: level }, () => ({ className, classSource: XPHB })),
    createdAtLevel: 1,
    // STR 10 (+0), DEX 16 (+3), WIS 12 (+1), CHA 8 (-1).
    abilityScores: { method: 'roll', scores: { strength: 10, dexterity: 16, constitution: 13, intelligence: 10, wisdom: 12, charisma: 8 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: ACOLYTE,
    ...extra,
  }
}

function monk(id: string, subclass: string | null, level: number, extra: Record<string, unknown> = {}) {
  return seeded(id, 'Monk', subclass, level, {
    classSkills: ['acrobatics', 'stealth'],
    toolChoices: [{ grantedBy: 'monk', name: "Smith's Tools" }, ...(subclass ? [{ grantedBy: 'kensei', name: "Painter's Supplies" }] : [])],
    ...(level >= 4 ? { featAsiChoices: [{ level: 4, kind: 'asi', increases: { wisdom: 2 } }] } : {}),
    ...extra,
  })
}

const LEVEL_3_PICKS = [
  { name: 'Longsword', level: 3 },
  { name: 'Longbow', level: 3 },
]

function samurai(id: string, resilient: boolean, extra: Record<string, unknown> = {}) {
  return seeded(id, 'Fighter', 'Samurai', 6, {
    classSkills: ['athletics', 'perception'],
    masteries: ['Longsword', 'Greatsword', 'Handaxe', 'Battleaxe'].map((name) => ({ name })),
    fightingStyles: [{ name: 'Defense', source: XPHB, className: 'Fighter', classSource: XPHB }],
    subclassSkills: [{ grantedBy: 'samurai', name: 'persuasion' }],
    featAsiChoices: [
      resilient ? { level: 4, kind: 'feat', name: 'Resilient', source: XPHB, chosenAbility: 'wisdom' } : { level: 4, kind: 'asi', increases: { strength: 2 } },
      { level: 6, kind: 'asi', increases: { strength: 2 } },
    ],
    ...extra,
  })
}

async function openSheet(page: Page, characters: { id: string }[]): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify(characters) },
  )
  await page.goto(`/#/character/${characters[0]!.id}`)
}

async function storedAll(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), STORAGE_KEY)
}

async function stored(page: Page, id: string): Promise<Record<string, unknown>> {
  return (await storedAll(page)).find((entry) => entry['id'] === id)!
}

const currentStep = (page: Page): Locator => page.locator('[aria-current="step"]')
const proficiencies = (page: Page): Locator => page.locator('.sheet__proficiencies')
const kenseiSelect = (page: Page, label: RegExp): Locator => page.getByRole('combobox', { name: label })
const save = (page: Page, ability: string): Locator => page.getByRole('button', { name: `Roll ${ability} saving throw` })
const courtierGroup = (page: Page): Locator => page.getByRole('group', { name: /^Elegant Courtier/ })

async function saveBreakdown(page: Page, ability: string): Promise<Locator> {
  await page.getByRole('button', { name: `${ability} saving throw breakdown`, exact: true }).click()
  return page.getByRole('dialog', { name: `${ability} saving throw`, exact: true })
}

/** Opens Level up, takes `label` ("Monk 2 → 3"), and walks the steps to the save; returns the steps it saw. */
async function levelUp(page: Page, label: string, level: number, on: { classStep?: (page: Page) => Promise<void>; proficiencies?: (page: Page) => Promise<void> }): Promise<string[]> {
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: label, exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)
  const seen: string[] = []
  for (let i = 0; i < 12; i++) {
    const step = (await currentStep(page).textContent()) ?? ''
    seen.push(step)
    if (/Review and save/.test(step)) {
      await wizardNav(page).getByRole('button', { name: `Save level ${level}` }).click()
      await expect(page).not.toHaveURL(/\/level-up/)
      return seen
    }
    if (/Class/.test(step)) await on.classStep?.(page)
    if (/Proficiencies/.test(step)) await on.proficiencies?.(page)
    if (/Hit points/.test(step)) {
      await page.getByRole('radiogroup', { name: `Level ${level} hit points method`, exact: true }).getByRole('radio', { name: /^Average/ }).check()
    }
    await next(page)
    await expect(currentStep(page)).not.toHaveText(step)
  }
  throw new Error(`Level up did not reach Review: ${seen.join(' / ')}`)
}

test('F-19 a, b: Monk 2 → 3 Way of the Kensei, Longsword and Longbow — proficient, pending row gone, Longsword attacks with DEX', async ({ page }) => {
  const longsword = { name: 'Longsword', source: XPHB, quantity: 1, equipped: 'held' }
  await openSheet(page, [monk('f19-a', null, 2, { inventory: [longsword] })])
  await page.getByRole('tab', { name: 'Actions' }).click()
  // Not a Monk weapon, not proficient: STR +0, no proficiency bonus.
  await expect(page.getByRole('button', { name: 'Roll Longsword to hit' })).toHaveText('+0')

  const steps = await levelUp(page, 'Monk 2 → 3', 3, {
    classStep: async (p) => chooseButton(p, 'Way of the Kensei', 'XGE').click(),
    proficiencies: async (p) => {
      const melee = kenseiSelect(p, /^Kensei melee weapon \(Monk 3\)/)
      const ranged = kenseiSelect(p, /^Kensei ranged weapon \(Monk 3\)/)
      // b: Heavy weapons are not offered; the Longbow is, despite Heavy, by the feature's own text.
      await expect(melee.locator('option', { hasText: /^Greatsword$/ })).toHaveCount(0)
      await expect(ranged.locator('option', { hasText: /^Heavy Crossbow$/ })).toHaveCount(0)
      await expect(ranged.locator('option', { hasText: /^Longbow$/ })).toHaveCount(1)
      await expect(melee.locator('option', { hasText: /^Longbow$/ })).toHaveCount(0)
      await expect(nextOf(p)).toBeDisabled()
      await p.getByRole('combobox', { name: /^Way of the Kensei tool/ }).selectOption("Painter's Supplies")
      await melee.selectOption('Longsword')
      await expect(nextOf(p)).toBeDisabled()
      await ranged.selectOption('Longbow')
      await expect(nextOf(p)).toBeEnabled()
    },
  })
  expect(steps.some((step) => /Proficiencies/.test(step))).toBe(true)

  expect((await stored(page, 'f19-a'))['kenseiWeapons']).toEqual(LEVEL_3_PICKS)
  await expect(proficiencies(page)).toContainText('Longsword')
  await expect(proficiencies(page)).toContainText('Longbow')
  await expect(proficiencies(page)).not.toContainText('Kensei weapons — not chosen')

  await page.getByRole('tab', { name: 'Actions' }).click()
  // DEX +3 and PB +2; Longsword's 1d8 beats the Monk 3 Martial Arts d6.
  await expect(page.getByRole('button', { name: 'Roll Longsword to hit' })).toHaveText('+5')
  await expect(page.getByRole('button', { name: 'Roll Longsword damage' })).toContainText('1d8 + 3')
  await page.getByRole('button', { name: 'Longsword breakdown', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Longsword' })).toContainText('Martial Arts')
})

const nextOf = (page: Page): Locator => wizardNav(page).getByRole('button', { name: 'Next', exact: true })

test('F-19 c: Monk 5 Kensei → 6 offers one more weapon; the Whip rolls the Martial Arts d8', async ({ page }) => {
  const whip = { name: 'Whip', source: XPHB, quantity: 1, equipped: 'held' }
  await openSheet(page, [monk('f19-c', 'Way of the Kensei', 5, { kenseiWeapons: LEVEL_3_PICKS, inventory: [whip] })])
  await levelUp(page, 'Monk 5 → 6', 6, {
    proficiencies: async (p) => {
      await expect(kenseiSelect(p, /^Kensei melee weapon/)).toHaveCount(0)
      await kenseiSelect(p, /^Kensei weapon \(Monk 6\)/).selectOption('Whip')
    },
  })
  expect((await stored(page, 'f19-c'))['kenseiWeapons']).toEqual([...LEVEL_3_PICKS, { name: 'Whip', level: 6 }])
  await expect(proficiencies(page)).toContainText('Whip')
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(page.getByRole('button', { name: 'Roll Whip damage' })).toContainText('1d8 + 3')
})

test('F-19 d: Remove level from Monk 6 drops the level-6 weapon and keeps the level-3 ones', async ({ page }) => {
  await openSheet(page, [monk('f19-d', 'Way of the Kensei', 6, { kenseiWeapons: [...LEVEL_3_PICKS, { name: 'Whip', level: 6 }] })])
  await expect(proficiencies(page)).toContainText('Whip')
  await page.getByRole('button', { name: 'Remove level 6', exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Remove level 6?' })
  await expect(dialog.locator('li', { hasText: 'Kensei weapon: Whip' })).toHaveCount(1)
  await expect(dialog.locator('li', { hasText: 'Kensei weapon: Longsword' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect((await stored(page, 'f19-d'))['kenseiWeapons']).toEqual(LEVEL_3_PICKS)
  await expect(proficiencies(page)).not.toContainText('Whip')
  await expect(proficiencies(page)).toContainText('Longbow')
})

test('F-19 e: Fighter 6 Samurai → 7 — Wisdom save proficient from Elegant Courtier, no choice shown', async ({ page }) => {
  await openSheet(page, [samurai('f19-e', false)])
  await expect(save(page, 'Wisdom')).toHaveText('+1')
  await levelUp(page, 'Fighter 6 → 7', 7, {
    proficiencies: async (p) => {
      await expect(nextOf(p)).toBeEnabled()
      await expect(courtierGroup(p)).toHaveCount(0)
    },
  })
  expect((await stored(page, 'f19-e'))['elegantCourtierSave']).toBeUndefined()
  // WIS +1, PB +3.
  await expect(save(page, 'Wisdom')).toHaveText('+4')
  await expect(await saveBreakdown(page, 'Wisdom')).toContainText('Elegant Courtier')
})

test('F-19 f: Fighter 6 Samurai with Resilient (Wisdom) → 7 — Intelligence or Charisma offered, Charisma becomes proficient', async ({ page }) => {
  await openSheet(page, [samurai('f19-f', true)])
  await expect(save(page, 'Charisma')).toHaveText('-1')
  await levelUp(page, 'Fighter 6 → 7', 7, {
    proficiencies: async (p) => {
      await expect(courtierGroup(p)).toBeVisible()
      await expect(nextOf(p)).toBeDisabled()
      await courtierGroup(p).getByRole('radio', { name: 'Charisma' }).check()
      await expect(nextOf(p)).toBeEnabled()
    },
  })
  expect((await stored(page, 'f19-f'))['elegantCourtierSave']).toBe('charisma')
  // CHA -1, PB +3.
  await expect(save(page, 'Charisma')).toHaveText('+2')
  await expect(await saveBreakdown(page, 'Charisma')).toContainText('Elegant Courtier')
})

test('F-19 g: Export then Import keeps the Kensei weapons and the Elegant Courtier save', async ({ page }) => {
  const kensei = monk('f19-g-monk', 'Way of the Kensei', 6, { kenseiWeapons: [...LEVEL_3_PICKS, { name: 'Whip', level: 6 }] })
  const courtier = { ...samurai('f19-g-fighter', true), classes: [{ className: 'Fighter', classSource: XPHB, subclass: 'Samurai', level: 7 }], levelOrder: Array.from({ length: 7 }, () => ({ className: 'Fighter', classSource: XPHB })), elegantCourtierSave: 'charisma' }
  await openSheet(page, [kensei, courtier])
  for (const [id, field] of [
    ['f19-g-monk', 'kenseiWeapons'],
    ['f19-g-fighter', 'elegantCourtierSave'],
  ] as const) {
    const original = await stored(page, id)
    await page.goto('/#/')
    await page.getByRole('button', { name: `More actions for ${id}`, exact: true }).click()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const file = await download
    await page.locator('input[type="file"]').setInputFiles((await file.path()) as string)
    await expect(page.locator('.char-card__name', { hasText: id })).toHaveCount(2)
    const copy = (await storedAll(page)).find((entry) => entry['name'] === id && entry['id'] !== id)!
    expect(copy[field]).toEqual(original[field])
  }
})
