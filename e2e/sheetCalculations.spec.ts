import { expect, test, type Locator, type Page } from '@playwright/test'

/* F-7a: calculation fixes from the sheet review (D315). Characters seeded into storage, as in breathWeapon.spec.ts. */
const STORAGE_KEY = 'familliar:characters'

type Scores = Record<'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma', number>
const SCORES: Scores = { strength: 15, dexterity: 16, constitution: 13, intelligence: 10, wisdom: 10, charisma: 8 }

function seeded(id: string, className: string, level: number, subclass: string | null, extra: Record<string, unknown> = {}, scores: Partial<Scores> = {}) {
  return {
    schemaVersion: 56,
    id,
    name: id,
    classes: [{ className, classSource: 'XPHB', subclass, level }],
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: { ...SCORES, ...scores } },
    species: { name: 'Human', source: 'XPHB' },
    speciesSize: 'M',
    spellChoices: [],
    ...extra,
  }
}

const item = (name: string, equipped: 'worn' | 'held') => ({ name, source: 'XPHB', quantity: 1, equipped })
const spells = (...names: string[]) => names.map((name) => ({ name, source: 'XPHB' }))

async function open(page: Page, saved: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([saved]) },
  )
  await page.goto(`/#/character/${saved.id}`)
}

async function breakdown(page: Page, button: string): Promise<Locator> {
  await page.getByRole('button', { name: button, exact: true }).click()
  return page.getByRole('dialog')
}

const speed = (page: Page): Locator => page.locator('.sheet__speed .sheet__card-value')
const save = (page: Page, ability: string): Locator => page.getByRole('button', { name: `Roll ${ability} saving throw` })
const actionRow = (page: Page, name: string): Locator =>
  page.getByRole('tabpanel', { name: 'Actions' }).locator('.sheet__action-row', { has: page.getByRole('button', { name: `${name} breakdown`, exact: true }) })
const spellsPanel = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Spells' })
const spellName = (page: Page, name: string): Locator => page.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) })
const kindRow = (page: Page, name: string, kind: 'cast' | 'use'): Locator => spellsPanel(page).locator(`.sheet__spell-row--${kind}`, { has: spellName(page, name) })

test('F-7a a: Fighter 1 with Archery and a Longbow — +2 to hit, shown as its own row', async ({ page }) => {
  await open(page, seeded('f7a-archery', 'Fighter', 1, null, { fightingStyle: 'Archery', inventory: [item('Longbow', 'held')] }))
  await page.getByRole('tab', { name: 'Actions' }).click()
  // DEX +3, PB +2, Archery +2.
  await expect(page.getByRole('button', { name: 'Roll Longbow to hit' })).toHaveText('+7')
  await expect(await breakdown(page, 'Longbow breakdown')).toContainText('Archery (Fighting Style): +2')
})

test('F-7a a: Fighter 1 with Defense in Chain Mail — AC 17', async ({ page }) => {
  await open(page, seeded('f7a-defense', 'Fighter', 1, null, { fightingStyle: 'Defense', inventory: [item('Chain Mail', 'worn')] }))
  await expect(page.locator('.sheet__armour-class-value')).toHaveText('17')
  await expect(await breakdown(page, 'Armour Class breakdown')).toContainText('Defense (Fighting Style): +1')
})

test('F-7a b: Monk 6 without armour — Speed 45; the same Monk with a Shield — 30', async ({ page }) => {
  await open(page, seeded('f7a-monk', 'Monk', 6, 'Warrior of the Open Hand'))
  await expect(speed(page)).toHaveText('45 ft')
  await expect(await breakdown(page, 'Speed breakdown')).toContainText('Unarmored Movement: +15')
})

test('F-7a b: Monk 6 with a Shield — Speed 30, Unarmored Movement named as not applied', async ({ page }) => {
  await open(page, seeded('f7a-monk-shield', 'Monk', 6, 'Warrior of the Open Hand', { inventory: [item('Shield', 'held')] }))
  await expect(speed(page)).toHaveText('30 ft')
  await expect(await breakdown(page, 'Speed breakdown')).toContainText('not while wielding Shield')
})

