import { expect, test, type Locator, type Page } from '@playwright/test'
import { next, wizardNav } from './wizard.ts'

/*
 * R14b (D217). A Human Fighter 3 seeded at the current schema, as customItemModes.spec.ts: STR 15, DEX 14,
 * CON 13, INT 8, WIS 12, PB +2, no skill proficiencies — so Intelligence save -1, Stealth +2.
 */
const STORAGE_KEY = 'familliar:characters'
const NOT_ATTUNED = 'requires attunement and you are not attuned to it'

function fighter(id: string, inventory: Record<string, unknown>[] = [], extra: Record<string, unknown> = {}) {
  return {
    schemaVersion: 54,
    id,
    name: `Fighter ${id}`,
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
    species: { name: 'Human', source: 'XPHB' },
    abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
    inventory,
    ...extra,
  }
}

function customRow(name: string, definition: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { name, source: 'custom', quantity: 1, custom: { name, kind: 'other', ...definition }, ...extra }
}

async function open(page: Page, character: { id: string }): Promise<void> {
  await page.addInitScript(
    ({ key, payload }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, payload)
    },
    { key: STORAGE_KEY, payload: JSON.stringify([character]) },
  )
  await page.goto(`/#/character/${character.id}`)
}

async function openManage(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Inventory' }).click()
  await page.getByRole('button', { name: 'Manage Inventory', exact: true }).click()
  return page.getByRole('dialog', { name: 'Manage Inventory' })
}

async function startCustomItem(page: Page, name: string): Promise<Locator> {
  const panel = await openManage(page)
  await panel.locator('summary', { hasText: 'Create a custom item' }).click()
  await panel.getByLabel('Custom item name').fill(name)
  return panel
}

async function submitCustomItem(page: Page, panel: Locator): Promise<void> {
  await panel.getByRole('button', { name: 'Add custom item' }).click()
  await page.keyboard.press('Escape')
}

/** One proficiency row: a kind, then a value picked by its visible label (or, for a tool, by a pattern — the exact name is item data). */
async function addProficiency(panel: Locator, n: number, kind: string, value: string | RegExp): Promise<void> {
  await panel.getByRole('button', { name: '+ Add proficiency' }).click()
  await panel.getByRole('combobox', { name: `Custom item proficiency ${n} kind` }).selectOption({ label: kind })
  const select = panel.getByRole('combobox', { name: `Custom item proficiency ${n} value` })
  if (typeof value === 'string') {
    await select.selectOption({ label: value })
    return
  }
  const option = select.locator('option', { hasText: value })
  await expect(option).toHaveCount(1)
  await select.selectOption((await option.getAttribute('value')) ?? '')
}

const save = (page: Page, ability: string): Locator => page.getByRole('button', { name: `Roll ${ability} saving throw` })
const skill = (page: Page, name: string): Locator => page.getByRole('button', { name: `Roll ${name} check` })
const defenses = (page: Page): Locator => page.locator('.sheet__defenses')
const savingThrows = (page: Page): Locator => page.locator('.sheet__saving-throws')
const proficienciesCard = (page: Page): Locator => page.locator('.sheet__proficiencies')

async function expectBreakdown(page: Page, button: string, dialog: string, text: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: button, exact: true }).click()
  await expect(page.getByRole('dialog', { name: dialog, exact: true })).toContainText(text)
  await page.keyboard.press('Escape')
}

test('R14b a: Language, Tool, Saving throw and Skill (Expertise) proficiencies from Add Custom Item reach the card, the INT save and Stealth', async ({ page }) => {
  await open(page, fighter('r14b-a'))
  await expect(save(page, 'Intelligence')).toHaveText('-1')
  await expect(skill(page, 'Stealth')).toHaveText('+2')

  const panel = await startCustomItem(page, 'Shadow Ring')
  await addProficiency(panel, 1, 'Language', 'Elvish')
  await addProficiency(panel, 2, 'Tool', /Thieves/)
  await addProficiency(panel, 3, 'Saving throw', 'Intelligence')
  await addProficiency(panel, 4, 'Skill', 'Stealth')
  await panel.getByRole('combobox', { name: 'Custom item proficiency 4 level' }).selectOption({ label: 'Expertise' })
  await submitCustomItem(page, panel)

  await expect(proficienciesCard(page)).toContainText('Elvish')
  await expect(proficienciesCard(page)).toContainText(/Thieves.? Tools/)
  await page.getByRole('button', { name: 'Proficiencies details' }).click()
  const drawer = page.getByRole('dialog', { name: 'Proficiencies', exact: true })
  await expect(drawer).toContainText('Elvish — Shadow Ring')
  await expect(drawer).toContainText(/Thieves.? Tools — Shadow Ring/)
  await page.keyboard.press('Escape')

  await expect(save(page, 'Intelligence')).toHaveText('+1')
  await expectBreakdown(page, 'Intelligence saving throw breakdown', 'Intelligence saving throw', 'proficiency (Shadow Ring)')
  // DEX +2 and expertise 2 × PB 2.
  await expect(skill(page, 'Stealth')).toHaveText('+6')
  await expectBreakdown(page, 'Stealth breakdown', 'Stealth', 'expertise (Shadow Ring)')
})

