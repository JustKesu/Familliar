import { expect, test, type Locator, type Page } from '@playwright/test'
import { createFighter } from './wizard.ts'

/*
 * R6 (D184). A Fighter 3 Battle Master with Defense and three maneuvers; the
 * Acolyte background gives the origin feat Magic Initiate; Cleric.
 */
const MANEUVERS = ['Trip Attack', 'Riposte', 'Parry']

async function createBattleMaster(page: Page): Promise<void> {
  await createFighter(page, {
    name: 'Brakka',
    level: 3,
    species: 'Dwarf|XPHB',
    subclass: 'Battle Master',
    onClassStep: async (p) => {
      const list = p.getByRole('button', { name: /^Options/ })
      if ((await list.getAttribute('aria-expanded')) === 'false') await list.click()
      for (const maneuver of MANEUVERS) await p.getByRole('checkbox', { name: maneuver, exact: true }).first().check()
    },
    // Student of War's tool and skill picks: the first offer of each.
    onLanguagesStep: async (p) => {
      for (const choice of await p.locator('.wizard__panel select').all()) {
        if ((await choice.inputValue()) === '') await choice.selectOption({ index: 1 })
      }
    },
  })
}

function features(page: Page): Locator {
  return page.getByRole('tabpanel', { name: 'Features & Traits' })
}

function actions(page: Page): Locator {
  return page.getByRole('tabpanel', { name: 'Actions' })
}

function group(page: Page, name: string): Locator {
  return features(page).getByRole('region', { name, exact: true })
}

function row(scope: Locator, name: string): Locator {
  return scope.locator('.sheet__group-row').filter({ has: scope.page().locator('.sheet__group-row-name', { hasText: new RegExp(`^${name}$`) }) })
}

async function openFeatures(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Features & Traits' }).click()
}

test.beforeEach(async ({ page }) => {
  await createBattleMaster(page)
  await openFeatures(page)
})

test('R6 a: Fighter Features holds the maneuvers under the feature granting them and Defense under Fighting Style', async ({ page }) => {
  const fighter = group(page, 'Fighter Features')
  await expect(fighter).toBeVisible()
  const granting = fighter.locator('.sheet__group-row').filter({ has: page.locator('.sheet__feature-option-name', { hasText: 'Trip Attack' }) })
  await expect(granting).toHaveCount(1)
  await expect(granting.locator('.sheet__group-row-name')).toHaveText('Combat Superiority')
  for (const maneuver of MANEUVERS) await expect(granting.locator('.sheet__feature-options')).toContainText(maneuver)
  await expect(row(fighter, 'Fighting Style').locator('.sheet__feature-options')).toContainText('Defense')
})

test('R6 b: Class Features hides Species Traits and Feats; Feats shows only Feats; All shows all', async ({ page }) => {
  const pill = (name: string) => features(page).getByRole('button', { name, exact: true })
  const regions = features(page).getByRole('region')
  await expect(regions).toHaveCount(3)

  await pill('Class Features').click()
  await expect(group(page, 'Fighter Features')).toBeVisible()
  await expect(group(page, 'Species Traits')).toHaveCount(0)
  await expect(group(page, 'Feats')).toHaveCount(0)

  await pill('Feats').click()
  await expect(regions).toHaveCount(1)
  await expect(group(page, 'Feats')).toBeVisible()

  await pill('All').click()
  await expect(group(page, 'Fighter Features')).toBeVisible()
  await expect(group(page, 'Species Traits')).toBeVisible()
  await expect(group(page, 'Feats')).toBeVisible()
})

test('R6 c: a feature name opens its text and a second click closes it', async ({ page }) => {
  const secondWind = row(group(page, 'Fighter Features'), 'Second Wind')
  const toggle = secondWind.getByRole('button', { name: 'Second Wind', exact: true })
  await expect(secondWind.locator('.sheet__group-row-text')).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(secondWind.locator('.sheet__group-row-text')).toContainText('stamina')
  await toggle.click()
  await expect(secondWind.locator('.sheet__group-row-text')).toHaveCount(0)
})

test('R6 d: a Second Wind use marked here shows in Actions; Finish Short Rest restores it in both tabs', async ({ page }) => {
  const featureBoxes = row(group(page, 'Fighter Features'), 'Second Wind').locator('.sheet__use-box--used')
  const actionBoxes = actions(page).locator('.sheet__group-row', { hasText: 'Second Wind' }).locator('.sheet__use-box--used')

  await row(group(page, 'Fighter Features'), 'Second Wind').getByRole('button', { name: 'Use Second Wind' }).first().click()
  await expect(featureBoxes).toHaveCount(1)
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(actionBoxes).toHaveCount(1)

  await page.getByRole('button', { name: 'Short Rest', exact: true }).click()
  await page.getByRole('dialog', { name: 'Short Rest' }).getByRole('button', { name: 'Finish Short Rest' }).click()
  await expect(actionBoxes).toHaveCount(0)
  await openFeatures(page)
  await expect(featureBoxes).toHaveCount(0)
})

test('R6 e: the background origin feat reads "From Background"', async ({ page }) => {
  const feat = row(group(page, 'Feats'), 'Magic Initiate; Cleric')
  await expect(feat.locator('.sheet__group-row-source')).toHaveText('From Background')
})

test('R6 f: the header SHORT REST and LONG REST buttons each carry an icon', async ({ page }) => {
  for (const name of ['Short Rest', 'Long Rest']) {
    await expect(page.getByRole('button', { name, exact: true }).locator('svg')).toHaveCount(1)
  }
})
