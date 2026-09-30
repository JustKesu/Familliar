import { expect, test, type Locator, type Page } from '@playwright/test'
import { createFighter, expectStep, next } from './wizard.ts'

/* R13a (D215). Characters seeded at schema 52 before the app loads, as in manageExtras.spec.ts. */
const STORAGE_KEY = 'familliar:characters'
const ABILITIES = { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } }
const ACOLYTE = { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" }

function fighter(id: string, level: number, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 52,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level }],
    abilityScores: ABILITIES,
    ...extra,
  }
}

const withFeatAt4 = (id: string) => fighter(id, 4, { background: ACOLYTE, fightingStyle: 'Archery', featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }] })

async function seed(page: Page, subjects: { id: string }[]): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify(subjects) },
  )
}

async function openManage(page: Page, id: string): Promise<Locator> {
  await page.goto(`/#/character/${id}`)
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Feats' })
}

const mine = (panel: Locator): Locator => panel.getByRole('region', { name: 'My Feats' })
const add = (panel: Locator): Locator => panel.getByRole('region', { name: 'Add Feats' })
const unavailable = (panel: Locator): Locator => panel.getByRole('region', { name: 'Unavailable' })
const row = (section: Locator, name: string): Locator =>
  section.locator('.manage-spells__row').filter({ has: section.page().locator('.manage-spells__name').getByText(name, { exact: true }) })
const search = (panel: Locator, text: string): Promise<void> => add(panel).getByRole('searchbox', { name: 'Search feats' }).fill(text)

async function maxHp(page: Page): Promise<number> {
  const match = /\/\s*(\d+)/.exec(await page.locator('.sheet__hit-points-value').first().innerText())
  return match ? Number(match[1]) : NaN
}

async function abilityScore(page: Page, ability: string): Promise<number> {
  return Number(await page.locator(`.ability-card[data-ability="${ability}"] .ability-card__score`).innerText())
}

async function skillStatus(page: Page, skillLabel: string): Promise<string | null> {
  return page.locator('.sheet__skills .sheet__row', { hasText: skillLabel }).locator('.sheet__prof-mark').getAttribute('data-status')
}

async function closeManage(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Close' }).click()
}

test('R13a a: level, background and Fighting Style feats are locked; an ASI level shows as Ability Score Improvement', async ({ page }) => {
  await seed(page, [withFeatAt4('r13a-a1'), fighter('r13a-a2', 4, { featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }] })])
  await page.goto('/#/character/r13a-a1')
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const features = page.getByRole('tabpanel', { name: 'Features & Traits' })
  for (const pill of ['Class Features', 'Species Traits', 'Feats', 'All']) {
    await features.getByRole('button', { name: pill, exact: true }).click()
    await expect(features.getByRole('button', { name: 'Manage Feats', exact: true })).toBeVisible()
  }

  const panel = await openManage(page, 'r13a-a1')
  await expect(row(mine(panel), 'Magic Initiate; Cleric')).toContainText('From Background')
  await expect(row(mine(panel), 'Alert')).toContainText('From level 4')
  await expect(row(mine(panel), 'Archery')).toContainText('From Fighter')
  await expect(mine(panel).getByRole('button', { name: /^Remove / })).toHaveCount(0)

  const asiPanel = await openManage(page, 'r13a-a2')
  const asi = row(mine(asiPanel), 'Ability Score Improvement')
  await expect(asi).toContainText('From level 4')
  await asi.getByRole('button', { name: 'Ability Score Improvement text' }).click()
  // R13b (D215): the stored pick now shows through the editable picker, not static text.
  await expect(asi.locator('.feat-asi-picker__asi select')).toHaveValue('strength')
  await expect(mine(asiPanel).getByRole('button', { name: /^Remove / })).toHaveCount(0)
})

