import { expect, test, type Page } from '@playwright/test'
import { chooseButton, createFighter, expectStep, nextButton, select, stepBar, wizardNav } from './wizard.ts'

/* M-3 (D430): the wizard at phone width — one step row with a dropdown list, Back/Next fixed at the bottom. */
const STORAGE_KEY = 'familliar:characters'
const XPHB = 'XPHB'

const fighter = {
  schemaVersion: 56,
  id: 'm3-fighter',
  name: 'Phone Fighter',
  classes: [{ className: 'Fighter', classSource: XPHB, subclass: null, level: 1 }],
  createdAtLevel: 1,
  abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 8 } },
  species: { name: 'Human', source: XPHB },
  speciesSize: 'M',
  fightingStyle: 'Archery',
  classSkills: ['athletics', 'perception'],
  masteries: [{ name: 'Longsword' }, { name: 'Greataxe' }, { name: 'Shortbow' }],
  spellChoices: [],
}

const warlock = {
  schemaVersion: 63,
  id: 'm3-warlock',
  name: 'Phone Warlock',
  classes: [{ className: 'Warlock', classSource: XPHB, subclass: null, level: 6 }],
  levelOrder: Array.from({ length: 6 }, () => ({ className: 'Warlock', classSource: XPHB })),
  createdAtLevel: 6,
  abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 16 } },
  species: { name: 'Tiefling; Infernal Legacy', source: XPHB },
  speciesSpellcastingAbility: 'charisma',
  speciesSize: 'M',
  background: { name: 'Acolyte', source: XPHB, skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
  classSkills: ['arcana', 'deception'],
  spellChoices: [{ className: 'Warlock', classSource: XPHB, spells: ['Eldritch Blast', 'Minor Illusion', 'Hex', 'Armor of Agathys', 'Hold Person'].map((name) => ({ name, source: XPHB })) }],
  optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Pact of the Chain', source: XPHB, level: 1 }] }],
  familiar: { name: 'Pseudodragon', source: 'XMM' },
  inventory: [{ name: 'Longsword', source: XPHB, quantity: 1, equipped: 'held' }],
}

async function seed(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

const stepToggle = (page: Page) => page.locator('.wizard__step-toggle')
const stepPanel = (page: Page) => page.locator('#wizard-step-panel')

async function expectNoOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  for (const button of await page.locator('button:visible').all()) {
    const rect = await button.boundingBox()
    if (rect) expect(rect.x + rect.width).toBeLessThanOrEqual(390.5)
  }
}

