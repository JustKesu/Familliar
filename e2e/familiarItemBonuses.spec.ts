import { expect, test, type Locator, type Page } from '@playwright/test'

/*
 * R14d (D220). A Wizard 3 with Find Familiar and a stored Owl familiar, seeded at
 * schema 54. Every base number is read from the app before an item is added, so
 * nothing here hardcodes the Owl's stat block.
 */
const STORAGE_KEY = 'familliar:characters'
const LEVEL = 3

function wizard(id: string, extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 54,
    id,
    name: `Wizard ${id}`,
    classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: LEVEL }],
    abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 } },
    spellChoices: [{ className: 'Wizard', classSource: 'XPHB', spells: [{ name: 'Find Familiar', source: 'XPHB' }] }],
    familiar: { name: 'Owl', source: 'XMM' },
    ...extra,
  }
}

async function open(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
  await page.getByRole('tab', { name: 'Extras' }).click()
}

const tab = (page: Page): Locator => page.getByRole('tabpanel', { name: 'Extras' })
const familiarRow = (page: Page): Locator => tab(page).locator('.extras-tab__item').first()
const cells = (page: Page): Locator => familiarRow(page).locator('.extras-tab__cell')
const hpButton = (page: Page): Locator => tab(page).getByRole('button', { name: 'Owl hit points' })
const statBlock = (page: Page): Locator => page.getByRole('dialog', { name: 'Owl', exact: true })

interface Base {
  ac: number
  hp: number
  walk: number
}

async function hpPair(page: Page): Promise<{ current: number; max: number }> {
  const match = /(\d+)\s*\/\s*(\d+)/.exec(await hpButton(page).innerText())
  if (!match) throw new Error('familiar HP cell has no "current / max"')
  return { current: Number(match[1]), max: Number(match[2]) }
}

async function readBase(page: Page): Promise<Base> {
  const walk = /^(\d+)/.exec(await cells(page).nth(2).innerText())
  return { ac: Number(await cells(page).nth(0).innerText()), hp: (await hpPair(page)).max, walk: Number(walk?.[1]) }
}

