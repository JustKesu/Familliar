import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, expectStep, next, select, wizardNav } from './wizard.ts'

/* M7b (D330): entering a new class through Level up. Seeded at schema 60 as the wizard saves a Fighter 4. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

/** STR 15 (+2 ASI = 17), DEX 14, CON 14 (+2), INT 12 (+1 Acolyte = 13), WIS 10 (+2 Acolyte = 12), CHA 12. */
function fighter(id: string, extra: Record<string, unknown> = {}, scores: Record<string, number> = {}) {
  return {
    schemaVersion: 60,
    id,
    name: id,
    classes: [{ className: 'Fighter', classSource: XPHB, subclass: 'Champion', level: 4 }],
    levelOrder: Array.from({ length: 4 }, () => ({ className: 'Fighter', classSource: XPHB })),
    createdAtLevel: 1,
    abilityScores: { method: 'roll', scores: { strength: 15, dexterity: 14, constitution: 14, intelligence: 12, wisdom: 10, charisma: 12, ...scores } },
    species: { name: 'Dwarf', source: XPHB },
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
    abilityBonus: { wisdom: 2, intelligence: 1 },
    languages: [
      { name: 'Common', source: XPHB, grantedBy: 'automatic' },
      { name: 'Dwarvish', source: XPHB, grantedBy: 'creation' },
      { name: 'Elvish', source: XPHB, grantedBy: 'creation' },
    ],
    classSkills: ['athletics', 'perception'],
    masteries: [{ name: 'Longsword' }, { name: 'Greatsword' }, { name: 'Handaxe' }, { name: 'Battleaxe' }],
    fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }],
    featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }],
    hitPointLevels: [2, 3, 4].map((level) => ({ level, kind: 'average', dieResult: 6 })),
    ...extra,
  }
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

const levelUpButton = (page: Page): Locator => page.locator('.sheet__level-up')
const classWindow = (page: Page): Locator => page.getByRole('dialog', { name: 'Level up which class?' })
const newClassList = (page: Page): Locator => classWindow(page).getByRole('region', { name: 'New class' })
const saveRow = (page: Page, ability: string): Locator =>
  page.locator('.sheet__saving-throws .sheet__row').filter({ has: page.getByRole('button', { name: `${ability} saving throw breakdown`, exact: true }) })
const skillStatus = (page: Page, skill: string) => page.locator('.sheet__skills .sheet__row', { hasText: skill }).locator('.sheet__prof-mark').getAttribute('data-status')

async function maxHp(page: Page): Promise<number> {
  const match = /\/\s*(\d+)/.exec(await page.locator('.sheet__hit-points-value').first().innerText())
  return match ? Number(match[1]) : NaN
}