test('R14b b: Weapon category Martial gives a Wizard holding a Longsword the proficiency bonus on the hit', async ({ page }) => {
  const wizard = fighter('r14b-b', [{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' }], {
    classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 3 }],
  })
  await open(page, wizard)
  await page.getByRole('tab', { name: 'Actions' }).click()
  // STR +2 and nothing else: a Wizard has no martial weapons.
  await expect(page.getByRole('button', { name: 'Roll Longsword to hit' })).toHaveText('+2')

  const panel = await startCustomItem(page, 'War Charm')
  await addProficiency(panel, 1, 'Weapon category', 'Martial')
  await submitCustomItem(page, panel)
  await page.getByRole('tab', { name: 'Actions' }).click()
  await expect(page.getByRole('button', { name: 'Roll Longsword to hit' })).toHaveText('+4')
})

test('R14b c: Vulnerabilities Fire shows on the Defenses card', async ({ page }) => {
  await open(page, fighter('r14b-c'))
  await expect(defenses(page)).toContainText('—')
  const panel = await startCustomItem(page, 'Brittle Charm')
  await panel.getByRole('checkbox', { name: 'Custom item vulnerabilities: Fire' }).check()
  await submitCustomItem(page, panel)
  await expect(defenses(page)).toContainText('Vulnerable: Fire')
})

test('R14b d: Condition immunity Frightened shows as Immune on Defenses and as a note in the Conditions drawer, which still switches it on', async ({ page }) => {
  await open(page, fighter('r14b-d'))
  const panel = await startCustomItem(page, 'Brave Cloak')
  await panel.getByRole('checkbox', { name: 'Custom item condition immunities: Frightened' }).check()
  await submitCustomItem(page, panel)

  await expect(defenses(page)).toContainText('Immune: Frightened')
  await page.getByRole('button', { name: 'Defenses details' }).click()
  await expect(page.getByRole('dialog', { name: 'Defenses', exact: true })).toContainText('Frightened — condition immunity (Brave Cloak)')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: '+ Add condition' }).click()
  const drawer = page.getByRole('dialog', { name: 'Conditions', exact: true })
  await expect(drawer.locator('li', { hasText: 'Frightened' })).toContainText('immune (Brave Cloak)')
  await expect(drawer.locator('li', { hasText: 'Charmed' })).not.toContainText('immune')
  const toggle = drawer.getByRole('button', { name: 'Toggle Frightened' })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
})

test('R14b e: Advantage on saves against Charmed is a note under Saving Throws', async ({ page }) => {
  await open(page, fighter('r14b-e'))
  await expect(savingThrows(page)).not.toContainText('Advantage on saving throws')
  const panel = await startCustomItem(page, 'Charm Band')
  await panel.getByRole('checkbox', { name: 'Custom item advantage on saves against: Charmed' }).check()
  await panel.getByRole('checkbox', { name: 'Custom item advantage on saves against: Frightened' }).check()
  await submitCustomItem(page, panel)
  await expect(savingThrows(page)).toContainText('Advantage on saving throws against Charmed, Frightened (Charm Band)')
})

