import { expect, test, type Page } from '@playwright/test'

/* MON-5 (D435): tracked uses. Adult Green Dragon (XMM): Legendary Resistance (3/Day, or 4/Day in Lair),
   Poison Breath {@recharge 5}, 3 legendary actions (4 in lair). Barlgura: daily "2e"/"1e" spells. Dire Wolf CR 1. */

const KEY = 'familliar:encounters'
const ID = 'enc-dragon'

const ENCOUNTER = {
  id: ID,
  name: 'Dragon',
  createdAt: '2026-11-27T10:00:00.000Z',
  updatedAt: '2026-11-27T10:00:00.000Z',
  party: null,
  players: [],
  groups: [
    { id: 'g-dragon', monster: { name: 'Adult Green Dragon', source: 'XMM' }, oneInitiative: false, members: [{ id: 'd1', name: 'Verdant' }] },
    { id: 'g-barl', monster: { name: 'Barlgura', source: 'XMM' }, oneInitiative: false, members: [{ id: 'b1', name: 'Barlgura' }] },
    { id: 'g-dire', monster: { name: 'Dire Wolf', source: 'XMM' }, oneInitiative: false, members: [{ id: 'w1', name: 'Alpha' }] },
  ],
  npcs: [],
  combat: null,
}

async function begin(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [KEY, JSON.stringify({ schemaVersion: 3, encounters: [ENCOUNTER] })])
  await page.goto(`/#/dm/encounter/${ID}/run`)
  await page.getByRole('spinbutton', { name: 'Initiative Verdant' }).fill('20')
  await page.getByRole('spinbutton', { name: 'Initiative Barlgura' }).fill('15')
  await page.getByRole('spinbutton', { name: 'Initiative Alpha' }).fill('10')
  await page.getByRole('button', { name: 'Begin' }).click()
}

const row = (page: Page, name: string) => page.getByRole('listitem', { name, exact: true })
const card = (page: Page, name: string) => page.getByRole('region', { name: `Stat block ${name}` })
const boxes = (page: Page, use: string) => card(page, 'Verdant').getByRole('listitem', { name: `${use} uses` }).locator('.use-box')

