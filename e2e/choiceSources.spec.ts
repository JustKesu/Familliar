import { expect, test, type Locator, type Page } from '@playwright/test'
import { chooseButton, next, wizardNav } from './wizard.ts'

/* M1b (D318): schema-57 characters read exactly as before; a level up through the wizard stores the style's class and the picks' sources. */
const STORAGE_KEY = 'familliar:characters'
const FIGHTER = { className: 'Fighter', classSource: 'XPHB' }
const SCORES = { strength: 15, dexterity: 16, constitution: 13, intelligence: 10, wisdom: 10, charisma: 8 }
const MANEUVERS = ['Trip Attack', 'Riposte', 'Parry']

function schema57(id: string, level: number, subclass: string | null, extra: Record<string, unknown>) {
  return {
    schemaVersion: 57,
    id,
    name: id,
    classes: [{ ...FIGHTER, subclass, level }],
    createdAtLevel: 1,
    abilityScores: { method: 'standardArray', scores: SCORES },
    species: { name: 'Human', source: 'XPHB' },
    speciesSize: 'M',
    spellChoices: [],
    levelOrder: Array.from({ length: level }, () => FIGHTER),
    hitPointLevels: Array.from({ length: level - 1 }, (_, index) => ({ level: index + 2, kind: 'average', dieResult: 6 })),
    ...extra,
  }
}

const archer = schema57('m1b-archer', 1, null, {
  fightingStyle: 'Archery',
  classSkills: ['athletics', 'perception'],
  masteries: [{ name: 'Longsword' }, { name: 'Greataxe' }, { name: 'Shortbow' }],
  inventory: [{ name: 'Longbow', source: 'XPHB', quantity: 1, equipped: 'held' }],
})

const battleMaster = schema57('m1b-master', 6, 'Battle Master', {
  fightingStyle: 'Defense',
  classSkills: ['athletics', 'perception'],
  masteries: [{ name: 'Longsword' }, { name: 'Greataxe' }, { name: 'Shortbow' }, { name: 'Battleaxe', level: 4 }],
  optionalFeatureChoices: [{ featureType: 'MV:B', choices: MANEUVERS.map((name) => ({ name })) }],
  toolChoices: [{ grantedBy: 'battleMaster', name: "Smith's Tools" }],
  subclassSkills: [{ grantedBy: 'battleMaster', name: 'history' }],
  featAsiChoices: [
    { level: 4, kind: 'asi', increases: { strength: 2 } },
    { level: 6, kind: 'asi', increases: { constitution: 2 } },
  ],
})

async function open(page: Page, saved: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([saved]) },
  )
  await page.goto(`/#/character/${saved.id}`)
}

async function stored(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]')[0], STORAGE_KEY)
}

function fighterFeatures(page: Page): Locator {
  return page.getByRole('tabpanel', { name: 'Features & Traits' }).getByRole('region', { name: 'Fighter Features', exact: true })
}

function featureRow(scope: Locator, name: string): Locator {
  return scope.locator('.sheet__group-row').filter({ has: scope.page().locator('.sheet__group-row-name', { hasText: new RegExp(`^${name}$`) }) })
}

/* As featuresTab.spec.ts R6 a and sheetCalculations.spec.ts F-7a a. */
async function expectArcheryShown(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Actions' }).click()
  await page.getByRole('button', { name: 'Longbow breakdown', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Archery (Fighting Style): +2')
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  await expect(featureRow(fighterFeatures(page), 'Fighting Style').locator('.sheet__feature-options')).toContainText('Archery')
}

async function levelUp(page: Page, level: number, onClassStep?: () => Promise<void>): Promise<void> {
  await page.getByRole('button', { name: `Level up to ${level}` }).click()
  await page.getByRole('dialog', { name: 'Level up which class?' }).locator('.level-up-class__option').click()
  const save = wizardNav(page).getByRole('button', { name: `Save level ${level}` })
  let picked = onClassStep === undefined
  for (let steps = 0; steps < 10 && !(await save.isVisible()); steps++) {
    if (!picked && (await page.getByRole('button', { name: /^Options/ }).isVisible())) {
      await onClassStep!()
      picked = true
    }
    const average = page.getByRole('radio', { name: /^Average/ })
    if (await average.isVisible()) await average.check()
    await next(page)
  }
  await save.click()
  await expect(page).toHaveURL(new RegExp(`#/character/[^/]+$`))
}

test('M1b a: a schema-57 Fighter shows its fighting style as before; a level up stores it with its class and source', async ({ page }) => {
  await open(page, archer)
  await expect(page.getByRole('button', { name: 'Roll Longbow to hit' })).toHaveText('+7')
  await expectArcheryShown(page)

  await levelUp(page, 2)
  await expect.poll(async () => (await stored(page)).fightingStyles).toEqual([{ ...FIGHTER, name: 'Archery', source: 'XPHB' }])
  expect('fightingStyle' in (await stored(page))).toBe(false)
  await expectArcheryShown(page)
})

test('M1b b: a schema-57 Battle Master shows its maneuvers as before; a maneuver picked in a level up is stored with its source', async ({ page }) => {
  await open(page, battleMaster)
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  const granting = fighterFeatures(page).locator('.sheet__group-row').filter({ has: page.locator('.sheet__feature-option-name', { hasText: 'Trip Attack' }) })
  await expect(granting.locator('.sheet__group-row-name')).toHaveText('Combat Superiority')
  for (const maneuver of MANEUVERS) await expect(granting.locator('.sheet__feature-options')).toContainText(maneuver)
  await expect(featureRow(fighterFeatures(page), 'Fighting Style').locator('.sheet__feature-options')).toContainText('Defense')

  await levelUp(page, 7, async () => {
    const list = page.getByRole('button', { name: /^Options/ })
    if ((await list.getAttribute('aria-expanded')) === 'false') await list.click()
    for (const maneuver of ['Precision Attack', 'Pushing Attack']) await chooseButton(page, maneuver).first().click()
  })

  await expect
    .poll(async () => (await stored(page)).optionalFeatureChoices)
    .toEqual([
      {
        featureType: 'MV:B',
        choices: [
          ...MANEUVERS.map((name) => ({ name, source: 'XPHB' })),
          { name: 'Precision Attack', level: 7, source: 'XPHB' },
          { name: 'Pushing Attack', level: 7, source: 'XPHB' },
        ],
      },
    ])
  expect((await stored(page)).fightingStyles).toEqual([{ ...FIGHTER, name: 'Defense', source: 'XPHB' }])

  await page.getByRole('tab', { name: 'Features & Traits' }).click()
  for (const maneuver of [...MANEUVERS, 'Precision Attack', 'Pushing Attack']) await expect(granting.locator('.sheet__feature-options')).toContainText(maneuver)
})
