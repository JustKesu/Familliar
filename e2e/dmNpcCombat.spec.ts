import { expect, test, type Page } from '@playwright/test'

/* NPC-2 (D438): NPCs in encounters. Mira = Fighter 3 (XPHB), STR 15 DEX 14 CON 13: initiative +2, STR save +4, CON +3, DEX +2, AC 12, max HP 25
   (the same numbers npcCombat.test.ts reads from data/). Wolf (XMM): CR 1/4, 50 XP, 11 HP. CR 1 = 200 XP. Party 4 × level 2: Low 400. */

const CHARACTERS = 'familliar:characters'
const ENCOUNTERS = 'familliar:encounters'
const ID = 'enc-npc'
const ABILITIES = { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } }

function npc(id: string, name: string) {
  return {
    schemaVersion: 73,
    id,
    name,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
    abilityScores: ABILITIES,
    species: { name: 'Elf', source: 'XPHB' },
    currentHp: 20,
    npc: true,
  }
}

function encounter(extra: Record<string, unknown> = {}) {
  return {
    id: ID,
    name: 'Ambush',
    createdAt: '2026-11-27T10:00:00.000Z',
    updatedAt: '2026-11-27T10:00:00.000Z',
    party: { size: 4, level: 2 },
    players: ['Ana'],
    groups: [{ id: 'g-wolf', monster: { name: 'Wolf', source: 'XMM' }, oneInitiative: false, members: [{ id: 'w1', name: 'Wolf' }] }],
    npcs: [],
    combat: null,
    ...extra,
  }
}

async function seed(page: Page, enc = encounter()): Promise<void> {
  await page.goto('/')
  await page.evaluate(
    ([c, cv, e, ev]) => {
      localStorage.setItem(c, cv)
      localStorage.setItem(e, ev)
    },
    [CHARACTERS, JSON.stringify([npc('n-mira', 'Mira'), npc('n-thug', 'Thug')]), ENCOUNTERS, JSON.stringify({ schemaVersion: 3, encounters: [enc] })],
  )
}

const row = (page: Page, name: string) => page.getByRole('listitem', { name, exact: true })
const storedNpc = (page: Page, id: string) =>
  page.evaluate(([key, npcId]) => (JSON.parse(localStorage.getItem(key) ?? '[]') as { id: string; currentHp?: number; play?: { conditions?: string[] } }[]).find((c) => c.id === npcId), [CHARACTERS, id])

async function addMira(page: Page): Promise<void> {
  await page.goto(`/#/dm/encounter/${ID}`)
  await page.getByRole('combobox', { name: 'Add NPC' }).selectOption('n-mira')
}

test('NPC-2 a, b: Add NPC with and without CR changes the difficulty; an NPC is added once', async ({ page }) => {
  await seed(page)
  await addMira(page)
  const total = page.locator('.encounter-difficulty__total')
  await expect(page.getByRole('region', { name: 'Mira NPC' })).toContainText('NPC · Fighter 3')
  await expect(total).toHaveText('50 XP')
  await expect(page.locator('.encounter-difficulty__note')).toHaveText('1 NPC without CR not counted')
  await page.getByRole('combobox', { name: 'Mira CR' }).selectOption('1')
  await expect(total).toHaveText('250 XP')
  await expect(page.locator('.encounter-difficulty__note')).toHaveCount(0)

  // b) Mira is no longer offered; Thug still is.
  const options = await page.getByRole('combobox', { name: 'Add NPC' }).locator('option').allTextContents()
  expect(options).toEqual(['Add NPC…', 'Thug · Fighter 3'])
  await page.getByRole('button', { name: 'Save' }).click()
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), ENCOUNTERS)
  expect(saved.schemaVersion).toBe(3)
  expect(saved.encounters[0].npcs).toMatchObject([{ characterId: 'n-mira', name: 'Mira', cr: '1' }])

  await page.goto(`/#/dm/encounter/${ID}`)
  await page.getByRole('button', { name: 'Remove Mira' }).click()
  await expect(page.getByRole('region', { name: 'Mira NPC' })).toHaveCount(0)
})

