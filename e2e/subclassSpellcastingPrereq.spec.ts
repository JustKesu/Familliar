import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseLevelFeat, expectStep, featOrAsiSelect, fillUpToBackground, levelCard, next, select } from './wizard.ts'

/* SC-1 (D413): a subclass with its own Spellcasting (Eldritch Knight, Arcane Trickster) meets the "spellcasting" feat prerequisite. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
const order = (entries: [string, number][]) => entries.flatMap(([className, level]) => Array.from({ length: level }, () => ({ className, classSource: XPHB })))

function seeded(id: string, classes: [string, number, string | null][], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 68,
    id,
    name: id,
    classes: classes.map(([className, level, subclass]) => ({ className, classSource: XPHB, subclass, level })),
    levelOrder: order(classes.map(([className, level]) => [className, level])),
    createdAtLevel: classes[0]![1],
    abilityScores: { method: 'standardArray', scores: { strength: 13, dexterity: 15, constitution: 14, intelligence: 12, wisdom: 8, charisma: 10 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    ...extra,
  }
}

const rogueSeed = (id: string, subclass: string) =>
  seeded(id, [['Rogue', 3, subclass]], {
    classSkills: ['acrobatics', 'deception', 'perception', 'stealth'],
    expertiseSkills: [
      { name: 'stealth', level: 1 },
      { name: 'perception', level: 1 },
    ],
    ...(subclass === 'Arcane Trickster' ? { spellChoices: [{ className: 'Rogue', classSource: XPHB, spells: refs(['Mage Hand', 'Minor Illusion', 'Fire Bolt', 'Shield', 'Magic Missile', 'Sleep']) }] } : {}),
  })

async function openSheet(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

const current = (page: Page): Locator => page.locator('[aria-current="step"]')
const counter = (page: Page, label: 'Cantrips' | 'Prepared'): Locator => page.locator('.manage-spells__counter', { hasText: new RegExp(`^${label}:`) })
const warCaster = (page: Page, level: number): Locator => featOrAsiSelect(page, level).locator('option[value="War Caster|XPHB"]')

async function fillSpells(page: Page): Promise<void> {
  const addSpells = page.getByRole('region', { name: 'Add Spells' })
  for (const [label, button] of [
    ['Cantrips', /^Add /],
    ['Prepared', /^Prepare /],
  ] as const) {
    if ((await counter(page, label).count()) === 0) continue
    for (;;) {
      const [, have, max] = (await counter(page, label).innerText()).match(/(\d+)\/(\d+)/)!.map(Number)
      if (have! >= max!) break
      await addSpells.getByRole('button', { name: button, disabled: false }).first().click()
      await expect(counter(page, label)).toHaveText(new RegExp(`^${label}: ${have! + 1}/`))
    }
  }
}

/** Walks Next from the current step to the ASI / Feat step, filling the steps that need picks on the way. */
async function walkToAsi(page: Page): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const step = (await current(page).textContent()) ?? ''
    if (/ASI \/ Feat/.test(step)) return
    if (/Proficiencies/.test(step) && (await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).count()) > 0) {
      await page.getByRole('checkbox', { name: 'Dwarvish (XPHB)' }).check()
      await page.getByRole('checkbox', { name: 'Elvish (XPHB)' }).check()
    }
    if (/Ability scores/.test(step)) {
      for (const [ability, score] of [['Strength', '15'], ['Dexterity', '14'], ['Constitution', '13'], ['Intelligence', '12'], ['Wisdom', '10'], ['Charisma', '8']]) {
        await select(page, ability!).selectOption({ label: score! })
      }
    }
    if (/Spells/.test(step)) await fillSpells(page)
    await next(page)
    await expect(current(page)).not.toHaveText(step)
  }
  await expectStep(page, 'ASI / Feat')
}

async function levelUp(page: Page, option: string): Promise<void> {
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: option, exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)
}

async function expectWarCasterTakeable(page: Page, level: number): Promise<void> {
  await expect(warCaster(page, level)).toHaveText('War Caster · XPHB')
  await expect(warCaster(page, level)).not.toHaveAttribute('disabled')
  await chooseLevelFeat(page, level, 'War Caster')
  await expect(featOrAsiSelect(page, level)).toHaveValue('War Caster|XPHB')
  await expect(levelCard(page, level).getByText(/no longer meets its prerequisite/)).toHaveCount(0)
}

test('SC-1 a: creation wizard Fighter 4 Eldritch Knight — War Caster has no "needs" text and can be taken', async ({ page }) => {
  await fillUpToBackground(page, { name: 'Knight Caster', level: 4, species: 'Dwarf|XPHB', subclass: 'Eldritch Knight' })
  await walkToAsi(page)
  await expectWarCasterTakeable(page, 4)
})

test('SC-1 b: Rogue 3 Arcane Trickster → Rogue 4 — War Caster can be taken', async ({ page }) => {
  await openSheet(page, rogueSeed('sc1-b', 'Arcane Trickster'))
  await levelUp(page, 'Rogue 3 → 4')
  await walkToAsi(page)
  await expectWarCasterTakeable(page, 4)
})

test('SC-1 c: Rogue 3 Thief → Rogue 4 — War Caster still needs a spellcasting class', async ({ page }) => {
  await openSheet(page, rogueSeed('sc1-c', 'Thief'))
  await levelUp(page, 'Rogue 3 → 4')
  await walkToAsi(page)
  await expect(warCaster(page, 4)).toHaveText('War Caster · XPHB (needs a spellcasting class)')
  await expect(warCaster(page, 4)).toHaveAttribute('disabled', '')
})

test('SC-1 d: Fighter 5 / Rogue 3 Arcane Trickster — Manage Feats offers War Caster', async ({ page }) => {
  await openSheet(
    page,
    seeded(
      'sc1-d',
      [
        ['Fighter', 5, 'Champion'],
        ['Rogue', 3, 'Arcane Trickster'],
      ],
      {
        classSkills: ['athletics', 'perception'],
        fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense' }],
        multiclassPicks: [{ className: 'Rogue', classSource: XPHB, kind: 'skill', name: 'stealth' }],
        featAsiChoices: [{ level: 4, kind: 'asi', increases: { dexterity: 2 } }],
        spellChoices: [{ className: 'Rogue', classSource: XPHB, spells: refs(['Mage Hand', 'Minor Illusion', 'Fire Bolt', 'Shield', 'Magic Missile', 'Sleep']) }],
      },
    ),
  )
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Manage Feats' })
  await panel.getByRole('searchbox', { name: 'Search feats' }).fill('War Caster')
  await expect(panel.getByRole('region', { name: 'Add Feats' }).getByRole('button', { name: 'Add War Caster', exact: true }).first()).toBeVisible()
})
