import { expect, test, type Locator, type Page } from '@playwright/test'

/*
 * R9a (D208). Casters seeded into storage before the app loads, as in
 * spellDice.spec.ts — wizard.ts builds Fighters only.
 */
const STORAGE_KEY = 'familliar:characters'

const scores = (key: 'wisdom' | 'charisma') => ({
  method: 'standardArray',
  scores: { strength: 8, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10, [key]: 16 },
})
const spells = (...names: string[]) => names.map((name) => ({ name, source: 'XPHB' }))

function caster(id: string, className: string, level: number, picks: string[], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 50,
    id,
    name: `${className} ${id}`,
    classes: [{ className, classSource: 'XPHB', subclass: null, level }],
    abilityScores: scores(className === 'Cleric' ? 'wisdom' : 'charisma'),
    ...(picks.length > 0 ? { spellChoices: [{ className, classSource: 'XPHB', spells: spells(...picks) }] } : {}),
    ...extra,
  }
}

const CLERIC = caster('r9a-cleric', 'Cleric', 3, ['Guidance', 'Light', 'Bless'])

async function openSpells(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
}

async function openManage(page: Page, character: { id: string }): Promise<Locator> {
  await openSpells(page, character)
  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  return drawer(page)
}

const drawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Manage Spells' })
const spellsPanel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const tabSpell = (page: Page, name: string): Locator => spellsPanel(page).locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) })
const prepared = (scope: Locator): Locator => scope.getByRole('region', { name: 'Prepared Spells' })
const addSpells = (scope: Locator): Locator => scope.getByRole('region', { name: 'Add Spells' })
const row = (scope: Locator, name: string): Locator =>
  scope.locator('.manage-spells__row', { has: scope.page().locator('.manage-spells__name', { hasText: new RegExp(`^${name}$`) }) })
const summary = (scope: Locator, text: string | RegExp): Locator => scope.locator('summary', { hasText: text })
const levelHeadings = (scope: Locator): Promise<string[]> => scope.locator('.manage-spells__level').allTextContents()

test('R9a a: Cleric 3 — the drawer holds Spell Slots (1st, 2nd), a Cleric section with both subsections and the real counters', async ({ page }) => {
  const panel = await openManage(page, CLERIC)
  await expect(summary(panel, 'Spell Slots')).toContainText('1st 4 · 2nd 2')
  await expect(panel.getByRole('group', { name: 'level 1 spell slots uses', exact: true }).getByRole('button')).toHaveCount(4)
  await expect(panel.getByRole('group', { name: 'level 2 spell slots uses', exact: true }).getByRole('button')).toHaveCount(2)
  await expect(summary(panel, /^Cleric$/)).toHaveCount(1)
  await expect(summary(panel, 'Prepared Spells (3)')).toHaveCount(1)
  await expect(summary(panel, 'Add Spells')).toHaveCount(1)
  await expect(panel.locator('.manage-spells__counter')).toHaveText(['Cantrips: 2/3', 'Prepared: 1/6'])
})

test('R9a b+c: Prepare puts a spell on the Spells tab at once and survives a reload; Unprepare in Prepared Spells takes it away', async ({ page }) => {
  let panel = await openManage(page, CLERIC)
  await addSpells(panel).getByRole('button', { name: 'Prepare Shield of Faith', exact: true }).click()
  await expect(addSpells(panel).getByRole('button', { name: 'Unprepare Shield of Faith', exact: true })).toBeVisible()
  await expect(tabSpell(page, 'Shield of Faith')).not.toHaveCount(0)
  await expect(panel.locator('.manage-spells__counter')).toHaveText(['Cantrips: 2/3', 'Prepared: 2/6'])

  await page.reload()
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(tabSpell(page, 'Shield of Faith')).not.toHaveCount(0)

  await page.getByRole('button', { name: 'Manage Spells', exact: true }).click()
  panel = drawer(page)
  await prepared(panel).getByRole('button', { name: 'Unprepare Shield of Faith', exact: true }).click()
  await expect(tabSpell(page, 'Shield of Faith')).toHaveCount(0)
  await expect(row(prepared(panel), 'Shield of Faith')).toHaveCount(0)
})

