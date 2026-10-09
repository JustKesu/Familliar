import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, createFighter, expectStep, next, nextButton, select, stepBar, wizardNav } from './wizard.ts'

/*
 * M11a: three multiclass builds from level 1 through the real UI — Level up, "+ New class…", Edit, Remove level.
 * Only the level 1 Warlock and Cleric are seeded (schema 60), as the wizard saves them. Expected values: docs/REPORT.md.
 */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const ABILITIES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function level1(id: string, className: string, scores: Record<string, number>, extra: Record<string, unknown>) {
  return {
    schemaVersion: 60,
    id,
    name: id,
    classes: [{ className, classSource: XPHB, subclass: null, level: 1 }],
    levelOrder: [{ className, classSource: XPHB }],
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores },
    species: { name: 'Dwarf', source: XPHB },
    background: { name: 'Soldier', source: XPHB, skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
    abilityBonus: { strength: 2, dexterity: 1 },
    languages: [
      { name: 'Common', source: XPHB, grantedBy: 'automatic' },
      { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
    ],
    ...extra,
  }
}

type Stored = Record<string, unknown>

async function openSheet(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

async function storedAll(page: Page): Promise<Stored[]> {
  return JSON.parse((await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)) ?? '[]') as Stored[]
}

async function stored(page: Page, id: string): Promise<Stored> {
  return (await storedAll(page)).find((entry) => entry['id'] === id)!
}

const order = (entries: string[]) => entries.map((className) => ({ className, classSource: XPHB }))
const classes = (page: Page): Locator => page.locator('.sheet__classes')
const levelUpButton = (page: Page): Locator => page.locator('.sheet__level-up')
const classWindow = (page: Page): Locator => page.getByRole('dialog', { name: 'Level up which class?' })
const saveRow = (page: Page, ability: string): Locator =>
  page.locator('.sheet__saving-throws .sheet__row').filter({ has: page.getByRole('button', { name: `${ability} saving throw breakdown`, exact: true }) })
const skillStatus = (page: Page, skill: string) => page.locator('.sheet__skills .sheet__row', { hasText: skill }).locator('.sheet__prof-mark').getAttribute('data-status')
const spellsPanel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const actionsPanel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Actions' })
const featuresPanel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Features & Traits' })
const section = (page: Page, label: string): Locator => spellsPanel(page).getByRole('region', { name: label, exact: true })
const spellRows = (scope: Locator, name: string): Locator =>
  scope.locator('.sheet__spell-row', { has: scope.page().locator('.sheet__spell-name', { hasText: new RegExp(`^${escape(name)}$`) }) })
const ordinarySlots = (page: Page, level: number): Locator =>
  spellsPanel(page).getByRole('group', { name: `level ${level} spell slots uses`, exact: true }).getByRole('button')
const pactSlots = (page: Page, sectionLabel: string): Locator => section(page, sectionLabel).getByRole('group', { name: 'Pact Magic slots uses', exact: true }).getByRole('button')
const featureRow = (page: Page, group: string, name: string): Locator =>
  featuresPanel(page).getByRole('region', { name: group, exact: true }).locator('.sheet__group-row-name', { hasText: new RegExp(`^${escape(name)}$`) })

async function maxHp(page: Page): Promise<number> {
  const match = /\/\s*(\d+)/.exec(await page.locator('.sheet__hit-points-value').first().innerText())
  return match ? Number(match[1]) : NaN
}

async function expectSaves(page: Page, proficient: string[]): Promise<void> {
  for (const ability of ABILITIES) {
    await expect(saveRow(page, ability).locator('.sheet__prof-mark')).toHaveAttribute('data-status', proficient.includes(ability) ? 'proficient' : 'none')
  }
}

async function openTab(page: Page, name: string): Promise<void> {
  await page.getByRole('tab', { name, exact: true }).click()
}

/** A CHOOSE button pressed once; a click that lands before the seeded character loads is lost, so it is retried by the caller. */
async function pick(button: Locator): Promise<void> {
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click()
  await expect(button).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
}

async function expandOptionLists(page: Page): Promise<void> {
  for (const toggle of await page.locator('.option-list__toggle[aria-expanded="false"]').all()) await toggle.click()
}

async function pickAll(page: Page, names: string[]): Promise<void> {
  await expandOptionLists(page)
  for (const name of names) await pick(chooseButton(page, name).first())
}

/** Named spells first (through the search box, skipping any already listed), then the counters filled with the first offered spells. */
async function fillSpells(page: Page, named: string[] = []): Promise<void> {
  const add = page.getByRole('region', { name: 'Add Spells' })
  const search = add.getByRole('searchbox')
  const prepared = page.getByRole('region', { name: 'Prepared Spells' })
  for (const name of named) {
    if ((await prepared.locator('.manage-spells__name', { hasText: new RegExp(`^${escape(name)}$`) }).count()) > 0) continue
    await search.fill(name)
    await add.getByRole('button', { name: new RegExp(`^(Add|Prepare) ${escape(name)}$`) }).first().click()
  }
  if (named.length > 0) await search.fill('')
  for (const [label, button] of [
    ['Cantrips', /^Add /],
    ['Prepared', /^Prepare /],
  ] as const) {
    const counter = page.locator('.manage-spells__counter', { hasText: new RegExp(`^${label}:`) })
    if ((await counter.count()) === 0) continue
    for (;;) {
      const [, have, max] = (await counter.innerText()).match(/(\d+)\/(\d+)/)!.map(Number)
      if (have! >= max!) break
      await add.getByRole('button', { name: button, disabled: false }).first().click()
      await expect(counter).toHaveText(new RegExp(`^${label}: ${have! + 1}/`))
    }
  }
}

interface LevelPlan {
  /** Idempotent picks on the Class step. */
  classStep?: (page: Page) => Promise<void>
  spells?: string[]
  options?: string[]
  expertise?: string[]
  proficiencies?: (page: Page) => Promise<void>
  /** D338: what the Spells and option steps must still hold from earlier levels, checked before anything is added. */
  kept?: { counters?: string[]; spells?: string[]; options?: string[] }
  /** D339: picks the subclass grants as always prepared, dropped with a note on the Spells step. */
  dropped?: { note: string; spells: string[] }
}

const droppedNote = (page: Page): Locator => page.locator('.dropped-always-prepared-note')

async function expectKeptSpells(page: Page, kept: LevelPlan['kept'] = {}): Promise<void> {
  for (const text of kept.counters ?? []) await expect(page.locator('.manage-spells__counter', { hasText: new RegExp(`^${text.split(':')[0]}:`) })).toHaveText(text)
  const prepared = page.getByRole('region', { name: 'Prepared Spells' })
  for (const name of kept.spells ?? []) await expect(prepared.locator('.manage-spells__name', { hasText: new RegExp(`^${escape(name)}$`) }).first()).toBeVisible()
}

async function expectDropped(page: Page, dropped: LevelPlan['dropped']): Promise<void> {
  if (!dropped) {
    await expect(droppedNote(page)).toHaveCount(0)
    return
  }
  await expect(droppedNote(page)).toHaveText(dropped.note)
  const prepared = page.getByRole('region', { name: 'Prepared Spells' })
  for (const name of dropped.spells) await expect(prepared.getByRole('button', { name: `Unprepare ${name}`, exact: true })).toHaveCount(0)
}

/** Walks the level-up wizard from its first step to "Save level N", taking the average hit points. */
async function walkLevelUp(page: Page, level: number, plan: LevelPlan = {}): Promise<void> {
  const current = page.locator('[aria-current="step"]')
  for (let walked = 0; walked < 10; walked++) {
    const step = (await current.innerText()).toLowerCase()
    if (step.includes('review')) break
    if (step.includes('class')) {
      await expect(async () => {
        await plan.classStep?.(page)
        await expect(nextButton(page)).toBeEnabled({ timeout: 2000 })
      }).toPass({ timeout: 20_000 })
    }
    if (step.includes('spells')) {
      await expectKeptSpells(page, plan.kept)
      await expectDropped(page, plan.dropped)
      await fillSpells(page, plan.spells)
      await expect(nextButton(page)).toBeEnabled()
    }
    if (step.includes('invocations') || step.includes('metamagic')) {
      await expandOptionLists(page)
      for (const name of plan.kept?.options ?? []) await expect(chooseButton(page, name).first()).toHaveAttribute('aria-pressed', 'true')
      await pickAll(page, plan.options ?? [])
    }
    if (step.includes('expertise')) for (const skill of plan.expertise ?? []) await page.getByRole('checkbox', { name: new RegExp(`^${skill} `) }).check()
    if (step.includes('proficiencies')) await plan.proficiencies?.(page)
    if (step.includes('hit points')) await page.getByRole('radiogroup', { name: `Level ${level} hit points method`, exact: true }).getByRole('radio', { name: /^Average/ }).check()
    await next(page)
    await expect(current).not.toHaveText(new RegExp(`^${escape(step)}$`, 'i'))
  }
  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: `Save level ${level}` }).click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
}