test('NPC-2 c–h: initiative, shared HP and conditions, sheet save bonus, sheet and back', async ({ page }) => {
  await seed(page)
  await addMira(page)
  await page.getByRole('button', { name: 'Start' }).click()

  // c) Mira is rolled as d20 + 2.
  await expect(page.locator('.combat-init__item', { hasText: 'Mira' })).toContainText('d20 +2')
  const rolled = Number(await page.getByRole('spinbutton', { name: 'Initiative Mira' }).inputValue())
  expect(rolled).toBeGreaterThanOrEqual(3)
  expect(rolled).toBeLessThanOrEqual(22)
  await page.getByRole('spinbutton', { name: 'Initiative Mira' }).fill('18')
  await page.getByRole('spinbutton', { name: 'Initiative Wolf' }).fill('10')
  await page.getByRole('spinbutton', { name: 'Initiative Ana' }).fill('5')
  await page.getByRole('button', { name: 'Begin' }).click()
  await expect(row(page, 'Mira')).toHaveAttribute('aria-current', 'true')
  await expect(row(page, 'Mira')).toContainText('NPC · Fighter 3')
  await expect(row(page, 'Mira').locator('.combat__ac')).toHaveText('12')
  await expect(row(page, 'Mira').locator('.combat__hp-text')).toHaveText('20 / 25')
  await expect(row(page, 'Mira').locator('.combat__saves')).toHaveText('STR +4DEX +2CON +3INT +1WIS +0CHA -1')

  // d) 5 damage to Mira and the wolf together.
  await page.getByRole('checkbox', { name: 'Select Mira' }).check()
  await page.getByRole('checkbox', { name: 'Select Wolf' }).check()
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('5')
  await page.getByRole('button', { name: 'Damage' }).click()
  await expect(row(page, 'Mira').locator('.combat__hp-text')).toHaveText('15 / 25')
  await expect(row(page, 'Wolf').locator('.combat__hp-text')).toHaveText('6 / 11')
  expect((await storedNpc(page, 'n-mira'))?.currentHp).toBe(15)

  // f) Prone from the encounter is on the character.
  await page.getByRole('button', { name: 'Clear selection' }).click()
  await page.getByRole('checkbox', { name: 'Select Mira' }).check()
  await page.getByRole('combobox', { name: 'Add condition' }).selectOption('Prone')
  await expect(row(page, 'Mira').locator('.combat__condition')).toHaveText(['Prone×'])
  expect((await storedNpc(page, 'n-mira'))?.play?.conditions).toEqual(['Prone'])

  // g) A forced d20 of 1 shows the sheet's STR save bonus: 1 + 4 = 5.
  await page.getByRole('combobox', { name: 'Save', exact: true }).selectOption('str')
  await page.getByRole('spinbutton', { name: 'DC' }).fill('10')
  await page.evaluate(() => {
    ;(window as unknown as { realRandom: () => number }).realRandom = Math.random
    Math.random = () => 0
  })
  await page.getByRole('button', { name: 'Roll saves' }).click()
  await page.evaluate(() => {
    Math.random = (window as unknown as { realRandom: () => number }).realRandom
  })
  await expect(row(page, 'Mira').getByRole('button', { name: /^Save for Mira:/ })).toHaveText('STR 5 ✗')
  await page.getByRole('combobox', { name: 'Save', exact: true }).selectOption('')

  // h) Next turn to the wolf, open Mira's sheet, then back to the same round and turn.
  await page.getByRole('button', { name: 'Next turn' }).click()
  await expect(row(page, 'Wolf')).toHaveAttribute('aria-current', 'true')
  await row(page, 'Mira').getByRole('button', { name: 'Sheet for Mira' }).click()
  const sheet = page.getByRole('dialog', { name: 'NPC sheet' })
  await expect(sheet.locator('.sheet__hit-points-value').first()).toHaveText('15 / 25')
  await expect(sheet.locator('.sheet__status-conditions')).toContainText('Prone')

  // e) Heal on the sheet shows in the encounter.
  const hp = sheet.getByRole('group', { name: 'Damage and healing' }).first()
  await hp.getByRole('spinbutton', { name: 'Amount' }).fill('4')
  await hp.getByRole('button', { name: 'Heal' }).click()
  await expect(sheet.locator('.sheet__hit-points-value').first()).toHaveText('19 / 25')
  await sheet.getByRole('button', { name: '← Back to encounter' }).click()
  await expect(page.getByRole('dialog', { name: 'NPC sheet' })).toHaveCount(0)
  await expect(page.locator('.combat__round-value')).toHaveText('1')
  await expect(row(page, 'Wolf')).toHaveAttribute('aria-current', 'true')
  await expect(row(page, 'Mira').locator('.combat__hp-text')).toHaveText('19 / 25')

  // Next turn skips Mira at 0 HP.
  await page.getByRole('checkbox', { name: 'Select Mira' }).check()
  await page.getByRole('spinbutton', { name: 'Amount' }).fill('30')
  await page.getByRole('button', { name: 'Damage' }).click()
  await expect(row(page, 'Mira')).toContainText('down')
  await page.getByRole('button', { name: 'Next turn' }).click()
  await expect(row(page, 'Ana')).toHaveAttribute('aria-current', 'true')
  await page.getByRole('button', { name: 'Next turn' }).click()
  await expect(row(page, 'Wolf')).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('.combat__round-value')).toHaveText('2')
})