test('R9a d: a full counter disables every remaining Prepare, and every remaining Add', async ({ page }) => {
  const panel = await openManage(page, caster('r9a-full', 'Cleric', 3, ['Guidance', 'Light', 'Bless', 'Cure Wounds', 'Aid', 'Command', 'Sanctuary']))
  await addSpells(panel).getByRole('button', { name: 'Prepare Guiding Bolt', exact: true }).click()
  await expect(panel.locator('.manage-spells__counter--full')).toHaveText(['Prepared: 6/6'])
  const prepareButtons = addSpells(panel).getByRole('button', { name: /^Prepare / })
  expect(await prepareButtons.count()).toBeGreaterThan(0)
  for (const button of await prepareButtons.all()) await expect(button).toBeDisabled()

  await addSpells(panel).getByRole('button', { name: 'Add Thaumaturgy', exact: true }).click()
  await expect(panel.locator('.manage-spells__counter--full')).toHaveText(['Cantrips: 3/3', 'Prepared: 6/6'])
  const addButtons = addSpells(panel).getByRole('button', { name: /^Add / })
  expect(await addButtons.count()).toBeGreaterThan(0)
  for (const button of await addButtons.all()) await expect(button).toBeDisabled()
})

test('R9a e: level pills combine (1st + 2nd), none on shows every level; search narrows by name', async ({ page }) => {
  const panel = await openManage(page, CLERIC)
  const add = addSpells(panel)
  const pills = add.getByRole('group', { name: 'Filter by level' })
  await expect(pills.getByRole('button')).toHaveText(['Cantrip', '1st', '2nd'])
  await pills.getByRole('button', { name: '1st', exact: true }).click()
  await pills.getByRole('button', { name: '2nd', exact: true }).click()
  expect(await levelHeadings(add)).toEqual(['1st Level', '2nd Level'])
  await pills.getByRole('button', { name: '1st', exact: true }).click()
  await pills.getByRole('button', { name: '2nd', exact: true }).click()
  expect(await levelHeadings(add)).toEqual(['Cantrips', '1st Level', '2nd Level'])

  await add.getByRole('searchbox', { name: 'Search Cleric spells' }).fill('cure')
  const names = await add.locator('.manage-spells__name').allTextContents()
  expect(names.length).toBeGreaterThan(0)
  for (const name of names) expect(name.toLowerCase()).toContain('cure')
})

test('R9a f: Life Domain — Bless and Cure Wounds are always prepared with no button, and disabled with a note in Add Spells', async ({ page }) => {
  const life = caster('r9a-life', 'Cleric', 3, ['Guidance'])
  const lifeDomain = { ...life, classes: [{ ...life.classes[0]!, subclass: 'Life Domain' }] }
  const panel = await openManage(page, lifeDomain)
  for (const name of ['Bless', 'Cure Wounds']) {
    const own = row(prepared(panel), name)
    await expect(own.locator('.manage-spells__tag')).toHaveText('Always prepared')
    await expect(own.locator('.manage-spells__button')).toHaveCount(0)
    const offered = row(addSpells(panel), name)
    await expect(offered.getByRole('button', { name: `Prepare ${name}`, exact: true })).toBeDisabled()
    await expect(offered).toContainText('(already have it from Life Domain, always prepared)')
  }
})

