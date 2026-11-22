import { expect, test, type Page } from '@playwright/test'
import { fillUpToBackground, finishFromBackground, select, type FighterOptions } from './wizard.ts'

/* M-1 (D428): the phone layout of the sheet — fixed header, bottom nav, More pills. */
const STORAGE_KEY = 'familliar:characters'

const fighter = {
  schemaVersion: 61,
  id: 'm1-fighter',
  name: 'Phone Fighter',
  classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
  levelOrder: [{ className: 'Fighter', classSource: 'XPHB' }],
  createdAtLevel: 1,
  abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
  species: { name: 'Dwarf', source: 'XPHB' },
  background: { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
  abilityBonus: { wisdom: 2, intelligence: 1 },
  classSkills: ['athletics', 'perception'],
  fightingStyle: 'Defense',
  // d10 + CON +1 + Dwarven Toughness 1.
  currentHp: 12,
}

async function openSheet(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([fighter]) },
  )
  await page.goto(`/#/character/${fighter.id}`)
  await expect(page.locator('.sheet__mobile-header h1')).toHaveText('Phone Fighter')
}

async function expectNoOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
}

const nav = (page: Page) => page.getByRole('tablist', { name: 'Sheet views' })
const hpValue = (page: Page) => page.locator('.sheet__mobile-header .sheet__hit-points-value')

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('M-1 a: every nav view and More pill fits 390 px and shows its content', async ({ page }) => {
    await openSheet(page)
    await expect(nav(page).getByRole('tab')).toHaveCount(5)

    await expect(nav(page).getByRole('tab', { name: 'Stats' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('group', { name: 'Roll mode' })).toBeVisible()
    await expect(page.locator('.sheet__mobile-stats .ability-card')).toHaveCount(6)
    await expect(page.getByRole('heading', { name: 'Saving throws' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible()
    await expect(page.locator('.sheet__concentration')).toBeVisible()
    await expectNoOverflow(page)

    for (const [tab, panel] of [
      ['Actions', 'actions'],
      ['Spells', 'spells'],
      ['Inventory', 'inventory'],
    ] as const) {
      await nav(page).getByRole('tab', { name: tab }).click()
      await expect(nav(page).getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true')
      // A Fighter's Spells panel is empty, so it is checked as shown rather than as visible.
      await expect(page.locator(`#sheet-panel-${panel}`)).toHaveCSS('display', 'block')
      if (panel !== 'spells') await expect(page.locator(`#sheet-panel-${panel}`)).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Saving throws' })).toBeHidden()
      await expectNoOverflow(page)
    }

    await nav(page).getByRole('tab', { name: 'More' }).click()
    const pills = page.getByRole('group', { name: 'More sections' })
    for (const [pill, panel] of [
      ['Features & Traits', 'features'],
      ['Notes', 'notes'],
      ['Extras', 'extras'],
    ] as const) {
      await pills.getByRole('button', { name: pill }).click()
      await expect(pills.getByRole('button', { name: pill })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator(`#sheet-panel-${panel}`)).toBeVisible()
      await expectNoOverflow(page)
    }
    await expect(page.getByRole('heading', { name: 'Backstory' })).toBeHidden()
    await pills.getByRole('button', { name: 'Notes' }).click()
    await expect(page.locator('#sheet-panel-notes')).toContainText('Backstory')
  })

  test('M-1 b: Damage 5 then Heal 3 from the header, kept after reload; the header stays on screen', async ({ page }) => {
    await openSheet(page)
    await expect(hpValue(page)).toContainText('12')
    const header = page.locator('.sheet__mobile-header')
    const amount = header.getByRole('spinbutton', { name: 'Amount' })
    await amount.fill('5')
    await header.getByRole('button', { name: 'Damage' }).click()
    await expect(hpValue(page)).toHaveText(/^7\s*\/\s*12$/)
    await amount.fill('3')
    await header.getByRole('button', { name: 'Heal' }).click()
    await expect(hpValue(page)).toHaveText(/^10\s*\/\s*12$/)
    await page.reload()
    await expect(hpValue(page)).toHaveText(/^10\s*\/\s*12$/)

    await expect(header.getByRole('button', { name: 'Short rest' })).toBeVisible()
    await expect(header.getByRole('button', { name: 'Long rest' })).toBeVisible()
    await page.mouse.wheel(0, 2000)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    const box = await header.boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeLessThan(5)
  })

  test('M-1 c: tapping a skill row rolls', async ({ page }) => {
    await openSheet(page)
    await page.locator('.sheet__skills li').filter({ hasText: 'Athletics' }).locator('.roll-value').click()
    await expect(page.locator('.roll-toast')).toContainText('Athletics')
  })

  test('M-1 d: More actions holds Edit and Level up; Edit opens the edit route', async ({ page }) => {
    await openSheet(page)
    const more = page.getByRole('button', { name: 'More actions' })
    const box = await more.boundingBox()
    expect(Math.round(box!.width)).toBe(44)
    expect(Math.round(box!.height)).toBe(44)
    await expect(page.getByRole('button', { name: 'Edit character' })).toBeHidden()
    await more.click()
    await expect(page.getByRole('button', { name: 'Edit character' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Level up/ })).toBeVisible()
    await page.getByRole('button', { name: 'Edit character' }).click()
    await expect(page).toHaveURL(/#\/character\/m1-fighter\/edit$/)
  })

  test('M-1 e: the Saving throws drawer is full width and closes', async ({ page }) => {
    await openSheet(page)
    await page.getByRole('button', { name: 'Saving throws details' }).click()
    const drawer = page.getByRole('dialog', { name: 'Saving throws' })
    await expect(drawer).toBeVisible()
    const box = await drawer.boundingBox()
    expect(box!.x).toBe(0)
    expect(box!.width).toBe(390)
    await drawer.getByRole('button', { name: /close/i }).click()
    await expect(drawer).toHaveCount(0)
  })

  test('M-1 g: with gear, a held weapon and spells, Actions, Spells and Inventory still fit 390 px', async ({ page }) => {
    // The actions.spec.ts Fighter: class gear plus Magic Initiate (Cleric) spells, built through the wizard at phone width.
    const options: FighterOptions = { name: 'Geared Phone', level: 1, species: 'Dwarf|XPHB', classGear: true }
    await fillUpToBackground(page, options)
    const originFeat = page.getByRole('group', { name: 'Origin feat: Magic Initiate; Cleric' })
    await originFeat.getByRole('checkbox', { name: 'Sacred Flame', exact: true }).first().check()
    await originFeat.getByRole('checkbox', { name: 'Guidance', exact: true }).first().check()
    await originFeat.getByRole('checkbox', { name: 'Guiding Bolt', exact: true }).first().check()
    await select(originFeat, 'Ability').selectOption('wisdom')
    await finishFromBackground(page, options)

    await nav(page).getByRole('tab', { name: 'Inventory' }).click()
    await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
    await page.getByRole('button', { name: 'Equip Greatsword', exact: true }).click()
    await page.keyboard.press('Escape')
    await expectNoOverflow(page)

    await nav(page).getByRole('tab', { name: 'Actions' }).click()
    const table = page.locator('#sheet-panel-actions table').first()
    await expect(table).toBeVisible()
    const box = await table.boundingBox()
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
    await expectNoOverflow(page)

    await nav(page).getByRole('tab', { name: 'Spells' }).click()
    await expect(page.locator('#sheet-panel-spells')).toContainText('Guiding Bolt')
    await expectNoOverflow(page)
  })
})

test('M-1 f: at 1366 px there is no bottom nav and the six desktop tabs remain', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([fighter]) },
  )
  await page.goto(`/#/character/${fighter.id}`)
  await expect(page.getByRole('heading', { name: 'Phone Fighter', level: 1 })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Sheet views' })).toHaveCount(0)
  await expect(page.locator('.sheet__mobile-header')).toHaveCount(0)
  await expect(page.getByRole('tablist', { name: 'Sekce listu postavy' }).getByRole('tab')).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'Edit character' })).toBeVisible()
})