async function enterClass(page: Page, className: string): Promise<void> {
  await levelUpButton(page).click()
  await classWindow(page).getByRole('button', { name: '+ New class…' }).click()
  await newClassList(page).getByRole('button', { name: className, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/level-up/${className}/XPHB$`))
}

/** Fills the Spells step's counters with the first offered spells, after any named cantrips. */
async function fillSpells(page: Page, cantrips: string[] = []): Promise<void> {
  const addSpells = page.getByRole('region', { name: 'Add Spells' })
  for (const name of cantrips) await addSpells.getByRole('button', { name: new RegExp(`^Add ${name}\\b`) }).first().click()
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

async function averageHitPoints(page: Page): Promise<void> {
  await expectStep(page, 'Hit points')
  await page.getByRole('radiogroup', { name: 'Level 5 hit points method', exact: true }).getByRole('radio', { name: /^Average/ }).check()
  await next(page)
}

async function saveLevel5(page: Page, id: string): Promise<void> {
  await expectStep(page, 'Review and save')
  await wizardNav(page).getByRole('button', { name: 'Save level 5' }).click()
  await expect(page).toHaveURL(new RegExp(`#/character/${id}$`))
}

test('M7b a: a single-class Fighter 4 — the window shows "Fighter 4 → 5" and "+ New class…"', async ({ page }) => {
  await openSheet(page, fighter('m7b-a'))
  await levelUpButton(page).click()
  await expect(classWindow(page).locator('.level-up-class__option')).toHaveText(['Fighter 4 → 5'])
  await expect(classWindow(page).getByRole('button', { name: 'Fighter 4 → 5' })).toBeFocused()
  await expect(classWindow(page).getByRole('button', { name: '+ New class…' })).toBeVisible()
})

test('M7b b + f: Fighter 4 with INT 13 and no level history takes Wizard — sheet, saves, cantrips, HP, armor; Level up then offers both classes', async ({ page }) => {
  const { levelOrder: _levelOrder, ...withoutHistory } = fighter('m7b-b')
  await openSheet(page, withoutHistory)
  // d10 max 10 + 3 × 6 + CON 2 × 4 + Dwarven Toughness 1 × 4.
  await expect.poll(() => maxHp(page)).toBe(40)
  const armorBefore = (await page.locator('.sheet__proficiencies').textContent()) ?? ''

  await enterClass(page, 'Wizard')
  await expectStep(page, 'Spells')
  await fillSpells(page, ['Fire Bolt', 'Light', 'Mage Hand'])
  await next(page)
  await averageHitPoints(page)
  await saveLevel5(page, 'm7b-b')

  await expect(page.locator('.sheet__classes')).toHaveText('Fighter 4 (Champion) / Wizard 1')
  await expect(page.locator('.sheet__identity')).toContainText('Level 5')
  for (const [ability, status] of [
    ['Strength', 'proficient'],
    ['Constitution', 'proficient'],
    ['Intelligence', 'none'],
    ['Wisdom', 'none'],
  ]) {
    await expect(saveRow(page, ability).locator('.sheet__prof-mark')).toHaveAttribute('data-status', status)
  }
  // d6 average 4 + CON 2 + Dwarven Toughness 1.
  await expect.poll(() => maxHp(page)).toBe(47)
  await expect(page.locator('.sheet__proficiencies')).toHaveText(armorBefore)
  await page.getByRole('button', { name: 'Proficiencies details' }).click()
  await expect(page.getByRole('dialog', { name: 'Proficiencies', exact: true })).not.toContainText('Wizard')
  await page.keyboard.press('Escape')

  await page.getByRole('tab', { name: 'Spells' }).click()
  const spells = page.getByRole('tabpanel', { name: 'Spells' })
  for (const name of ['Fire Bolt', 'Light', 'Mage Hand']) await expect(spells.locator('.sheet__spell-name', { hasText: new RegExp(`^${name}$`) }).first()).toBeVisible()

  await expect(levelUpButton(page)).toHaveText('Level up to 6')
  await levelUpButton(page).click()
  await expect(classWindow(page).locator('.level-up-class__option')).toHaveText(['Fighter 4 → 5', 'Wizard 1 → 2'])
})

test('M7b c: Sorcerer is listed but disabled with the Charisma reason; Monk names both of its scores', async ({ page }) => {
  await openSheet(page, fighter('m7b-c'))
  await levelUpButton(page).click()
  await classWindow(page).getByRole('button', { name: '+ New class…' }).click()
  const sorcerer = newClassList(page).getByRole('button', { name: 'Sorcerer', exact: true })
  await expect(sorcerer).toBeDisabled()
  await expect(sorcerer).toHaveAccessibleDescription('Needs Charisma 13 (Sorcerer). You have 12.')
  await expect(newClassList(page).getByRole('button', { name: 'Monk', exact: true })).toHaveAccessibleDescription('Needs Dexterity 13 and Wisdom 13 (Monk). You have Dexterity 14, Wisdom 12.')
  await expect(newClassList(page).getByRole('button', { name: 'Wizard', exact: true })).toBeEnabled()
  await expect(newClassList(page).getByRole('button', { name: 'Fighter', exact: true })).toHaveCount(0)
})

test('M7b d: Fighter takes Rogue — one Rogue skill on Proficiencies, Expertise sees it, Stealth proficient, Thieves’ Tools from Rogue (multiclass)', async ({ page }) => {
  await openSheet(page, fighter('m7b-d'))
  await enterClass(page, 'Rogue')

  await expectStep(page, 'Class')
  for (const weapon of ['Dagger', 'Shortsword']) await chooseButton(page, weapon).first().click()
  await next(page)

  await expectStep(page, 'Expertise')
  for (const skill of ['Athletics', 'Perception']) await page.getByRole('checkbox', { name: new RegExp(`^${skill} `) }).check()
  await next(page)

  await expectStep(page, 'Proficiencies')
  await select(page, "Thieves' Cant language:").selectOption({ index: 1 })
  const skill = select(page, 'Rogue multiclass skill:')
  // Held skills (class, background) are never offered.
  await expect(skill.locator('option', { hasText: /^Athletics$/ })).toHaveCount(0)
  await skill.selectOption('stealth')
  await wizardNav(page).getByRole('button', { name: 'Back', exact: true }).click()
  await expectStep(page, 'Expertise')
  await expect(page.getByRole('checkbox', { name: 'Stealth (from Rogue (multiclass))' })).toBeVisible()
  await next(page)
  await expectStep(page, 'Proficiencies')
  await next(page)
  await averageHitPoints(page)
  await saveLevel5(page, 'm7b-d')

  await expect(page.locator('.sheet__classes')).toHaveText('Fighter 4 (Champion) / Rogue 1')
  await expect.poll(() => skillStatus(page, 'Stealth')).toBe('proficient')
  await expect(page.locator('.sheet__proficiencies')).toContainText("Thieves' Tools")
  await page.getByRole('button', { name: 'Proficiencies details' }).click()
  await expect(page.getByRole('dialog', { name: 'Proficiencies', exact: true })).toContainText("Thieves' Tools — Rogue (multiclass)")
})

test('M7b e: Fighter with CHA 13 takes Bard — a skill and a musical instrument picked and shown', async ({ page }) => {
  await openSheet(page, fighter('m7b-e', {}, { charisma: 13 }))
  await enterClass(page, 'Bard')

  await expectStep(page, 'Proficiencies')
  // D328: never the Bard's three starting instruments.
  await expect(select(page, 'Bard tool 1:')).toHaveCount(0)
  await select(page, 'Bard multiclass skill:').selectOption('arcana')
  const instrument = select(page, 'Bard multiclass instrument:')
  await instrument.selectOption({ index: 1 })
  const instrumentName = (await instrument.locator('option:checked').innerText()).trim()
  await next(page)

  await expectStep(page, 'Spells')
  await fillSpells(page)
  await next(page)
  await averageHitPoints(page)
  await saveLevel5(page, 'm7b-e')

  await expect(page.locator('.sheet__classes')).toHaveText('Fighter 4 (Champion) / Bard 1')
  await expect.poll(() => skillStatus(page, 'Arcana')).toBe('proficient')
  await page.getByRole('button', { name: 'Proficiencies details' }).click()
  await expect(page.getByRole('dialog', { name: 'Proficiencies', exact: true })).toContainText(`${instrumentName} — Bard (multiclass)`)
})

test('M7b g: a Fighter 20, and a Fighter 19 / Wizard 1, keep Level up disabled', async ({ page }) => {
  const fighter20 = fighter('m7b-g', {
    classes: [{ className: 'Fighter', classSource: XPHB, subclass: 'Champion', level: 20 }],
    levelOrder: Array.from({ length: 20 }, () => ({ className: 'Fighter', classSource: XPHB })),
    hitPointLevels: undefined,
    featAsiChoices: undefined,
  })
  await openSheet(page, fighter20)
  await expect(levelUpButton(page)).toBeDisabled()
  await expect(levelUpButton(page)).toHaveText('Level up unavailable: Level 20 is the highest character level.')

  const mixed = fighter('m7b-g2', {
    classes: [
      { className: 'Fighter', classSource: XPHB, subclass: 'Champion', level: 19 },
      { className: 'Wizard', classSource: XPHB, subclass: null, level: 1 },
    ],
    levelOrder: [...Array.from({ length: 19 }, () => ({ className: 'Fighter', classSource: XPHB })), { className: 'Wizard', classSource: XPHB }],
    hitPointLevels: undefined,
    featAsiChoices: undefined,
  })
  await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), { key: STORAGE_KEY, payload: JSON.stringify([fighter20, mixed]) })
  await page.goto('/#/')
  await page.reload()
  await page.getByRole('button', { name: 'm7b-g2', exact: true }).click()
  await expect(levelUpButton(page)).toBeDisabled()
  await expect(levelUpButton(page)).toHaveText('Level up unavailable: Level 20 is the highest character level.')
})