test('R13a b, c, g: ADD Tough raises max HP by 2 × level, shows "Added manually", survives a reload; REMOVE restores it', async ({ page }) => {
  const level = 4
  await seed(page, [withFeatAt4('r13a-b')])
  await page.goto('/#/character/r13a-b')
  let before = NaN
  await expect.poll(async () => (before = await maxHp(page))).toBeGreaterThan(0)

  const panel = await openManage(page, 'r13a-b')
  await search(panel, 'Tough')
  await add(panel).getByRole('button', { name: 'Add Tough', exact: true }).click()
  await expect(row(mine(panel), 'Tough').getByRole('button', { name: 'Remove Tough', exact: true })).toBeVisible()
  await expect(add(panel).getByRole('button', { name: 'Add Tough', exact: true })).toHaveCount(0)
  await expect.poll(() => maxHp(page)).toBe(before + 2 * level)

  const feats = page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Feats', exact: true })
  await expect(feats.locator('li').filter({ hasText: 'Tough' }).first()).toContainText('Added manually')

  await page.reload()
  await expect.poll(() => maxHp(page)).toBe(before + 2 * level)
  const reloaded = await openManage(page, 'r13a-b')
  await row(mine(reloaded), 'Tough').getByRole('button', { name: 'Remove Tough', exact: true }).click()
  await expect(row(mine(reloaded), 'Tough')).toHaveCount(0)
  await expect.poll(() => maxHp(page)).toBe(before)
})

test('R13a d: a held non-repeatable feat is not offered', async ({ page }) => {
  await seed(page, [withFeatAt4('r13a-d')])
  const panel = await openManage(page, 'r13a-d')
  await search(panel, 'Alert')
  await expect(add(panel).getByRole('button', { name: 'Add Alert', exact: true })).toHaveCount(0)
  await expect(add(panel)).toContainText('No feats match.')
})

test('R13a e: at level 1 a General feat is listed under Unavailable with its reason and no ADD', async ({ page }) => {
  await seed(page, [fighter('r13a-e', 1)])
  const panel = await openManage(page, 'r13a-e')
  await expect(add(panel).getByRole('button', { name: 'Add Actor', exact: true })).toHaveCount(0)
  await expect(unavailable(panel)).toBeHidden()
  await panel.getByText('Unavailable — prerequisites not met').click()
  const actor = row(unavailable(panel), 'Actor')
  await expect(actor).toContainText('General')
  await expect(actor).toContainText('Requires character level 4')
  await expect(actor.getByRole('button', { name: /^Add / })).toHaveCount(0)
})

test('R13a f: a category pill filters Add Feats', async ({ page }) => {
  await seed(page, [withFeatAt4('r13a-f')])
  const panel = await openManage(page, 'r13a-f')
  const pills = add(panel).getByRole('group', { name: 'Filter by category' })
  await pills.getByRole('button', { name: 'Fighting Style', exact: true }).click()
  await expect(add(panel).getByRole('button', { name: 'Add Defense', exact: true })).toBeVisible()
  await expect(add(panel).getByRole('button', { name: 'Add Tough', exact: true })).toHaveCount(0)
  for (const meta of await add(panel).locator('.manage-spells__meta').allInnerTexts()) expect(meta).toBe('Fighting Style')
  await pills.getByRole('button', { name: 'All', exact: true }).click()
  await expect(add(panel).getByRole('button', { name: 'Add Tough', exact: true })).toBeVisible()
})

test('R13a h: a character seeded at schema 52 loads with its feats unchanged', async ({ page }) => {
  await seed(page, [withFeatAt4('r13a-h')])
  const panel = await openManage(page, 'r13a-h')
  await expect(row(mine(panel), 'Alert')).toContainText('From level 4')
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
  expect(stored.featAsiChoices).toEqual([{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }])
  expect(stored.background).toEqual(ACOLYTE)
  expect(stored.grantedFeats).toBeUndefined()
})