async function levelUp(page: Page, label: string, level: number, plan?: LevelPlan): Promise<void> {
  await levelUpButton(page).click()
  await classWindow(page).getByRole('button', { name: label, exact: true }).click()
  await walkLevelUp(page, level, plan)
}

async function enterClass(page: Page, className: string, level: number, plan?: LevelPlan): Promise<void> {
  await levelUpButton(page).click()
  await classWindow(page).getByRole('button', { name: '+ New class…' }).click()
  await classWindow(page).getByRole('region', { name: 'New class' }).getByRole('button', { name: className, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/level-up/${className}/XPHB$`))
  await walkLevelUp(page, level, plan)
}

/** Export from the list, import the file; the copy (a fresh id) shows the same class line and max HP. */
async function exportImport(page: Page, id: string): Promise<void> {
  const name = (await stored(page, id))['name'] as string
  const line = await classes(page).innerText()
  const hp = await maxHp(page)
  await page.goto('/#/')
  await page.getByRole('button', { name: `More actions for ${name}`, exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const file = await download
  await page.locator('input[type="file"]').setInputFiles((await file.path()) as string)
  await expect(page.locator('.char-card__name', { hasText: name })).toHaveCount(2)
  const copy = (await storedAll(page)).find((entry) => entry['name'] === name && entry['id'] !== id)!
  await page.goto(`/#/character/${copy['id'] as string}`)
  await expect(classes(page)).toHaveText(line)
  await expect.poll(() => maxHp(page)).toBe(hp)
  await page.goto(`/#/character/${id}`)
  await expect(classes(page)).toHaveText(line)
}

const editButton = (page: Page): Locator => page.locator('.sheet__edit-character')
const classTab = (page: Page, className: string): Locator => page.getByRole('group', { name: 'Class to edit' }).getByRole('button', { name: new RegExp(`^${className} \\d+`) })
const goToStep = (page: Page, name: RegExp): Promise<void> => stepBar(page).getByRole('button', { name }).click()
const saveButton = (page: Page): Locator => wizardNav(page).getByRole('button', { name: 'Save changes' })

async function switchTo(page: Page, className: string): Promise<void> {
  await goToStep(page, /Class and level/)
  await classTab(page, className).click()
  await expect(classTab(page, className)).toHaveAttribute('aria-pressed', 'true')
}

async function saveEdit(page: Page, id: string): Promise<void> {
  for (let steps = 0; steps < 12 && !(await saveButton(page).isVisible()); steps++) await nextButton(page).click()
  await saveButton(page).click()
  await expect(page).toHaveURL(new RegExp(`#/character/${id}$`))
}

/** Unprepares `out` on the Edit Spells step and prepares the first other offered spell; returns its name. */
async function swapSpell(page: Page, out: string): Promise<string> {
  await page.getByRole('region', { name: 'Prepared Spells' }).getByRole('button', { name: `Unprepare ${out}`, exact: true }).click()
  const offered = page.getByRole('region', { name: 'Add Spells' }).getByRole('button', { name: /^Prepare /, disabled: false })
  for (const button of await offered.all()) {
    const name = ((await button.getAttribute('aria-label')) ?? (await button.innerText())).replace(/^Prepare /, '').trim()
    if (name === out) continue
    await button.click()
    return name
  }
  throw new Error('no other spell offered')
}

async function removeLevel(page: Page, level: number): Promise<void> {
  await page.getByRole('button', { name: `Remove level ${level}`, exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: `Remove level ${level}?` })
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

function spellsOf(character: Stored, className: string): string[] {
  const entry = ((character['spellChoices'] ?? []) as { className: string; spells: { name: string }[] }[]).find((choice) => choice.className === className)
  return (entry?.spells ?? []).map((spell) => spell.name)
}

const WARLOCK_1_SPELLS = ['Eldritch Blast', 'Minor Illusion', 'Hex', 'Armor of Agathys']
const WARLOCK_2_SPELLS = [...WARLOCK_1_SPELLS, 'Hellish Rebuke']
const SORCERER_CANTRIPS = ['Fire Bolt', 'Light', 'Mage Hand', 'Ray of Frost']

// Standard array STR 8 DEX 14 CON 13 INT 10 WIS 12 CHA 15; Soldier +2 STR +1 DEX. CON +1, CHA 15 meets both CHA 13 prerequisites.
const warlock1 = (id: string) =>
  level1(id, 'Warlock', { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 }, {
    classSkills: ['arcana', 'deception'],
    spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: refs(WARLOCK_1_SPELLS) }],
    optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Armor of Shadows', source: XPHB, level: 1 }] }],
  })

test('M11a A: Warlock 1 → Warlock 3 / Sorcerer 3 through Level up; saves, slots, HP, spells, invocations; export, edit, remove', async ({ page }) => {
  test.setTimeout(240_000)
  const id = 'm11a-a'
  const seed = warlock1(id)

  await test.step('Warlock 2 → Sorcerer 1 → Sorcerer 2 → Warlock 3 → Sorcerer 3', async () => {
    await openSheet(page, seed)
    await expect(classes(page)).toHaveText('Warlock 1')
    await levelUp(page, 'Warlock 1 → 2', 2, { spells: ['Hellish Rebuke'], options: ["Devil's Sight", 'Mask of Many Faces'] })
    await expect(classes(page)).toHaveText('Warlock 2')
    await enterClass(page, 'Sorcerer', 3, { spells: [...SORCERER_CANTRIPS, 'Burning Hands', 'Shield'] })
    await expect(classes(page)).toHaveText('Warlock 2 / Sorcerer 1')
    await levelUp(page, 'Sorcerer 1 → 2', 4, { spells: ['Magic Missile', 'Sleep'], options: ['Careful Spell', 'Quickened Spell'] })
    // D338: the subclass pick keeps the class's earlier spells and invocations. Warlock 3: cantrips 2, prepared 4 (3 held).
    await levelUp(page, 'Warlock 2 → 3', 5, {
      classStep: (p) => pickAll(p, ['Fiend Patron']),
      kept: { counters: ['Cantrips: 2/2', 'Prepared: 3/4'], spells: WARLOCK_2_SPELLS, options: ['Armor of Shadows', "Devil's Sight", 'Mask of Many Faces'] },
      spells: ['Hold Person'],
    })
    // Sorcerer 3: cantrips 4, prepared 6 (4 held).
    await levelUp(page, 'Sorcerer 2 → 3', 6, {
      classStep: (p) => pickAll(p, ['Wild Magic Sorcery']),
      kept: { counters: ['Cantrips: 4/4', 'Prepared: 4/6'], spells: [...SORCERER_CANTRIPS, 'Burning Hands', 'Shield', 'Magic Missile', 'Sleep'] },
      spells: ['Scorching Ray', 'Mirror Image'],
    })
    await expect(classes(page)).toHaveText('Warlock 3 (Fiend Patron) / Sorcerer 3 (Wild Magic Sorcery)')
    expect((await stored(page, id))['levelOrder']).toEqual(order(['Warlock', 'Warlock', 'Sorcerer', 'Sorcerer', 'Warlock', 'Sorcerer']))
  })

  await test.step('sheet: saves, max HP', async () => {
    await expectSaves(page, ['Wisdom', 'Charisma'])
    // Warlock d8 max 8 + Warlock 5 × 2 + Sorcerer 4 × 3, CON +1 × 6, Dwarven Toughness +1 × 6.
    await expect.poll(() => maxHp(page)).toBe(42)
  })

  await test.step('Spells tab: Sorcerer-only ordinary slots, Pact Magic 2 at 2nd, class labels, Slot and Pact on a 2nd level spell', async () => {
    await openTab(page, 'Spells')
    await expect(ordinarySlots(page, 1)).toHaveCount(4)
    await expect(ordinarySlots(page, 2)).toHaveCount(2)
    await expect(pactSlots(page, '2nd Level')).toHaveCount(2)
    await expect(section(page, '3rd Level')).toHaveCount(0)
    for (const [name, at, className] of [
      ['Eldritch Blast', 'Cantrips', 'Warlock'],
      ['Hex', '1st Level', 'Warlock'],
      ['Fire Bolt', 'Cantrips', 'Sorcerer'],
      ['Burning Hands', '1st Level', 'Sorcerer'],
      ['Scorching Ray', '2nd Level', 'Sorcerer'],
      ['Hold Person', '2nd Level', 'Warlock'],
    ] as const) {
      await expect(spellRows(section(page, at), name).first().locator('.sheet__action-subtitle')).toHaveText(new RegExp(`^${className}`))
    }
    const hold = spellRows(section(page, '2nd Level'), 'Hold Person').first()
    await expect(hold.getByRole('button', { name: 'Cast Hold Person with a spell slot', exact: true })).toBeVisible()
    await expect(hold.getByRole('button', { name: 'Cast Hold Person with a Pact Magic slot', exact: true })).toBeVisible()
  })

  await test.step('Features: the invocations survive the Sorcerer levels', async () => {
    await openTab(page, 'Features & Traits')
    const invocations = featuresPanel(page).locator('.sheet__feature-options').filter({ hasText: 'Armor of Shadows' })
    for (const name of ["Devil's Sight", 'Mask of Many Faces']) await expect(invocations).toContainText(name)
  })

  await test.step('Export and Import', async () => {
    await exportImport(page, id)
  })

  await test.step('Edit: a Sorcerer spell swapped, Warlock picks unchanged, kept after reload', async () => {
    const before = await stored(page, id)
    await editButton(page).click()
    await switchTo(page, 'Sorcerer')
    await goToStep(page, /Spells/)
    await expectStep(page, 'Spells')
    const added = await swapSpell(page, 'Shield')
    await saveEdit(page, id)
    await page.reload()
    await expect(classes(page)).toHaveText('Warlock 3 (Fiend Patron) / Sorcerer 3 (Wild Magic Sorcery)')
    const after = await stored(page, id)
    expect(spellsOf(after, 'Sorcerer')).toContain(added)
    expect(spellsOf(after, 'Sorcerer')).not.toContain('Shield')
    expect(spellsOf(after, 'Warlock')).toEqual(spellsOf(before, 'Warlock'))
    expect(after['optionalFeatureChoices']).toEqual(before['optionalFeatureChoices'])
    await openTab(page, 'Spells')
    await expect(spellRows(spellsPanel(page), added).first().locator('.sheet__action-subtitle')).toHaveText(/^Sorcerer/)
  })

  await test.step('Remove level: the Sorcerer 3 goes first, then levels until the Sorcerer is gone', async () => {
    await removeLevel(page, 6)
    await expect(classes(page)).toHaveText('Warlock 3 (Fiend Patron) / Sorcerer 2')
    expect((await stored(page, id))['levelOrder']).toEqual(order(['Warlock', 'Warlock', 'Sorcerer', 'Sorcerer', 'Warlock']))
    // Sorcerer 2 alone: 1st ×3, no ordinary 2nd; d6 average 4 + CON 1 + Toughness 1 less.
    await expect(ordinarySlots(page, 1)).toHaveCount(3)
    await expect(ordinarySlots(page, 2)).toHaveCount(0)
    await expect(pactSlots(page, '2nd Level')).toHaveCount(2)
    await expect.poll(() => maxHp(page)).toBe(36)

    for (const level of [5, 4, 3]) await removeLevel(page, level)
    await expect(classes(page)).toHaveText('Warlock 2')
    const after = await stored(page, id)
    expect(after['levelOrder']).toEqual(order(['Warlock', 'Warlock']))
    expect(spellsOf(after, 'Sorcerer')).toEqual([])
    // d8 max 8 + 5, CON +1 × 2, Toughness +1 × 2.
    await expect.poll(() => maxHp(page)).toBe(17)
    await expectSaves(page, ['Wisdom', 'Charisma'])
    for (const name of ['Fire Bolt', 'Burning Hands', 'Scorching Ray']) await expect(spellRows(spellsPanel(page), name)).toHaveCount(0)
    await expect(spellRows(spellsPanel(page), 'Hex').first()).toBeVisible()
    await expect(spellsPanel(page).getByRole('group', { name: /^level \d spell slots uses$/ })).toHaveCount(0)
    await openTab(page, 'Features & Traits')
    await expect(featuresPanel(page).getByRole('region', { name: 'Sorcerer Features', exact: true })).toHaveCount(0)
    await expect(featuresPanel(page)).not.toContainText('Sorcery Points')
  })
})

// D338 (M11a finding 1): the first subclass pick keeps the class's earlier spell picks.
test('M11a finding 1: Warlock 2 → 3 with Fiend Patron — the Spells step still holds the Warlock 2 picks', async ({ page }) => {
  await openSheet(page, warlock1('m11a-f1'))
  await levelUp(page, 'Warlock 1 → 2', 2, { spells: ['Hellish Rebuke'], options: ["Devil's Sight", 'Mask of Many Faces'] })
  await levelUpButton(page).click()
  await classWindow(page).getByRole('button', { name: 'Warlock 2 → 3', exact: true }).click()
  await pickAll(page, ['Fiend Patron'])
  await next(page)
  await expectStep(page, 'Spells')
  // Warlock table: 2 cantrips at levels 2 and 3, prepared 3 → 4.
  await expect(page.locator('.manage-spells__counter', { hasText: /^Prepared:/ })).toHaveText('Prepared: 3/4')
  await expect(page.locator('.manage-spells__counter', { hasText: /^Cantrips:/ })).toHaveText('Cantrips: 2/2')
})

test('F-13: single-class Wizard 2 → 3 — choosing the subclass keeps the spellbook picks on the Spells step', async ({ page }) => {
  const id = 'f13-wizard'
  const wizardSpells = ['Fire Bolt', 'Mage Hand', 'Prestidigitation', 'Magic Missile', 'Shield', 'Detect Magic', 'Mage Armor', 'Sleep']
  // Standard array, INT 15. Wizard 2 holds 3 cantrips and 5 prepared, Scholar Expertise at level 2.
  const seed = {
    ...level1(id, 'Wizard', { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 }, {
      classSkills: ['arcana', 'history'],
      expertiseSkills: [{ name: 'arcana', level: 2 }],
      spellChoices: [{ className: 'Wizard', classSource: XPHB, spells: refs(wizardSpells) }],
      hitPointLevels: [{ level: 2, kind: 'average', dieResult: 4 }],
    }),
    classes: [{ className: 'Wizard', classSource: XPHB, subclass: null, level: 2 }],
    levelOrder: order(['Wizard', 'Wizard']),
  }
  await openSheet(page, seed)
  await expect(classes(page)).toHaveText('Wizard 2')
  await levelUpButton(page).click()
  await classWindow(page).getByRole('button', { name: 'Wizard 2 → 3', exact: true }).click()
  await expect(async () => {
    await pickAll(page, ['Bladesinger'])
    await expect(nextButton(page)).toBeEnabled({ timeout: 2000 })
  }).toPass({ timeout: 20_000 })
  const current = page.locator('[aria-current="step"]')
  for (let walked = 0; walked < 4 && !/spells/i.test(await current.innerText()); walked++) {
    // Bladesinger's skill pick, if its step comes first.
    for (const choice of await page.locator('.wizard__panel select').all()) {
      if ((await choice.inputValue()) === '') await choice.selectOption({ index: 1 })
    }
    const step = await current.innerText()
    await next(page)
    await expect(current).not.toHaveText(step)
  }
  await expectStep(page, 'Spells')
  // Wizard table: cantrips 3 at levels 2 and 3, prepared 5 → 6.
  await expectKeptSpells(page, { counters: ['Cantrips: 3/3', 'Prepared: 5/6'], spells: wizardSpells })
})

const LIFE_DOMAIN_NOTE = 'Bless and Cure Wounds are always prepared by Life Domain and were removed from your picks.'
const CLERIC_2_PICKS = ['Guidance', 'Light', 'Sacred Flame', 'Thaumaturgy', 'Bless', 'Command', 'Cure Wounds', 'Healing Word', 'Sanctuary']

// Cleric 2 with Thaumaturge: 4 cantrips, 5 prepared. Same scores as M11a B.
const cleric2 = (id: string) => ({
  ...level1(id, 'Cleric', { strength: 12, dexterity: 10, constitution: 13, intelligence: 8, wisdom: 15, charisma: 14 }, {
    classSkills: ['history', 'insight'],
    classFeatureChoices: [{ className: 'Cleric', classSource: XPHB, featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Thaumaturge' }],
    spellChoices: [{ className: 'Cleric', classSource: XPHB, spells: refs(CLERIC_2_PICKS) }],
    hitPointLevels: [{ level: 2, kind: 'average', dieResult: 5 }],
  }),
  classes: [{ className: 'Cleric', classSource: XPHB, subclass: null, level: 2 }],
  levelOrder: order(['Cleric', 'Cleric']),
})

test('F-14 a: Cleric 2 → 3 Life Domain drops the Bless and Cure Wounds picks; Next enabled; the sheet lists each once as always prepared', async ({ page }) => {
  const id = 'f14-cleric'
  await openSheet(page, cleric2(id))
  await expect(classes(page)).toHaveText('Cleric 2')
  // Cleric table: cantrips 3 at level 3 (+1 Thaumaturge), prepared 6; 5 held picks less the 2 dropped.
  await levelUp(page, 'Cleric 2 → 3', 3, {
    classStep: (p) => pickAll(p, ['Life Domain']),
    kept: { counters: ['Cantrips: 4/4', 'Prepared: 3/6'], spells: ['Command', 'Healing Word', 'Sanctuary'] },
    dropped: { note: LIFE_DOMAIN_NOTE, spells: ['Bless', 'Cure Wounds'] },
  })
  await expect(classes(page)).toHaveText('Cleric 3 (Life Domain)')
  const picks = spellsOf(await stored(page, id), 'Cleric')
  expect(picks).toHaveLength(10)
  for (const name of ['Bless', 'Cure Wounds']) expect(picks).not.toContain(name)
  await openTab(page, 'Spells')
  // Once in its own level's section; higher sections repeat a spell as an upcast row.
  for (const name of ['Bless', 'Cure Wounds']) {
    const rows = spellRows(section(page, '1st Level'), name)
    await expect(rows).toHaveCount(1)
    await rows.getByRole('button', { name, exact: true }).click()
    await expect(rows.locator('.sheet__spell-provenance')).toContainText('always prepared (Life Domain)')
  }
})

test("F-14 b: Cleric 2 / Paladin 1 → Cleric 3 Life Domain drops only the Cleric's Bless and Cure Wounds; the Paladin's stay", async ({ page }) => {
  test.setTimeout(120_000)
  const id = 'f14-multiclass'
  await openSheet(page, cleric2(id))
  await expect(classes(page)).toHaveText('Cleric 2')
  await enterClass(page, 'Paladin', 3, {
    classStep: async (p) => {
      await expandOptionLists(p)
      if ((await chooseButton(p, 'Longsword').count()) > 0) await pickAll(p, ['Longsword', 'Warhammer'])
    },
    spells: ['Bless', 'Cure Wounds'],
  })
  await expect(classes(page)).toHaveText('Cleric 2 / Paladin 1')
  expect(spellsOf(await stored(page, id), 'Paladin')).toEqual(['Bless', 'Cure Wounds'])
  await levelUp(page, 'Cleric 2 → 3', 4, {
    classStep: (p) => pickAll(p, ['Life Domain']),
    kept: { counters: ['Cantrips: 4/4', 'Prepared: 3/6'] },
    dropped: { note: LIFE_DOMAIN_NOTE, spells: ['Bless', 'Cure Wounds'] },
  })
  await expect(classes(page)).toHaveText('Cleric 3 (Life Domain) / Paladin 1')
  const saved = await stored(page, id)
  expect(spellsOf(saved, 'Paladin')).toEqual(['Bless', 'Cure Wounds'])
  for (const name of ['Bless', 'Cure Wounds']) expect(spellsOf(saved, 'Cleric')).not.toContain(name)
})

test('M11a B: Cleric 1 → Cleric 3 / Paladin 3 through Level up; saves, slots, two Channel Divinity pools, HP, armor; export, edit, remove', async ({ page }) => {
  test.setTimeout(240_000)
  const id = 'm11a-b'
  const CLERIC_1_SPELLS = ['Guidance', 'Light', 'Sacred Flame', 'Thaumaturgy', 'Bless', 'Command', 'Cure Wounds', 'Healing Word']
  // Standard array STR 12 DEX 10 CON 13 INT 8 WIS 15 CHA 14; Soldier +2 STR +1 DEX → STR 14, WIS 15, CHA 14 meet Cleric and Paladin. CON +1.
  const seed = level1(id, 'Cleric', { strength: 12, dexterity: 10, constitution: 13, intelligence: 8, wisdom: 15, charisma: 14 }, {
    classSkills: ['history', 'insight'],
    // Thaumaturge: one extra Cleric cantrip, and no armor or weapon proficiency that would hide the Paladin's.
    classFeatureChoices: [{ className: 'Cleric', classSource: XPHB, featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Thaumaturge' }],
    spellChoices: [{ className: 'Cleric', classSource: XPHB, spells: refs(CLERIC_1_SPELLS) }],
  })
  const CLERIC_2_SPELLS = [...CLERIC_1_SPELLS, 'Sanctuary']
  const proficiencies = (page: Page): Locator => page.locator('.sheet__proficiencies')

  await test.step('Cleric 2 → Paladin 1 → Paladin 2 → Cleric 3 → Paladin 3', async () => {
    await openSheet(page, seed)
    await expect(classes(page)).toHaveText('Cleric 1')
    await levelUp(page, 'Cleric 1 → 2', 2, { spells: ['Sanctuary'] })
    await expect(proficiencies(page)).not.toContainText('Martial weapons')
    await enterClass(page, 'Paladin', 3, {
      classStep: async (p) => {
        await expandOptionLists(p)
        if ((await chooseButton(p, 'Longsword').count()) > 0) await pickAll(p, ['Longsword', 'Warhammer'])
      },
      spells: ['Divine Favor', 'Shield of Faith'],
    })
    await expect(classes(page)).toHaveText('Cleric 2 / Paladin 1')
    await levelUp(page, 'Paladin 1 → 2', 4, { classStep: (p) => pickAll(p, ['Defense']), spells: ['Heroism'] })
    // D338: the subclass pick keeps the earlier spells; D339 drops Bless and Cure Wounds, which Life Domain grants. Cleric cantrips 3 + 1 Thaumaturge, prepared 6.
    await levelUp(page, 'Cleric 2 → 3', 5, {
      classStep: (p) => pickAll(p, ['Life Domain']),
      kept: { counters: ['Cantrips: 4/4', 'Prepared: 3/6'], spells: CLERIC_2_SPELLS.filter((name) => name !== 'Bless' && name !== 'Cure Wounds') },
      dropped: { note: 'Bless and Cure Wounds are always prepared by Life Domain and were removed from your picks.', spells: ['Bless', 'Cure Wounds'] },
    })
    // F-14 c: Oath of Devotion grants Shield of Faith. Paladin prepared 4 at level 3.
    await levelUp(page, 'Paladin 2 → 3', 6, {
      classStep: (p) => pickAll(p, ['Oath of Devotion']),
      kept: { counters: ['Prepared: 2/4'], spells: ['Divine Favor', 'Heroism'] },
      dropped: { note: 'Shield of Faith is always prepared by Oath of Devotion and was removed from your picks.', spells: ['Shield of Faith'] },
      spells: ['Searing Smite'],
    })
    const saved = await stored(page, id)
    for (const name of ['Bless', 'Cure Wounds']) expect(spellsOf(saved, 'Cleric')).not.toContain(name)
    expect(spellsOf(saved, 'Paladin')).not.toContain('Shield of Faith')
    await expect(classes(page)).toHaveText('Cleric 3 (Life Domain) / Paladin 3 (Oath of Devotion)')
    expect((await stored(page, id))['levelOrder']).toEqual(order(['Cleric', 'Cleric', 'Paladin', 'Paladin', 'Cleric', 'Paladin']))
  })

  await test.step('sheet: saves, max HP, Paladin multiclass armor and weapons', async () => {
    await expectSaves(page, ['Wisdom', 'Charisma'])
    // Cleric d8 max 8 + Cleric 5 × 2 + Paladin 6 × 3, CON +1 × 6, Dwarven Toughness +1 × 6.
    await expect.poll(() => maxHp(page)).toBe(48)
    for (const text of ['Medium armor', 'Shields', 'Martial weapons']) await expect(proficiencies(page)).toContainText(text)
    await page.getByRole('button', { name: 'Proficiencies details' }).click()
    await expect(page.getByRole('dialog', { name: 'Proficiencies', exact: true })).toContainText('Martial weapons — Paladin (multiclass)')
    await page.keyboard.press('Escape')
  })

  await test.step('Spells tab: caster level 3 + 2 = 5 → 4 / 3 / 2', async () => {
    await openTab(page, 'Spells')
    await expect(ordinarySlots(page, 1)).toHaveCount(4)
    await expect(ordinarySlots(page, 2)).toHaveCount(3)
    await expect(ordinarySlots(page, 3)).toHaveCount(2)
    await expect(section(page, '4th Level')).toHaveCount(0)
  })

  const CLERIC = 'Channel Divinity (Cleric)'
  const PALADIN = 'Channel Divinity (Paladin)'
  const counter = (page: Page, name: string): Locator => actionsPanel(page).getByRole('group', { name: `${name} uses`, exact: true }).first()

  await test.step('Actions: two Channel Divinity pools, 2 uses each; a Cleric use leaves the Paladin pool alone', async () => {
    await openTab(page, 'Actions')
    await expect(counter(page, CLERIC).getByRole('button')).toHaveCount(2)
    await expect(counter(page, PALADIN).getByRole('button')).toHaveCount(2)
    await counter(page, CLERIC).getByRole('button', { name: `Use ${CLERIC}` }).first().click()
    await expect(counter(page, CLERIC).locator('.sheet__use-box--used')).toHaveCount(1)
    await expect(counter(page, PALADIN).locator('.sheet__use-box--used')).toHaveCount(0)
  })

  await test.step('Export and Import', async () => {
    await exportImport(page, id)
  })

  await test.step('Edit: a Paladin spell swapped, Cleric picks unchanged, kept after reload', async () => {
    const before = await stored(page, id)
    await editButton(page).click()
    await switchTo(page, 'Paladin')
    await goToStep(page, /Spells/)
    await expectStep(page, 'Spells')
    const added = await swapSpell(page, 'Heroism')
    await saveEdit(page, id)
    await page.reload()
    const after = await stored(page, id)
    expect(spellsOf(after, 'Paladin')).toContain(added)
    expect(spellsOf(after, 'Paladin')).not.toContain('Heroism')
    expect(spellsOf(after, 'Cleric')).toEqual(spellsOf(before, 'Cleric'))
    expect(after['classFeatureChoices']).toEqual(before['classFeatureChoices'])
    await expect(classes(page)).toHaveText('Cleric 3 (Life Domain) / Paladin 3 (Oath of Devotion)')
  })

  await test.step('Remove level: Paladin 3 goes first, then levels until the Paladin is gone', async () => {
    await removeLevel(page, 6)
    await expect(classes(page)).toHaveText('Cleric 3 (Life Domain) / Paladin 2')
    expect((await stored(page, id))['levelOrder']).toEqual(order(['Cleric', 'Cleric', 'Paladin', 'Paladin', 'Cleric']))
    // d10 average 6 + CON 1 + Toughness 1 less.
    await expect.poll(() => maxHp(page)).toBe(40)
    await openTab(page, 'Spells')
    // Caster level 3 + 1 = 4 → 4 / 3.
    await expect(ordinarySlots(page, 1)).toHaveCount(4)
    await expect(ordinarySlots(page, 2)).toHaveCount(3)
    await expect(ordinarySlots(page, 3)).toHaveCount(0)
    await openTab(page, 'Actions')
    await expect(actionsPanel(page).getByRole('group', { name: `${PALADIN} uses` })).toHaveCount(0)
    await expect(counter(page, 'Channel Divinity').getByRole('button')).toHaveCount(2)
    await expect(counter(page, 'Channel Divinity').locator('.sheet__use-box--used')).toHaveCount(1)

    for (const level of [5, 4, 3]) await removeLevel(page, level)
    await expect(classes(page)).toHaveText('Cleric 2')
    const after = await stored(page, id)
    expect(after['levelOrder']).toEqual(order(['Cleric', 'Cleric']))
    expect(spellsOf(after, 'Paladin')).toEqual([])
    // d8 max 8 + 5, CON +1 × 2, Toughness +1 × 2.
    await expect.poll(() => maxHp(page)).toBe(17)
    await expect(proficiencies(page)).not.toContainText('Martial weapons')
    await expect(actionsPanel(page)).not.toContainText('Lay on Hands')
    await openTab(page, 'Spells')
    for (const name of ['Divine Favor', 'Shield of Faith']) await expect(spellRows(spellsPanel(page), name)).toHaveCount(0)
    // Cleric 2 alone: 1st ×3.
    await expect(ordinarySlots(page, 1)).toHaveCount(3)
    await expect(ordinarySlots(page, 2)).toHaveCount(0)
    await openTab(page, 'Features & Traits')
    await expect(featuresPanel(page).getByRole('region', { name: 'Paladin Features', exact: true })).toHaveCount(0)
  })
})

test('M11a C: wizard Fighter 1 → Fighter 3 / Rogue 2 through Level up; saves, Rogue picks, masteries, features, HP; export, edit, remove', async ({ page }) => {
  test.setTimeout(240_000)
  let id = ''

  await test.step('real wizard Fighter 1, then Fighter 2 → Rogue 1 → Rogue 2 → Fighter 3', async () => {
    // STR 15, DEX 14 (meets Rogue DEX 13), CON 13; Acolyte +2 WIS +1 INT.
    await createFighter(page, { name: 'M11a Fighter', level: 1, species: 'Dwarf|XPHB' })
    id = /#\/character\/([^/]+)$/.exec(page.url())![1]!
    await expect(classes(page)).toHaveText('Fighter 1')
    await levelUp(page, 'Fighter 1 → 2', 2)
    await enterClass(page, 'Rogue', 3, {
      classStep: (p) => pickAll(p, ['Dagger', 'Shortsword']),
      expertise: ['Athletics', 'Perception'],
      proficiencies: async (p) => {
        await select(p, "Thieves' Cant language:").selectOption({ index: 1 })
        await select(p, 'Rogue multiclass skill:').selectOption('stealth')
      },
    })
    await expect(classes(page)).toHaveText('Fighter 2 / Rogue 1')
    await levelUp(page, 'Rogue 1 → 2', 4)
    await levelUp(page, 'Fighter 2 → 3', 5, { classStep: (p) => pickAll(p, ['Champion']) })
    await expect(classes(page)).toHaveText('Fighter 3 (Champion) / Rogue 2')
    expect((await stored(page, id))['levelOrder']).toEqual(order(['Fighter', 'Fighter', 'Rogue', 'Rogue', 'Fighter']))
  })

  await test.step('sheet: saves, max HP, Rogue skill, Thieves’ Tools, Expertise', async () => {
    await expectSaves(page, ['Strength', 'Constitution'])
    // Fighter d10 max 10 + Fighter 6 × 2 + Rogue 5 × 2, CON +1 × 5, Dwarven Toughness +1 × 5.
    await expect.poll(() => maxHp(page)).toBe(42)
    await expect.poll(() => skillStatus(page, 'Stealth')).toBe('proficient')
    for (const skill of ['Athletics', 'Perception']) await expect.poll(() => skillStatus(page, skill)).toBe('expertise')
    await expect(page.locator('.sheet__proficiencies')).toContainText("Thieves' Tools")
  })

  await test.step('Features: Sneak Attack, Cunning Action, Second Wind, Action Surge', async () => {
    await openTab(page, 'Features & Traits')
    for (const [group, name] of [
      ['Rogue Features', 'Sneak Attack'],
      ['Rogue Features', 'Cunning Action'],
      ['Fighter Features', 'Second Wind'],
      ['Fighter Features', 'Action Surge'],
    ]) {
      await expect(featureRow(page, group!, name!).first()).toBeVisible()
    }
  })

  await test.step('Export and Import', async () => {
    await exportImport(page, id)
  })

  await test.step('Edit: 3 Fighter and 2 Rogue masteries; the Rogue Expertise Athletics → Stealth, Fighter picks unchanged, kept after reload', async () => {
    const before = await stored(page, id)
    await editButton(page).click()
    const count = page.locator('.option-list__toggle', { hasText: 'Weapon masteries' })
    await switchTo(page, 'Fighter')
    await expect(count).toContainText('All 3 weapon masteries chosen.')
    await switchTo(page, 'Rogue')
    await expect(count).toContainText('All 2 weapon masteries chosen.')
    await goToStep(page, /Expertise/)
    await expectStep(page, 'Expertise')
    await page.getByRole('checkbox', { name: /^Athletics / }).uncheck()
    await page.getByRole('checkbox', { name: /^Stealth / }).check()
    await saveEdit(page, id)
    await page.reload()
    await expect.poll(() => skillStatus(page, 'Stealth')).toBe('expertise')
    await expect.poll(() => skillStatus(page, 'Athletics')).toBe('proficient')
    const after = await stored(page, id)
    const expertise = ((after['expertiseSkills'] ?? []) as { name: string }[]).map((skill) => skill.name)
    expect(expertise).toEqual(expect.arrayContaining(['perception', 'stealth']))
    expect(expertise).not.toContain('athletics')
    for (const key of ['masteries', 'fightingStyles', 'classSkills']) expect(after[key]).toEqual(before[key])
  })

  await test.step('Remove level: Fighter 3 goes first, then levels until the Rogue is gone', async () => {
    await removeLevel(page, 5)
    await expect(classes(page)).toHaveText('Fighter 2 / Rogue 2')
    expect((await stored(page, id))['levelOrder']).toEqual(order(['Fighter', 'Fighter', 'Rogue', 'Rogue']))
    // d10 average 6 + CON 1 + Toughness 1 less.
    await expect.poll(() => maxHp(page)).toBe(34)

    for (const level of [4, 3]) await removeLevel(page, level)
    await expect(classes(page)).toHaveText('Fighter 2')
    const after = await stored(page, id)
    expect(after['levelOrder']).toEqual(order(['Fighter', 'Fighter']))
    expect(after['multiclassPicks']).toBeUndefined()
    expect(((after['masteries'] ?? []) as { name: string }[]).map((mastery) => mastery.name)).toEqual(['Longsword', 'Greatsword', 'Handaxe'])
    // d10 max 10 + 6, CON +1 × 2, Toughness +1 × 2.
    await expect.poll(() => maxHp(page)).toBe(20)
    await expectSaves(page, ['Strength', 'Constitution'])
    await expect.poll(() => skillStatus(page, 'Stealth')).toBe('none')
    await expect.poll(() => skillStatus(page, 'Perception')).toBe('proficient')
    await expect(page.locator('.sheet__proficiencies')).not.toContainText("Thieves' Tools")
    await openTab(page, 'Features & Traits')
    await expect(featuresPanel(page).getByRole('region', { name: 'Rogue Features', exact: true })).toHaveCount(0)
    await expect(featureRow(page, 'Fighter Features', 'Action Surge').first()).toBeVisible()
  })
})