async function fillFighterClassStep(page: Page): Promise<void> {
  await page.getByLabel('Character name').fill('Phone')
  await select(page, 'Class').selectOption('Fighter|XPHB')
  await select(page, 'Level').selectOption('1')
  await page.getByRole('checkbox', { name: 'Athletics', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Perception', exact: true }).check()
  for (const weapon of ['Longsword', 'Greatsword', 'Handaxe']) await chooseButton(page, weapon).first().click()
  await chooseButton(page, 'Defense').click()
}

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('M-3 a: one step row on top, Next fixed at the bottom is the "Step navigation" Next', async ({ page }) => {
    await page.goto('/#/new')
    await expect(stepToggle(page)).toHaveText(/^1 \/ \d+ · Class and level/)
    await expect(page.getByRole('group', { name: 'Quick navigation' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(1)
    await expect(wizardNav(page)).toHaveCSS('position', 'fixed')
    await expect(nextButton(page)).toBeVisible()
    const rect = await nextButton(page).boundingBox()
    expect(rect!.y + rect!.height).toBeGreaterThanOrEqual(800)
    expect(rect!.height).toBeGreaterThanOrEqual(44)
    await expect(wizardNav(page).getByRole('button', { name: 'Cancel' })).toBeHidden()

    await fillFighterClassStep(page)
    await nextButton(page).click()
    await expectStep(page, 'Species')
    await expect(stepToggle(page)).toHaveText(/^2 \/ \d+ · Species/)
  })

  test('M-3 b: the step list opens with Cancel, jumps back, keeps later steps locked and closes outside', async ({ page }) => {
    await page.goto('/#/new')
    await fillFighterClassStep(page)
    await nextButton(page).click()
    await expectStep(page, 'Species')

    await expect(stepPanel(page)).toBeHidden()
    await stepToggle(page).click()
    await expect(stepToggle(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(stepBar(page)).toBeVisible()
    await expect(stepPanel(page).getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(stepBar(page).getByRole('button', { name: /^\d+\. Background$/ })).toBeDisabled()

    // Below the open panel and left of every control.
    await page.mouse.click(2, 720)
    await expect(stepPanel(page)).toBeHidden()
    await expectStep(page, 'Species')

    await stepToggle(page).click()
    await stepBar(page).getByRole('button', { name: /^1\. Class and level$/ }).click()
    await expectStep(page, 'Class and level')
    await expect(stepPanel(page)).toBeHidden()
    await expect(stepToggle(page)).toHaveText(/^1 \/ \d+ · Class and level/)

    await stepToggle(page).click()
    await stepPanel(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('alertdialog', { name: 'Cancel character creation?' })).toBeVisible()
  })

  test('M-3 c: a new character is created end to end on a phone', async ({ page }) => {
    await createFighter(page, { name: 'Phone Made', level: 1, species: 'Dwarf|XPHB' })
    await expect(page.getByRole('heading', { name: 'Phone Made' })).toBeVisible()
  })

  test('M-3 d: Level up from a seeded character reaches its last step and saves', async ({ page }) => {
    await seed(page, fighter)
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('button', { name: 'Level up to 2' }).click()
    await page.getByRole('dialog', { name: 'Level up which class?' }).locator('.level-up-class__option').click()
    const saveLevel = wizardNav(page).getByRole('button', { name: 'Save level 2' })
    for (let steps = 0; steps < 8 && !(await saveLevel.isVisible()); steps++) {
      const average = page.getByRole('radio', { name: /^Average/ })
      if (await average.isVisible()) await average.check()
      await nextButton(page).click()
    }
    await expect(stepToggle(page)).toHaveText(/· Review and save/)
    const rect = await saveLevel.boundingBox()
    expect(rect!.y + rect!.height).toBeGreaterThanOrEqual(800)
    await saveLevel.click()
    await expect(page).toHaveURL(/#\/character\/m3-fighter$/)
  })

  test('M-3 e: no wizard step overflows 390 px', async ({ page }) => {
    await createFighter(page, { name: 'Wide', level: 4, species: 'Dwarf|XPHB', stopAtReview: true })
    await expectNoOverflow(page)
    const labels = await stepPanel(page).locator('.wizard__step').allTextContents()
    expect(labels.length).toBeGreaterThanOrEqual(9)
    for (const label of labels) {
      await stepToggle(page).click()
      await expectNoOverflow(page)
      await stepBar(page).getByRole('button', { name: label, exact: true }).click()
      await expectStep(page, label.replace(/^\d+\. /, ''))
      await expectNoOverflow(page)
    }
  })

  test('M-3 f: Extras table head hidden; drawer close is a 44 px target and its search is full width', async ({ page }) => {
    await seed(page, warlock)
    const nav = page.getByRole('tablist', { name: 'Sheet views' })
    await nav.getByRole('tab', { name: 'More' }).click()
    await page.getByRole('group', { name: 'More sections' }).getByRole('button', { name: 'Extras' }).click()
    await expect(page.locator('#sheet-panel-extras .extras-tab__item').first()).toContainText('Pseudodragon')
    await expect(page.locator('#sheet-panel-extras .extras-tab__head')).toBeHidden()

    await nav.getByRole('tab', { name: 'Spells' }).click()
    await page.getByRole('button', { name: 'Manage Spells' }).click()
    const drawer = page.getByRole('dialog', { name: 'Manage Spells' })
    const close = drawer.getByRole('button', { name: 'Close' })
    const closeRect = await close.boundingBox()
    expect(closeRect!.width).toBeGreaterThanOrEqual(44)
    expect(closeRect!.height).toBeGreaterThanOrEqual(44)
    expect(closeRect!.x + closeRect!.width).toBeLessThanOrEqual(390)

    const search = drawer.locator('input[type="search"]:visible').first()
    const searchRect = await search.boundingBox()
    const parentWidth = await search.evaluate((element) => {
      const parent = element.parentElement!
      const style = getComputedStyle(parent)
      return parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    })
    expect(searchRect!.width).toBeGreaterThanOrEqual(parentWidth - 1)
  })
})

test.describe('desktop', () => {
  test.use({ viewport: { width: 1366, height: 900 } })

  test('M-3 f: the Extras table head is visible at 1366 px', async ({ page }) => {
    await seed(page, warlock)
    await page.getByRole('tablist', { name: 'Sekce listu postavy' }).getByRole('tab', { name: 'Extras' }).click()
    await expect(page.locator('#sheet-panel-extras .extras-tab__head')).toBeVisible()
  })

  test('M-3 g: the wizard bar keeps the full step list and its Cancel/Back/Next', async ({ page }) => {
    await page.goto('/#/new')
    await expectStep(page, 'Class and level')
    await expect(stepToggle(page)).toHaveCount(0)
    await expect(stepBar(page)).toBeVisible()
    await expect(stepBar(page).locator('.wizard__step')).not.toHaveCount(0)
    const quick = page.getByRole('group', { name: 'Quick navigation' })
    for (const name of ['Cancel', 'Back', 'Next']) await expect(quick.getByRole('button', { name, exact: true })).toBeVisible()
    await expect(wizardNav(page)).not.toHaveCSS('position', 'fixed')
    await expect(wizardNav(page).getByRole('button', { name: 'Cancel' })).toBeVisible()
  })
})