test('R9a g: a Magic Initiate (Cleric) spell stays out of the class section and is disabled with a note in Add Spells', async ({ page }) => {
  const panel = await openManage(
    page,
    caster('r9a-initiate', 'Cleric', 3, ['Guidance'], {
      background: { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
      grantedFeats: [
        {
          origin: 'background',
          name: 'Magic Initiate; Cleric',
          source: 'XPHB',
          chosenAbility: 'wisdom',
          magicInitiate: { className: 'Cleric', classSource: 'XPHB', cantrips: spells('Sacred Flame', 'Thaumaturgy'), spell: { name: 'Healing Word', source: 'XPHB' } },
        },
      ],
    }),
  )
  await expect(row(prepared(panel), 'Healing Word')).toHaveCount(0)
  const offered = row(addSpells(panel), 'Healing Word')
  await expect(offered.getByRole('button', { name: 'Prepare Healing Word', exact: true })).toBeDisabled()
  await expect(offered).toContainText('(already have it from the Magic Initiate; Cleric feat)')
})

test('R9a h: a slot box clicked in the drawer fills the same box in the Spells tab heading', async ({ page }) => {
  const panel = await openManage(page, CLERIC)
  await panel.getByRole('group', { name: 'level 1 spell slots uses', exact: true }).getByRole('button').first().click()
  await expect(spellsPanel(page).getByRole('group', { name: 'level 1 spell slots uses', exact: true }).locator('.sheet__use-box--used')).toHaveCount(1)
})

test('R9a i: Warlock 3 — a Pact Magic section, no ordinary slots, and Prepare/Unprepare with the "Prepared:" counter', async ({ page }) => {
  const panel = await openManage(page, caster('r9a-warlock', 'Warlock', 3, ['Eldritch Blast', 'Hex']))
  await expect(summary(panel, 'Pact Magic')).toHaveCount(1)
  await expect(summary(panel, 'Spell Slots')).toHaveCount(0)
  await expect(panel.locator('.manage-spells__counter').last()).toHaveText(/^Prepared: 1\/\d+$/)
  await expect(prepared(panel).getByRole('button', { name: 'Unprepare Hex', exact: true })).toBeVisible()
  await expect(addSpells(panel).getByRole('button', { name: 'Prepare Armor of Agathys', exact: true })).toBeEnabled()
})

test('R9a j: Sorcerer 1 with no spells gets the button and can add a cantrip; a Fighter gets no button', async ({ page }) => {
  const panel = await openManage(page, caster('r9a-sorcerer', 'Sorcerer', 1, []))
  await addSpells(panel).getByRole('button', { name: 'Add Fire Bolt', exact: true }).click()
  await expect(tabSpell(page, 'Fire Bolt')).not.toHaveCount(0)
})

test('R9a j2: Fighter 1 — no Manage Spells button', async ({ page }) => {
  await openSpells(page, caster('r9a-fighter', 'Fighter', 1, []))
  await expect(page.getByRole('button', { name: 'Manage Spells', exact: true })).toHaveCount(0)
})

const BARD_10 = caster('r9b-bard10', 'Bard', 10, ['Vicious Mockery'])
const secrets = (scope: Locator): Locator => scope.locator('.manage-spells__secrets')

test('R9b a: Bard 10 — Fireball is offered with the Magical Secrets tag; Prepare puts it on the Spells tab with the Bard save DC, and Prepared Spells keeps the tag', async ({ page }) => {
  const panel = await openManage(page, BARD_10)
  await expect(secrets(row(addSpells(panel), 'Fireball'))).toHaveText('Magical Secrets')
  await addSpells(panel).getByRole('button', { name: 'Prepare Fireball', exact: true }).click()
  await expect(secrets(row(prepared(panel), 'Fireball'))).toHaveText('Magical Secrets')
  const fireball = spellsPanel(page).locator('.sheet__spell-row', { has: page.locator('.sheet__spell-name', { hasText: /^Fireball$/ }) })
  await expect(fireball.locator('.sheet__action-to-hit').first()).toContainText('DC 15 DEX')
})

test('R9b b: Bard 9 — Fireball is not offered, nothing carries the tag', async ({ page }) => {
  const panel = await openManage(page, caster('r9b-bard9', 'Bard', 9, []))
  await expect(row(addSpells(panel), 'Fireball')).toHaveCount(0)
  await expect(secrets(panel)).toHaveCount(0)
})

test('R9b c1: Fire Bolt (a Wizard-only cantrip) is never offered at Bard 10, nor is a 6th-level spell', async ({ page }) => {
  const panel = await openManage(page, BARD_10)
  await expect(row(addSpells(panel), 'Fire Bolt')).toHaveCount(0)
  await expect(row(addSpells(panel), 'Chain Lightning')).toHaveCount(0)
})

test('R9b c2: Bard 11 — Chain Lightning is offered with the tag', async ({ page }) => {
  const panel = await openManage(page, caster('r9b-bard11', 'Bard', 11, []))
  await expect(secrets(row(addSpells(panel), 'Chain Lightning'))).toHaveText('Magical Secrets')
})

test('R9b d: Cure Wounds is on the Bard list itself, so it carries no tag', async ({ page }) => {
  const panel = await openManage(page, BARD_10)
  await expect(row(addSpells(panel), 'Cure Wounds')).toHaveCount(1)
  await expect(secrets(row(addSpells(panel), 'Cure Wounds'))).toHaveCount(0)
})

test('R9a k: ▸ on a row opens the spell text in the drawer', async ({ page }) => {
  const panel = await openManage(page, CLERIC)
  const bless = row(addSpells(panel), 'Bless')
  await bless.getByRole('button', { name: 'Bless text', exact: true }).click()
  await expect(bless.locator('.manage-spells__text')).toContainText('Casting Time')
})
