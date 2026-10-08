import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, next, nextButton, wizardNav } from './wizard.ts'

/* M10b (D336): one Channel Divinity pool per granting class; the Manage Feats level chip names the class. Seeded at schema 60. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'
const order = (entries: [string, number][]) => entries.flatMap(([className, level]) => Array.from({ length: level }, () => ({ className, classSource: XPHB })))

function seeded(id: string, classes: [string, string | null, number][], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 60,
    id,
    name: id,
    classes: classes.map(([className, subclass, level]) => ({ className, classSource: XPHB, subclass, level })),
    levelOrder: order(classes.map(([className, , level]) => [className, level])),
    createdAtLevel: 1,
    abilityScores: { method: 'roll', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 14, wisdom: 14, charisma: 15 } },
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

async function storedUses(page: Page): Promise<unknown> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0]?.play?.resourceUses, STORAGE_KEY)
}

const actions = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Actions' })
const counter = (page: Page, name: string): Locator => actions(page).getByRole('group', { name: `${name} uses`, exact: true }).first()
const boxes = (page: Page, name: string): Locator => counter(page, name).getByRole('button')
const used = (page: Page, name: string): Locator => counter(page, name).locator('.sheet__use-box--used')
const CLERIC = 'Channel Divinity (Cleric)'
const PALADIN = 'Channel Divinity (Paladin)'

async function openActions(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Actions' }).click()
}

async function shortRest(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Short Rest' })
  await drawer.getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(drawer).toHaveCount(0)
}

async function removeLevel(page: Page, level: number): Promise<void> {
  await page.getByRole('button', { name: `Remove level ${level}`, exact: true }).click()
  const dialog = page.getByRole('alertdialog', { name: `Remove level ${level}?` })
  await dialog.getByRole('button', { name: 'Remove level', exact: true }).click()
  await expect(dialog).toHaveCount(0)
}

test('M10b a: Cleric 3 / Paladin 3 — two Channel Divinity counters named by class; a Cleric use leaves the Paladin counter alone', async ({ page }) => {
  await openSheet(page, seeded('m10b-a', [['Cleric', null, 3], ['Paladin', null, 3]]))
  await openActions(page)
  await expect(boxes(page, CLERIC)).toHaveCount(2)
  await expect(boxes(page, PALADIN)).toHaveCount(2)
  await expect(actions(page).getByRole('group', { name: 'Channel Divinity uses', exact: true })).toHaveCount(0)

  await counter(page, CLERIC).getByRole('button', { name: `Use ${CLERIC}` }).first().click()
  await expect(used(page, CLERIC)).toHaveCount(1)
  await expect(used(page, PALADIN)).toHaveCount(0)
  expect(await storedUses(page)).toEqual({ [CLERIC]: 1 })
})

test('M10b a2: Cleric 6 / Paladin 3 — each counter has its own class table maximum', async ({ page }) => {
  await openSheet(page, seeded('m10b-a2', [['Cleric', null, 6], ['Paladin', null, 3]]))
  await openActions(page)
  await expect(boxes(page, CLERIC)).toHaveCount(3)
  await expect(boxes(page, PALADIN)).toHaveCount(2)
})

test('M10b b: Sacred Weapon spends the Paladin pool, Preserve Life the Cleric pool', async ({ page }) => {
  await openSheet(page, seeded('m10b-b', [['Cleric', 'Life Domain', 3], ['Paladin', 'Oath of Devotion', 3]]))
  await openActions(page)
  const row = (name: string) => actions(page).locator('.sheet__group-row', { hasText: name }).first()

  await row('Sacred Weapon').getByRole('button', { name: `Use ${PALADIN}` }).first().click()
  await expect.poll(() => storedUses(page)).toEqual({ [PALADIN]: 1 })
  await row('Preserve Life').getByRole('button', { name: `Use ${CLERIC}` }).first().click()
  await expect.poll(() => storedUses(page)).toEqual({ [PALADIN]: 1, [CLERIC]: 1 })
})

test('M10b c: Short Rest returns one use to each pool, Long Rest empties both', async ({ page }) => {
  await openSheet(page, seeded('m10b-c', [['Cleric', null, 3], ['Paladin', null, 3]], { play: { resourceUses: { [CLERIC]: 2, [PALADIN]: 2 } } }))
  await openActions(page)
  await expect(used(page, CLERIC)).toHaveCount(2)
  await expect(used(page, PALADIN)).toHaveCount(2)

  await shortRest(page)
  await expect(used(page, CLERIC)).toHaveCount(1)
  await expect(used(page, PALADIN)).toHaveCount(1)
  expect(await storedUses(page)).toEqual({ [CLERIC]: 1, [PALADIN]: 1 })

  await page.getByRole('button', { name: 'Long Rest', exact: true }).click()
  await expect(used(page, CLERIC)).toHaveCount(0)
  await expect(used(page, PALADIN)).toHaveCount(0)
})

test('M10b d: single-class Cleric 3 keeps the plain "Channel Divinity" counter and key', async ({ page }) => {
  await openSheet(page, seeded('m10b-d', [['Cleric', null, 3]]))
  await openActions(page)
  await expect(boxes(page, 'Channel Divinity')).toHaveCount(2)
  await expect(actions(page).getByRole('group', { name: `${CLERIC} uses` })).toHaveCount(0)
  await counter(page, 'Channel Divinity').getByRole('button', { name: 'Use Channel Divinity' }).first().click()
  await expect.poll(() => storedUses(page)).toEqual({ 'Channel Divinity': 1 })
})

test('M10b e: a legacy plain count on Cleric 3 / Paladin 3 shows on the first class pool and is stored there on the next write', async ({ page }) => {
  await openSheet(page, seeded('m10b-e', [['Cleric', null, 3], ['Paladin', null, 3]], { play: { resourceUses: { 'Channel Divinity': 1 } } }))
  await openActions(page)
  await expect(used(page, CLERIC)).toHaveCount(1)
  await expect(used(page, PALADIN)).toHaveCount(0)

  await counter(page, PALADIN).getByRole('button', { name: `Use ${PALADIN}` }).first().click()
  await expect.poll(() => storedUses(page)).toEqual({ [CLERIC]: 1, [PALADIN]: 1 })
})

test('M10b f: Cleric 3 / Paladin 1, Paladin last — Remove level leaves the Cleric pool with its spent count and no Paladin key', async ({ page }) => {
  await openSheet(page, seeded('m10b-f', [['Cleric', null, 3], ['Paladin', null, 1]], { play: { resourceUses: { 'Channel Divinity': 1 } } }))
  await removeLevel(page, 4)
  await expect(page.locator('.sheet__classes')).toHaveText('Cleric 3')
  expect(await storedUses(page)).toEqual({ 'Channel Divinity': 1 })
  await openActions(page)
  await expect(used(page, 'Channel Divinity')).toHaveCount(1)
})

test('M10b f2: Cleric 3 / Paladin 3, Paladin last — the Paladin counter and its key go, the Cleric count returns to the plain key', async ({ page }) => {
  await openSheet(page, seeded('m10b-f2', [['Cleric', null, 3], ['Paladin', null, 3]], { play: { resourceUses: { [CLERIC]: 1, [PALADIN]: 1 } } }))
  await removeLevel(page, 6)
  await expect(page.locator('.sheet__classes')).toHaveText('Cleric 3 / Paladin 2')
  expect(await storedUses(page)).toEqual({ 'Channel Divinity': 1 })
  await openActions(page)
  await expect(used(page, 'Channel Divinity')).toHaveCount(1)
  await expect(actions(page).getByRole('group', { name: `${PALADIN} uses` })).toHaveCount(0)
})

/** Fills the Spells step's counters with the first offered spells; a counter the class does not have is skipped. */
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

