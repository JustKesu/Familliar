import { expect, test, type Page } from '@playwright/test'

/* MON-4 (D434): running an encounter. Wolf (XMM): 11 HP, AC 12, DEX save +2, initiative +2; Dire Wolf: 22 HP, AC 14. */

const KEY = 'familliar:encounters'
const ID = 'enc-wolves'

const ENCOUNTER = {
  id: ID,
  name: 'Wolves',
  createdAt: '2026-11-27T10:00:00.000Z',
  updatedAt: '2026-11-27T10:00:00.000Z',
  party: { size: 4, level: 2 },
  players: ['Ana', 'Bor'],
  groups: [
    { id: 'g-wolf', monster: { name: 'Wolf', source: 'XMM' }, oneInitiative: true, members: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `w${n}`, name: `Wolf ${n}` })) },
    { id: 'g-dire', monster: { name: 'Dire Wolf', source: 'XMM' }, oneInitiative: false, members: [{ id: 'd1', name: 'Alpha' }] },
  ],
  combat: null,
}

async function seed(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [KEY, JSON.stringify({ schemaVersion: 2, encounters: [ENCOUNTER] })])
}

const row = (page: Page, name: string) => page.getByRole('listitem', { name, exact: true })
const storedCombat = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null').encounters[0].combat, KEY)

async function enterInitiative(page: Page): Promise<void> {
  for (const name of ['Wolf x6', 'Alpha']) {
    const rolled = Number(await page.getByRole('spinbutton', { name: `Initiative ${name}` }).inputValue())
    expect(rolled).toBeGreaterThanOrEqual(3)
    expect(rolled).toBeLessThanOrEqual(22)
  }
  await expect(page.getByRole('spinbutton', { name: 'Initiative Ana' })).toHaveValue('')
  await page.getByRole('spinbutton', { name: 'Initiative Wolf x6' }).fill('15')
  await page.getByRole('spinbutton', { name: 'Initiative Alpha' }).fill('15')
  await page.getByRole('spinbutton', { name: 'Initiative Ana' }).fill('15')
  await page.getByRole('button', { name: 'Begin' }).click()
}

async function saveOutcome(page: Page, name: string): Promise<boolean> {
  const label = await row(page, name).getByRole('button', { name: new RegExp(`^Save for ${name}:`) }).getAttribute('aria-label')
  return label!.includes('success')
}