/* R13b (D215): editing feat sub-choices, including ASI ability increases, directly in the panel. */
const ACOLYTE_WITH_MAGIC_INITIATE = (id: string) =>
  fighter(id, 4, {
    background: ACOLYTE,
    grantedFeats: [
      {
        origin: 'background',
        name: 'Magic Initiate; Cleric',
        source: 'XPHB',
        chosenAbility: 'wisdom',
        magicInitiate: {
          className: 'Cleric',
          classSource: 'XPHB',
          cantrips: [
            { name: 'Guidance', source: 'XPHB' },
            { name: 'Sacred Flame', source: 'XPHB' },
          ],
          spell: { name: 'Bless', source: 'XPHB' },
        },
      },
    ],
  })

test('R13b a: changing ASI +2 STR to +1 STR/+1 DEX in the panel moves the ability scores', async ({ page }) => {
  await seed(page, [fighter('r13b-a', 4, { featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }] })])
  await page.goto('/#/character/r13b-a')
  const strBefore = await abilityScore(page, 'strength')
  const dexBefore = await abilityScore(page, 'dexterity')

  const panel = await openManage(page, 'r13b-a')
  const asi = row(mine(panel), 'Ability Score Improvement')
  await asi.getByRole('button', { name: 'Ability Score Improvement text' }).click()
  await asi.getByLabel('+1 to two abilities').click()
  const selects = asi.locator('.feat-asi-picker__asi select')
  await selects.nth(0).selectOption('strength')
  await selects.nth(1).selectOption('dexterity')

  await expect.poll(() => abilityScore(page, 'strength')).toBe(strBefore - 1)
  await expect.poll(() => abilityScore(page, 'dexterity')).toBe(dexBefore + 1)
})

