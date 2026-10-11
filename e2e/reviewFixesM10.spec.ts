import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, next, stepBar, wizardNav } from './wizard.ts'

/* F-12 (D337): fixes from the M10 review. Seeded at schema 60. */
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
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
    species: { name: 'Human', source: XPHB },
    speciesSize: 'M',
    background: { name: 'Soldier', source: XPHB, skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
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

async function stored(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
}

test('F-12 a: Fighter 4 stored without abilityBonus — level up to 5 saves, the sheet opens and the list still shows it', async ({ page }) => {
  const fighter = seeded('f12-a', [['Fighter', 'Champion', 4]], {
    classSkills: ['perception', 'history'],
    masteries: ['Longsword', 'Greatsword', 'Handaxe', 'Battleaxe'].map((name) => ({ name })),
    fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }],
    featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }],
    hitPointLevels: [2, 3, 4].map((level) => ({ level, kind: 'average', dieResult: 6 })),
  })
  await openSheet(page, fighter)
  await page.locator('.sheet__level-up').click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).getByRole('button', { name: 'Fighter 4 → 5', exact: true }).click()

  const current = page.locator('[aria-current="step"]')
  for (let walked = 0; walked < 8; walked++) {
    const step = await current.innerText()
    if (step.toLowerCase().includes('review')) break
    if (step.toLowerCase().includes('hit points')) await page.getByRole('radiogroup', { name: 'Level 5 hit points method', exact: true }).getByRole('radio', { name: /^Average/ }).check()
    await next(page)
    await expect(current).not.toHaveText(step)
  }
  await wizardNav(page).getByRole('button', { name: 'Save level 5' }).click()
  await expect(page).toHaveURL(/#\/character\/f12-a$/)
  await expect(page.locator('.sheet__classes')).toContainText('Fighter 5')
  expect(await stored(page)).not.toHaveProperty('abilityBonus')

  await page.goto('/#/')
  await page.reload()
  await page.getByRole('button', { name: 'f12-a', exact: true }).click()
  await expect(page.locator('.sheet__classes')).toContainText('Fighter 5')
})

const actions = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Actions' })
const CLERIC = 'Channel Divinity (Cleric)'
const PALADIN = 'Channel Divinity (Paladin)'

// Rows named exactly "Channel Divinity": each class's own, Guided Strike (War and Conquest, D343) is not counted.
test('F-12 c: Cleric 3 (War Domain) / Paladin 3 (Oath of Conquest) — two "Channel Divinity" rows, each spends its own pool', async ({ page }) => {
  await openSheet(page, seeded('f12-c', [['Cleric', 'War Domain', 3], ['Paladin', 'Oath of Conquest', 3]]))
  await page.getByRole('tab', { name: 'Actions' }).click()
  const rows = actions(page).locator('.sheet__group-row').filter({ has: page.getByRole('button', { name: 'Channel Divinity', exact: true }) })
  const rowOf = (pool: string) => rows.filter({ has: page.getByRole('button', { name: `Use ${pool}` }) })
  await expect(rows).toHaveCount(2)
  await expect(rowOf(CLERIC)).toHaveCount(1)
  await expect(rowOf(PALADIN)).toHaveCount(1)

  await rowOf(CLERIC).getByRole('button', { name: `Use ${CLERIC}` }).first().click()
  await expect.poll(async () => (await stored(page))['play']).toEqual({ resourceUses: { [CLERIC]: 1 } })
  await rowOf(PALADIN).getByRole('button', { name: `Use ${PALADIN}` }).first().click()
  await expect.poll(async () => (await stored(page))['play']).toEqual({ resourceUses: { [CLERIC]: 1, [PALADIN]: 1 } })
})

test('F-12 d: Fighter 4 / Rogue 1 Edit — a weapon the Fighter masters is not offered in the Rogue picker', async ({ page }) => {
  const masteries = [...['Longsword', 'Greatsword', 'Handaxe'].map((name) => ({ name, level: 1 })), { name: 'Battleaxe', level: 4 }, ...['Dagger', 'Shortsword'].map((name) => ({ name, level: 5 }))]
  await openSheet(
    page,
    seeded('f12-d', [['Fighter', 'Champion', 4], ['Rogue', null, 1]], {
      abilityBonus: { strength: 2, dexterity: 1 },
      classSkills: ['perception', 'history'],
      masteries,
      fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }],
      expertiseSkills: [{ name: 'perception', level: 5 }, { name: 'athletics', level: 5 }],
      featAsiChoices: [{ level: 4, kind: 'asi', increases: { constitution: 2 } }],
      multiclassPicks: [{ className: 'Rogue', classSource: XPHB, kind: 'skill', name: 'stealth' }],
      hitPointLevels: [{ level: 2, kind: 'average', dieResult: 6 }, { level: 3, kind: 'average', dieResult: 6 }, { level: 4, kind: 'average', dieResult: 6 }, { level: 5, kind: 'average', dieResult: 5 }],
    }),
  )
  await page.locator('.sheet__edit-character').click()
  await stepBar(page).getByRole('button', { name: /Class and level/ }).click()
  const rogueTab = page.getByRole('group', { name: 'Class to edit' }).getByRole('button', { name: /^Rogue \d+/ })
  await rogueTab.click()
  await expect(rogueTab).toHaveAttribute('aria-pressed', 'true')
  const toggle = page.getByRole('button', { name: /^Weapon masteries/, expanded: false })
  if ((await toggle.count()) > 0) await toggle.first().click()
  await expect(chooseButton(page, 'Dagger').first()).toHaveAttribute('aria-pressed', 'true')
  // Sickle is a Light simple weapon like the Handaxe, so the Rogue list would offer both but for the Fighter's pick.
  await expect(chooseButton(page, 'Sickle')).not.toHaveCount(0)
  await expect(chooseButton(page, 'Handaxe')).toHaveCount(0)
})
