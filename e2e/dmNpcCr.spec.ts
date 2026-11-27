import { expect, test, type Page } from '@playwright/test'

/* NPC-3 (D439). Mira = Fighter 3 (XPHB), STR 15 DEX 14 CON 13, a held Greatsword: HP 25, AC 12 → defence CR 1/8 (hp 7-35, AC 13);
   2d6 + 2 = 9 × 1 attack, +4 → offence CR 1 (dpr 9-14, atk 3); (0.125 + 1) / 2 → CR 1/2 = 100 XP. Wolf (XMM) 50 XP. */

const CHARACTERS = 'familliar:characters'
const ENCOUNTERS = 'familliar:encounters'
const ID = 'enc-cr'
const TITLE = 'Estimate (DMG 2014 method): defence CR 1/8, offence CR 1. Spells of level 1+ and other features are not counted.'

const mira = {
  schemaVersion: 73,
  id: 'n-mira',
  name: 'Mira',
  classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
  abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
  species: { name: 'Elf', source: 'XPHB' },
  inventory: [{ name: 'Greatsword', source: 'XPHB', quantity: 1, equipped: 'held' }],
  npc: true,
}

function encounter(npcs: unknown[] = []) {
  return {
    id: ID,
    name: 'Ambush',
    createdAt: '2026-11-27T10:00:00.000Z',
    updatedAt: '2026-11-27T10:00:00.000Z',
    party: { size: 4, level: 2 },
    players: [],
    groups: [{ id: 'g-wolf', monster: { name: 'Wolf', source: 'XMM' }, oneInitiative: false, members: [{ id: 'w1', name: 'Wolf' }] }],
    npcs,
    combat: null,
  }
}

async function seed(page: Page, enc = encounter()): Promise<void> {
  await page.goto('/')
  await page.evaluate(
    ([c, cv, e, ev]) => {
      localStorage.setItem(c, cv)
      localStorage.setItem(e, ev)
    },
    [CHARACTERS, JSON.stringify([mira]), ENCOUNTERS, JSON.stringify({ schemaVersion: 3, encounters: [enc] })],
  )
}

const badge = (page: Page) => page.locator('.char-card', { hasText: 'Mira' }).locator('.char-card__badge')

test('NPC-3 a: the NPCs tab card shows the estimate and its tooltip', async ({ page }) => {
  await seed(page)
  await page.goto('/#/dm/npcs')
  await expect(badge(page)).toHaveText('≈ CR 1/2')
  await expect(badge(page)).toHaveAttribute('title', TITLE)
})

test('NPC-3 b, c: Add NPC prefills the estimate; clearing it leaves the NPC uncounted', async ({ page }) => {
  await seed(page)
  await page.goto(`/#/dm/encounter/${ID}`)
  const total = page.locator('.encounter-difficulty__total')
  await expect(total).toHaveText('50 XP')
  await page.getByRole('combobox', { name: 'Add NPC' }).selectOption('n-mira')
  const cr = page.getByRole('combobox', { name: 'Mira CR' })
  await expect(cr).toHaveValue('1/2')
  await expect(total).toHaveText('150 XP')

  await cr.selectOption('')
  await expect(total).toHaveText('50 XP')
  await expect(page.locator('.encounter-difficulty__note')).toHaveText('1 NPC without CR not counted')
  await page.getByRole('button', { name: 'Save' }).click()
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).encounters[0].npcs, ENCOUNTERS)
  expect(saved).toMatchObject([{ characterId: 'n-mira', cr: null }])
})

test('NPC-3 d: an NPC stored with no CR keeps it empty', async ({ page }) => {
  await seed(page, encounter([{ id: 'npc-1', characterId: 'n-mira', name: 'Mira', cr: null }]))
  await page.goto(`/#/dm/encounter/${ID}`)
  // The estimate is visible elsewhere, so it has had time to load.
  await page.goto('/#/dm/npcs')
  await expect(badge(page)).toHaveText('≈ CR 1/2')
  await page.goto(`/#/dm/encounter/${ID}`)
  await expect(page.getByRole('combobox', { name: 'Mira CR' })).toHaveValue('')
  await expect(page.locator('.encounter-difficulty__note')).toHaveText('1 NPC without CR not counted')
  await expect(page.locator('.encounter-difficulty__total')).toHaveText('50 XP')
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('NPC-3 e: the card label stays inside the card at 390px', async ({ page }) => {
    await seed(page)
    await page.goto('/#/dm/npcs')
    await expect(badge(page)).toHaveText('≈ CR 1/2')
    const card = page.locator('.char-card', { hasText: 'Mira' })
    const [cardBox, badgeBox] = await Promise.all([card.boundingBox(), badge(page).boundingBox()])
    expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width)
    const overflowing = await card.evaluate((element) => [element, ...element.querySelectorAll('*')].filter((e) => e.scrollWidth > e.clientWidth).map((e) => e.className))
    expect(overflowing).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})