test('R13b b: an ability already at 20 cannot receive an increase in the panel', async ({ page }) => {
  const maxed = fighter('r13b-b', 4, {
    abilityScores: { method: 'standardArray', scores: { strength: 20, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
    // The schema has no "empty" state for a stored 'asi' choice (setAsiIncreases, characterStore.test.ts) — seed a valid pick unrelated to strength.
    featAsiChoices: [{ level: 4, kind: 'asi', increases: { constitution: 2 } }],
  })
  await seed(page, [maxed])
  const panel = await openManage(page, 'r13b-b')
  const asi = row(mine(panel), 'Ability Score Improvement')
  await asi.getByRole('button', { name: 'Ability Score Improvement text' }).click()
  const select = asi.locator('.feat-asi-picker__asi select').first()
  await expect(select.locator('option', { hasText: 'Strength' })).toBeDisabled()
  await expect(select.locator('option', { hasText: 'Dexterity' })).toBeEnabled()
})

test('R13b c: picking a manually added Skilled\'s three skills in the panel makes them proficient and clears the pending note', async ({ page }) => {
  await seed(page, [fighter('r13b-c', 4)])
  const panel = await openManage(page, 'r13b-c')
  await search(panel, 'Skilled')
  await add(panel).getByRole('button', { name: 'Add Skilled', exact: true }).click()
  const skilled = row(mine(panel), 'Skilled')
  await skilled.getByRole('button', { name: 'Skilled text' }).click()
  for (const [slot, skill] of [
    ['1', 'arcana'],
    ['2', 'history'],
    ['3', 'nature'],
  ] as const) {
    await skilled.getByLabel(`Skilled skill or tool ${slot}`, { exact: true }).selectOption(`skill:${skill}`)
  }

  await expect.poll(() => skillStatus(page, 'Arcana')).toBe('proficient')
  await expect.poll(() => skillStatus(page, 'History')).toBe('proficient')
  await expect.poll(() => skillStatus(page, 'Nature')).toBe('proficient')

  const feats = page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Feats', exact: true })
  await expect(feats.locator('.sheet__group-row', { hasText: 'Skilled' })).not.toContainText('Choices not made yet')
})

test('R13b d: changing a background Magic Initiate cantrip in the panel updates the Spells tab', async ({ page }) => {
  await seed(page, [ACOLYTE_WITH_MAGIC_INITIATE('r13b-d')])
  const panel = await openManage(page, 'r13b-d')
  const magicInitiate = row(mine(panel), 'Magic Initiate; Cleric')
  await magicInitiate.getByRole('button', { name: 'Magic Initiate; Cleric text' }).click()
  await magicInitiate.getByRole('checkbox', { name: 'Guidance', exact: true }).uncheck()
  await magicInitiate.getByRole('checkbox', { name: 'Toll the Dead', exact: true }).check()
  await closeManage(page)

  await page.getByRole('tab', { name: 'Spells' }).click()
  const spellNames = page.getByRole('tabpanel', { name: 'Spells' }).locator('.sheet__spell-name')
  await expect(spellNames).toContainText(['Toll the Dead'])
  await expect(spellNames.filter({ hasText: 'Guidance' })).toHaveCount(0)
})

test('R13b e: changing a half-feat\'s chosen ability at an ASI level moves the +1 bonus', async ({ page }) => {
  await seed(page, [fighter('r13b-e', 4, { featAsiChoices: [{ level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' }] })])
  await page.goto('/#/character/r13b-e')
  const strBefore = await abilityScore(page, 'strength')
  const dexBefore = await abilityScore(page, 'dexterity')

  const panel = await openManage(page, 'r13b-e')
  const athlete = row(mine(panel), 'Athlete')
  await athlete.getByRole('button', { name: 'Athlete text' }).click()
  await athlete.getByRole('combobox', { name: 'Ability', exact: true }).selectOption('dexterity')
  await closeManage(page)

  await expect.poll(() => abilityScore(page, 'strength')).toBe(strBefore - 1)
  await expect.poll(() => abilityScore(page, 'dexterity')).toBe(dexBefore + 1)
})

test('R13b f: panel edits survive a reload', async ({ page }) => {
  await seed(page, [fighter('r13b-f', 4, { featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }] })])
  await page.goto('/#/character/r13b-f')
  const strBefore = await abilityScore(page, 'strength')

  const panel = await openManage(page, 'r13b-f')
  const asi = row(mine(panel), 'Ability Score Improvement')
  await asi.getByRole('button', { name: 'Ability Score Improvement text' }).click()
  await asi.getByLabel('+1 to two abilities').click()
  const selects = asi.locator('.feat-asi-picker__asi select')
  await selects.nth(0).selectOption('strength')
  await selects.nth(1).selectOption('dexterity')
  await expect.poll(() => abilityScore(page, 'strength')).toBe(strBefore - 1)

  await page.reload()
  await expect.poll(() => abilityScore(page, 'strength')).toBe(strBefore - 1)

  const reloaded = await openManage(page, 'r13b-f')
  const asiReloaded = row(mine(reloaded), 'Ability Score Improvement')
  await asiReloaded.getByRole('button', { name: 'Ability Score Improvement text' }).click()
  const reloadedSelects = asiReloaded.locator('.feat-asi-picker__asi select')
  await expect(reloadedSelects.nth(0)).toHaveValue('strength')
  await expect(reloadedSelects.nth(1)).toHaveValue('dexterity')
})

test('R13b g: Edit Character does not offer a manually added Tough again at an ASI level', async ({ page }) => {
  await createFighter(page, { name: 'Manual Tough Test', level: 4, species: 'Dwarf|XPHB' })

  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Manage Feats' })
  await search(panel, 'Tough')
  await add(panel).getByRole('button', { name: 'Add Tough', exact: true }).click()
  await closeManage(page)

  await page.getByRole('button', { name: 'Edit character' }).click()
  await expectStep(page, 'Class and level')
  await next(page)
  await expectStep(page, 'Species')
  await next(page)
  await expectStep(page, 'Background')
  await next(page)
  await expectStep(page, 'Proficiencies')
  await next(page)
  await expectStep(page, 'Ability scores')
  await next(page)
  await expectStep(page, 'ASI / Feat')

  const group = page.getByRole('group', { name: 'Level 4' })
  await group.getByRole('radio', { name: 'Feat', exact: true }).check()
  await expect(group.getByRole('radio', { name: 'Tough', exact: true })).toBeDisabled()
  await expect(group.getByText('Already added manually.')).toBeVisible()
})
