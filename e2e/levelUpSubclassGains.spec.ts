import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, createFighter, next, stepBar, wizardNav } from './wizard.ts'

/* LS-1 (D411): a level up that reaches the subclass level walks the steps and lists the features of the subclass chosen on its Class step. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const refs = (names: string[]) => names.map((name) => ({ name, source: XPHB }))
const order = (entries: [string, number][]) => entries.flatMap(([className, level]) => Array.from({ length: level }, () => ({ className, classSource: XPHB })))

function seeded(id: string, classes: [string, number][], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 68,
    id,
    name: id,
    classes: classes.map(([className, level]) => ({ className, classSource: XPHB, subclass: null, level })),
    levelOrder: order(classes),
    createdAtLevel: classes[0]![1],
    abilityScores: { method: 'standardArray', scores: { strength: 13, dexterity: 15, constitution: 14, intelligence: 12, wisdom: 8, charisma: 10 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
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

const current = (page: Page): Locator => page.locator('[aria-current="step"]')
const counter = (page: Page, label: 'Cantrips' | 'Prepared'): Locator => page.locator('.manage-spells__counter', { hasText: new RegExp(`^${label}:`) })
const whatsNew = (page: Page, level: number): Locator => page.getByRole('region', { name: `Level ${level} — What's new` })
const spellName = (page: Page, name: string): Locator =>
  page.getByRole('tabpanel', { name: 'Spells' }).locator('.sheet__spell-name', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) })

async function levelUp(page: Page, option: string): Promise<void> {
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: option, exact: true }).click()
  await expect(page).toHaveURL(/\/level-up/)
}

/** Fills the Spells step's counters with the first offered spells and returns their names. */
async function fillSpells(page: Page): Promise<string[]> {
  const addSpells = page.getByRole('region', { name: 'Add Spells' })
  const names: string[] = []
  for (const [label, button] of [
    ['Cantrips', /^Add /],
    ['Prepared', /^Prepare /],
  ] as const) {
    if ((await counter(page, label).count()) === 0) continue
    for (;;) {
      const [, have, max] = (await counter(page, label).innerText()).match(/(\d+)\/(\d+)/)!.map(Number)
      if (have! >= max!) break
      const target = addSpells.getByRole('button', { name: button, disabled: false }).first()
      names.push(((await target.getAttribute('aria-label')) ?? '').replace(button, '').trim())
      await target.click()
      await expect(counter(page, label)).toHaveText(new RegExp(`^${label}: ${have! + 1}/`))
    }
  }
  return names
}

/** Walks from the Class step (already done) to Review; returns the steps seen and the spells picked. */
async function walkToReview(page: Page, level: number): Promise<{ seen: string[]; spells: string[] }> {
  const seen: string[] = []
  const spells: string[] = []
  for (let i = 0; i < 12; i++) {
    const step = (await current(page).textContent()) ?? ''
    seen.push(step)
    if (/Review and save/.test(step)) break
    if (/Spells/.test(step)) spells.push(...(await fillSpells(page)))
    if (/Hit points/.test(step)) await page.getByRole('radiogroup', { name: `Level ${level} hit points method`, exact: true }).getByRole('radio', { name: /^Average/ }).check()
    await next(page)
    await expect(current(page)).not.toHaveText(step)
  }
  return { seen, spells }
}

async function saveAndCheckSpells(page: Page, level: number, spells: string[]): Promise<void> {
  await wizardNav(page).getByRole('button', { name: `Save level ${level}` }).click()
  await expect(page).not.toHaveURL(/\/level-up/)
  await page.getByRole('tab', { name: 'Spells', exact: true }).click()
  for (const name of spells) await expect(spellName(page, name).first()).toBeVisible()
}

test('LS-1 a: Fighter 2 → 3 Eldritch Knight walks Spells (2 cantrips, 3 prepared), Review lists War Bond, the sheet has the spells', async ({ page }) => {
  await createFighter(page, { name: 'Knight Rising', level: 2, species: 'Dwarf|XPHB' })
  await levelUp(page, 'Fighter 2 → 3')
  await chooseButton(page, 'Eldritch Knight').click()
  await next(page)

  await expect(current(page)).toContainText('Spells')
  await expect(counter(page, 'Cantrips')).toHaveText(/^Cantrips: 0\/2/)
  await expect(counter(page, 'Prepared')).toHaveText(/^Prepared: 0\/3/)
  const { seen, spells } = await walkToReview(page, 3)
  expect(seen.some((step) => /Spells/.test(step))).toBe(true)
  expect(spells).toHaveLength(5)
  await expect(whatsNew(page, 3)).toContainText('War Bond')
  await saveAndCheckSpells(page, 3, spells)
  await expect(page.locator('.sheet__classes')).toHaveText('Fighter 3 (Eldritch Knight)')
})