/** Creates a custom item in Manage Inventory with the given Familiar bonuses, then returns to the Extras tab. */
async function addItem(page: Page, name: string, bonuses: { label: string; amount: number; perLevel?: true }[], requiresAttunement = false): Promise<void> {
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  const panel = page.getByRole('dialog', { name: 'Manage Inventory' })
  await panel.locator('summary', { hasText: 'Create a custom item' }).click()
  await panel.getByLabel('Custom item name').fill(name)
  if (requiresAttunement) await panel.getByRole('checkbox', { name: 'Custom item requires attunement' }).check()
  for (const [index, bonus] of bonuses.entries()) {
    const n = index + 1
    await panel.getByRole('button', { name: '+ Add bonus' }).click()
    await panel.getByRole('combobox', { name: `Custom item bonus ${n} target` }).selectOption({ label: bonus.label })
    await panel.getByRole('spinbutton', { name: `Custom item bonus ${n} amount` }).fill(String(bonus.amount))
    if (bonus.perLevel) await panel.getByRole('checkbox', { name: `Custom item bonus ${n} per level` }).check()
  }
  await panel.getByRole('button', { name: 'Add custom item' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Extras' }).click()
}

async function openStatBlock(page: Page): Promise<Locator> {
  await familiarRow(page).getByRole('button', { name: 'Owl', exact: true }).click()
  return statBlock(page)
}

/** The first attack's to-hit number and hit damage, as the stat block prints them. */
async function firstAttack(dialog: Locator): Promise<{ hit: number; damage: number }> {
  const text = await dialog.locator('.beast__blocks', { has: dialog.page().getByRole('heading', { name: 'Actions' }) }).innerText()
  const hit = /Attack Roll:\s*([+-]\d+)/.exec(text)
  const damage = /Hit:\s*(\d+)/.exec(text)
  if (!hit || !damage) throw new Error(`no attack in: ${text.slice(0, 200)}`)
  return { hit: Number(hit[1]), damage: Number(damage[1]) }
}

test('R14d a: Familiar AC +2, max HP +5 and walking speed +10 change the Extras row and the stat block, and the drawer lists the item', async ({ page }) => {
  await open(page, wizard('r14d-a'))
  const base = await readBase(page)
  await addItem(page, 'Familiar Charm', [
    { label: 'Familiar: AC', amount: 2 },
    { label: 'Familiar: Max HP', amount: 5 },
    { label: 'Familiar: Walking speed', amount: 10 },
  ])

  await expect(cells(page).nth(0)).toHaveText(String(base.ac + 2))
  await expect(hpButton(page)).toHaveText(new RegExp(`^${base.hp + 5}\\s*/\\s*${base.hp + 5}$`))
  await expect(cells(page).nth(2)).toContainText(new RegExp(`^${base.walk + 10} ft`))

  const dialog = await openStatBlock(page)
  const vitals = dialog.locator('.beast__vitals')
  await expect(vitals).toContainText(`AC ${base.ac + 2}`)
  await expect(vitals).toContainText(new RegExp(`HP ${base.hp + 5}\\b`))
  await expect(vitals).toContainText(new RegExp(`Speed ${base.walk + 10} ft`))
  await expect(dialog).toContainText(/Bonuses from items\s+Familiar Charm: AC \+2, max HP \+5, walking speed \+10/)
})

test('R14d b: Familiar attack +1 and damage +1 raise the numbers in the action text', async ({ page }) => {
  await open(page, wizard('r14d-b'))
  let dialog = await openStatBlock(page)
  const before = await firstAttack(dialog)
  await page.keyboard.press('Escape')

  await addItem(page, 'Fang Charm', [
    { label: 'Familiar: Attack rolls', amount: 1 },
    { label: 'Familiar: Damage rolls', amount: 1 },
  ])
  dialog = await openStatBlock(page)
  expect(await firstAttack(dialog)).toEqual({ hit: before.hit + 1, damage: before.damage + 1 })
})

test('R14d c: Familiar saving throws +1 list all six saves with the bonus on the ability modifier', async ({ page }) => {
  await open(page, wizard('r14d-c'))
  let dialog = await openStatBlock(page)
  await expect(dialog.locator('.beast__line', { hasText: 'Saves' })).toHaveCount(0)
  const modifiers = (await dialog.locator('.beast__ability-modifier').allInnerTexts()).map((text) => Number(/-?\d+/.exec(text.replace('+', ''))?.[0]))
  await page.keyboard.press('Escape')

  await addItem(page, 'Ward Charm', [{ label: 'Familiar: Saving throws (all)', amount: 1 }])
  dialog = await openStatBlock(page)
  const labels = ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha']
  const expected = labels.map((label, i) => `${label} ${modifiers[i] + 1 >= 0 ? '+' : ''}${modifiers[i] + 1}`).join(', ')
  await expect(dialog.locator('.beast__line', { hasText: 'Saves' })).toHaveText(`Saves ${expected}`)
})

test('R14d d: an unattuned item that requires attunement changes nothing and is listed as not applied; Attune applies it', async ({ page }) => {
  await open(page, wizard('r14d-d'))
  const base = await readBase(page)
  await addItem(page, 'Bonded Collar', [{ label: 'Familiar: AC', amount: 2 }], true)

  await expect(cells(page).nth(0)).toHaveText(String(base.ac))
  let dialog = await openStatBlock(page)
  await expect(dialog).toContainText(/Bonded Collar: AC \+2 — not applied: not attuned/)
  await page.keyboard.press('Escape')

  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  await page.getByRole('dialog', { name: 'Manage Inventory' }).getByRole('button', { name: 'Attune to Bonded Collar' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Extras' }).click()

  await expect(cells(page).nth(0)).toHaveText(String(base.ac + 2))
  dialog = await openStatBlock(page)
  await expect(dialog).toContainText(/Bonded Collar: AC \+2/)
  await expect(dialog).not.toContainText('not applied')
})

test('R14d e: Familiar max HP +1 per level adds the character level to the maximum', async ({ page }) => {
  await open(page, wizard('r14d-e'))
  const base = await readBase(page)
  await addItem(page, 'Growth Charm', [{ label: 'Familiar: Max HP', amount: 1, perLevel: true }])
  await expect(hpButton(page)).toHaveText(new RegExp(`\\s*/\\s*${base.hp + LEVEL}$`))
  const dialog = await openStatBlock(page)
  await expect(dialog).toContainText(/Growth Charm: max HP \+1 per level \(\+3\)/)
})

test('R14d f: removing the item clamps a stored current HP that equalled the raised maximum', async ({ page }) => {
  await open(page, wizard('r14d-f'))
  const base = await readBase(page)
  await addItem(page, 'Vigor Charm', [{ label: 'Familiar: Max HP', amount: 5 }])
  await expect(hpButton(page)).toHaveText(new RegExp(`^${base.hp + 5}\\s*/\\s*${base.hp + 5}$`))

  // Damage then Heal writes an explicit current HP equal to the raised maximum.
  await hpButton(page).click()
  const panel = page.getByRole('dialog', { name: 'Owl — Hit Points' })
  for (const action of ['Damage', 'Heal'] as const) {
    await panel.getByRole('spinbutton', { name: 'Amount' }).fill('1')
    await panel.getByRole('button', { name: action, exact: true }).click()
  }
  await expect(panel.locator('.familiar-hp__value')).toHaveText(`${base.hp + 5} / ${base.hp + 5}`)
  await page.keyboard.press('Escape')

  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  await page.getByRole('dialog', { name: 'Manage Inventory' }).getByRole('button', { name: 'Remove Vigor Charm from inventory' }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Extras' }).click()
  await expect(hpButton(page)).toHaveText(new RegExp(`^${base.hp}\\s*/\\s*${base.hp}$`))
})

test('R14d g: a Wild Shape row of the same creature and the Manage Extras stat block stay unchanged with the item held', async ({ page }) => {
  const charm = { name: 'Familiar Charm', source: 'custom', quantity: 1, custom: { name: 'Familiar Charm', kind: 'other', bonuses: [{ target: 'familiarArmourClass', amount: 2 }] } }
  await open(
    page,
    wizard('r14d-g', {
      classes: [{ className: 'Druid', classSource: 'XPHB', subclass: null, level: 2 }],
      spellChoices: [{ className: 'Druid', classSource: 'XPHB', spells: [{ name: 'Find Familiar', source: 'XPHB' }] }],
      wildShapeForms: [{ className: 'Druid', classSource: 'XPHB', forms: [{ name: 'Owl', source: 'XMM' }] }],
      inventory: [charm],
    }),
  )
  const rows = tab(page).locator('.extras-tab__item')
  await expect(rows).toHaveCount(2)
  const wildAc = Number(await rows.nth(1).locator('.extras-tab__cell').nth(0).innerText())
  await expect(rows.nth(0).locator('.extras-tab__cell').nth(0)).toHaveText(String(wildAc + 2))

  await rows.nth(1).getByRole('button', { name: 'Owl', exact: true }).click()
  await expect(statBlock(page).locator('.beast__vitals')).toContainText(`AC ${wildAc}`)
  await expect(statBlock(page)).not.toContainText('Bonuses from items')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Manage Extras', exact: true }).click()
  const manage = page.getByRole('dialog', { name: 'Manage Extras' })
  await manage.getByRole('button', { name: 'Owl stat block' }).first().click()
  await expect(manage.locator('.beast__vitals').first()).toContainText(`AC ${wildAc}`)
  await expect(manage).not.toContainText('Bonuses from items')
})