test('F-7a c: Paladin 6, Cha 16 — every save +3 from Aura of Protection, named in the breakdown', async ({ page }) => {
  await open(page, seeded('f7a-paladin', 'Paladin', 6, 'Oath of Devotion', {}, { strength: 10, charisma: 16 }))
  // STR +0 (not proficient) + 3; WIS +0 + PB 3 + 3.
  await expect(save(page, 'Strength')).toHaveText('+3')
  await expect(save(page, 'Wisdom')).toHaveText('+6')
  await expect(await breakdown(page, 'Strength saving throw breakdown')).toContainText('Aura of Protection (while conscious): +3')
})

test('F-7a d: Human Fighter with three Magic Initiates — Guiding Bolt casts with WIS everywhere, Thunderwave gets one free-cast row per instance', async ({ page }) => {
  const initiate = (className: string, cantrips: string[], spell: string) => ({ className, classSource: 'XPHB', cantrips: spells(...cantrips), spell: { name: spell, source: 'XPHB' } })
  await open(
    page,
    seeded(
      'f7a-initiates',
      'Fighter',
      4,
      null,
      {
        background: { name: 'Sage', source: 'XPHB', skillProficiencies: ['arcana', 'history'], toolProficiency: "Calligrapher's Supplies" },
        grantedFeats: [
          { origin: 'species', name: 'Magic Initiate', source: 'XPHB', chosenAbility: 'wisdom', magicInitiate: initiate('Cleric', ['Guidance', 'Sacred Flame'], 'Guiding Bolt') },
          { origin: 'background', name: 'Magic Initiate; Wizard', source: 'XPHB', chosenAbility: 'intelligence', magicInitiate: initiate('Wizard', ['Fire Bolt', 'Light'], 'Thunderwave') },
        ],
        featAsiChoices: [{ level: 4, kind: 'feat', name: 'Magic Initiate', source: 'XPHB', chosenAbility: 'intelligence', magicInitiate: initiate('Druid', ['Druidcraft', 'Produce Flame'], 'Thunderwave') }],
      },
      { intelligence: 16, wisdom: 10 },
    ),
  )
  // WIS +0, PB +2; INT +3 would give +5.
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(actionRow(page, 'Guiding Bolt').locator('.sheet__action-to-hit')).toContainText('+2')
  await page.getByRole('tab', { name: 'Spells' }).click()
  await expect(kindRow(page, 'Guiding Bolt', 'use').locator('.sheet__action-to-hit')).toContainText('+2')
  await expect(kindRow(page, 'Thunderwave', 'use')).toHaveCount(2)
  for (const row of await kindRow(page, 'Thunderwave', 'use').all()) await expect(row.locator('.sheet__action-to-hit')).toContainText('DC 13')
})

test('F-7a e: Wizard 3 Tiefling (Infernal Legacy, CHA) — Hellish Rebuke CAST row DC equals the Actions DC', async ({ page }) => {
  await open(
    page,
    seeded('f7a-tiefling', 'Wizard', 3, 'Evoker', { species: { name: 'Tiefling; Infernal Legacy', source: 'XPHB' }, speciesSpellcastingAbility: 'charisma' }, { intelligence: 16, charisma: 10 }),
  )
  // 8 + PB 2 + CHA +0; the Wizard's INT would give 13.
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(actionRow(page, 'Hellish Rebuke').locator('.sheet__action-to-hit')).toContainText('DC 10')
  await page.getByRole('tab', { name: 'Spells' }).click()
  // The 1st-level CAST row and its 2nd-level upcast row.
  await expect(kindRow(page, 'Hellish Rebuke', 'cast')).toHaveCount(2)
  for (const row of await kindRow(page, 'Hellish Rebuke', 'cast').all()) await expect(row.locator('.sheet__action-to-hit')).toContainText('DC 10')
})

test('F-7a f: Sorcerer 3 Draconic — Draconic Resilience adds +3 to max HP', async ({ page }) => {
  await open(page, seeded('f7a-draconic', 'Sorcerer', 3, 'Draconic Sorcery'))
  await expect(await breakdown(page, 'Hit points details')).toContainText('Draconic Resilience (+1 per Sorcerer level): +3')
})
