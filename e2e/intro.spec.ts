import { expect, test, type Page } from '@playwright/test'

/* U-2 (D312): the FAMILLIAR intro on the first open of the character list in a tab. */

test.use({ reducedMotion: 'no-preference' })

const STORAGE_KEY = 'familliar:characters'
const FIGHTER = {
  schemaVersion: 52,
  id: 'u2-sheet',
  name: 'Intro Tester',
  classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
  abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
}

const overlay = (page: Page) => page.locator('.intro__bg')
const newCharacter = (page: Page) => page.getByRole('button', { name: 'New character' })
const sheetTab = (page: Page) => page.getByRole('tab', { name: 'Features & Traits' })

async function expectIntroShown(page: Page): Promise<void> {
  await expect(overlay(page)).toBeVisible()
  await expect(page.locator('.intro__word')).toHaveText('FAMILLIAR')
  await expect(page.getByText('Welcome, adventurer')).toBeAttached()
}

test('U-2 a: a fresh tab on #/ shows the intro, the list is not clickable under it, then the intro ends', async ({ page }) => {
  await page.goto('/#/')
  await expectIntroShown(page)
  await expect(newCharacter(page).click({ trial: true, timeout: 500 })).rejects.toThrow()

  await expect(overlay(page)).toBeHidden({ timeout: 8_000 })
  await newCharacter(page).click()
  await expect(page).toHaveURL(/#\/new$/)
})

test('U-2 b: a click skips the intro', async ({ page }) => {
  await page.goto('/#/')
  await expectIntroShown(page)
  await page.mouse.click(200, 200)
  await expect(overlay(page)).toBeHidden({ timeout: 1_000 })
  await newCharacter(page).click({ trial: true })
})

test('U-2 c: a key press skips the intro', async ({ page }) => {
  await page.goto('/#/')
  await expectIntroShown(page)
  await page.keyboard.press('Space')
  await expect(overlay(page)).toBeHidden({ timeout: 1_000 })
})

test('U-2 d: neither a reload nor list → sheet → list replays it', async ({ page }) => {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([FIGHTER]) },
  )
  await page.goto('/#/')
  await expectIntroShown(page)
  await page.keyboard.press('Escape')
  await expect(overlay(page)).toBeHidden({ timeout: 1_000 })

  await page.reload()
  await expect(newCharacter(page)).toBeVisible()
  await expect(overlay(page)).toHaveCount(0)

  await page.goto('/#/character/u2-sheet')
  await expect(sheetTab(page)).toBeVisible()
  await page.goto('/#/')
  await expect(newCharacter(page)).toBeVisible()
  await expect(overlay(page)).toHaveCount(0)
})

test('U-2 e: a tab opened on a character sheet shows no intro, now or on the list afterwards', async ({ page }) => {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([FIGHTER]) },
  )
  await page.goto('/#/character/u2-sheet')
  await expect(sheetTab(page)).toBeVisible()
  await expect(overlay(page)).toHaveCount(0)

  await page.goto('/#/')
  await expect(newCharacter(page)).toBeVisible()
  await expect(overlay(page)).toHaveCount(0)
})

test('U-2 f: with reduced motion requested there is no intro', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/')
  await newCharacter(page).click({ trial: true })
  await expect(overlay(page)).toHaveCount(0)
})

test('U-2 g: in the light theme the intro background is the light page background', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('familliar:settings', JSON.stringify({ theme: 'light', flame: true })))
  await page.goto('/#/')
  await expectIntroShown(page)
  const [intro, body] = await Promise.all([
    overlay(page).evaluate((el) => getComputedStyle(el).backgroundColor),
    page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ])
  expect(intro).toBe(body)
  expect(intro).toBe('rgb(242, 242, 244)')
})