test('NPC-2 i: a deleted NPC shows as deleted in setup and combat and can be removed', async ({ page }) => {
  const ghost = { id: 'npc-ghost', characterId: 'n-gone', name: 'Ghost', cr: null }
  const combat = {
    round: 1,
    turn: 0,
    order: [
      { kind: 'npc', npcId: 'npc-ghost', initiative: 15, bonus: 1 },
      { kind: 'member', groupId: 'g-wolf', memberId: 'w1', initiative: 10, bonus: 2 },
    ],
    hp: {},
    conditions: {},
    adv: {},
    saveResults: {},
  }
  await seed(page, encounter({ npcs: [ghost], combat }))
  await page.goto(`/#/dm/encounter/${ID}/run`)
  await expect(row(page, 'Ghost (NPC deleted)')).toBeVisible()
  await expect(page.locator('.combat__round-line, .combat__round-value').first()).toBeVisible()
  await page.getByRole('button', { name: 'Remove Ghost (NPC deleted)' }).click()
  await expect(row(page, 'Ghost (NPC deleted)')).toHaveCount(0)
  await expect(row(page, 'Wolf')).toHaveAttribute('aria-current', 'true')
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).encounters[0], ENCOUNTERS)
  expect(saved.npcs).toEqual([])
  expect(saved.combat.order).toHaveLength(1)

  await seed(page, encounter({ npcs: [ghost] }))
  await page.goto(`/#/dm/encounter/${ID}`)
  await expect(page.getByRole('region', { name: 'Ghost (NPC deleted) NPC' })).toContainText('This NPC no longer exists')
  await page.getByRole('button', { name: 'Remove Ghost (NPC deleted)' }).click()
  await expect(page.getByRole('region', { name: 'Ghost (NPC deleted) NPC' })).toHaveCount(0)
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('NPC-2 j: NPC setup card and combat row buttons stay inside 390px', async ({ page }) => {
    const insideViewport = async (locators: ReturnType<Page['locator']>[]) => {
      for (const locator of locators) {
        const right = await locator.evaluate((element) => element.getBoundingClientRect().right)
        expect(right).toBeLessThanOrEqual(390)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    }
    await seed(page)
    await addMira(page)
    await page.getByRole('combobox', { name: 'Mira CR' }).selectOption('1')
    await insideViewport([page.getByRole('button', { name: 'Remove Mira' }), page.getByRole('combobox', { name: 'Mira CR' }), page.getByRole('combobox', { name: 'Add NPC' })])
    await page.getByRole('button', { name: 'Start' }).click()
    await page.getByRole('button', { name: 'Begin' }).click()
    await expect(row(page, 'Mira')).toContainText('NPC · CR 1')
    await insideViewport([page.getByRole('checkbox', { name: 'Select Mira' }), row(page, 'Mira').getByRole('button', { name: 'Sheet for Mira' }), row(page, 'Mira').locator('.combat__hp')])
    await row(page, 'Mira').getByRole('button', { name: 'Sheet for Mira' }).click()
    await insideViewport([page.getByRole('button', { name: '← Back to encounter' })])
    await page.getByRole('button', { name: '← Back to encounter' }).click()
    await expect(page.getByRole('list', { name: 'Turn order' })).toBeVisible()
  })
})
