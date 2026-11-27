import { expect, test, type Page } from '@playwright/test'

/* MON-6 (D436): rolls from the monster stat block. Wolf (XMM): Bite {@hit 4} {@damage 1d6 + 2}, DEX 15 (+2), STR 14 (+2), Stealth +4. */

const KEY = 'familliar:encounters'
const ID = 'enc-wolves'
const ENCOUNTER = {
  id: ID,
  name: 'Wolves',
  createdAt: '2026-11-27T10:00:00.000Z',
  updatedAt: '2026-11-27T10:00:00.000Z',
  party: { size: 4, level: 2 },
  players: [],
  groups: [{ id: 'g-wolf', monster: { name: 'Wolf', source: 'XMM' }, oneInitiative: true, members: [1, 2, 3].map((n) => ({ id: `w${n}`, name: `Wolf ${n}` })) }],
  combat: null,
}

const toast = (page: Page) => page.locator('.roll-toast')
const dice = (page: Page) => page.locator('.roll-toast__die')
const card = (page: Page) => page.locator('.monster-card')
const rollButton = (page: Page, label: string) => card(page).getByRole('button', { name: `Roll ${label}`, exact: true })

async function startEncounter(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [KEY, JSON.stringify({ schemaVersion: 2, encounters: [ENCOUNTER] })])
  await page.goto(`/#/dm/encounter/${ID}`)
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('spinbutton', { name: 'Initiative Wolf x3' }).fill('15')
  await page.getByRole('button', { name: 'Begin' }).click()
}

test('MON-6 a–e: Bestiary Wolf rolls to hit, damage, save, check and skill; history; advantage', async ({ page }) => {
  await page.goto('/#/dm/bestiary')
  await page.getByRole('searchbox', { name: 'Search monsters' }).fill('wolf')
  await page.locator('.bestiary__row', { has: page.locator('.bestiary__name', { hasText: /^Wolf$/ }) }).click()

  // a) to hit
  await expect(rollButton(page, 'Wolf · Bite to hit')).toHaveText('+4')
  await rollButton(page, 'Wolf · Bite to hit').click()
  await expect(toast(page).locator('.roll-toast__label')).toHaveText('Wolf · Bite to hit')
  await expect(dice(page)).toHaveCount(1)

  // b) damage
  await expect(rollButton(page, 'Wolf · Bite damage')).toHaveText('1d6 + 2')
  await rollButton(page, 'Wolf · Bite damage').click()
  await expect(toast(page).locator('.roll-toast__label')).toHaveText('Wolf · Bite damage')
  await expect(dice(page)).toHaveCount(1)
  await expect(toast(page).locator('.roll-toast__sum')).toContainText('+ 2 =')

  // c) save, ability check, skill
  for (const [label, text] of [
    ['Wolf · DEX save', '+2'],
    ['Wolf · STR check', '+2'],
    ['Wolf · Stealth', '+4'],
  ]) {
    await expect(rollButton(page, label)).toHaveText(text)
    await rollButton(page, label).click()
    await expect(toast(page).locator('.roll-toast__label')).toHaveText(label)
    await expect(dice(page)).toHaveCount(1)
  }
  await expect(card(page).locator('.beast__vitals').getByRole('button')).toHaveCount(0)

  // d) history newest first
  await page.getByRole('button', { name: 'Rolls', exact: true }).click()
  const entries = page.getByRole('dialog', { name: 'Roll history' }).getByRole('listitem')
  const labels = (await entries.allTextContents()).map((text) => text.split(':')[0])
  expect(labels).toEqual(['Wolf · Stealth', 'Wolf · STR check', 'Wolf · DEX save', 'Wolf · Bite damage', 'Wolf · Bite to hit'])
  await page.getByRole('dialog', { name: 'Roll history' }).getByRole('button', { name: 'Close' }).click()

  // e) advantage: two dice, then back to Normal; damage ignores the mode
  const mode = page.getByRole('group', { name: 'Roll mode' })
  await mode.getByRole('button', { name: 'Advantage', exact: true }).click()
  await rollButton(page, 'Wolf · Bite damage').click()
  await expect(toast(page).locator('.roll-toast__label')).toHaveText('Wolf · Bite damage')
  await expect(mode.getByRole('button', { name: 'Advantage', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await rollButton(page, 'Wolf · Bite to hit').click()
  await expect(toast(page).locator('.roll-toast__label')).toHaveText('Wolf · Bite to hit')
  await expect(dice(page)).toHaveCount(2)
  await expect(mode.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')
})

test('MON-6 f: the third wolf in a running encounter rolls as "Wolf 3"', async ({ page }) => {
  await startEncounter(page)
  await page.getByRole('button', { name: 'Stat block for Wolf 3' }).click()
  await rollButton(page, 'Wolf 3 · Bite to hit').click()
  await expect(toast(page).locator('.roll-toast__label')).toHaveText('Wolf 3 · Bite to hit')
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('MON-6 g: at 390×844 the toast is inside the viewport and clear of the bottom bar', async ({ page }) => {
    await startEncounter(page)
    await page.getByRole('button', { name: 'Stat block for Wolf 3' }).click()
    await rollButton(page, 'Wolf 3 · Bite to hit').click()
    const inside = async () => {
      const box = (await toast(page).boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(390)
      expect(box.y + box.height).toBeLessThanOrEqual(844)
      return box
    }
    await inside()

    await page.getByRole('button', { name: '← Back' }).click()
    await expect(toast(page)).toBeVisible()
    const box = await inside()
    const bar = (await page.getByRole('toolbar', { name: 'Selected creatures' }).boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(bar.y)

    await expect(page.getByRole('group', { name: 'Roll mode' })).toBeVisible()
    await page.getByRole('button', { name: 'Rolls', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Roll history' }).getByRole('listitem')).toHaveCount(1)
  })
})

test('MON-6 h: a sheet spell description keeps {@damage} as plain text', async ({ page }) => {
  const sorcerer = {
    schemaVersion: 50,
    id: 'mon6-sorcerer',
    name: 'Plain Sorcerer',
    classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: null, level: 5 }],
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 16 } },
    spellChoices: [{ className: 'Sorcerer', classSource: 'XPHB', spells: [{ name: 'Fireball', source: 'XPHB' }] }],
  }
  await page.addInitScript((payload) => localStorage.setItem('familliar:characters', payload), JSON.stringify([sorcerer]))
  await page.goto(`/#/character/${sorcerer.id}`)
  await page.getByRole('tab', { name: 'Spells' }).click()
  await page.getByRole('button', { name: 'Fireball', exact: true }).first().click()
  const panel = page.getByRole('tabpanel', { name: 'Spells' })
  await expect(panel.locator('.mk-value--damage').first()).toHaveText('8d6')
  await expect(panel.locator('.mk-p .roll-value, .mk-entries .roll-value')).toHaveCount(0)
})
