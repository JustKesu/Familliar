import { expect, test, type Locator, type Page } from '@playwright/test'
import { featOrAsiSelect, next, takeAllFighterLevel4Picks } from './wizard.ts'

/*
 * R14e1 (D221). A Human Fighter 3 at the current schema, as customItemProficiencies.spec.ts: STR 15, DEX 14,
 * CON 13, PB +2, proficient in Strength saves and the Longsword — Strength save +4, Athletics +2, Longsword +4,
 * max HP 10 + 6 + 6 + 3 × 1 = 25. Item names are data/items.json's (DATA.md "Item `ability`").
 */
const STORAGE_KEY = 'familliar:characters'

function fighter(id: string, inventory: Record<string, unknown>[], scores: Record<string, number> = {}, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 54,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
    species: { name: 'Human', source: 'XPHB' },
    abilityScores: { method: 'roll', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10, ...scores } },
    inventory,
    ...extra,
  }
}

const item = (name: string, attuned = false) => ({ name, source: 'XDMG', quantity: 1, ...(attuned ? { attuned: true } : {}) })
const longsword = { name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' }

async function open(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

const score = (page: Page, ability: string): Locator => page.locator(`.ability-card[data-ability="${ability}"] .ability-card__score`)

async function maxHp(page: Page): Promise<number> {
  const match = /\/\s*(\d+)/.exec(await page.locator('.sheet__hit-points-value').first().innerText())
  return match ? Number(match[1]) : NaN
}

async function expectAbilityBreakdown(page: Page, label: string, text: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: `${label} score breakdown`, exact: true }).click()
  await expect(page.getByRole('dialog', { name: label, exact: true })).toContainText(text)
  await page.keyboard.press('Escape')
}

test('R14e1 a: an attuned Belt of Hill Giant Strength sets Strength to 21 and lifts the save, Athletics and the Longsword', async ({ page }) => {
  await open(page, fighter('r14e1-a', [longsword, item('Belt of Hill Giant Strength', true)]))
  await expect(score(page, 'strength')).toHaveText('21')
  await expect(page.getByRole('button', { name: 'Roll Strength saving throw' })).toHaveText('+7')
  await expect(page.getByRole('button', { name: 'Roll Athletics check' })).toHaveText('+5')
  await expectAbilityBreakdown(page, 'Strength', 'Belt of Hill Giant Strength: set to 21')
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(page.getByRole('button', { name: 'Roll Longsword to hit' })).toHaveText('+7')
})

test('R14e1 b: the same belt not attuned changes nothing and says so', async ({ page }) => {
  await open(page, fighter('r14e1-b', [item('Belt of Hill Giant Strength')]))
  await expect(score(page, 'strength')).toHaveText('15')
  await expect(page.getByRole('button', { name: 'Roll Athletics check' })).toHaveText('+2')
  await expectAbilityBreakdown(page, 'Strength', 'considered (set to 21) — not applied: not attuned')
})

test('R14e1 c: Gauntlets of Ogre Power leave a Strength of 20 alone', async ({ page }) => {
  await open(page, fighter('r14e1-c', [item('Gauntlets of Ogre Power', true)], { strength: 20 }))
  await expect(score(page, 'strength')).toHaveText('20')
  await expectAbilityBreakdown(page, 'Strength', 'no effect: the score is already 20')
})

test('R14e1 d: Amulet of Health raises max HP by the Constitution modifier change times level', async ({ page }) => {
  await open(page, fighter('r14e1-d', [item('Amulet of Health', true)]))
  await expect(score(page, 'constitution')).toHaveText('19')
  // 25 without it; CON +1 → +4 at level 3 adds 9.
  await expect.poll(() => maxHp(page)).toBe(34)
})

test('R14e1 e: of two set-to items on Strength the higher wins', async ({ page }) => {
  await open(page, fighter('r14e1-e', [item('Belt of Hill Giant Strength', true), item('Belt of Frost Giant Strength', true)]))
  await expect(score(page, 'strength')).toHaveText('23')
  await expectAbilityBreakdown(page, 'Strength', 'no effect: Belt of Frost Giant Strength sets a score at least as high')
})

test('R14e1 f: Belt of Dwarvenkind with Constitution 19 stops at 20', async ({ page }) => {
  await open(page, fighter('r14e1-f', [item('Belt of Dwarvenkind', true)], { constitution: 19 }))
  await expect(score(page, 'constitution')).toHaveText('20')
  await expectAbilityBreakdown(page, 'Constitution', 'capped at 20')
})

test('R14e1 g: a Potion of Giant Strength and a Manual in the pack change nothing', async ({ page }) => {
  await open(page, fighter('r14e1-g', [item('Potion of Hill Giant Strength'), item('Manual of Gainful Exercise')]))
  await expect(score(page, 'strength')).toHaveText('15')
  await page.getByRole('button', { name: 'Strength score breakdown', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Strength', exact: true })).not.toContainText('Potion')
  await expect(page.getByRole('dialog', { name: 'Strength', exact: true })).not.toContainText('Manual')
})

test('R14e1 h: an attuned Book of Vile Darkness is named on every ability and changes no score', async ({ page }) => {
  await open(page, fighter('r14e1-h', [item('Book of Vile Darkness', true)]))
  await expect(score(page, 'strength')).toHaveText('15')
  await expect(score(page, 'charisma')).toHaveText('10')
  await expectAbilityBreakdown(page, 'Charisma', 'Book of Vile Darkness')
  await expectAbilityBreakdown(page, 'Strength', 'not applied: ability choice not supported')
})

test('R14e1 i: Level up works from the base Strength, not the belt', async ({ page }) => {
  // With the belt's 21 counted, +2 Strength would be marked "(would exceed 20)"; from base 15 it is offered.
  await open(page, fighter('r14e1-i', [item('Belt of Hill Giant Strength', true)], {}, { classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 3 }] }))
  await expect(score(page, 'strength')).toHaveText('21')
  await page.getByRole('button', { name: 'Level up to 4' }).click()
  await takeAllFighterLevel4Picks(page)
  const level4 = page.getByRole('group', { name: 'Level 4' })
  for (let steps = 0; steps < 8 && !(await level4.isVisible()); steps++) await next(page)
  await featOrAsiSelect(page, 4).selectOption('asi')
  const strength = level4.getByRole('combobox', { name: 'Level 4 +2 ability', exact: true }).locator('option[value="strength"]')
  await expect(strength).toHaveText('Strength')
  await expect(strength).toBeEnabled()
})