test('MON-5 a–e: boxes persist, lair, recharge reminder, legendary refill, two cards', async ({ page }) => {
  await begin(page)
  await row(page, 'Verdant').getByRole('button', { name: 'Stat block for Verdant' }).click()
  await expect(card(page, 'Verdant').getByRole('region', { name: 'Tracked uses Verdant' })).toBeVisible()
  await expect(card(page, 'Verdant').getByRole('listitem', { name: 'Legendary Resistance uses' })).toContainText('3/Day')

  // a) Two Legendary Resistance boxes, kept after reload; row shows the count.
  await expect(boxes(page, 'Legendary Resistance')).toHaveCount(3)
  await page.getByRole('button', { name: 'Legendary Resistance use 2' }).click()
  await expect(row(page, 'Verdant').locator('.combat__use-counts')).toContainText('LR 2/3')
  expect(await boxes(page, 'Legendary Resistance').evaluateAll((els) => els.map((el) => el.getAttribute('aria-pressed')))).toEqual(['true', 'true', 'false'])
  await page.reload()
  await row(page, 'Verdant').getByRole('button', { name: 'Stat block for Verdant' }).click()
  await expect(boxes(page, 'Legendary Resistance')).toHaveCount(3)
  expect(await boxes(page, 'Legendary Resistance').evaluateAll((els) => els.map((el) => el.getAttribute('aria-pressed')))).toEqual(['true', 'true', 'false'])
  await page.getByRole('button', { name: 'Legendary Resistance use 2' }).click()
  await expect(row(page, 'Verdant').locator('.combat__use-counts')).toContainText('LR 1/3')

  // b) In lair: 4 boxes for Legendary Resistance and legendary actions.
  await card(page, 'Verdant').getByRole('checkbox', { name: 'In lair' }).check()
  await expect(boxes(page, 'Legendary Resistance')).toHaveCount(4)
  await expect(boxes(page, 'Legendary Actions')).toHaveCount(4)
  await expect(row(page, 'Verdant').locator('.combat__use-counts')).toContainText('LR 1/4')

  // c + d) Breath spent, two legendary actions used, round comes back to the dragon.
  await card(page, 'Verdant').getByRole('button', { name: 'Use Poison Breath' }).click()
  await expect(card(page, 'Verdant').getByRole('button', { name: 'Poison Breath spent, mark ready' })).toHaveText('SPENT · Recharge 5-6')
  await page.getByRole('button', { name: 'Legendary Actions use 2' }).click()
  await expect(row(page, 'Verdant').locator('.combat__use-counts')).toContainText('LA 2/4')
  await page.getByRole('button', { name: 'Next turn' }).click()
  await expect(page.getByRole('list', { name: 'Recharge reminders' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Next turn' }).click()
  await page.getByRole('button', { name: 'Next turn' }).click()
  await expect(row(page, 'Verdant')).toHaveAttribute('aria-current', 'true')
  await expect(row(page, 'Verdant').locator('.combat__use-counts')).toContainText('LA 0/4')
  expect(await boxes(page, 'Legendary Actions').evaluateAll((els) => els.map((el) => el.getAttribute('aria-pressed')))).toEqual(['false', 'false', 'false', 'false'])
  const reminder = page.getByRole('list', { name: 'Recharge reminders' }).getByRole('listitem')
  await expect(reminder).toContainText('Verdant: Poison Breath is spent - roll d6, recharges on 5-6')
  for (let i = 0; i < 40 && (await reminder.getByRole('button', { name: 'ROLL d6' }).count()) > 0; i++) {
    await reminder.getByRole('button', { name: 'ROLL d6' }).click()
    await expect(reminder.locator('.recharge-reminder__result')).toContainText('Rolled')
  }
  await expect(reminder.locator('.recharge-reminder__result')).toContainText(/Rolled [56] - READY/)
  await expect(card(page, 'Verdant').getByRole('button', { name: 'Use Poison Breath' })).toBeVisible()
  await reminder.getByRole('button', { name: 'Dismiss reminder' }).click()
  await expect(page.getByRole('list', { name: 'Recharge reminders' })).toHaveCount(0)

  // e) Second card opens beside the first, newest first.
  await row(page, 'Barlgura').getByRole('button', { name: 'Stat block for Barlgura' }).click()
  await expect(card(page, 'Barlgura').getByRole('listitem', { name: 'Entangle uses' })).toContainText('1/Day each')
  const cards = page.locator('.combat__stats')
  await expect(cards).toHaveCount(2)
  expect(await cards.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))).toEqual(['Stat block Barlgura', 'Stat block Verdant'])
  const [first, second] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()]
  expect(Math.abs(first!.y - second!.y)).toBeLessThan(2)
  expect(second!.x).toBeGreaterThan(first!.x + first!.width - 1)
  await card(page, 'Barlgura').getByRole('button', { name: 'Close' }).click()
  await expect(cards).toHaveCount(1)
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('MON-5 f: bottom bar rows, rows fill the width, CR in subtitle, no inner overflow', async ({ page }) => {
    await begin(page)
    const wide = await page.evaluate(() =>
      [document.documentElement, ...document.querySelectorAll('main, main *')]
        .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'hidden' && el.clientWidth > 0)
        .map((el) => `${el.tagName}.${el.className}`)
        .slice(0, 5),
    )
    expect(wide).toEqual([])

    await expect(row(page, 'Alpha')).toContainText('Dire Wolf · CR 1')
    for (const name of ['Verdant', 'Barlgura', 'Alpha']) {
      const rowBox = await row(page, name).boundingBox()
      const button = await row(page, name).getByRole('button', { name: `Stat block for ${name}` }).boundingBox()
      expect(rowBox!.x + rowBox!.width - (button!.x + button!.width)).toBeLessThanOrEqual(12)
    }

    const bar = page.getByRole('toolbar', { name: 'Selected creatures' })
    const count = await bar.locator('.combat__count').boundingBox()
    const save = await bar.getByRole('button', { name: 'Save: none' }).boundingBox()
    const condition = await bar.getByRole('combobox', { name: 'Add condition' }).boundingBox()
    const amount = await bar.getByRole('spinbutton', { name: 'Amount' }).boundingBox()
    const damage = await bar.getByRole('button', { name: 'Damage' }).boundingBox()
    const heal = await bar.getByRole('button', { name: 'Heal' }).boundingBox()
    expect(Math.abs(count!.y + count!.height / 2 - (save!.y + save!.height / 2))).toBeLessThan(4)
    expect(Math.abs(save!.y - condition!.y)).toBeLessThan(4)
    expect(damage!.y).toBeGreaterThan(save!.y + save!.height - 1)
    expect(Math.abs(damage!.y - heal!.y)).toBeLessThan(1)
    expect(Math.abs(damage!.y - amount!.y)).toBeLessThan(4)
    expect(damage!.height).toBeGreaterThanOrEqual(44)
    expect(heal!.height).toBeGreaterThanOrEqual(44)
    expect(Math.round(amount!.width)).toBe(70)
    expect(Math.abs(damage!.width - heal!.width)).toBeLessThan(2)
    await expect(bar.locator('label')).toHaveCount(0)
  })
})