test('R14b f: the same item requiring attunement applies nothing until Attune, then everything', async ({ page }) => {
  const ring = customRow('Shadow Ring', {
    requiresAttunement: true,
    proficiencies: [
      { kind: 'language', language: 'Elvish' },
      { kind: 'savingThrow', ability: 'intelligence' },
      { kind: 'skill', skill: 'stealth', expertise: true },
    ],
    vulnerable: ['fire'],
    conditionImmune: ['Frightened'],
    conditionAdvantage: ['Charmed'],
  })
  await open(page, fighter('r14b-f', [ring]))

  await expect(proficienciesCard(page)).not.toContainText('Elvish')
  await expect(save(page, 'Intelligence')).toHaveText('-1')
  await expect(skill(page, 'Stealth')).toHaveText('+2')
  await expect(defenses(page)).not.toContainText('Vulnerable')
  await expect(defenses(page)).not.toContainText('Immune')
  await expect(savingThrows(page)).not.toContainText('Advantage on saving throws')
  await expectBreakdown(page, 'Intelligence saving throw breakdown', 'Intelligence saving throw', `Shadow Ring: considered (saving throw proficiency) — not applied: ${NOT_ATTUNED}`)
  await expectBreakdown(page, 'Stealth breakdown', 'Stealth', `Shadow Ring: considered (expertise) — not applied: ${NOT_ATTUNED}`)
  await expectBreakdown(page, 'Defenses details', 'Defenses', `Shadow Ring: ${NOT_ATTUNED}`)
  await page.getByRole('button', { name: '+ Add condition' }).click()
  await expect(page.getByRole('dialog', { name: 'Conditions', exact: true })).not.toContainText('immune (')
  await page.keyboard.press('Escape')

  const panel = await openManage(page)
  await panel.getByRole('button', { name: 'Attune to Shadow Ring' }).click()
  await page.keyboard.press('Escape')

  await expect(proficienciesCard(page)).toContainText('Elvish')
  await expect(save(page, 'Intelligence')).toHaveText('+1')
  await expect(skill(page, 'Stealth')).toHaveText('+6')
  await expect(defenses(page)).toContainText('Vulnerable: Fire')
  await expect(defenses(page)).toContainText('Immune: Frightened')
  await expect(savingThrows(page)).toContainText('Advantage on saving throws against Charmed (Shadow Ring)')
  await page.getByRole('button', { name: '+ Add condition' }).click()
  await expect(page.getByRole('dialog', { name: 'Conditions', exact: true }).locator('li', { hasText: 'Frightened' })).toContainText('immune (Shadow Ring)')
})

test('R14b g: a used proficiency is not offered in another row; the Proficient / Expertise select is only on Skill rows', async ({ page }) => {
  await open(page, fighter('r14b-g'))
  const panel = await startCustomItem(page, 'Form Probe')
  await addProficiency(panel, 1, 'Saving throw', 'Wisdom')
  await panel.getByRole('button', { name: '+ Add proficiency' }).click()
  await panel.getByRole('combobox', { name: 'Custom item proficiency 2 kind' }).selectOption({ label: 'Saving throw' })
  const second = panel.getByRole('combobox', { name: 'Custom item proficiency 2 value' })
  await expect(second.locator('option[value="wisdom"]')).toHaveCount(0)
  await expect(second.locator('option[value="charisma"]')).toHaveCount(1)
  // Row 1 still shows its own pick.
  await expect(panel.getByRole('combobox', { name: 'Custom item proficiency 1 value' }).locator('option[value="wisdom"]')).toHaveCount(1)

  await expect(panel.getByRole('combobox', { name: 'Custom item proficiency 1 level' })).toHaveCount(0)
  await panel.getByRole('combobox', { name: 'Custom item proficiency 2 kind' }).selectOption({ label: 'Skill' })
  await expect(panel.getByRole('combobox', { name: 'Custom item proficiency 2 level' })).toBeVisible()
  await panel.getByRole('combobox', { name: 'Custom item proficiency 2 kind' }).selectOption({ label: 'Armor' })
  await expect(panel.getByRole('combobox', { name: 'Custom item proficiency 2 level' })).toHaveCount(0)
})

test('R14b h: the level-up Hit points step shows the maximum with the item bonus, the number the sheet shows after saving', async ({ page }) => {
  const pin = customRow('Lucky Pin', { bonuses: [{ target: 'maxHitPoints', amount: 1, perLevel: true }] })
  // Fighter 4: 10 + 3 × 6 + 4 × 1 = 32, +4 from the pin = 36. Level 5 with the average is 44 (+7 level, +1 pin).
  const character = fighter('r14b-h', [pin], {
    classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 4 }],
    featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }],
    currentHp: 36,
  })
  await open(page, character)

  await page.getByRole('button', { name: 'Level up to 5' }).click()
  const saveButton = wizardNav(page).getByRole('button', { name: 'Save level 5' })
  let checkedTotal = false
  for (let steps = 0; steps < 8 && !(await saveButton.isVisible()); steps++) {
    const average = page.getByRole('radio', { name: 'Average (6)' })
    if (await average.isVisible()) {
      await average.check()
      await expect(page.locator('.hit-points-picker__running-total')).toContainText('44')
      checkedTotal = true
    }
    await next(page)
  }
  expect(checkedTotal).toBe(true)
  await saveButton.click()
  await expect(page).toHaveURL(/#\/character\/[^/]+$/)
  await expect(page.locator('.sheet__hit-points-value').first()).toHaveText('44 / 44')
})