test('M10b h: Paladin 2 / Cleric 3, Paladin first, 1 Channel Divinity spent — levelling Paladin to 3 keeps the count with Cleric, the Paladin pool starts full', async ({ page }) => {
  // What a real Paladin 2 holds, so the level-up walk and its save accept the character.
  const paladinPicks = {
    abilityBonus: { wisdom: 2, charisma: 1 },
    classSkills: ['athletics', 'persuasion'],
    fightingStyles: [{ className: 'Paladin', classSource: XPHB, name: 'Defense', source: XPHB }],
  }
  await openSheet(page, seeded('m10b-h', [['Paladin', null, 2], ['Cleric', null, 3]], { ...paladinPicks, play: { resourceUses: { 'Channel Divinity': 1 } } }))
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Paladin 2 → 3', exact: true }).click()
  await expect(page).toHaveURL(/\/level-up\/Paladin\/XPHB$/)

  const current = page.locator('[aria-current="step"]')
  for (let walked = 0; walked < 8; walked++) {
    const step = await current.innerText()
    // The step bar is uppercased by CSS, so innerText comes back in capitals.
    const is = (label: string) => step.toLowerCase().includes(label)
    if (is('review')) break
    if (is('class')) {
      // The seed can land after a first click and clear it, so the pick is retried until it holds.
      await expect(async () => {
        const oath = chooseButton(page, 'Oath of Devotion')
        if ((await oath.getAttribute('aria-pressed')) !== 'true') await oath.click()
        await expect(oath).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 })
        await expect(nextButton(page)).toBeEnabled({ timeout: 2000 })
      }).toPass({ timeout: 20_000 })
    }
    if (is('spells')) await fillSpells(page)
    if (is('hit points')) await page.getByRole('radiogroup', { name: 'Level 6 hit points method', exact: true }).getByRole('radio', { name: /^Average/ }).check()
    await next(page)
    await expect(current).not.toHaveText(step)
  }
  await wizardNav(page).getByRole('button', { name: 'Save level 6' }).click()
  await expect(page).toHaveURL(/#\/character\/m10b-h$/)
  await expect(page.locator('.sheet__classes')).toContainText('Paladin 3')

  expect(await storedUses(page)).toEqual({ [CLERIC]: 1 })
  await openActions(page)
  await expect(used(page, CLERIC)).toHaveCount(1)
  await expect(used(page, PALADIN)).toHaveCount(0)
})

async function manageFeatsChip(page: Page, name: string): Promise<Locator> {
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await page.getByRole('button', { name: 'Manage Feats', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Feats' }).locator('.manage-spells__row', { hasText: name }).locator('.manage-spells__tag')
}

test('M10b g: Manage Feats names the class that took the ASI level on Wizard 4 / Cleric 1; Fighter 4 keeps "From level 4"', async ({ page }) => {
  const asi = { featAsiChoices: [{ level: 4, kind: 'asi', increases: { intelligence: 1, wisdom: 1 } }] }
  await openSheet(page, seeded('m10b-g', [['Wizard', null, 4], ['Cleric', null, 1]], asi))
  await expect(await manageFeatsChip(page, 'Ability Score Improvement')).toHaveText('From Wizard 4')
})

test('M10b g2: single-class Fighter 4 keeps "From level 4" in Manage Feats', async ({ page }) => {
  await openSheet(page, seeded('m10b-g2', [['Fighter', null, 4]], { featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }] }))
  await expect(await manageFeatsChip(page, 'Ability Score Improvement')).toHaveText('From level 4')
})