test('LS-1 b: Fighter 5 / Rogue 2 → Rogue 3 Arcane Trickster walks the Rogue Spells step, Review lists Mage Hand Legerdemain', async ({ page }) => {
  await openSheet(
    page,
    seeded('ls1-b', [
      ['Fighter', 5],
      ['Rogue', 2],
    ], {
      classSkills: ['athletics', 'perception'],
      fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense' }],
      multiclassPicks: [{ className: 'Rogue', classSource: XPHB, kind: 'skill', name: 'stealth' }],
      featAsiChoices: [{ level: 4, kind: 'asi', increases: { dexterity: 2 } }],
    }),
  )
  await levelUp(page, 'Rogue 2 → 3')
  await chooseButton(page, 'Arcane Trickster').click()
  await next(page)

  await expect(current(page)).toContainText('Spells')
  await expect(page.getByRole('searchbox', { name: /Search Rogue spells/ })).toBeVisible()
  const { spells } = await walkToReview(page, 8)
  expect(spells.length).toBeGreaterThan(0)
  await expect(whatsNew(page, 8)).toContainText('Mage Hand Legerdemain')
  // D415: the Review class line names the subclass chosen on this level up.
  await expect(page.locator('.review__line')).toContainText('Fighter 5 / Rogue 3 (Arcane Trickster)')
  await saveAndCheckSpells(page, 8, spells)
  await expect(page.locator('.sheet__classes')).toHaveText('Fighter 5 / Rogue 3 (Arcane Trickster)')
})

test('LS-1 c: Bard 2 → 3 College of Valor lists Combat Inspiration and Martial Training in the Review', async ({ page }) => {
  await openSheet(
    page,
    seeded('ls1-c', [['Bard', 2]], {
      classSkills: ['acrobatics', 'history', 'performance'],
      hitPointLevels: [{ level: 2, kind: 'average', dieResult: 5 }],
      spellChoices: [{ className: 'Bard', classSource: XPHB, spells: refs(['Vicious Mockery', 'Minor Illusion', 'Healing Word', 'Charm Person', 'Thunderwave', 'Faerie Fire', 'Sleep']) }],
    }),
  )
  await levelUp(page, 'Bard 2 → 3')
  await chooseButton(page, 'College of Valor').click()
  await next(page)
  await walkToReview(page, 3)
  await expect(whatsNew(page, 3)).toContainText('Combat Inspiration')
  await expect(whatsNew(page, 3)).toContainText('Martial Training')
})

test('LS-1 e: Fighter 2 → 3 Eldritch Knight with spells picked, then Champion, then Eldritch Knight again — the saved sheet has only the final pass’s spells', async ({ page }) => {
  await createFighter(page, { name: 'Knight Flips', level: 2, species: 'Dwarf|XPHB' })
  await levelUp(page, 'Fighter 2 → 3')
  await chooseButton(page, 'Eldritch Knight').click()
  await next(page)
  await expect(current(page)).toContainText('Spells')
  const firstPass = await fillSpells(page)
  expect(firstPass).toHaveLength(5)

  await stepBar(page).getByRole('button').first().click()
  const pickSubclass = async (name: string): Promise<void> => {
    await expect(async () => {
      for (const toggle of await page.locator('.option-list__toggle[aria-expanded="false"]').all()) await toggle.click({ timeout: 1000 })
      await chooseButton(page, name).click({ timeout: 1000 })
    }).toPass({ timeout: 20_000 })
  }
  await pickSubclass('Champion')
  await pickSubclass('Eldritch Knight')
  await next(page)
  await expect(current(page)).toContainText('Spells')
  await expect(counter(page, 'Cantrips')).toHaveText(/^Cantrips: 0\/2/)
  await expect(counter(page, 'Prepared')).toHaveText(/^Prepared: 0\/3/)
  const { spells } = await walkToReview(page, 3)
  expect(spells).toHaveLength(5)

  await wizardNav(page).getByRole('button', { name: 'Save level 3' }).click()
  await expect(page).not.toHaveURL(/\/level-up/)
  await page.getByRole('tab', { name: 'Spells', exact: true }).click()
  await expect(page.getByRole('tabpanel', { name: 'Spells' }).locator('.sheet__spell-name')).toHaveCount(5)
})

test('LS-1 d:Fighter 2 → 3 Eldritch Knight then Champion — the Spells step goes away, Review lists Champion features', async ({ page }) => {
  await createFighter(page, { name: 'Knight Changes', level: 2, species: 'Dwarf|XPHB' })
  await levelUp(page, 'Fighter 2 → 3')
  const spellsStep = stepBar(page).getByRole('button', { name: /Spells/ })
  await chooseButton(page, 'Eldritch Knight').click()
  await expect(spellsStep).toHaveCount(1)
  await expect(async () => {
    for (const toggle of await page.locator('.option-list__toggle[aria-expanded="false"]').all()) await toggle.click({ timeout: 1000 })
    await chooseButton(page, 'Champion').click({ timeout: 1000 })
  }).toPass({ timeout: 20_000 })
  await expect(spellsStep).toHaveCount(0)
  await next(page)
  const { seen } = await walkToReview(page, 3)
  expect(seen.some((step) => /Spells/.test(step))).toBe(false)
  await expect(whatsNew(page, 3)).toContainText('Improved Critical')
  await expect(whatsNew(page, 3)).not.toContainText('War Bond')
})