test('MON-4 a–f: initiative, saves and damage, conditions, down and skipped, reload, end', async ({ page }) => {
  await seed(page)
  await page.goto(`/#/dm/encounter/${ID}`)
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page).toHaveURL(new RegExp(`#/dm/encounter/${ID}/run$`))

  // a) Ties at 15: Ana (player) first, then Wolves before Alpha (same +2, list order); blank Bor last.
  await enterInitiative(page)
  const order = page.getByRole('list', { name: 'Turn order' }).locator(':scope > li')
  expect(await order.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))).toEqual(['Ana', 'Wolf group', 'Alpha', 'Bor'])
  await expect(page.locator('.combat__difficulty')).toHaveText('500 XP · Moderate')
  await expect(page.locator('.combat__round-value')).toHaveText('1')
  await expect(row(page, 'Ana')).toHaveAttribute('aria-current', 'true')
  await expect(row(page, 'Alpha')).toContainText('Dire Wolf · CR 1')
  await expect(row(page, 'Alpha').locator('.combat__ac')).toHaveText('14')
  await expect(row(page, 'Wolf 1').locator('.combat__hp-text')).toHaveText('11 / 11')
  await expect(row(page, 'Wolf 1').locator('.combat__saves')).toHaveText('STR +2DEX +2CON +1INT -4WIS +1CHA -2')
  await expect(row(page, 'Bor').locator('.combat__init')).toHaveText('—')

  await row(page, 'Alpha').getByRole('button', { name: 'Stat block for Alpha' }).click()
  await expect(page.getByRole('region', { name: 'Stat block' }).getByRole('article', { name: 'Dire Wolf stat block' })).toBeVisible()
  await page.getByRole('region', { name: 'Stat block' }).getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('region', { name: 'Stat block' })).toHaveCount(0)

  // b) Three wolves save DEX DC 13, one result flipped, 14 damage: failure 0, success half (7).
  for (const name of ['Wolf 1', 'Wolf 2', 'Wolf 3']) await page.getByRole('checkbox', { name: `Select ${name}` }).check()
  await expect(page.locator('.combat__count')).toHaveText('3 selected')
  await page.getByRole('combobox', { name: 'Save', exact: true }).selectOption('dex')
  await page.getByRole('spinbutton', { name: 'DC' }).fill('13')
  await page.getByRole('button', { name: 'Roll saves' }).click()
  const before = await saveOutcome(page, 'Wolf 1')
  await row(page, 'Wolf 1').getByRole('button', { name: /^Save for Wolf 1:/ }).click()
  expect(await saveOutcome(page, 'Wolf 1')).toBe(!before)
  const outcomes = [await saveOutcome(page, 'Wolf 1'), await saveOutcome(page, 'Wolf 2'), await saveOutcome(page, 'Wolf 3')]
  await expect(row(page, 'Wolf 4').getByRole('button', { name: /^Save for/ })).toHaveCount(0)
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('14')
  await page.getByRole('button', { name: 'Damage' }).click()
  for (const [i, success] of outcomes.entries()) {
    await expect(row(page, `Wolf ${i + 1}`).locator('.combat__hp-text')).toHaveText(success ? '4 / 11' : '0 / 11')
  }
  await expect(page.locator('.combat__save-chip')).toHaveCount(0)
  await expect(row(page, 'Wolf 4').locator('.combat__hp-text')).toHaveText('11 / 11')

  // c) Prone on Alpha, then removed.
  await page.getByRole('button', { name: 'Clear selection' }).click()
  await page.getByRole('checkbox', { name: 'Select Alpha' }).check()
  await page.getByRole('combobox', { name: 'Add condition' }).selectOption('Prone')
  await expect(row(page, 'Alpha').locator('.combat__condition')).toHaveText(['Prone×'])
  await page.getByRole('button', { name: 'Remove Prone from Alpha' }).click()
  await expect(row(page, 'Alpha').locator('.combat__condition')).toHaveCount(0)

  // d) Every wolf to 0: down, skipped by Next turn, round increments on the wrap.
  await page.getByRole('button', { name: 'Clear selection' }).click()
  await page.getByRole('button', { name: 'Select all alive' }).click()
  await page.getByRole('combobox', { name: 'Save', exact: true }).selectOption('')
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('20')
  await page.getByRole('button', { name: 'Damage' }).click()
  for (let n = 1; n <= 6; n++) await expect(row(page, `Wolf ${n}`)).toContainText('down')
  await expect(row(page, 'Wolf 1')).toHaveCSS('opacity', '0.45')
  await page.getByRole('button', { name: 'Next turn' }).click()
  await expect(row(page, 'Alpha')).toHaveAttribute('aria-current', 'true')
  await page.getByRole('button', { name: 'Next turn' }).click()
  await expect(row(page, 'Bor')).toHaveAttribute('aria-current', 'true')
  await page.getByRole('button', { name: 'Next turn' }).click()
  await expect(row(page, 'Ana')).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('.combat__round-value')).toHaveText('2')
  await page.getByRole('button', { name: 'Next turn' }).click()
  await expect(row(page, 'Alpha')).toHaveAttribute('aria-current', 'true')

  // e) Reload resumes the same fight.
  const saved = await storedCombat(page)
  expect(saved.round).toBe(2)
  await page.reload()
  await expect(page.locator('.combat__round-value')).toHaveText('2')
  await expect(row(page, 'Alpha')).toHaveAttribute('aria-current', 'true')
  await expect(row(page, 'Wolf 6')).toContainText('down')
  await expect(row(page, 'Alpha').locator('.combat__hp-text')).toHaveText('22 / 22')
  expect(await storedCombat(page)).toEqual(saved)

  // f) End encounter clears the fight and keeps the encounter.
  await page.getByRole('button', { name: 'End encounter' }).click()
  await page.getByRole('alertdialog', { name: 'End encounter?' }).getByRole('button', { name: 'End encounter' }).click()
  await expect(page).toHaveURL(/#\/dm$/)
  await expect(page.getByRole('button', { name: 'Run Wolves' })).toHaveText('Run')
  expect(await storedCombat(page)).toBeNull()
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('MON-4 g: bottom bar works at 390px without inner overflow', async ({ page }) => {
    const noOverflow = async () => {
      const wide = await page.evaluate(() =>
        [document.documentElement, ...document.querySelectorAll('main, main *')]
          .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'hidden' && el.clientWidth > 0)
          .map((el) => `${el.tagName}.${el.className}`)
          .slice(0, 5),
      )
      expect(wide).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    }
    await seed(page)
    await page.goto('/#/dm')
    await page.getByRole('button', { name: 'Run Wolves' }).click()
    await enterInitiative(page)
    await expect(page.locator('.combat__round-line')).toHaveText('Round 1 · Ana turn')
    await noOverflow()

    const bar = page.getByRole('toolbar', { name: 'Selected creatures' })
    const box = await bar.boundingBox()
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
    expect(box!.y).toBeGreaterThan(600)

    await page.getByRole('checkbox', { name: 'Select Wolf 1' }).check()
    await expect(bar.locator('.combat__count')).toHaveText('1 selected')
    await bar.getByRole('button', { name: 'Save: none' }).click()
    const panel = page.getByRole('region', { name: 'Save settings' })
    await panel.getByRole('combobox', { name: 'Save', exact: true }).selectOption('dex')
    await panel.getByRole('spinbutton', { name: 'DC' }).fill('13')
    await panel.getByRole('button', { name: 'Roll saves' }).click()
    await panel.getByRole('button', { name: 'Done' }).click()
    await expect(bar.getByRole('button', { name: 'Save: DEX DC 13' })).toBeVisible()
    const success = await saveOutcome(page, 'Wolf 1')
    await bar.getByRole('spinbutton', { name: 'Amount' }).fill('5')
    await bar.getByRole('button', { name: 'Damage' }).click()
    await expect(row(page, 'Wolf 1').locator('.combat__hp-text')).toHaveText(success ? '9 / 11' : '6 / 11')
    await bar.getByRole('combobox', { name: 'Add condition' }).selectOption('Prone')
    await expect(row(page, 'Wolf 1').locator('.combat__condition')).toHaveText(['Prone×'])
    await page.getByRole('button', { name: 'Next turn' }).click()
    await expect(page.locator('.combat__round-line')).toHaveText('Round 1 · Wolf x6 turn')
    await noOverflow()

    const stat = await row(page, 'Alpha').getByRole('button', { name: 'Stat block for Alpha' }).boundingBox()
    expect(stat!.height).toBeGreaterThanOrEqual(44)
    await row(page, 'Alpha').getByRole('button', { name: 'Stat block for Alpha' }).click()
    await expect(page.getByRole('article', { name: 'Dire Wolf stat block' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Turn order' })).toHaveCount(0)
    await noOverflow()
    await page.getByRole('button', { name: '← Back' }).click()
    await expect(page.getByRole('list', { name: 'Turn order' })).toBeVisible()
  })
})
